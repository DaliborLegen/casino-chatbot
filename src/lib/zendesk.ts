import crypto from "node:crypto";
import { stripMarkdown } from "@/lib/format";

// Zendesk Messaging runs on Sunshine Conversations. Unlike LiveChat, the bot is
// not an agent in a queue — it is a switchboard integration that receives every
// message first and hands control to Agent Workspace during support hours.
// Docs shape: POST /sc/v2/apps/{appId}/conversations/{id}/messages and .../passControl.

export interface ZendeskConfig {
  subdomain: string;
  appId: string;
  keyId: string;
  secret: string;
  /** Our own switchboard integration id — we only reply while it holds control. */
  botSwitchboardId: string;
}

/** Returns the config, or null when the integration isn't provisioned yet. */
export function getZendeskConfig(): ZendeskConfig | null {
  const subdomain = process.env.ZENDESK_SUBDOMAIN;
  const appId = process.env.ZENDESK_APP_ID;
  const keyId = process.env.ZENDESK_KEY_ID;
  const secret = process.env.ZENDESK_SECRET;
  const botSwitchboardId = process.env.ZENDESK_BOT_SWITCHBOARD_ID;

  if (!subdomain || !appId || !keyId || !secret || !botSwitchboardId) return null;
  return { subdomain, appId, keyId, secret, botSwitchboardId };
}

function authHeader(cfg: ZendeskConfig): string {
  return `Basic ${Buffer.from(`${cfg.keyId}:${cfg.secret}`).toString("base64")}`;
}

function apiBase(cfg: ZendeskConfig): string {
  return `https://${cfg.subdomain}.zendesk.com/sc/v2/apps/${cfg.appId}`;
}

async function zendeskFetch(
  cfg: ZendeskConfig,
  path: string,
  init: { method: "GET" | "POST" | "PATCH"; body?: unknown }
): Promise<unknown> {
  // One retry on a transient failure: a dropped passControl would leave the
  // guest waiting for an agent who never gets the conversation. Both calls we
  // make are safe to repeat (passControl to the same target is idempotent in
  // effect, and a duplicate is rejected rather than doubling anything).
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${apiBase(cfg)}${path}`, {
        method: init.method,
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader(cfg),
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === 1) {
        await new Promise((r) => setTimeout(r, 700));
        continue;
      }
      throw lastError;
    }

    const text = await res.text();
    if (res.ok) return text ? JSON.parse(text) : {};

    lastError = new Error(`Zendesk API ${init.method} ${path} failed: ${res.status} ${text}`);
    const transient = res.status === 429 || res.status >= 500;
    if (attempt === 1 && transient) {
      console.warn("Zendesk API transient failure, retrying", { path, status: res.status });
      await new Promise((r) => setTimeout(r, 700));
      continue;
    }
    throw lastError;
  }

  throw lastError ?? new Error(`Zendesk API ${init.method} ${path} failed`);
}

/** Posts a bot reply into the conversation. */
export async function postBusinessMessage(
  cfg: ZendeskConfig,
  conversationId: string,
  text: string
): Promise<void> {
  await zendeskFetch(cfg, `/conversations/${conversationId}/messages`, {
    method: "POST",
    body: {
      author: { type: "business" },
      content: { type: "text", text: stripMarkdown(text) },
    },
  });
}

/**
 * Asks the guest for a name and an email through a native form message.
 *
 * Until 8 September 2026 Zendesk's own AnswerBot did this via a proactive
 * welcome greeting; with that greeting gone, conversations reached the agents
 * with no contact details. Web Widget renders `form` inline and answers with a
 * `formResponse` message, which the webhook picks up like any other message.
 */
export async function sendContactForm(
  cfg: ZendeskConfig,
  conversationId: string,
  intro: string
): Promise<void> {
  await postBusinessMessage(cfg, conversationId, intro);
  await zendeskFetch(cfg, `/conversations/${conversationId}/messages`, {
    method: "POST",
    body: {
      author: { type: "business" },
      content: {
        type: "form",
        // Locks the text input until the form is submitted, the way LiveChat's
        // pre-chat form did. The webhook still nudges anyone who gets a message
        // through another channel, so nobody ends up unable to reach support.
        blockChatInput: true,
        fields: [
          { type: "text", name: "name", label: "Ime in priimek" },
          { type: "email", name: "email", label: "E-poštni naslov" },
        ],
      },
    },
  });
}

/**
 * Writes the collected details onto the Sunshine user, so the agent sees a
 * named guest rather than an anonymous visitor. Best effort: `passControl`
 * metadata carries the same values, and Zendesk ignores unknown profile fields.
 */
export async function updateUserProfile(
  cfg: ZendeskConfig,
  userId: string,
  contact: { name?: string; email?: string }
): Promise<void> {
  const [givenName, ...rest] = (contact.name ?? "").trim().split(/\s+/).filter(Boolean);
  const profile: Record<string, string> = {};
  if (givenName) profile.givenName = givenName;
  if (rest.length) profile.surname = rest.join(" ");
  if (contact.email) profile.email = contact.email;
  if (Object.keys(profile).length === 0) return;

  await zendeskFetch(cfg, `/users/${userId}`, { method: "PATCH", body: { profile } });
}

/**
 * Hands the conversation to a named switchboard integration, e.g. back to
 * Zendesk's own answerBot for brands our bot does not serve yet.
 */
export async function passControlToIntegration(
  cfg: ZendeskConfig,
  conversationId: string,
  switchboardIntegration: string
): Promise<void> {
  await zendeskFetch(cfg, `/conversations/${conversationId}/passControl`, {
    method: "POST",
    body: { switchboardIntegration },
  });
}

/**
 * Hands the conversation to the next switchboard integration (Agent Workspace).
 * `nextSwitchboardIntegrationId` must be configured on our integration in Zendesk.
 */
export async function passControlToAgent(
  cfg: ZendeskConfig,
  conversationId: string,
  opts: {
    firstMessageId?: string;
    /**
     * Where the conversation goes. "next" is our configured neighbour (Agent
     * Workspace); naming zd-answerBot instead lets Zendesk's own bot run its
     * pre-chat flow, which asks the guest for an email before an agent takes over.
     */
    target?: string;
    /** Collected pre-chat details, mapped onto the ticket's requester fields. */
    contact?: { name?: string; email?: string };
  } = {}
): Promise<void> {
  const { firstMessageId, target = "next", contact } = opts;
  await zendeskFetch(cfg, `/conversations/${conversationId}/passControl`, {
    method: "POST",
    body: {
      switchboardIntegration: target,
      metadata: {
        "dataCapture.systemField.tags": "chatbot,handoff",
        ...(firstMessageId ? { first_message_id: firstMessageId } : {}),
        // Zendesk maps dataCapture.systemField.* onto the ticket it creates at
        // handoff. The email is not honoured on every plan, which is why we
        // also write it to the guest's Sunshine profile.
        ...(contact?.name ? { "dataCapture.systemField.requester.name": contact.name } : {}),
        ...(contact?.email ? { "dataCapture.systemField.requester.email": contact.email } : {}),
        origin_source_type: "web",
      },
    },
  });
}

interface ConversationResponse {
  conversation?: {
    brandId?: string;
    activeSwitchboardIntegration?: { id?: string };
  };
}

/**
 * Reads which brand a conversation belongs to. The `conversation:create` event
 * doesn't name the channel integration, so the brand is what tells us which
 * casino just opened the widget.
 */
export async function getConversationBrandId(
  cfg: ZendeskConfig,
  conversationId: string
): Promise<string | null> {
  const data = (await zendeskFetch(cfg, `/conversations/${conversationId}`, {
    method: "GET",
  })) as ConversationResponse;
  return data.conversation?.brandId ?? null;
}

/**
 * Reads which integration currently controls the conversation. Used when the
 * webhook payload doesn't carry it, and to re-check before posting a reply that
 * took a while to generate (an agent may have taken over meanwhile).
 */
export async function getActiveSwitchboardId(
  cfg: ZendeskConfig,
  conversationId: string
): Promise<string | null> {
  const data = (await zendeskFetch(cfg, `/conversations/${conversationId}`, {
    method: "GET",
  })) as ConversationResponse;
  return data.conversation?.activeSwitchboardIntegration?.id ?? null;
}

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verifies the webhook came from Zendesk.
 *
 * Zendesk hands out either a shared secret (sent back as a header) or an
 * HMAC signature over the raw body, depending on how the integration is
 * created. We accept both so the exact scheme can be confirmed with Zendesk
 * without a code change; if no secret is configured, verification is skipped
 * and that is logged loudly.
 */
export function describeSignatureHeaders(headers: Headers): string[] {
  // Header names only, never values: enough to tell which scheme Zendesk uses
  // on the first real delivery, without writing a secret into the logs.
  const names: string[] = [];
  headers.forEach((_value, name) => {
    if (/signature|api-key|hmac|webhook|zendesk|sunshine|smooch/i.test(name)) names.push(name);
  });
  return names;
}

export function verifyWebhookSignature(rawBody: string, headers: Headers): boolean {
  const secret = process.env.ZENDESK_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("Zendesk webhook: ZENDESK_WEBHOOK_SECRET not set — request NOT verified");
    return true;
  }

  const apiKey = headers.get("x-api-key");
  if (apiKey) return timingSafeEqual(apiKey, secret);

  const signature =
    headers.get("x-zendesk-webhook-signature") ??
    headers.get("x-sunshine-conversations-signature");

  if (signature) {
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
    return timingSafeEqual(signature, expected);
  }

  console.warn("Zendesk webhook: no recognised signature header");
  return false;
}

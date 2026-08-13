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
  init: { method: "GET" | "POST"; body?: unknown }
): Promise<unknown> {
  const res = await fetch(`${apiBase(cfg)}${path}`, {
    method: init.method,
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(cfg),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Zendesk API ${init.method} ${path} failed: ${res.status} ${text}`);
  }
  return text ? JSON.parse(text) : {};
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
 * Hands the conversation to the next switchboard integration (Agent Workspace).
 * `nextSwitchboardIntegrationId` must be configured on our integration in Zendesk.
 */
export async function passControlToAgent(
  cfg: ZendeskConfig,
  conversationId: string,
  firstMessageId?: string
): Promise<void> {
  await zendeskFetch(cfg, `/conversations/${conversationId}/passControl`, {
    method: "POST",
    body: {
      switchboardIntegration: "next",
      metadata: {
        "dataCapture.systemField.tags": "chatbot,handoff",
        ...(firstMessageId ? { first_message_id: firstMessageId } : {}),
        origin_source_type: "web",
      },
    },
  });
}

interface ConversationResponse {
  conversation?: {
    activeSwitchboardIntegration?: { id?: string };
  };
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

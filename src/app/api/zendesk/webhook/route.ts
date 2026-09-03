import { NextRequest, NextResponse } from "next/server";
import { ensureConversation, fallbackReply, generateReply, recordAgentHandoff } from "@/lib/chat";
import { MAX_MESSAGE_LENGTH } from "@/lib/limits";
import { isSessionRateLimited } from "@/lib/rate-limit";
import { isSupportOpen } from "@/lib/support-hours";
import { isTenantId, type TenantId } from "@/lib/tenants";
import {
  describeSignatureHeaders,
  getActiveSwitchboardId,
  getZendeskConfig,
  passControlToAgent,
  passControlToIntegration,
  postBusinessMessage,
  verifyWebhookSignature,
  type ZendeskConfig,
} from "@/lib/zendesk";

export const runtime = "nodejs";
export const maxDuration = 30;

const ATTACHMENT_REPLY = "Priponke žal ne morem prebrati, prosim opišite svojo težavo.";

/**
 * Event ids already handled. Zendesk re-delivers events when a webhook is slow
 * or errors, and the same message must not be answered twice.
 *
 * In-memory, so it only dedupes within one serverless instance — enough for the
 * common retry burst. A cross-instance guard would need a Supabase table; add it
 * if duplicates show up in production.
 */
const seenEvents = new Map<string, number>();
const SEEN_TTL_MS = 10 * 60 * 1000;

function alreadyHandled(eventId: string): boolean {
  const now = Date.now();
  for (const [id, ts] of seenEvents) {
    if (now - ts > SEEN_TTL_MS) seenEvents.delete(id);
  }
  if (seenEvents.has(eventId)) return true;
  seenEvents.set(eventId, now);
  return false;
}

/**
 * Serialises processing per conversation so two quick messages can't race each
 * other into a double reply or a double handoff.
 */
const conversationLocks = new Map<string, Promise<void>>();

function withConversationLock(conversationId: string, task: () => Promise<void>): Promise<void> {
  const previous = conversationLocks.get(conversationId) ?? Promise.resolve();
  const next = previous.then(task, task).finally(() => {
    if (conversationLocks.get(conversationId) === next) conversationLocks.delete(conversationId);
  });
  conversationLocks.set(conversationId, next);
  return next;
}

interface ZendeskEvent {
  id?: string;
  type?: string;
  payload?: {
    conversation?: {
      id?: string;
      _id?: string;
      activeSwitchboardIntegration?: { id?: string };
    };
    message?: {
      id?: string;
      _id?: string;
      author?: { type?: string };
      content?: { type?: string; text?: string };
      /** Which channel integration the message came in through (one per brand). */
      source?: { type?: string; integrationId?: string };
    };
  };
}

interface ZendeskWebhookBody {
  events?: ZendeskEvent[];
}

function conversationIdOf(event: ZendeskEvent): string | undefined {
  return event.payload?.conversation?.id ?? event.payload?.conversation?._id;
}

function messageIdOf(event: ZendeskEvent): string | undefined {
  return event.payload?.message?.id ?? event.payload?.message?._id;
}

function defaultTenant(): TenantId {
  const configured = process.env.ZENDESK_TENANT;
  return isTenantId(configured) ? configured : "casino777";
}

/**
 * All three casinos share one Sunshine Conversations app, one web integration
 * per brand, so the integration the message arrived on decides which bot answers.
 * Format: "<integrationId>:<tenant>,<integrationId>:<tenant>".
 */
function tenantByIntegration(): Record<string, TenantId> {
  const raw = process.env.ZENDESK_TENANT_BY_INTEGRATION;
  if (!raw) return {};
  const map: Record<string, TenantId> = {};
  for (const pair of raw.split(",")) {
    const [id, name] = pair.split(":").map((s) => s.trim());
    if (id && isTenantId(name)) map[id] = name;
  }
  return map;
}

function tenantFor(event: ZendeskEvent): TenantId {
  const integrationId = event.payload?.message?.source?.integrationId;
  const mapped = integrationId ? tenantByIntegration()[integrationId] : undefined;
  if (!mapped && integrationId) {
    console.warn("Zendesk: unmapped source integration, using default tenant", { integrationId });
  }
  return mapped ?? defaultTenant();
}

/**
 * Which web integrations (brands) our bot actually serves. The switchboard's
 * default answerer is set per app, not per integration, so with all three
 * casinos in one Sunshine app every conversation reaches us first. Anything
 * outside this list is handed straight back to Zendesk's own answerBot, so the
 * brands we have not gone live with behave exactly as before.
 *
 * Empty or unset means: serve everything.
 */
function servedIntegrations(): string[] {
  return (process.env.ZENDESK_ONLY_INTEGRATIONS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function servesIntegration(integrationId: string | undefined): boolean {
  const allowed = servedIntegrations();
  if (allowed.length === 0) return true;
  // An unknown integration is not ours to answer for: better silent handback
  // than the wrong brand's bot replying.
  if (!integrationId) return false;
  return allowed.includes(integrationId);
}

/** True when our integration currently holds control of the conversation. */
async function botHasControl(
  cfg: ZendeskConfig,
  conversationId: string,
  fromPayload: string | undefined
): Promise<boolean> {
  const active = fromPayload ?? (await getActiveSwitchboardId(cfg, conversationId));
  // No switchboard configured yet (e.g. during first tests): treat as ours.
  if (!active) return true;
  return active === cfg.botSwitchboardId;
}

async function handleUserMessage(cfg: ZendeskConfig, event: ZendeskEvent): Promise<void> {
  const conversationId = conversationIdOf(event);
  if (!conversationId) return;

  const message = event.payload?.message;
  const content = message?.content;
  const sessionId = `zd_${conversationId}`;

  const activeFromPayload = event.payload?.conversation?.activeSwitchboardIntegration?.id;
  if (!(await botHasControl(cfg, conversationId, activeFromPayload))) {
    console.log("Zendesk: agent holds control, skipping", { conversationId });
    return;
  }

  const integrationId = message?.source?.integrationId;
  if (!servesIntegration(integrationId)) {
    console.log("Zendesk: brand not served by the bot, handing back", {
      conversationId,
      integrationId,
    });
    const fallback = process.env.ZENDESK_FALLBACK_SWITCHBOARD || "zd-answerBot";
    try {
      await passControlToIntegration(cfg, conversationId, fallback);
    } catch (err) {
      // The conversation must never stay parked on us: we do not answer for
      // this brand, so nobody would. Agent Workspace is the safe landing spot.
      console.error("Zendesk handback failed, passing to agents instead:", err);
      await passControlToAgent(cfg, conversationId, messageIdOf(event));
    }
    return;
  }

  const tenant = tenantFor(event);

  // Support hours → hand over to Agent Workspace, don't call the bot at all.
  if (isSupportOpen()) {
    try {
      await passControlToAgent(cfg, conversationId, messageIdOf(event));
      // Logged because a silent success looks exactly like a dropped event.
      console.log("Zendesk: handed to agents", { conversationId, integrationId });
      // Keep a trace in the history, otherwise daytime traffic is invisible in
      // the admin. Never let a bookkeeping failure undo a completed handoff.
      await recordAgentHandoff(sessionId, tenant, content?.type === "text" ? content.text : undefined).catch(
        (err) => console.error("Zendesk: handoff not recorded:", err)
      );
      return;
    } catch (err) {
      console.error("Zendesk passControl failed:", err);
      // Never leave the customer waiting on a handoff that didn't happen —
      // answer as the bot instead. Disable with ZENDESK_REPLY_ON_HANDOFF_FAILURE=0.
      if (process.env.ZENDESK_REPLY_ON_HANDOFF_FAILURE === "0") return;
    }
  }

  if (content?.type && content.type !== "text") {
    await postBusinessMessage(cfg, conversationId, ATTACHMENT_REPLY);
    return;
  }

  const text = content?.text?.trim();
  if (!text) return;
  if (text.length > MAX_MESSAGE_LENGTH) return;
  if (await isSessionRateLimited(sessionId)) return;

  let reply: string;
  try {
    await ensureConversation(sessionId, tenant);
    reply = await generateReply(sessionId, text, tenant);
  } catch (err) {
    // generateReply handles Claude failures itself, so this is the store failing.
    // Outside support hours nobody else answers, so still say something.
    console.error("Zendesk reply generation error:", err);
    reply = fallbackReply(tenant);
  }
  if (!reply) return;

  // Generating a reply takes seconds; an agent may have picked the chat up in
  // the meantime, so re-check control before speaking over them.
  if (!(await botHasControl(cfg, conversationId, undefined))) {
    console.log("Zendesk: control changed while generating, dropping reply", { conversationId });
    return;
  }

  await postBusinessMessage(cfg, conversationId, reply);
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!verifyWebhookSignature(rawBody, req.headers)) {
    // Nothing is processed, but ACK anyway: a 4xx makes Zendesk retry and can
    // get the webhook disabled, and until the first live delivery we can't be
    // sure which signature scheme they use. The header names tell us that.
    console.warn("Zendesk webhook: signature verification failed", {
      signatureHeaders: describeSignatureHeaders(req.headers),
    });
    return NextResponse.json({ ok: true, skipped: "bad-signature" });
  }

  const cfg = getZendeskConfig();
  if (!cfg) {
    // Not provisioned yet. ACK so Zendesk doesn't retry-storm the endpoint.
    console.warn("Zendesk webhook: integration not configured (missing env vars)");
    return NextResponse.json({ ok: true, skipped: "not-configured" });
  }

  let body: ZendeskWebhookBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const events = body.events ?? [];
  let handled = 0;

  for (const event of events) {
    if (event.type !== "conversation:message") continue;
    if (event.payload?.message?.author?.type !== "user") continue; // ignore our own + agent messages

    const eventId = event.id;
    if (eventId && alreadyHandled(eventId)) continue;

    const conversationId = conversationIdOf(event);
    if (!conversationId) continue;

    handled++;
    try {
      await withConversationLock(conversationId, () => handleUserMessage(cfg, event));
    } catch (err) {
      // Logged, but still ACK below: a 5xx makes Zendesk retry the whole batch,
      // which is what caused the LiveChat retry storm.
      console.error("Zendesk webhook processing error:", err);
    }
  }

  return NextResponse.json({ ok: true, received: events.length, handled });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "zendesk-webhook",
    configured: getZendeskConfig() !== null,
    supportOpen: isSupportOpen(),
  });
}

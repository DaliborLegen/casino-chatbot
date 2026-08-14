import { NextRequest, NextResponse } from "next/server";
import { ensureConversation, fallbackReply, generateReply } from "@/lib/chat";
import { MAX_MESSAGE_LENGTH } from "@/lib/limits";
import { isSessionRateLimited } from "@/lib/rate-limit";
import { isSupportOpen } from "@/lib/support-hours";
import { isTenantId, type TenantId } from "@/lib/tenants";
import {
  describeSignatureHeaders,
  getActiveSwitchboardId,
  getZendeskConfig,
  passControlToAgent,
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

function tenant(): TenantId {
  const configured = process.env.ZENDESK_TENANT;
  return isTenantId(configured) ? configured : "casino777";
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

  // Support hours → hand over to Agent Workspace, don't call the bot at all.
  if (isSupportOpen()) {
    try {
      await passControlToAgent(cfg, conversationId, messageIdOf(event));
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
    await ensureConversation(sessionId, tenant());
    reply = await generateReply(sessionId, text, tenant());
  } catch (err) {
    // generateReply handles Claude failures itself, so this is the store failing.
    // Outside support hours nobody else answers, so still say something.
    console.error("Zendesk reply generation error:", err);
    reply = fallbackReply(tenant());
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

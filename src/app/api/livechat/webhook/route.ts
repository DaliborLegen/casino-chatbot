import { NextRequest, NextResponse } from "next/server";
import { generateReply, getConversationTenant, ensureConversation } from "@/lib/chat";
import { sendTextMessage } from "@/lib/livechat";
import { MAX_MESSAGE_LENGTH } from "@/lib/limits";
import { isSessionRateLimited } from "@/lib/rate-limit";
import type { TenantId } from "@/lib/tenants";

// One LiveChat license serves all three casinos; groups route chats to the
// right brand. Group 1 = casino.si, group 3 = supercasino.si (verified from
// each site's LiveChat snippet). Unknown groups fall back to casino.
const GROUP_TENANT: Record<number, TenantId> = {
  1: "casino",
  3: "supercasino",
};

function tenantForGroups(groupIds: number[] | undefined): TenantId {
  for (const g of groupIds || []) {
    const t = GROUP_TENANT[g];
    if (t !== undefined) return t;
  }
  return "casino";
}

export const runtime = "nodejs";
export const maxDuration = 30;

interface LiveChatWebhook {
  webhook_id?: string;
  secret_key?: string;
  action?: string;
  payload?: {
    chat_id?: string;
    thread_id?: string;
    chat?: {
      id?: string;
    };
    event?: {
      id?: string;
      author_id?: string;
      type?: string;
      text?: string;
    };
  };
}

const NIGHT_WELCOME =
  "Naša ekipa je dosegljiva vsak dan med 8:00 in 24:00. Do takrat vam lahko pomagam jaz kot AI asistent.";

const ATTACHMENT_REPLY = "Priponke žal ne morem prebrati, prosim opišite svojo težavo.";

export async function POST(req: NextRequest) {
  const expectedSecret = process.env.LIVECHAT_WEBHOOK_SECRET;
  const botAgentId = process.env.LIVECHAT_BOT_AGENT_ID;

  if (!expectedSecret || !botAgentId) {
    console.error("LiveChat webhook misconfigured: missing env vars");
    return NextResponse.json({ error: "Misconfigured" }, { status: 500 });
  }

  let body: LiveChatWebhook;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.secret_key !== expectedSecret) {
    console.warn("LiveChat webhook: invalid secret_key");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (body.action === "incoming_chat") {
    const chatId = body.payload?.chat?.id ?? body.payload?.chat_id;
    if (!chatId) {
      return NextResponse.json({ ok: true, ignored: "no-chat-id" });
    }
    try {
      await sendTextMessage({ chat_id: chatId, text: NIGHT_WELCOME, bot_agent_id: botAgentId });
    } catch (err) {
      // Expected when the bot isn't a member of the chat (a human agent took it)
      // or the chat already closed. incoming_chat fires for every chat in the
      // license, so we ACK and skip instead of 500'ing — a 500 makes LiveChat
      // retry the webhook and trips the 5xx anomaly alarm.
      console.warn("LiveChat welcome skipped:", err);
      return NextResponse.json({ ok: true, skipped: "welcome-send-failed" });
    }
    return NextResponse.json({ ok: true, sent: "welcome" });
  }

  if (body.action !== "incoming_event") {
    return NextResponse.json({ ok: true, ignored: "action" });
  }

  const event = body.payload?.event;
  const chatId = body.payload?.chat_id;

  if (!event || !chatId) {
    return NextResponse.json({ ok: true, ignored: "no-event" });
  }

  // Ignore our own messages to prevent loops
  if (event.author_id === botAgentId) {
    return NextResponse.json({ ok: true, ignored: "self" });
  }

  const sessionId = `lc_${chatId}`;

  if (event.type === "file") {
    if (await isSessionRateLimited(sessionId)) {
      return NextResponse.json({ ok: true, ignored: "rate-limit" });
    }
    try {
      await sendTextMessage({ chat_id: chatId, text: ATTACHMENT_REPLY, bot_agent_id: botAgentId });
    } catch (err) {
      console.warn("LiveChat attachment reply skipped:", err);
      return NextResponse.json({ ok: true, skipped: "attachment-reply-failed" });
    }
    return NextResponse.json({ ok: true, sent: "attachment-reply" });
  }

  if (event.type !== "message" || !event.text) {
    return NextResponse.json({ ok: true, ignored: "non-message" });
  }

  if (event.text.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ ok: true, ignored: "too-long" });
  }

  if (await isSessionRateLimited(sessionId)) {
    return NextResponse.json({ ok: true, ignored: "rate-limit" });
  }

  try {
    const reply = await generateReply(sessionId, event.text);
    if (reply) {
      await sendTextMessage({ chat_id: chatId, text: reply, bot_agent_id: botAgentId });
    }
  } catch (err) {
    // Logged for visibility, but still ACK so LiveChat doesn't retry-storm the
    // webhook on a transient Claude/LiveChat failure (which would trip the 5xx alarm).
    console.error("LiveChat webhook processing error:", err);
    return NextResponse.json({ ok: true, skipped: "processing-failed" });
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "livechat-webhook" });
}

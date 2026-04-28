import { NextRequest, NextResponse } from "next/server";
import { generateReply } from "@/lib/chat";
import { sendTextMessage } from "@/lib/livechat";

export const runtime = "nodejs";
export const maxDuration = 30;

interface LiveChatWebhook {
  webhook_id?: string;
  secret_key?: string;
  action?: string;
  payload?: {
    chat_id?: string;
    thread_id?: string;
    event?: {
      id?: string;
      author_id?: string;
      type?: string;
      text?: string;
    };
  };
}

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

  if (body.action !== "incoming_event") {
    return NextResponse.json({ ok: true, ignored: "action" });
  }

  const event = body.payload?.event;
  const chatId = body.payload?.chat_id;

  if (!event || !chatId || event.type !== "message" || !event.text) {
    return NextResponse.json({ ok: true, ignored: "non-message" });
  }

  // Ignore our own messages to prevent loops
  if (event.author_id === botAgentId) {
    return NextResponse.json({ ok: true, ignored: "self" });
  }

  // TEMP verification test 2026-04-28 — remove after Dalibor confirms
  if (event.text.trim().toLowerCase() === "legen") {
    try {
      await sendTextMessage({ chat_id: chatId, text: "dalibor", bot_agent_id: botAgentId });
    } catch (err) {
      console.error("legen short-circuit send failed:", err);
    }
    return NextResponse.json({ ok: true, shortCircuit: "legen" });
  }

  try {
    const reply = await generateReply(`lc_${chatId}`, event.text);
    if (reply) {
      await sendTextMessage({ chat_id: chatId, text: reply, bot_agent_id: botAgentId });
    }
  } catch (err) {
    console.error("LiveChat webhook processing error:", err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "livechat-webhook" });
}

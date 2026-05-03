import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/lib/supabase";
import { buildSystemPrompt } from "@/lib/system-prompt";

export interface StoredMessage {
  role: "user" | "assistant";
  content: string;
}

const memorySessions = new Map<string, { messages: StoredMessage[]; lastActive: number }>();

if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [id, session] of memorySessions) {
      if (now - session.lastActive > 30 * 60 * 1000) memorySessions.delete(id);
    }
  }, 5 * 60 * 1000);
}

function hasSupabase(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function getMessagesFromSupabase(sid: string, userMessage: string): Promise<StoredMessage[]> {
  const supabase = getSupabase();

  let { data: conversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("session_id", sid)
    .single();

  if (!conversation) {
    const { data: newConvo } = await supabase
      .from("conversations")
      .insert({ session_id: sid })
      .select("id")
      .single();
    conversation = newConvo;
  }

  if (!conversation) throw new Error("Failed to create conversation");

  const { data: history } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true })
    .limit(19);

  await supabase.from("messages").insert({
    conversation_id: conversation.id,
    role: "user",
    content: userMessage,
  });

  const past: StoredMessage[] = (history || []).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
  while (past.length > 0 && past[past.length - 1].role === "user") past.pop();
  return [...past, { role: "user", content: userMessage }];
}

async function saveReplyToSupabase(sid: string, reply: string) {
  const supabase = getSupabase();
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("session_id", sid)
    .single();

  if (conversation) {
    await supabase.from("messages").insert({
      conversation_id: conversation.id,
      role: "assistant",
      content: reply,
    });
    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversation.id);
  }
}

function getMessagesFromMemory(sid: string, userMessage: string): StoredMessage[] {
  if (!memorySessions.has(sid)) {
    memorySessions.set(sid, { messages: [], lastActive: Date.now() });
  }
  const session = memorySessions.get(sid)!;
  session.lastActive = Date.now();
  while (session.messages.length > 0 && session.messages[session.messages.length - 1].role === "user") {
    session.messages.pop();
  }
  session.messages.push({ role: "user", content: userMessage });
  if (session.messages.length > 20) session.messages = session.messages.slice(-20);
  return [...session.messages];
}

function saveReplyToMemory(sid: string, reply: string) {
  const session = memorySessions.get(sid);
  if (session) session.messages.push({ role: "assistant", content: reply });
}

export async function generateReply(sessionId: string, userMessage: string): Promise<string> {
  const useSupabase = hasSupabase();

  const messages = useSupabase
    ? await getMessagesFromSupabase(sessionId, userMessage)
    : getMessagesFromMemory(sessionId, userMessage);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: buildSystemPrompt(),
    messages,
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const reply = textBlock && textBlock.type === "text" ? textBlock.text : "";

  if (!reply) {
    console.error("Empty Claude reply", {
      stop_reason: response.stop_reason,
      content_types: response.content.map((b) => b.type),
    });
  }

  if (useSupabase) {
    await saveReplyToSupabase(sessionId, reply);
  } else {
    saveReplyToMemory(sessionId, reply);
  }

  return reply;
}

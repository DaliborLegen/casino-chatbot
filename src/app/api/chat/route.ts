import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/lib/supabase";
import { systemPrompt } from "@/lib/system-prompt";

interface StoredMessage {
  role: "user" | "assistant";
  content: string;
}

// In-memory fallback when Supabase is not configured
const memorySessions = new Map<string, { messages: StoredMessage[]; lastActive: number }>();

// Clean old sessions every 5 min
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of memorySessions) {
    if (now - session.lastActive > 30 * 60 * 1000) memorySessions.delete(id);
  }
}, 5 * 60 * 1000);

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

  await supabase.from("messages").insert({
    conversation_id: conversation.id,
    role: "user",
    content: userMessage,
  });

  const { data: history } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true })
    .limit(20);

  return (history || []).map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
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
  session.messages.push({ role: "user", content: userMessage });
  if (session.messages.length > 20) session.messages = session.messages.slice(-20);
  return [...session.messages];
}

function saveReplyToMemory(sid: string, reply: string) {
  const session = memorySessions.get(sid);
  if (session) session.messages.push({ role: "assistant", content: reply });
}

export async function POST(req: NextRequest) {
  try {
    const { message, sessionId } = await req.json();

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    const sid = sessionId || crypto.randomUUID();
    const useSupabase = hasSupabase();

    // Get conversation history
    const messages = useSupabase
      ? await getMessagesFromSupabase(sid, message.trim())
      : getMessagesFromMemory(sid, message.trim());

    // Call Claude
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    const reply = response.content[0].type === "text" ? response.content[0].text : "";

    // Save reply
    if (useSupabase) {
      await saveReplyToSupabase(sid, reply);
    } else {
      saveReplyToMemory(sid, reply);
    }

    return NextResponse.json({ reply, sessionId: sid });
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json(
      {
        error: "Prišlo je do napake. Prosimo, poskusite znova ali nas kontaktirajte na podpora@casino.si.",
      },
      { status: 500 }
    );
  }
}

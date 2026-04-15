import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/lib/supabase";
import { systemPrompt } from "@/lib/system-prompt";

export async function POST(req: NextRequest) {
  try {
    const { message, sessionId } = await req.json();

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    const sid = sessionId || crypto.randomUUID();
    const supabase = getSupabase();
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    // Get or create conversation
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

    if (!conversation) {
      return NextResponse.json({ error: "Failed to create conversation." }, { status: 500 });
    }

    // Save user message
    await supabase.from("messages").insert({
      conversation_id: conversation.id,
      role: "user",
      content: message.trim(),
    });

    // Get last 20 messages for context
    const { data: history } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true })
      .limit(20);

    const messages = (history || []).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Call Claude
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    const reply = response.content[0].type === "text" ? response.content[0].text : "";

    // Save assistant reply
    await supabase.from("messages").insert({
      conversation_id: conversation.id,
      role: "assistant",
      content: reply,
    });

    // Update conversation timestamp
    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversation.id);

    return NextResponse.json({ reply, sessionId: sid });
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json(
      {
        error:
          "Prišlo je do napake. Prosimo, poskusite znova ali nas kontaktirajte na podpora@casino.si.",
      },
      { status: 500 }
    );
  }
}

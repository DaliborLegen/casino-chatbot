import { NextRequest, NextResponse } from "next/server";
import { generateReply } from "@/lib/chat";

export async function POST(req: NextRequest) {
  try {
    const { message, sessionId } = await req.json();

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    const sid = sessionId || crypto.randomUUID();
    const reply = await generateReply(sid, message.trim());

    return NextResponse.json({ reply, sessionId: sid });
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json(
      {
        error: "Prišlo je do napake. Prosimo, poskusite znova ali nas kontaktirajte na online@casino.si.",
      },
      { status: 500 }
    );
  }
}

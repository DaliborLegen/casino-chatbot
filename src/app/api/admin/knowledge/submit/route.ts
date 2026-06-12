import { NextRequest, NextResponse } from "next/server";
import {
  normalizeSubmission,
  insertPending,
  type KnowledgeType,
  type SubmissionInput,
} from "@/lib/knowledge";
import { sendApprovalEmail } from "@/lib/email-knowledge";

export const runtime = "nodejs";
export const maxDuration = 60;

const VALID_TYPES: KnowledgeType[] = ["promocija", "pravilo", "faq"];

function basicAuthUser(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Basic ")) return null;
  try {
    const decoded = atob(auth.slice(6));
    const idx = decoded.indexOf(":");
    return idx >= 0 ? decoded.slice(0, idx) : decoded;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  let payload: {
    type?: string;
    title?: string;
    rawInput?: string;
    specialInstructions?: string;
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Neveljaven JSON." }, { status: 400 });
  }

  const type = (payload.type || "promocija") as KnowledgeType;
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: "Neveljaven tip vnosa." }, { status: 400 });
  }
  const rawInput = (payload.rawInput || "").trim();
  if (rawInput.length < 5) {
    return NextResponse.json({ error: "Vsebina vnosa je prekratka." }, { status: 400 });
  }
  if (rawInput.length > 8000) {
    return NextResponse.json({ error: "Vsebina vnosa je predolga (max 8000 znakov)." }, { status: 400 });
  }

  const input: SubmissionInput = {
    type,
    title: (payload.title || "").trim(),
    rawInput,
    specialInstructions: (payload.specialInstructions || "").trim() || undefined,
    submittedBy: basicAuthUser(req) || undefined,
  };

  try {
    const normalized = await normalizeSubmission(input);
    const entry = await insertPending(input, normalized);
    const email = await sendApprovalEmail(entry);
    if (!email.sent) {
      console.warn("Knowledge approval email not sent:", email.skippedReason || email.error);
    }
    return NextResponse.json({
      ok: true,
      entry: { id: entry.id, title: entry.title, body: entry.body, type: entry.type },
      emailSent: email.sent,
      emailNote: email.skippedReason || email.error || null,
    });
  } catch (err) {
    console.error("Knowledge submit failed:", err);
    return NextResponse.json(
      { error: "Vnosa ni bilo mogoče shraniti. Poskusite znova." },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Retention. The casino keeps the authoritative record in Zendesk and asked us
 * to hold ours for about a year as a backup, so anything older goes.
 *
 * Conversations carry personal data twice over: the pre-chat form (name, email)
 * and whatever guests type about themselves, so we delete the whole thing
 * rather than just blanking the contact fields. The daily insight summaries
 * live in their own table and are not touched, so the statistics survive.
 */
const DEFAULT_RETENTION_DAYS = 365;

/** Deleted per run, so one pass can't blow the function's time budget. */
const BATCH = 500;
const MAX_BATCHES = 20;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const days = Number(process.env.RETENTION_DAYS) || DEFAULT_RETENTION_DAYS;
  if (!Number.isFinite(days) || days < 30) {
    // A too-short retention would quietly shred live history; refuse instead.
    return NextResponse.json({ error: "RETENTION_DAYS must be at least 30" }, { status: 400 });
  }
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const dryRun = req.nextUrl.searchParams.get("dry") === "1";

  const supabase = getSupabase();
  let conversationsDeleted = 0;
  let messagesDeleted = 0;
  let batches = 0;

  try {
    for (; batches < MAX_BATCHES; batches++) {
      const { data: old, error } = await supabase
        .from("conversations")
        .select("id")
        .lt("updated_at", cutoff)
        .order("updated_at", { ascending: true })
        .limit(BATCH);
      if (error) throw error;
      if (!old || old.length === 0) break;

      const ids = old.map((c) => c.id as string);
      if (dryRun) {
        conversationsDeleted += ids.length;
        break;
      }

      const { data: msgs, error: msgErr } = await supabase
        .from("messages")
        .delete()
        .in("conversation_id", ids)
        .select("id");
      if (msgErr) throw msgErr;
      messagesDeleted += msgs?.length ?? 0;

      const { error: convErr } = await supabase.from("conversations").delete().in("id", ids);
      if (convErr) throw convErr;
      conversationsDeleted += ids.length;

      if (old.length < BATCH) break;
    }
  } catch (err) {
    console.error("Retention purge failed:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : String(err),
        conversationsDeleted,
        messagesDeleted,
      },
      { status: 500 }
    );
  }

  const result = {
    ok: true,
    dryRun,
    retentionDays: days,
    cutoff,
    conversationsDeleted,
    messagesDeleted,
    batches,
    // True when the cap stopped us early: the next run picks up the rest.
    more: batches >= MAX_BATCHES,
  };
  console.log("Retention purge", result);
  return NextResponse.json(result);
}

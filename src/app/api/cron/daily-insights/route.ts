import { NextRequest, NextResponse } from "next/server";
import { generateDailyInsight, persistInsight } from "@/lib/insights";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await generateDailyInsight();
    await persistInsight(result);
    return NextResponse.json({
      ok: true,
      report_date: result.report_date,
      conversation_count: result.stats.conversation_count,
      message_count: result.stats.message_count,
      input_tokens: result.stats.input_tokens,
      output_tokens: result.stats.output_tokens,
    });
  } catch (err) {
    console.error("Daily insights cron failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

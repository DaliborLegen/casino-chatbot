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
    const params = req.nextUrl.searchParams;
    const hoursParam = params.get("hours");
    const endParam = params.get("end");
    const label = params.get("label") || undefined;
    const reportDateParam = params.get("date") || undefined;

    const hours = hoursParam ? Number(hoursParam) : undefined;
    if (hours !== undefined && (!Number.isFinite(hours) || hours <= 0 || hours > 168)) {
      return NextResponse.json({ error: "hours must be 1-168" }, { status: 400 });
    }

    let endUtc: Date | undefined;
    if (endParam) {
      endUtc = new Date(endParam);
      if (Number.isNaN(endUtc.getTime())) {
        return NextResponse.json({ error: "invalid 'end' (expected ISO timestamp)" }, { status: 400 });
      }
    }

    const result = await generateDailyInsight({ hours, endUtc, label, reportDate: reportDateParam });
    await persistInsight(result);
    return NextResponse.json({
      ok: true,
      report_date: result.report_date,
      label: result.label,
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

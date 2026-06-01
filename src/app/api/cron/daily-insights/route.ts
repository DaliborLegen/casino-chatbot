import { NextRequest, NextResponse } from "next/server";
import { generateDailyInsight, persistInsight } from "@/lib/insights";
import { sendInsightEmail } from "@/lib/email-insights";

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

  // Two cron entries (0 7 * * * and 0 8 * * *) exist so exactly one fires at
  // 09:00 Europe/Ljubljana year-round (DST-safe). The other must self-skip.
  // Auth above already gates this to Vercel cron or a CRON_SECRET-bearing
  // caller, so apply the hour guard to all non-forced requests — do NOT rely
  // on the x-vercel-cron header (its value is not a documented contract and
  // was evaluating false, bypassing the guard and sending the report twice).
  // Manual runs that must bypass the guard pass ?force=1.
  const force = req.nextUrl.searchParams.get("force") === "1";
  if (!force) {
    const ljubljanaHour = Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Ljubljana",
        hour: "2-digit",
        hour12: false,
      }).format(new Date())
    );
    if (ljubljanaHour !== 9) {
      return NextResponse.json({ ok: true, skipped: true, ljubljana_hour: ljubljanaHour });
    }
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

    const sendEmail = params.get("email") !== "0";
    const emailResult = sendEmail
      ? await sendInsightEmail(result).catch((err) => ({
          sent: false as const,
          error: err instanceof Error ? err.message : String(err),
        }))
      : { sent: false as const, skippedReason: "email=0 query param" };

    if (!emailResult.sent) {
      console.warn(
        "Daily insights email not sent:",
        "error" in emailResult ? emailResult.error : emailResult.skippedReason
      );
    } else {
      console.log("Daily insights email sent:", emailResult.resendId);
    }

    return NextResponse.json({
      ok: true,
      report_date: result.report_date,
      label: result.label,
      conversation_count: result.stats.conversation_count,
      message_count: result.stats.message_count,
      input_tokens: result.stats.input_tokens,
      output_tokens: result.stats.output_tokens,
      email: emailResult,
    });
  } catch (err) {
    console.error("Daily insights cron failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

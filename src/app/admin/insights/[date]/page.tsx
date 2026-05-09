import Link from "next/link";
import { notFound } from "next/navigation";
import { getInsight } from "@/lib/insights";
import { renderMarkdown } from "@/lib/markdown";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("sl-SI", {
    timeZone: "Europe/Ljubljana",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(iso));
}

function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat("sl-SI", {
    timeZone: "Europe/Ljubljana",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default async function InsightDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ label?: string }>;
}) {
  const { date } = await params;
  const { label = "daily" } = await searchParams;
  const report = await getInsight(date, label);
  if (!report) notFound();

  const html = renderMarkdown(report.markdown);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-3xl mx-auto">
        <Link href="/admin/insights" className="text-sm text-zinc-400 hover:text-zinc-100">
          ← Vsa poročila
        </Link>

        <header className="mt-3 mb-6 pb-4 border-b border-zinc-800">
          <h1 className="text-xl font-semibold">{fmtDate(report.report_date)}</h1>
          <div className="mt-1 text-xs text-zinc-500">
            {report.conversation_count} pogovorov · {report.message_count} sporočil · generirano{" "}
            {fmtDateTime(report.created_at)}
            {report.model && (
              <>
                {" · "}
                <span className="font-mono">{report.model}</span>
              </>
            )}
            {report.input_tokens != null && report.output_tokens != null && (
              <>
                {" · "}
                {report.input_tokens.toLocaleString("sl-SI")} in / {report.output_tokens.toLocaleString("sl-SI")} out tok
              </>
            )}
          </div>
        </header>

        <article
          className="prose-none"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}

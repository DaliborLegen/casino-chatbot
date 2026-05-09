import Link from "next/link";
import { listInsights } from "@/lib/insights";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("sl-SI", {
    timeZone: "Europe/Ljubljana",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
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

export default async function InsightsListPage() {
  const rows = await listInsights(60);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-4xl mx-auto">
        <Link href="/admin" className="text-sm text-zinc-400 hover:text-zinc-100">
          ← Vsi pogovori
        </Link>

        <header className="mt-3 mb-6 flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold">Dnevna analiza</h1>
          <div className="text-sm text-zinc-400">{rows.length} poročil</div>
        </header>

        <div className="rounded-lg border border-zinc-800 overflow-hidden">
          <div className="hidden md:grid grid-cols-[180px_1fr_120px_120px_180px] gap-3 px-4 py-2 bg-zinc-900 text-xs font-medium text-zinc-400 uppercase tracking-wide">
            <div>Datum</div>
            <div></div>
            <div className="text-right">Pogovorov</div>
            <div className="text-right">Sporočil</div>
            <div>Generirano</div>
          </div>
          {rows.map((r) => (
            <Link
              key={r.report_date}
              href={`/admin/insights/${r.report_date}`}
              className="block border-t border-zinc-800 hover:bg-zinc-900/60 transition-colors px-4 py-3 md:py-2 md:grid md:grid-cols-[180px_1fr_120px_120px_180px] md:gap-3 md:items-center"
            >
              <div className="text-sm text-zinc-100 font-medium">{fmtDate(r.report_date)}</div>
              <div className="hidden md:block text-xs text-zinc-500 font-mono">{r.report_date}</div>
              <div className="text-sm text-zinc-300 md:text-right">
                <span className="md:hidden text-zinc-500 mr-1">Pogovorov:</span>
                {r.conversation_count}
              </div>
              <div className="text-sm text-zinc-300 md:text-right">
                <span className="md:hidden text-zinc-500 mr-1">Sporočil:</span>
                {r.message_count}
              </div>
              <div className="text-xs text-zinc-500 mt-1 md:mt-0">
                <span className="md:hidden text-zinc-500 mr-1">Generirano:</span>
                {fmtDateTime(r.created_at)}
              </div>
            </Link>
          ))}
          {rows.length === 0 && (
            <div className="px-4 py-6 text-center text-zinc-500 text-sm">
              Še ni poročil. Cron teče vsak dan ob 06:00 UTC (08:00 Ljubljana poleti).
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { getAdminTenant } from "@/lib/admin-tenant";
import type { TenantId } from "@/lib/tenants";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Row {
  id: string;
  session_id: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  last_user: string | null;
  last_assistant: string | null;
}

interface Filters {
  /** Free text searched in message contents (and the session id). */
  q: string;
  /** "" = all, otherwise a session-id prefix group. */
  source: "" | "lc" | "zd" | "widget";
  /** How many days back to include, 0 = no limit. */
  days: number;
}

interface Stats {
  today: number;
  week: number;
  month: number;
  avgMessages: number | null;
  bySource: { livechat: number; zendesk: number; widget: number };
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function sourceOf(sessionId: string): "lc" | "zd" | "widget" {
  if (sessionId.startsWith("lc_")) return "lc";
  if (sessionId.startsWith("zd_")) return "zd";
  return "widget";
}

/**
 * Conversation counts and averages for the header strip. Kept to cheap COUNT
 * queries plus one message count, so it doesn't slow the list down.
 */
async function loadStats(tenant: TenantId): Promise<Stats> {
  const supabase = getSupabase();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const countSince = async (sinceIso: string) => {
    const { count } = await supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("tenant", tenant)
      .gte("updated_at", sinceIso);
    return count ?? 0;
  };

  const [today, week, month] = await Promise.all([
    countSince(startOfToday.toISOString()),
    countSince(daysAgoIso(7)),
    countSince(daysAgoIso(30)),
  ]);

  // Average length over the last 7 days, and the source split over the same window.
  const { data: recent } = await supabase
    .from("conversations")
    .select("id, session_id")
    .eq("tenant", tenant)
    .gte("updated_at", daysAgoIso(7))
    .limit(1000);

  const bySource = { livechat: 0, zendesk: 0, widget: 0 };
  for (const c of recent || []) {
    const s = sourceOf(c.session_id);
    if (s === "lc") bySource.livechat++;
    else if (s === "zd") bySource.zendesk++;
    else bySource.widget++;
  }

  let avgMessages: number | null = null;
  if (recent && recent.length > 0) {
    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .in(
        "conversation_id",
        recent.map((c) => c.id)
      );
    if (count !== null && count !== undefined) {
      avgMessages = Math.round((count / recent.length) * 10) / 10;
    }
  }

  return { today, week, month, avgMessages, bySource };
}

async function loadConversations(
  limit: number,
  tenant: TenantId,
  filters: Filters
): Promise<Row[]> {
  const supabase = getSupabase();
  // The webhook creates a conversation row for every LiveChat chat in the
  // shared license (incoming_chat), including daytime chats human agents handle
  // and the bot never answers — those stay at 0 messages. We hide them below so
  // the dashboard shows only real conversations. Over-fetch candidates to keep
  // the page full after filtering.
  const candidateLimit = Math.min(limit * 2, 500);
  const { data: convos, error } = await supabase
    .from("conversations")
    .select("id, session_id, created_at, updated_at")
    .eq("tenant", tenant)
    .order("updated_at", { ascending: false })
    .limit(candidateLimit);
  if (error || !convos) return [];

  const ids = convos.map((c) => c.id);
  const { data: msgs } = await supabase
    .from("messages")
    .select("conversation_id, role, content, created_at")
    .in("conversation_id", ids)
    .order("created_at", { ascending: false });

  const lastUser = new Map<string, string>();
  const lastAssistant = new Map<string, string>();
  const counts = new Map<string, number>();
  for (const m of msgs || []) {
    counts.set(m.conversation_id, (counts.get(m.conversation_id) || 0) + 1);
    if (m.role === "user" && !lastUser.has(m.conversation_id)) {
      lastUser.set(m.conversation_id, m.content);
    } else if (m.role === "assistant" && !lastAssistant.has(m.conversation_id)) {
      lastAssistant.set(m.conversation_id, m.content);
    }
  }

  return convos
    .map((c) => ({
      id: c.id,
      session_id: c.session_id,
      created_at: c.created_at,
      updated_at: c.updated_at,
      message_count: counts.get(c.id) || 0,
      last_user: lastUser.get(c.id) || null,
      last_assistant: lastAssistant.get(c.id) || null,
    }))
    .filter((r) => r.message_count > 0)
    .slice(0, limit);
}

function fmt(d: string) {
  return new Intl.DateTimeFormat("sl-SI", {
    timeZone: "Europe/Ljubljana",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}

function source(sid: string) {
  if (sid.startsWith("lc_")) return { label: "LiveChat", cls: "bg-emerald-900/40 text-emerald-300" };
  if (sid.startsWith("smoke-test-")) return { label: "Smoke", cls: "bg-zinc-700 text-zinc-300" };
  return { label: "Widget", cls: "bg-sky-900/40 text-sky-300" };
}

function truncate(s: string | null, n: number) {
  if (!s) return "—";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ limit?: string }>;
}) {
  const params = await searchParams;
  const limit = Math.min(Number(params.limit) || 100, 500);
  const tenant = await getAdminTenant();
  const rows = await loadConversations(limit, tenant.id);

  return (
    <div className="text-zinc-100 px-4 sm:px-5 py-6">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-baseline justify-between mb-6">
          <h1 className="text-2xl font-semibold">
            Pogovori
            <span className="ml-3 align-middle inline-block h-1 w-10 rounded-full" style={{ background: "var(--accent)" }} />
          </h1>
          <span className="text-sm text-zinc-400">{tenant.name} · {rows.length} sej · prikazane zadnje</span>
        </header>

        <div className="rounded-lg border border-zinc-800 overflow-hidden">
          <div className="hidden md:grid grid-cols-[110px_140px_140px_60px_1fr_1fr] gap-3 px-4 py-2 bg-zinc-900 text-xs font-medium text-zinc-400 uppercase tracking-wide">
            <div>Vir</div>
            <div>Posodobljeno</div>
            <div>Začelo</div>
            <div className="text-right">#</div>
            <div>Zadnje vprašanje</div>
            <div>Zadnji odgovor</div>
          </div>
          {rows.map((r) => {
            const src = source(r.session_id);
            return (
              <Link
                key={r.id}
                href={`/admin/${encodeURIComponent(r.session_id)}`}
                className="block border-t border-zinc-800 hover:bg-zinc-900/60 transition-colors px-4 py-3 md:py-2 md:grid md:grid-cols-[110px_140px_140px_60px_1fr_1fr] md:gap-3 md:items-start"
              >
                <div className="mb-2 md:mb-0">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs ${src.cls}`}>
                    {src.label}
                  </span>
                </div>
                <div className="text-sm text-zinc-300 whitespace-nowrap">
                  <span className="md:hidden text-zinc-500 mr-1">Posodobljeno:</span>
                  {fmt(r.updated_at)}
                </div>
                <div className="text-sm text-zinc-500 whitespace-nowrap">
                  <span className="md:hidden text-zinc-500 mr-1">Začelo:</span>
                  {fmt(r.created_at)}
                </div>
                <div className="text-sm text-zinc-300 md:text-right">
                  <span className="md:hidden text-zinc-500 mr-1">Sporočil:</span>
                  {r.message_count}
                </div>
                <div className="text-sm text-zinc-200 mt-1 md:mt-0">
                  {truncate(r.last_user, 120)}
                </div>
                <div className="text-sm text-zinc-400 mt-1 md:mt-0">
                  {truncate(r.last_assistant, 120)}
                </div>
              </Link>
            );
          })}
          {rows.length === 0 && (
            <div className="px-4 py-6 text-center text-zinc-500">Ni pogovorov.</div>
          )}
        </div>

        <div className="mt-4 text-xs text-zinc-500">
          <Link
            href={`?limit=${Math.min(limit + 100, 500)}`}
            className="underline hover:text-zinc-300"
          >
            Naloži več (max 500)
          </Link>
        </div>
      </div>
    </div>
  );
}

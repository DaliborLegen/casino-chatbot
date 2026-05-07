import Link from "next/link";
import { getSupabase } from "@/lib/supabase";

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

async function loadConversations(limit: number): Promise<Row[]> {
  const supabase = getSupabase();
  const { data: convos, error } = await supabase
    .from("conversations")
    .select("id, session_id, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(limit);
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

  return convos.map((c) => ({
    id: c.id,
    session_id: c.session_id,
    created_at: c.created_at,
    updated_at: c.updated_at,
    message_count: counts.get(c.id) || 0,
    last_user: lastUser.get(c.id) || null,
    last_assistant: lastAssistant.get(c.id) || null,
  }));
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
  const rows = await loadConversations(limit);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-baseline justify-between mb-6">
          <h1 className="text-2xl font-semibold">Pogovori</h1>
          <div className="text-sm text-zinc-400">
            {rows.length} sej · prikazane zadnje
          </div>
        </header>

        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900 text-zinc-400 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Vir</th>
                <th className="px-3 py-2 font-medium">Posodobljeno</th>
                <th className="px-3 py-2 font-medium">Začelo</th>
                <th className="px-3 py-2 font-medium text-right">#</th>
                <th className="px-3 py-2 font-medium">Zadnje vprašanje</th>
                <th className="px-3 py-2 font-medium">Zadnji odgovor</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const src = source(r.session_id);
                return (
                  <tr
                    key={r.id}
                    className="border-t border-zinc-800 hover:bg-zinc-900/60"
                  >
                    <td className="px-3 py-2 align-top">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs ${src.cls}`}>
                        {src.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top whitespace-nowrap text-zinc-300">
                      {fmt(r.updated_at)}
                    </td>
                    <td className="px-3 py-2 align-top whitespace-nowrap text-zinc-500">
                      {fmt(r.created_at)}
                    </td>
                    <td className="px-3 py-2 align-top text-right text-zinc-300">
                      {r.message_count}
                    </td>
                    <td className="px-3 py-2 align-top text-zinc-200 max-w-md">
                      <Link
                        href={`/admin/${encodeURIComponent(r.session_id)}`}
                        className="hover:underline"
                      >
                        {truncate(r.last_user, 100)}
                      </Link>
                    </td>
                    <td className="px-3 py-2 align-top text-zinc-400 max-w-md">
                      {truncate(r.last_assistant, 100)}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-zinc-500">
                    Ni pogovorov.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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

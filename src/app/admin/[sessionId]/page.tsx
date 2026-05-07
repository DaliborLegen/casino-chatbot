import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

async function loadConversation(sessionId: string) {
  const supabase = getSupabase();
  const { data: convo } = await supabase
    .from("conversations")
    .select("id, session_id, created_at, updated_at")
    .eq("session_id", sessionId)
    .single();
  if (!convo) return null;

  const { data: msgs } = await supabase
    .from("messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", convo.id)
    .order("created_at", { ascending: true });

  return { convo, messages: (msgs || []) as Message[] };
}

function fmt(d: string) {
  return new Intl.DateTimeFormat("sl-SI", {
    timeZone: "Europe/Ljubljana",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(d));
}

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const decoded = decodeURIComponent(sessionId);
  const data = await loadConversation(decoded);
  if (!data) notFound();

  const { convo, messages } = data;
  const source = decoded.startsWith("lc_")
    ? "LiveChat"
    : decoded.startsWith("smoke-test-")
    ? "Smoke test"
    : "Widget";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-3xl mx-auto">
        <Link href="/admin" className="text-sm text-zinc-400 hover:text-zinc-100">
          ← Vsi pogovori
        </Link>

        <header className="mt-3 mb-6 pb-4 border-b border-zinc-800">
          <h1 className="text-xl font-semibold">{source}</h1>
          <div className="mt-1 text-xs text-zinc-500 font-mono break-all">
            session_id: {convo.session_id}
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            Začelo: {fmt(convo.created_at)} · Posodobljeno: {fmt(convo.updated_at)} ·{" "}
            {messages.length} sporočil
          </div>
        </header>

        <div className="space-y-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={
                m.role === "user"
                  ? "ml-12 rounded-lg bg-sky-900/30 border border-sky-900/50 p-3"
                  : "mr-12 rounded-lg bg-zinc-900 border border-zinc-800 p-3"
              }
            >
              <div className="flex items-baseline justify-between mb-1">
                <span
                  className={
                    m.role === "user"
                      ? "text-xs font-medium text-sky-300"
                      : "text-xs font-medium text-zinc-400"
                  }
                >
                  {m.role === "user" ? "Uporabnik" : "Bot"}
                </span>
                <span className="text-xs text-zinc-600">{fmt(m.created_at)}</span>
              </div>
              <div className="whitespace-pre-wrap text-sm text-zinc-100">
                {m.content}
              </div>
            </div>
          ))}
          {messages.length === 0 && (
            <div className="text-zinc-500 text-sm">Ni sporočil.</div>
          )}
        </div>
      </div>
    </div>
  );
}

import { getSupabase } from "@/lib/supabase";
import { SESSION_RATE_LIMIT, SESSION_RATE_WINDOW_MS } from "@/lib/limits";

export async function isSessionRateLimited(sessionId: string): Promise<boolean> {
  try {
    const supabase = getSupabase();
    const { data: convo } = await supabase
      .from("conversations")
      .select("id")
      .eq("session_id", sessionId)
      .single();

    if (!convo) return false;

    const since = new Date(Date.now() - SESSION_RATE_WINDOW_MS).toISOString();
    const { count } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("conversation_id", convo.id)
      .eq("role", "user")
      .gte("created_at", since);

    return (count ?? 0) >= SESSION_RATE_LIMIT;
  } catch {
    return false;
  }
}

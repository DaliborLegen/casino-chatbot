import { ensureConversation } from "@/lib/chat";
import { getSupabase } from "@/lib/supabase";
import type { TenantId } from "@/lib/tenants";

/**
 * Pre-chat contact details (name + email), per Zendesk conversation.
 *
 * Zendesk's own AnswerBot used to collect these through a proactive welcome
 * greeting. That greeting was deleted on 8 September 2026, so every conversation
 * now lands on our integration first and reached the agents with no contact
 * details at all — Zendesk support confirmed we are the ones who have to ask.
 *
 * The state lives on `conversations.metadata.contact` so it survives across
 * serverless instances; an in-memory copy keeps the flow sane when Supabase is
 * unreachable, at worst asking once per instance.
 */
export interface ContactState {
  name?: string;
  email?: string;
  /** ISO timestamp of when we sent the form. Set means: never ask again. */
  formSentAt?: string;
  /** The guest's opening message, kept so we can answer it after the form. */
  pendingMessage?: string;
  /** How many times we have put the form in front of this guest. */
  formPrompts?: number;
}

const memory = new Map<string, ContactState>();

function hasSupabase(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function hasContactDetails(state: ContactState): boolean {
  return Boolean(state.email || state.name);
}

/** Never throws: a lookup failure must not cost the guest an answer. */
export async function loadContact(sessionId: string): Promise<ContactState> {
  const local = memory.get(sessionId) ?? {};
  if (!hasSupabase()) return local;

  try {
    const { data } = await getSupabase()
      .from("conversations")
      .select("metadata")
      .eq("session_id", sessionId)
      .maybeSingle();

    const metadata = (data?.metadata as Record<string, unknown> | null) ?? null;
    const stored = (metadata?.contact as ContactState | undefined) ?? undefined;
    if (!stored) return local;

    const merged = { ...local, ...stored };
    memory.set(sessionId, merged);
    return merged;
  } catch (err) {
    console.error("Zendesk contact: load failed, using in-memory state:", err);
    return local;
  }
}

/** Merges `patch` into the stored contact state. Never throws. */
export async function saveContact(
  sessionId: string,
  tenant: TenantId,
  patch: ContactState
): Promise<ContactState> {
  const merged = { ...(memory.get(sessionId) ?? {}), ...patch };
  memory.set(sessionId, merged);
  if (!hasSupabase()) return merged;

  try {
    await ensureConversation(sessionId, tenant);
    const supabase = getSupabase();
    const { data } = await supabase
      .from("conversations")
      .select("id, metadata")
      .eq("session_id", sessionId)
      .single();
    if (!data) return merged;

    const metadata = (data.metadata as Record<string, unknown>) ?? {};
    const contact = { ...((metadata.contact as ContactState | undefined) ?? {}), ...patch };
    memory.set(sessionId, { ...merged, ...contact });

    await supabase
      .from("conversations")
      .update({ metadata: { ...metadata, contact }, updated_at: new Date().toISOString() })
      .eq("id", data.id);

    return { ...merged, ...contact };
  } catch (err) {
    // The in-memory copy still holds, so the guest is not asked again in this
    // instance; worse would be to abort the conversation over bookkeeping.
    console.error("Zendesk contact: save failed:", err);
    return merged;
  }
}

import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/lib/supabase";
import { baseSystemPrompt, buildTimeContext } from "@/lib/system-prompt";
import { supercasinoSystemPrompt } from "@/lib/system-prompt-supercasino";
import { casino777SystemPrompt } from "@/lib/system-prompt-777";
import { getActiveKnowledgeSection } from "@/lib/knowledge";
import { DEFAULT_TENANT, getTenant, isTenantId, type TenantId } from "@/lib/tenants";

export interface StoredMessage {
  role: "user" | "assistant";
  content: string;
}

const memorySessions = new Map<string, { messages: StoredMessage[]; lastActive: number }>();

if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [id, session] of memorySessions) {
      if (now - session.lastActive > 30 * 60 * 1000) memorySessions.delete(id);
    }
  }, 5 * 60 * 1000);
}

function hasSupabase(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function getMessagesFromSupabase(sid: string, userMessage: string): Promise<StoredMessage[]> {
  const supabase = getSupabase();

  let { data: conversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("session_id", sid)
    .single();

  if (!conversation) {
    const { data: newConvo } = await supabase
      .from("conversations")
      .insert({ session_id: sid })
      .select("id")
      .single();
    conversation = newConvo;
  }

  if (!conversation) throw new Error("Failed to create conversation");

  const { data: history } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true })
    .limit(19);

  await supabase.from("messages").insert({
    conversation_id: conversation.id,
    role: "user",
    content: userMessage,
  });

  const past: StoredMessage[] = (history || []).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
  while (past.length > 0 && past[past.length - 1].role === "user") past.pop();
  return [...past, { role: "user", content: userMessage }];
}

async function saveReplyToSupabase(sid: string, reply: string) {
  const supabase = getSupabase();
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("session_id", sid)
    .single();

  if (conversation) {
    await supabase.from("messages").insert({
      conversation_id: conversation.id,
      role: "assistant",
      content: reply,
    });
    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversation.id);
  }
}

function getMessagesFromMemory(sid: string, userMessage: string): StoredMessage[] {
  if (!memorySessions.has(sid)) {
    memorySessions.set(sid, { messages: [], lastActive: Date.now() });
  }
  const session = memorySessions.get(sid)!;
  session.lastActive = Date.now();
  while (session.messages.length > 0 && session.messages[session.messages.length - 1].role === "user") {
    session.messages.pop();
  }
  session.messages.push({ role: "user", content: userMessage });
  if (session.messages.length > 20) session.messages = session.messages.slice(-20);
  return [...session.messages];
}

function saveReplyToMemory(sid: string, reply: string) {
  const session = memorySessions.get(sid);
  if (session) session.messages.push({ role: "assistant", content: reply });
}

// ---------------------------------------------------------------------------
// Resilience. A failing Claude call used to surface as silence in LiveChat (the
// webhook logs and ACKs), which between 00:00 and 08:00 means nobody answers the
// guest at all. Transient failures are retried; a final failure returns a plain
// fallback so the guest always gets something and knows where to write.
// ---------------------------------------------------------------------------

const MAX_ATTEMPTS = 3;
/** Stop retrying past this point so we stay inside the webhooks' maxDuration = 30s. */
const RETRY_DEADLINE_MS = 15_000;
const RETRY_STATUSES = new Set([408, 409, 429, 500, 502, 503, 504, 529]);

function isRetryable(err: unknown): boolean {
  if (err instanceof Anthropic.APIConnectionError || err instanceof Anthropic.APIConnectionTimeoutError) {
    return true;
  }
  if (err instanceof Anthropic.APIError && typeof err.status === "number") {
    return RETRY_STATUSES.has(err.status);
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Message the guest sees when Claude is unreachable (rate limit, outage, timeout). */
export function fallbackReply(tenant: TenantId): string {
  const email = getTenant(tenant).supportEmail;
  return `Oprostite, trenutno imam tehnično težavo in vam ne morem odgovoriti. Prosimo, poskusite čez nekaj minut ali nam pišite na ${email}.`;
}

async function createMessageWithRetry(
  client: Anthropic,
  params: Anthropic.MessageCreateParamsNonStreaming
): Promise<Anthropic.Message> {
  const startedAt = Date.now();
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await client.messages.create(params);
    } catch (err) {
      lastError = err;
      const elapsed = Date.now() - startedAt;
      const canRetry =
        attempt < MAX_ATTEMPTS && isRetryable(err) && elapsed < RETRY_DEADLINE_MS;
      console.error("Claude call failed", {
        attempt,
        elapsed,
        retrying: canRetry,
        status: err instanceof Anthropic.APIError ? err.status : undefined,
        message: err instanceof Error ? err.message : String(err),
      });
      if (!canRetry) break;
      await sleep(attempt * 800);
    }
  }

  throw lastError;
}

function systemPromptFor(tenant: TenantId): string {
  if (tenant === "supercasino") return supercasinoSystemPrompt;
  if (tenant === "casino777") return casino777SystemPrompt;
  return baseSystemPrompt;
}

/** Returns the tenant a stored conversation belongs to, or null if unknown. */
export async function getConversationTenant(sessionId: string): Promise<TenantId | null> {
  if (!hasSupabase()) return null;
  const supabase = getSupabase();
  const { data } = await supabase
    .from("conversations")
    .select("tenant")
    .eq("session_id", sessionId)
    .single();
  if (!data) return null;
  return isTenantId(data.tenant) ? data.tenant : "casino";
}

/** Creates the conversation row up front with the correct tenant (idempotent). */
export async function ensureConversation(sessionId: string, tenant: TenantId): Promise<void> {
  if (!hasSupabase()) return;
  const supabase = getSupabase();
  await supabase
    .from("conversations")
    .upsert({ session_id: sessionId, tenant }, { onConflict: "session_id", ignoreDuplicates: true });
}

export async function generateReply(
  sessionId: string,
  userMessage: string,
  tenant: TenantId = DEFAULT_TENANT
): Promise<string> {
  const useSupabase = hasSupabase();

  if (useSupabase) await ensureConversation(sessionId, tenant);

  const messages = useSupabase
    ? await getMessagesFromSupabase(sessionId, userMessage)
    : getMessagesFromMemory(sessionId, userMessage);

  // Active, operator-approved promos/rules added via /admin/pravila. Appended to
  // the cached system block — the cache rebuilds only when knowledge changes (rare).
  const knowledgeSection = await getActiveKnowledgeSection(tenant);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: systemPromptFor(tenant) + knowledgeSection,
        cache_control: { type: "ephemeral" },
      },
      { type: "text", text: buildTimeContext() },
    ],
    messages,
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const reply = textBlock && textBlock.type === "text" ? textBlock.text : "";

  console.log("Claude usage", {
    input_tokens: response.usage.input_tokens,
    cache_creation_input_tokens: response.usage.cache_creation_input_tokens,
    cache_read_input_tokens: response.usage.cache_read_input_tokens,
    output_tokens: response.usage.output_tokens,
  });

  if (!reply) {
    console.error("Empty Claude reply", {
      stop_reason: response.stop_reason,
      content_types: response.content.map((b) => b.type),
    });
  }

  if (useSupabase) {
    await saveReplyToSupabase(sessionId, reply);
  } else {
    saveReplyToMemory(sessionId, reply);
  }

  return reply;
}

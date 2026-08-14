import Anthropic from "@anthropic-ai/sdk";
import crypto from "crypto";
import { getSupabase } from "@/lib/supabase";
import { DEFAULT_TENANT, type TenantId } from "@/lib/tenants";

const NORMALIZE_MODEL = "claude-haiku-4-5-20251001";

export type KnowledgeType = "promocija" | "pravilo" | "faq";
/** `inactive` = was live, then switched off (expired promo, superseded rule). */
export type KnowledgeStatus = "pending" | "active" | "rejected" | "inactive";

export interface KnowledgeEntry {
  id: string;
  tenant: TenantId;
  type: KnowledgeType;
  title: string;
  body: string;
  special_instructions: string | null;
  raw_input: string | null;
  status: KnowledgeStatus;
  submitted_by: string | null;
  created_at: string;
  decided_at: string | null;
  decided_by: string | null;
  /** ISO timestamp after which the bot stops using the entry; null = no end date. */
  expires_at: string | null;
}

export interface SubmissionInput {
  tenant?: TenantId;
  type: KnowledgeType;
  title: string;
  rawInput: string;
  specialInstructions?: string;
  submittedBy?: string;
  /** ISO timestamp; the entry stops being used after it. */
  expiresAt?: string | null;
}

function hasSupabase(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// ---------------------------------------------------------------------------
// AI normalization — turns a raw casino.si submission into a clean, house-style
// entry the bot can use. Reviewed by the operator before going live, so a cheap
// model is fine; failures fall back to the raw text.
// ---------------------------------------------------------------------------

const NORMALIZER_SYSTEM = `Si urednik baze znanja za AI chatbota casino.si (slovenski spletni casino). Tvoja naloga: surov vnos osebja casino.si (nova promocija, sprememba pravila ali FAQ) pretvoriti v en čist, jedrnat vnos v slogu obstoječe baze.

Slog obstoječih vnosov:
- Slovenščina, sproščeno-profesionalen ton. Piši v 2. osebi množine (VIKANJE): "prejmete", "aktivirate", "vnesete" — nikoli tikanja.
- Uporabljaj IZKLJUČNO obstoječe, pravilne slovenske besede; ne izmišljuj glagolov. Za wagering piši "pogoj stavljenja (wagering) Nx", za stavo "maksimalna stava", za izplačilo "maksimalno izplačilo".
- Faktografsko: navedi kode, igre, zneske, pogoje TOČNO tako kot v vhodu. NE izmišljuj številk, datumov ali pogojev, ki jih v vhodu ni.
- Brez pozdravov in brez marketinških vzklikov.
- Če vhod opisuje promocijo, vključi: kako jo igralec prejme/aktivira, kaj dobi (kode, vrtljaji, znesek, igre) in pogoje (wagering, max stava, max izplačilo, omejitve), če so podani.

Vrni IZKLJUČNO veljaven JSON brez ograje (brez \`\`\`), v točno tej obliki:
{"title": "<kratek opisni naslov v slovenščini>", "body": "<en odstavek ali nekaj stavkov, normalizirana vsebina>"}

Če so podana posebna navodila (npr. "ne omenjaj proaktivno", "ekskluzivno, usmeri na podporo"), jih NE zapiši v body kot navodilo botu — body naj ostane vsebina; navodila obravnava sistem ločeno.`;

export async function normalizeSubmission(
  input: SubmissionInput
): Promise<{ title: string; body: string }> {
  const fallback = { title: input.title.trim() || "Nov vnos", body: input.rawInput.trim() };
  if (!process.env.ANTHROPIC_API_KEY) return fallback;

  const userContent = `Tip vnosa: ${input.type}
Predlagan naslov: ${input.title || "(ni podan)"}
Posebna navodila: ${input.specialInstructions?.trim() || "(jih ni)"}

Surov vnos osebja casino.si:
${input.rawInput.trim()}`;

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: NORMALIZE_MODEL,
      max_tokens: 1024,
      system: [{ type: "text", text: NORMALIZER_SYSTEM }],
      messages: [{ role: "user", content: userContent }],
    });
    const block = response.content.find((b) => b.type === "text");
    const text = block && block.type === "text" ? block.text.trim() : "";
    const jsonStr = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(jsonStr) as { title?: string; body?: string };
    const title = (parsed.title || "").trim();
    const body = (parsed.body || "").trim();
    if (!body) return fallback;
    return { title: title || fallback.title, body };
  } catch (err) {
    console.error("Knowledge normalize failed, using raw input:", err);
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function insertPending(
  input: SubmissionInput,
  normalized: { title: string; body: string }
): Promise<KnowledgeEntry> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("bot_knowledge")
    .insert({
      tenant: input.tenant || DEFAULT_TENANT,
      type: input.type,
      title: normalized.title,
      body: normalized.body,
      special_instructions: input.specialInstructions?.trim() || null,
      raw_input: input.rawInput.trim(),
      status: "pending",
      submitted_by: input.submittedBy || null,
      expires_at: input.expiresAt || null,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(`Knowledge insert failed: ${error?.message}`);
  return data as KnowledgeEntry;
}

export async function getById(id: string): Promise<KnowledgeEntry | null> {
  const supabase = getSupabase();
  const { data } = await supabase.from("bot_knowledge").select("*").eq("id", id).single();
  return (data as KnowledgeEntry) ?? null;
}

export async function listEntries(limit = 100, tenant: TenantId = DEFAULT_TENANT): Promise<KnowledgeEntry[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("bot_knowledge")
    .select("*")
    .eq("tenant", tenant)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as KnowledgeEntry[];
}

/**
 * Sets an entry's status. Returns the updated row, or null if the entry was
 * already decided (idempotent guard so a reused email link is a no-op).
 */
export async function decideEntry(
  id: string,
  status: "active" | "rejected",
  decidedBy: string
): Promise<{ entry: KnowledgeEntry | null; alreadyDecided: boolean }> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("bot_knowledge")
    .update({ status, decided_at: new Date().toISOString(), decided_by: decidedBy })
    .eq("id", id)
    .eq("status", "pending")
    .select("*")
    .single();

  if (error || !data) {
    const existing = await getById(id);
    if (existing && existing.status !== "pending") {
      return { entry: existing, alreadyDecided: true };
    }
    return { entry: null, alreadyDecided: false };
  }
  invalidateActiveCache();
  return { entry: data as KnowledgeEntry, alreadyDecided: false };
}

// ---------------------------------------------------------------------------
// Runtime injection into the bot prompt — only 'active' entries.
// Cached in-memory per serverless instance with a short TTL to avoid a DB hit
// on every chat message; an approval propagates within CACHE_TTL_MS.
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 60 * 1000;
const activeCache = new Map<TenantId, { section: string; expiresAt: number }>();

export function invalidateActiveCache(): void {
  activeCache.clear();
}

function formatSection(entries: KnowledgeEntry[]): string {
  if (entries.length === 0) return "";
  const blocks = entries.map((e) => {
    const lines = [`### ${e.title} [${e.type}]`, e.body.trim()];
    if (e.special_instructions?.trim()) {
      lines.push(`POSEBNO NAVODILO (obvezno upoštevaj): ${e.special_instructions.trim()}`);
    }
    return lines.join("\n");
  });
  return `\n\n## Dodatne promocije in pravila (potrjeno s strani operaterja)
Te informacije so del uradne baze znanja in imajo enako veljavo kot FAQ zgoraj. Če ima vnos POSEBNO NAVODILO, ga obvezno upoštevaj (npr. "ne omenjaj proaktivno" pomeni, da o tem govoriš le, če uporabnik sam načne temo).
${blocks.join("\n\n")}`;
}

/**
 * Returns the active-knowledge section to append to the system prompt, or "".
 * Non-fatal: any error (no Supabase, query failure) yields an empty section so
 * the bot keeps working on its static knowledge base.
 */
export async function getActiveKnowledgeSection(tenant: TenantId = DEFAULT_TENANT): Promise<string> {
  if (!hasSupabase()) return "";
  const now = Date.now();
  const cached = activeCache.get(tenant);
  if (cached && cached.expiresAt > now) return cached.section;

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("bot_knowledge")
      .select("*")
      .eq("status", "active")
      .eq("tenant", tenant)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("Knowledge active query failed:", error.message);
      return cached?.section ?? "";
    }
    const section = formatSection((data as KnowledgeEntry[]) || []);
    activeCache.set(tenant, { section, expiresAt: now + CACHE_TTL_MS });
    return section;
  } catch (err) {
    console.error("Knowledge active load failed:", err);
    return cached?.section ?? "";
  }
}

// ---------------------------------------------------------------------------
// HMAC decision tokens — let the operator approve/reject from a one-click email
// link without logging in. Token binds the entry id and the action.
// ---------------------------------------------------------------------------

function approvalSecret(): string | null {
  return process.env.KNOWLEDGE_APPROVAL_SECRET || null;
}

export function signDecisionToken(id: string, action: "approve" | "reject"): string | null {
  const secret = approvalSecret();
  if (!secret) return null;
  return crypto.createHmac("sha256", secret).update(`${id}:${action}`).digest("hex");
}

export function verifyDecisionToken(
  id: string,
  action: "approve" | "reject",
  token: string
): boolean {
  const expected = signDecisionToken(id, action);
  if (!expected || !token) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

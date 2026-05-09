import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "@/lib/supabase";

const ANALYSIS_MODEL = "claude-haiku-4-5-20251001";
const TZ = "Europe/Ljubljana";

export interface InsightStats {
  conversation_count: number;
  message_count: number;
  model: string;
  input_tokens: number;
  output_tokens: number;
}

export interface InsightResult {
  report_date: string;
  label: string;
  markdown: string;
  stats: InsightStats;
}

export interface InsightOptions {
  endUtc?: Date;
  hours?: number;
  label?: string;
  reportDate?: string;
}

interface ConversationDump {
  session_id: string;
  source: "Widget" | "LiveChat" | "Smoke";
  started_at: string;
  messages: { role: "user" | "assistant"; content: string; created_at: string }[];
}

function ljubljanaDateString(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function classifySource(sid: string): ConversationDump["source"] {
  if (sid.startsWith("lc_")) return "LiveChat";
  if (sid.startsWith("smoke-test-")) return "Smoke";
  return "Widget";
}

function redact(text: string): string {
  return text
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]")
    .replace(/(?:\+?386[\s\-]?|0)[1-9]\d?[\s\-]?\d{3}[\s\-]?\d{3,4}/g, "[telefon]")
    .replace(/\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}\b/g, "[iban]");
}

const ANALYZER_SYSTEM = `Si analitik kakovosti AI chatbota za casino.si. Tvoja naloga je dnevni pregled pogovorov in iskanje vzorcev za izboljšave.

Vhod: seznam pogovorov zadnjih 24 ur. Vsak pogovor ima vir (Widget = chat-bot.bet, LiveChat = casino.si support okno, Smoke = test), session_id, sporočila z vlogami user/assistant.

Izpiši markdown poročilo s točno temi sekcijami:

## Povzetek
2-4 vrstice — koliko pogovorov, kakšna je splošna kakovost, glavni opažaji.

## Težave po pogovorih
Samo pogovore kjer je nekaj NAROBE (napačen jezik, napačen odgovor, halucinacija, manjka FAQ podlaga, format problem, nepotrebno odvračanje). Format:

### {session_id} — {Vir}
- **Težava:** kratka diagnoza
- **User:** "{citat ki sproži težavo}"
- **Bot:** "{problematičen odgovor, skrajšaj če dolg}"
- **Predlog:** kratek konkreten popravek

Če ni težav, napiši "Ni najdenih napak."

## Predlogi za sistem
Konkretni, izvedljivi predlogi sprememb. Za vsakega navedi tip in vsebino:

- **Nov FAQ vnos** — vprašanje + predlagan odgovor (slovensko, ujemaj se s tonom obstoječih FAQ-jev)
- **System prompt pravilo** — eno vrstico v slogu obstoječih pravil ("Vedno X", "Nikoli Y")
- **Sprememba podatkov** — npr. "dodaj igro X med ponudnika Y"
- **Drugo** — karkoli kar opaziš

Vsak predlog mora imeti **Razlog:** s sklicem na konkreten pogovor (session_id) ali vzorec.

## Pozitivno
1-3 stvari ki bot dela dobro (samo če izstopajo).

## Statistika
- Pogovorov: N
- Sporočil: M (X user / Y bot)
- LiveChat / Widget razmerje
- Število pogovorov z najmanj 1 težavo

Pravila:
- Slovenščina razen v citatih
- Ne navajaj imen, e-pošte, telefonskih številk uporabnikov (so že redacted kot [email]/[telefon] — pusti tako)
- Citati naj bodo dobesedni iz sporočil
- Bodi konkreten, ne pavšalen — vsak predlog mora biti takoj izvedljiv brez dodatnega spraševanja
- Če vhod prazen, vrni samo "## Povzetek\nNi pogovorov v tem obdobju."`;

async function loadConversations(startUtc: Date, endUtc: Date): Promise<ConversationDump[]> {
  const supabase = getSupabase();

  const { data: convos, error } = await supabase
    .from("conversations")
    .select("id, session_id, created_at, updated_at")
    .gte("updated_at", startUtc.toISOString())
    .lt("updated_at", endUtc.toISOString())
    .order("updated_at", { ascending: false });

  if (error || !convos) {
    if (error) console.error("Insights: convos query failed", error);
    return [];
  }

  if (convos.length === 0) return [];

  const ids = convos.map((c) => c.id);
  const { data: msgs } = await supabase
    .from("messages")
    .select("conversation_id, role, content, created_at")
    .in("conversation_id", ids)
    .order("created_at", { ascending: true });

  const byConvo = new Map<string, ConversationDump["messages"]>();
  for (const m of msgs || []) {
    const arr = byConvo.get(m.conversation_id) || [];
    arr.push({ role: m.role, content: redact(m.content), created_at: m.created_at });
    byConvo.set(m.conversation_id, arr);
  }

  return convos
    .map((c) => ({
      session_id: c.session_id,
      source: classifySource(c.session_id),
      started_at: c.created_at,
      messages: byConvo.get(c.id) || [],
    }))
    .filter((c) => c.messages.length > 0);
}

function formatForPrompt(convos: ConversationDump[]): string {
  const lines: string[] = [];
  for (const c of convos) {
    lines.push(`---`);
    lines.push(`session_id: ${c.session_id}`);
    lines.push(`vir: ${c.source}`);
    lines.push(`začelo: ${c.started_at}`);
    for (const m of c.messages) {
      const role = m.role === "user" ? "USER" : "BOT";
      lines.push(`${role}: ${m.content}`);
    }
  }
  return lines.join("\n");
}

export async function generateDailyInsight(options: InsightOptions = {}): Promise<InsightResult> {
  const hours = options.hours ?? 24;
  const endUtc = options.endUtc ?? new Date();
  const startUtc = new Date(endUtc.getTime() - hours * 60 * 60 * 1000);
  const reportDate = options.reportDate ?? ljubljanaDateString(endUtc);
  const label = options.label ?? "daily";

  const convos = await loadConversations(startUtc, endUtc);
  const messageCount = convos.reduce((n, c) => n + c.messages.length, 0);

  const userContent = convos.length === 0
    ? `Ni pogovorov v obdobju (${hours}h).`
    : `Obdobje: ${startUtc.toISOString()} do ${endUtc.toISOString()} (UTC, trajanje ${hours}h)\nDatum poročila: ${reportDate} (Europe/Ljubljana)\nLabel: ${label}\nPogovorov: ${convos.length}, sporočil: ${messageCount}\n\n${formatForPrompt(convos)}`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const response = await client.messages.create({
    model: ANALYSIS_MODEL,
    max_tokens: 4096,
    system: [
      {
        type: "text",
        text: ANALYZER_SYSTEM,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userContent }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const markdown = textBlock && textBlock.type === "text" ? textBlock.text : "";

  if (!markdown) {
    throw new Error(`Insights: empty Claude response (stop_reason=${response.stop_reason})`);
  }

  return {
    report_date: reportDate,
    markdown,
    stats: {
      conversation_count: convos.length,
      message_count: messageCount,
      model: ANALYSIS_MODEL,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
  };
}

export async function persistInsight(result: InsightResult): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("daily_insights").upsert(
    {
      report_date: result.report_date,
      markdown: result.markdown,
      conversation_count: result.stats.conversation_count,
      message_count: result.stats.message_count,
      model: result.stats.model,
      input_tokens: result.stats.input_tokens,
      output_tokens: result.stats.output_tokens,
    },
    { onConflict: "report_date" }
  );
  if (error) throw new Error(`Insights: persist failed: ${error.message}`);
}

export async function listInsights(limit = 60): Promise<
  { report_date: string; conversation_count: number; message_count: number; created_at: string }[]
> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("daily_insights")
    .select("report_date, conversation_count, message_count, created_at")
    .order("report_date", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data;
}

export async function getInsight(reportDate: string): Promise<{
  report_date: string;
  markdown: string;
  conversation_count: number;
  message_count: number;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  created_at: string;
} | null> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("daily_insights")
    .select("report_date, markdown, conversation_count, message_count, model, input_tokens, output_tokens, created_at")
    .eq("report_date", reportDate)
    .single();
  return data ?? null;
}

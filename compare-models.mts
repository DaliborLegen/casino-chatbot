import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import Anthropic from "@anthropic-ai/sdk";
import { baseSystemPrompt } from "@/lib/system-prompt";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const SONNET = "claude-sonnet-4-6";
const HAIKU = "claude-haiku-4-5-20251001";

const questions = [
  "Kako lahko dvignem dobitek?",
  "Kakšen je minimalni polog in katere plačilne metode sprejemate?",
  "Pozabil sem geslo, kaj naj naredim?",
  "Zakaj moj dvig še ni bil izplačan, čakam že 3 dni in sem že jezen!",
  "Imam bonus 50 evrov ampak ne morem dvignit, zakaj? in a lahko igram book of ra z njim?",
  "Ali je casino.si legalen v Sloveniji in kdo vas nadzoruje?",
  "Mislim da imam problem z igranjem, porabim preveč. Kaj lahko naredim?",
];

async function ask(model: string, q: string): Promise<{ text: string; usage: Anthropic.Usage }> {
  const r = await client.messages.create({
    model,
    max_tokens: 1024,
    system: [{ type: "text", text: baseSystemPrompt, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: q }],
  });
  const b = r.content.find((c) => c.type === "text");
  return { text: b && b.type === "text" ? b.text : "(prazno)", usage: r.usage };
}

for (let i = 0; i < questions.length; i++) {
  const q = questions[i];
  console.log("\n\n============================================================");
  console.log(`VPRAŠANJE ${i + 1}: ${q}`);
  console.log("============================================================");
  const [s, h] = await Promise.all([ask(SONNET, q), ask(HAIKU, q)]);
  console.log("\n----- SONNET 4.6 -----");
  console.log(s.text);
  console.log("\n----- HAIKU 4.5 -----");
  console.log(h.text);
}
console.log("\n\n[gotovo]");

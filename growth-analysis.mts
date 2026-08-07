import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function pull(table: string, cols: string) {
  const out: any[] = [];
  let from = 0; const page = 1000;
  for (;;) {
    const { data, error } = await sb.from(table).select(cols).order("created_at", { ascending: true }).range(from, from + page - 1);
    if (error) { console.error(table, error); process.exit(1); }
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < page) break;
    from += page;
  }
  return out;
}

const msgs = await pull("messages", "created_at, role, conversation_id, content");
const convs = await pull("conversations", "id, created_at, tenant, session_id");
const tenantOf: Record<string,string> = {}, sessOf: Record<string,string> = {};
for (const c of convs) { tenantOf[c.id] = c.tenant || "casino"; sessOf[c.id] = c.session_id || ""; }

const casinoMsgs = msgs.filter(m => (tenantOf[m.conversation_id]||"casino") === "casino");
const dayKey = (s:string) => s.slice(0,10);
const weekKey = (s:string) => { const d=new Date(s); const day=(d.getUTCDay()+6)%7; const mon=new Date(d); mon.setUTCDate(d.getUTCDate()-day); return mon.toISOString().slice(0,10); };

// Weekly: user msgs, new conversations, avg msgs/conv, avg chars/user-msg
type Agg = { userMsgs:number; asstMsgs:number; convs:Set<string>; userChars:number };
const wk: Record<string, Agg> = {};
for (const m of casinoMsgs) {
  const k = weekKey(m.created_at);
  wk[k] ??= { userMsgs:0, asstMsgs:0, convs:new Set(), userChars:0 };
  wk[k].convs.add(m.conversation_id);
  if (m.role === "user") { wk[k].userMsgs++; wk[k].userChars += (m.content||"").length; }
  else wk[k].asstMsgs++;
}
// new conversations per week (by conversation created_at)
const newConvWk: Record<string, number> = {};
for (const c of convs) { if ((c.tenant||"casino")!=="casino") continue; const k=weekKey(c.created_at); newConvWk[k]=(newConvWk[k]||0)+1; }

console.log("CASINO — po TEDNIH (teden se začne v pon, UTC)");
console.log("teden       | uporab.sporočil | aktiv.pogovorov | novih pog. | sporočil/pogovor | povpr.znakov/vpr.");
for (const k of Object.keys(wk).sort()) {
  const a = wk[k];
  const mpc = a.convs.size ? (a.userMsgs+a.asstMsgs)/a.convs.size : 0;
  const cpu = a.userMsgs ? a.userChars/a.userMsgs : 0;
  console.log(`${k} |   ${String(a.userMsgs).padStart(5)}        |    ${String(a.convs.size).padStart(4)}         |   ${String(newConvWk[k]||0).padStart(4)}     |     ${mpc.toFixed(1).padStart(5)}       |    ${cpu.toFixed(0).padStart(5)}`);
}

// Last 40 days daily
console.log("\nCASINO — zadnjih ~40 dni po DNEVIH");
const dayAgg: Record<string,{u:number;a:number;c:Set<string>}> = {};
for (const m of casinoMsgs) { const k=dayKey(m.created_at); dayAgg[k] ??= {u:0,a:0,c:new Set()}; dayAgg[k].c.add(m.conversation_id); if(m.role==="user")dayAgg[k].u++; else dayAgg[k].a++; }
const days = Object.keys(dayAgg).sort().slice(-40);
for (const k of days) console.log(`${k}  vpr:${String(dayAgg[k].u).padStart(4)}  odg:${String(dayAgg[k].a).padStart(4)}  pog:${String(dayAgg[k].c.size).padStart(3)}`);

// Anomaly: biggest single days & sessions with most messages
console.log("\nNAJVEČJI POSAMEZNI DNEVI (vpr.):");
Object.entries(dayAgg).map(([k,v])=>[k,v.u] as [string,number]).sort((a,b)=>b[1]-a[1]).slice(0,6).forEach(([k,v])=>console.log(`  ${k}: ${v}`));

console.log("\nPOGOVORI Z NAJVEČ SPOROČILI (možna zanka/anomalija):");
const perConv: Record<string,number> = {};
for (const m of casinoMsgs) perConv[m.conversation_id]=(perConv[m.conversation_id]||0)+1;
Object.entries(perConv).sort((a,b)=>b[1]-a[1]).slice(0,8).forEach(([id,n])=>console.log(`  ${n} sporočil | session ${sessOf[id]}`));

console.log("\n[gotovo]");

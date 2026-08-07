import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Manual .env.local parse (no dotenv dependency)
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb = createClient(url, key);

// Pull all USER messages (each ≈ one Claude call sharing the tenant's cached prompt)
type Row = { created_at: string; conversation_id: string };
const rows: Row[] = [];
let from = 0;
const page = 1000;
for (;;) {
  const { data, error } = await sb
    .from("messages")
    .select("created_at, conversation_id")
    .eq("role", "user")
    .order("created_at", { ascending: true })
    .range(from, from + page - 1);
  if (error) { console.error(error); process.exit(1); }
  if (!data || data.length === 0) break;
  rows.push(...data as Row[]);
  if (data.length < page) break;
  from += page;
}

// Map conversation -> tenant
const convIds = [...new Set(rows.map(r => r.conversation_id))];
const tenantOf: Record<string, string> = {};
for (let i = 0; i < convIds.length; i += 500) {
  const chunk = convIds.slice(i, i + 500);
  const { data } = await sb.from("conversations").select("id, tenant").in("id", chunk);
  for (const c of (data || []) as { id: string; tenant: string }[]) tenantOf[c.id] = c.tenant || "casino";
}

console.log(`Skupaj uporabniških sporočil (Claude klicev): ${rows.length}`);
if (rows.length === 0) process.exit(0);
console.log(`Obdobje: ${rows[0].created_at.slice(0,10)} .. ${rows[rows.length-1].created_at.slice(0,10)}`);

// Per-tenant gap analysis. Cache warmth depends on time since the PREVIOUS
// Claude call that shares the same cached prefix (same tenant).
for (const tenant of ["casino", "supercasino"]) {
  const ts = rows.filter(r => (tenantOf[r.conversation_id] || "casino") === tenant)
                 .map(r => new Date(r.created_at).getTime())
                 .sort((a,b) => a-b);
  if (ts.length === 0) continue;

  const buckets = { warm5: 0, cold5warm60: 0, cold60: 0, first: 0 };
  const gapsMin: number[] = [];
  for (let i = 0; i < ts.length; i++) {
    if (i === 0) { buckets.first++; continue; }
    const gapMin = (ts[i] - ts[i-1]) / 60000;
    gapsMin.push(gapMin);
    if (gapMin <= 5) buckets.warm5++;
    else if (gapMin <= 60) buckets.cold5warm60++;
    else buckets.cold60++;
  }
  const n = ts.length;
  const sorted = [...gapsMin].sort((a,b)=>a-b);
  const median = sorted.length ? sorted[Math.floor(sorted.length/2)] : 0;

  // Days span for daily volume
  const days = Math.max(1, (ts[ts.length-1] - ts[0]) / 86400000);

  console.log(`\n================ ${tenant.toUpperCase()} ================`);
  console.log(`Klicev skupaj: ${n}  |  dni: ${days.toFixed(0)}  |  povprečno/dan: ${(n/days).toFixed(1)}`);
  console.log(`Mediana razmika med klici: ${median.toFixed(1)} min`);
  console.log(`\nRazmiki do prejšnjega klica (določa cache):`);
  console.log(`  <= 5 min  (TOPEL pri 5-min cache):        ${buckets.warm5}  (${(100*buckets.warm5/(n-1||1)).toFixed(1)}%)`);
  console.log(`  5-60 min  (HLADEN pri 5m, TOPEL pri 1h):  ${buckets.cold5warm60}  (${(100*buckets.cold5warm60/(n-1||1)).toFixed(1)}%)  <-- tu je prihranek`);
  console.log(`  > 60 min  (HLADEN pri obeh):              ${buckets.cold60}  (${(100*buckets.cold60/(n-1||1)).toFixed(1)}%)`);

  // Hour-of-day histogram (UTC)
  const byHour = new Array(24).fill(0);
  for (const r of rows) {
    if ((tenantOf[r.conversation_id]||"casino")!==tenant) continue;
    byHour[new Date(r.created_at).getUTCHours()]++;
  }
  console.log(`\nPo urah dneva (UTC, SLO = +2):`);
  console.log(byHour.map((c,h)=>`${String(h).padStart(2,"0")}:${c}`).join("  "));
}
console.log("\n[gotovo]");

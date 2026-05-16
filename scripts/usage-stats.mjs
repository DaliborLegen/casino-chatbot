import pg from "pg";

const raw = process.env.POSTGRES_URL_NON_POOLING;
if (!raw) { console.error("POSTGRES_URL_NON_POOLING not set"); process.exit(1); }

const u = new URL(raw);
u.searchParams.delete("sslmode");
const client = new pg.Client({ connectionString: u.toString(), ssl: { rejectUnauthorized: false } });
await client.connect();

const last7 = await client.query(`
  select
    date_trunc('day', m.created_at)::date as day,
    count(*) filter (where m.role='user') as user_msgs,
    count(*) filter (where m.role='assistant') as bot_msgs,
    count(distinct m.conversation_id) as convos
  from messages m
  where m.created_at > now() - interval '7 days'
  group by 1 order by 1 desc
`);

const totals = await client.query(`
  select
    count(*) filter (where m.role='user') as user_msgs,
    count(*) filter (where m.role='assistant') as bot_msgs,
    count(distinct m.conversation_id) as convos
  from messages m
  where m.created_at > now() - interval '7 days'
`);

const ins = await client.query(`select report_date, conversation_count, message_count, input_tokens, output_tokens from daily_insights order by report_date desc limit 7`);

console.log("=== ZADNJIH 7 DNI ===");
for (const r of last7.rows) console.log(`${r.day}: ${r.convos} pogovorov, ${r.user_msgs} user, ${r.bot_msgs} bot`);
console.log("\n=== SKUPAJ 7 DNI ===");
console.log(totals.rows[0]);
console.log("\n=== DAILY INSIGHTS ===");
for (const r of ins.rows) console.log(`${r.report_date}: ${r.conversation_count} pog, ${r.message_count} msg, in=${r.input_tokens}, out=${r.output_tokens}`);

await client.end();

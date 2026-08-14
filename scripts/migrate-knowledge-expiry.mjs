// Dodaj rok veljavnosti in status 'inactive' na bot_knowledge.
// Idempotentno — lahko poženeš večkrat.
// Zagon: node scripts/migrate-knowledge-expiry.mjs   (rabi POSTGRES_URL_NON_POOLING)
import pg from "pg";

const SQL = `
alter table bot_knowledge add column if not exists expires_at timestamptz;

alter table bot_knowledge drop constraint if exists bot_knowledge_status_check;
alter table bot_knowledge add constraint bot_knowledge_status_check
  check (status in ('pending','active','rejected','inactive'));

create index if not exists idx_bot_knowledge_expires on bot_knowledge(expires_at);
`;

const raw = process.env.POSTGRES_URL_NON_POOLING;
if (!raw) {
  console.error("POSTGRES_URL_NON_POOLING not set");
  process.exit(1);
}

const u = new URL(raw);
u.searchParams.delete("sslmode");
const client = new pg.Client({
  connectionString: u.toString(),
  ssl: { rejectUnauthorized: false },
});
await client.connect();
try {
  await client.query(SQL);
  const { rows } = await client.query(
    "select column_name, data_type from information_schema.columns where table_name='bot_knowledge' order by ordinal_position"
  );
  console.log("bot_knowledge columns:");
  for (const r of rows) console.log(`  ${r.column_name}  ${r.data_type}`);
  const { rows: checks } = await client.query(
    "select pg_get_constraintdef(oid) as def from pg_constraint where conname='bot_knowledge_status_check'"
  );
  for (const c of checks) console.log(`status check: ${c.def}`);
} finally {
  await client.end();
}

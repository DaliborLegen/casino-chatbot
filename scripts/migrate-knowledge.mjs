import pg from "pg";

const SQL = `
create table if not exists bot_knowledge (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'promocija',
  title text not null,
  body text not null,
  special_instructions text,
  raw_input text,
  status text not null default 'pending' check (status in ('pending','active','rejected')),
  submitted_by text,
  created_at timestamptz default now(),
  decided_at timestamptz,
  decided_by text
);

create index if not exists idx_bot_knowledge_status on bot_knowledge(status, created_at desc);
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
} finally {
  await client.end();
}

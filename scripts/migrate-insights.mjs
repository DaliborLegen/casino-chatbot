import pg from "pg";

const SQL = `
create table if not exists daily_insights (
  id uuid primary key default gen_random_uuid(),
  report_date date unique not null,
  markdown text not null,
  conversation_count int not null default 0,
  message_count int not null default 0,
  model text,
  input_tokens int,
  output_tokens int,
  created_at timestamptz default now()
);

create index if not exists idx_daily_insights_date on daily_insights(report_date desc);
`;

const url = process.env.POSTGRES_URL_NON_POOLING;
if (!url) {
  console.error("POSTGRES_URL_NON_POOLING not set");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});
await client.connect();
try {
  await client.query(SQL);
  const { rows } = await client.query(
    "select column_name, data_type from information_schema.columns where table_name='daily_insights' order by ordinal_position"
  );
  console.log("daily_insights columns:");
  for (const r of rows) console.log(`  ${r.column_name}  ${r.data_type}`);
} finally {
  await client.end();
}

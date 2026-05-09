import pg from "pg";

const SQL = `
alter table daily_insights add column if not exists label text not null default 'daily';

do $$ begin
  if exists (
    select 1 from pg_constraint
    where conname = 'daily_insights_report_date_key' and conrelid = 'daily_insights'::regclass
  ) then
    alter table daily_insights drop constraint daily_insights_report_date_key;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'daily_insights_report_date_label_key' and conrelid = 'daily_insights'::regclass
  ) then
    alter table daily_insights add constraint daily_insights_report_date_label_key unique (report_date, label);
  end if;
end $$;

create index if not exists idx_daily_insights_date_label on daily_insights(report_date desc, label);
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
    "select column_name, data_type, column_default from information_schema.columns where table_name='daily_insights' order by ordinal_position"
  );
  console.log("daily_insights columns:");
  for (const r of rows) console.log(`  ${r.column_name}  ${r.data_type}  default=${r.column_default ?? ""}`);
  const { rows: cons } = await client.query(
    "select conname from pg_constraint where conrelid='daily_insights'::regclass and contype='u'"
  );
  console.log("unique constraints:", cons.map((c) => c.conname));
} finally {
  await client.end();
}

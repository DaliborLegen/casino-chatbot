-- Conversations table
create table conversations (
  id uuid primary key default gen_random_uuid(),
  session_id text unique not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  metadata jsonb default '{}'
);

-- Messages table
create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);

-- Index for fast lookups
create index idx_messages_conversation on messages(conversation_id, created_at);
create index idx_conversations_session on conversations(session_id);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger conversations_updated_at
  before update on conversations
  for each row execute function update_updated_at();

-- Daily insights reports (one per (report_date, label))
create table if not exists daily_insights (
  id uuid primary key default gen_random_uuid(),
  report_date date not null,
  label text not null default 'daily',
  markdown text not null,
  conversation_count int not null default 0,
  message_count int not null default 0,
  model text,
  input_tokens int,
  output_tokens int,
  created_at timestamptz default now(),
  unique (report_date, label)
);

create index if not exists idx_daily_insights_date_label on daily_insights(report_date desc, label);

-- Dynamic knowledge entries (promos/rules added by casino.si via /admin/pravila).
-- Approval-gated: status starts as 'pending', goes 'active' only after operator approval,
-- and only 'active' rows are injected into the bot's system prompt at runtime.
create table if not exists bot_knowledge (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'promocija',          -- promocija | pravilo | faq
  title text not null,
  body text not null,                               -- normalized text the bot reads
  special_instructions text,                        -- e.g. "ne omenjaj proaktivno"
  raw_input text,                                   -- original submission, for audit
  status text not null default 'pending' check (status in ('pending','active','rejected','inactive')),
  submitted_by text,
  created_at timestamptz default now(),
  decided_at timestamptz,
  decided_by text,
  expires_at timestamptz                            -- optional: bot ignores the entry after this
);

create index if not exists idx_bot_knowledge_status on bot_knowledge(status, created_at desc);
create index if not exists idx_bot_knowledge_expires on bot_knowledge(expires_at);

-- ---------------------------------------------------------------------------
-- Multi-tenant (2026-07): one deployment serves multiple casinos.
-- tenant: 'casino' (casino.si) | 'supercasino' (supercasino.si)
-- Applied to production 2026-07-21.
-- ---------------------------------------------------------------------------
alter table conversations add column if not exists tenant text not null default 'casino';
alter table bot_knowledge add column if not exists tenant text not null default 'casino';
alter table daily_insights add column if not exists tenant text not null default 'casino';

create index if not exists idx_conversations_tenant on conversations(tenant, updated_at desc);
create index if not exists idx_bot_knowledge_tenant on bot_knowledge(tenant, status, created_at desc);

-- daily_insights uniqueness now includes tenant (one report per date+label+tenant)
alter table daily_insights drop constraint if exists daily_insights_report_date_label_key;
create unique index if not exists idx_daily_insights_unique on daily_insights(report_date, label, tenant);

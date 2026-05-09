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

-- Daily insights reports (one per UTC date)
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

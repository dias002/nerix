create extension if not exists "uuid-ossp";

create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  email text unique,
  phone text unique,
  display_name text,
  country_code text not null default 'KZ',
  language text not null default 'ru',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists wallets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id),
  available_credits bigint not null default 0,
  reserved_credits bigint not null default 0,
  currency text not null default 'NERIX',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, currency)
);

create table if not exists ledger_entries (
  id uuid primary key default uuid_generate_v4(),
  wallet_id uuid not null references wallets(id),
  type text not null,
  amount_credits bigint not null,
  balance_after_credits bigint not null,
  reference_type text,
  reference_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ledger_entries_wallet_created_idx
  on ledger_entries(wallet_id, created_at desc);

create table if not exists payments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id),
  provider text not null,
  provider_payment_id text,
  status text not null,
  amount_minor bigint not null,
  currency text not null,
  credits_to_add bigint not null,
  idempotency_key text unique,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ai_providers (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique,
  name text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists ai_models (
  id uuid primary key default uuid_generate_v4(),
  provider_id uuid not null references ai_providers(id),
  code text not null,
  modality text not null,
  input_price_per_unit numeric(12, 6) not null default 0,
  output_price_per_unit numeric(12, 6) not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (provider_id, code)
);

create table if not exists country_provider_rules (
  id uuid primary key default uuid_generate_v4(),
  country_code text not null,
  provider_id uuid not null references ai_providers(id),
  allowed boolean not null default true,
  reason text,
  created_at timestamptz not null default now(),
  unique (country_code, provider_id)
);

create table if not exists agents (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique,
  name text not null,
  category text not null,
  description text not null default '',
  system_prompt text not null default '',
  default_model_id uuid references ai_models(id),
  price_multiplier numeric(8, 3) not null default 1,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists conversations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id),
  agent_id uuid references agents(id),
  title text,
  language text not null default 'ru',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references conversations(id),
  role text not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_created_idx
  on messages(conversation_id, created_at asc);

create table if not exists files (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id),
  storage_key text not null,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  status text not null default 'uploaded',
  created_at timestamptz not null default now()
);

create table if not exists memory_items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id),
  title text not null,
  content text not null,
  source text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists usage_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id),
  conversation_id uuid references conversations(id),
  message_id uuid references messages(id),
  agent_id uuid references agents(id),
  provider_id uuid references ai_providers(id),
  model_id uuid references ai_models(id),
  input_units bigint not null default 0,
  output_units bigint not null default 0,
  charged_credits bigint not null default 0,
  raw_usage jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists generation_jobs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id),
  agent_id uuid references agents(id),
  modality text not null,
  status text not null default 'queued',
  prompt text not null,
  result_file_id uuid references files(id),
  reserved_credits bigint not null default 0,
  final_credits bigint,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default uuid_generate_v4(),
  actor_user_id uuid references users(id),
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into ai_providers (code, name)
values
  ('mock-provider', 'Local Mock Provider')
on conflict (code) do nothing;


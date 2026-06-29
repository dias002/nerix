import type { DatabaseClient } from "./database.types.js";

export async function runDatabaseMigrations(database: DatabaseClient) {
  await database.query(`create extension if not exists "uuid-ossp"`);
  await database.query(`create extension if not exists pg_trgm`);

  await database.query(`
    create table if not exists users (
      id uuid primary key default uuid_generate_v4(),
      email text unique,
      phone text unique,
      password_hash text,
      system_role text not null default 'user',
      display_name text,
      country_code text not null default 'KZ',
      language text not null default 'ru',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await database.query(`
    create table if not exists wallets (
      id uuid primary key default uuid_generate_v4(),
      user_id uuid not null references users(id),
      available_credits bigint not null default 0,
      reserved_credits bigint not null default 0,
      currency text not null default 'NOMDUCHAT',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (user_id, currency)
    )
  `);

  await database.query(`
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
    )
  `);

  await database.query(`
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
    )
  `);

  await database.query(`
    create table if not exists ai_providers (
      id uuid primary key default uuid_generate_v4(),
      code text not null unique,
      name text not null,
      enabled boolean not null default true,
      created_at timestamptz not null default now()
    )
  `);

  await database.query(`
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
    )
  `);

  await database.query(`
    create table if not exists country_provider_rules (
      id uuid primary key default uuid_generate_v4(),
      country_code text not null,
      provider_id uuid not null references ai_providers(id),
      allowed boolean not null default true,
      reason text,
      created_at timestamptz not null default now(),
      unique (country_code, provider_id)
    )
  `);

  await database.query(`
    create table if not exists agents (
      id uuid primary key default uuid_generate_v4(),
      slug text not null unique,
      name text not null,
      category text not null,
      description text not null default '',
      system_prompt text not null default '',
      default_model_id uuid references ai_models(id),
      input_types text[] not null default array['text'],
      output_types text[] not null default array['text'],
      default_model text not null default 'text-primary',
      fallback_models text[] not null default array[]::text[],
      country_denylist text[] not null default array[]::text[],
      price_multiplier numeric(8, 3) not null default 1,
      enabled boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await database.query(`
    create table if not exists conversations (
      id uuid primary key default uuid_generate_v4(),
      user_id uuid not null references users(id),
      agent_id uuid references agents(id),
      title text,
      language text not null default 'ru',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await database.query(`
    create table if not exists messages (
      id uuid primary key default uuid_generate_v4(),
      conversation_id uuid not null references conversations(id),
      role text not null,
      content text not null,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    )
  `);

  await database.query(`
    create table if not exists files (
      id uuid primary key default uuid_generate_v4(),
      user_id uuid not null references users(id),
      storage_key text not null,
      original_name text not null,
      mime_type text not null,
      size_bytes bigint not null,
      status text not null default 'uploaded',
      created_at timestamptz not null default now()
    )
  `);

  await database.query(`
    create table if not exists memory_items (
      id uuid primary key default uuid_generate_v4(),
      user_id uuid not null references users(id),
      title text not null,
      content text not null,
      source text,
      enabled boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await database.query(`
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
    )
  `);

  await database.query(`
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
    )
  `);

  await database.query(`
    alter table generation_jobs
      add column if not exists provider text,
      add column if not exists model text,
      add column if not exists reservation_id uuid,
      add column if not exists result_url text,
      add column if not exists result_mime_type text,
      add column if not exists metadata jsonb not null default '{}'::jsonb
  `);

  await database.query(`
    create table if not exists audit_logs (
      id uuid primary key default uuid_generate_v4(),
      actor_user_id uuid references users(id),
      action text not null,
      entity_type text,
      entity_id text,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    )
  `);

  await database.query(`
    create table if not exists feature_flags (
      id uuid primary key default uuid_generate_v4(),
      key text not null unique,
      label text not null,
      description text not null default '',
      enabled boolean not null default false,
      audience text not null default 'all',
      rollout_percent integer not null default 100 check (rollout_percent >= 0 and rollout_percent <= 100),
      metadata jsonb not null default '{}'::jsonb,
      updated_by_user_id uuid references users(id) on delete set null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await database.query(`
    create table if not exists ai_provider_settings (
      id uuid primary key default uuid_generate_v4(),
      provider_code text not null unique,
      name text not null,
      enabled boolean not null default false,
      model text not null default '',
      traffic_mode text not null default 'paused',
      modalities text[] not null default array[]::text[],
      country_policy jsonb not null default '{}'::jsonb,
      metadata jsonb not null default '{}'::jsonb,
      updated_by_user_id uuid references users(id) on delete set null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await database.query(`
    create table if not exists promotions (
      id uuid primary key default uuid_generate_v4(),
      slug text not null unique,
      title text not null,
      body text not null default '',
      placement text not null default 'global',
      audience text not null default 'all',
      active boolean not null default false,
      starts_at timestamptz,
      ends_at timestamptz,
      priority integer not null default 100,
      metadata jsonb not null default '{}'::jsonb,
      updated_by_user_id uuid references users(id) on delete set null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await database.query(`
    create table if not exists content_blocks (
      id uuid primary key default uuid_generate_v4(),
      key text not null,
      locale text not null default 'ru',
      title text not null default '',
      body text not null default '',
      placement text not null default 'app',
      active boolean not null default true,
      metadata jsonb not null default '{}'::jsonb,
      updated_by_user_id uuid references users(id) on delete set null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (key, locale)
    )
  `);

  await database.query(`
    alter table users
      add column if not exists password_hash text
  `);

  await database.query(`
    alter table users
      add column if not exists system_role text not null default 'user'
  `);

  await database.query(`
    alter table agents
      add column if not exists input_types text[] not null default array['text'],
      add column if not exists output_types text[] not null default array['text'],
      add column if not exists default_model text not null default 'text-primary',
      add column if not exists fallback_models text[] not null default array[]::text[],
      add column if not exists country_denylist text[] not null default array[]::text[]
  `);

  await database.query(`
    create table if not exists credit_reservations (
      id uuid primary key default uuid_generate_v4(),
      wallet_id uuid not null references wallets(id),
      user_id uuid not null references users(id),
      amount_reserved bigint not null,
      amount_captured bigint not null default 0,
      amount_refunded bigint not null default 0,
      status text not null default 'open',
      reference_id text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await database.query(`
    create index if not exists credit_reservations_wallet_created_idx
      on credit_reservations(wallet_id, created_at desc)
  `);

  await database.query(`
    create unique index if not exists ledger_entries_subscription_topup_once_idx
      on ledger_entries(wallet_id, reference_id)
      where type = 'topup'
        and reference_type = 'subscription'
        and reference_id is not null
  `);

  await database.query(`
    create table if not exists plans (
      id uuid primary key default uuid_generate_v4(),
      slug text not null unique,
      name text not null,
      monthly_credits bigint not null,
      context_tokens bigint not null default 0,
      description text not null default '',
      enabled boolean not null default true,
      sort_order integer not null default 100,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await database.query(`
    create table if not exists plan_prices (
      id uuid primary key default uuid_generate_v4(),
      plan_id uuid not null references plans(id),
      country_code text not null,
      provider text not null,
      currency text not null,
      amount_minor bigint not null,
      price_source text not null default 'mashagpt_benchmark_draft',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (plan_id, country_code)
    )
  `);

  await database.query(`
    create table if not exists subscription_checkouts (
      id uuid primary key default uuid_generate_v4(),
      user_id uuid not null references users(id),
      plan_slug text not null,
      country_code text not null,
      provider text not null,
      currency text not null,
      amount_minor bigint not null,
      status text not null default 'pending',
      credits_granted boolean not null default false,
      checkout_url text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await database.query(`
    alter table subscription_checkouts
      add column if not exists provider_checkout_id text not null default ''
  `);

  await database.query(`
    create index if not exists subscription_checkouts_user_created_idx
      on subscription_checkouts(user_id, created_at desc)
  `);

  await database.query(`
    create table if not exists subscriptions (
      id uuid primary key default uuid_generate_v4(),
      user_id uuid not null references users(id),
      plan_slug text not null,
      status text not null,
      country_code text not null,
      provider text not null,
      current_period_start timestamptz not null,
      current_period_end timestamptz not null,
      cancel_at_period_end boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await database.query(`
    create index if not exists subscriptions_user_status_created_idx
      on subscriptions(user_id, status, created_at desc)
  `);

  await database.query(`
    create table if not exists oauth_accounts (
      id uuid primary key default uuid_generate_v4(),
      user_id uuid not null references users(id),
      provider text not null,
      provider_user_id text not null,
      email text,
      display_name text,
      raw_profile jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (provider, provider_user_id)
    )
  `);

  await database.query(`
    create index if not exists oauth_accounts_user_provider_idx
      on oauth_accounts(user_id, provider)
  `);

  await database.query(`
    create table if not exists password_reset_tokens (
      id uuid primary key default uuid_generate_v4(),
      user_id uuid not null references users(id),
      token_hash text not null unique,
      expires_at timestamptz not null,
      used_at timestamptz,
      created_at timestamptz not null default now()
    )
  `);

  await database.query(`
    create index if not exists password_reset_tokens_user_created_idx
      on password_reset_tokens(user_id, created_at desc)
  `);

  await database.query(`
    create index if not exists password_reset_tokens_active_idx
      on password_reset_tokens(token_hash, expires_at)
      where used_at is null
  `);

  await database.query(`
    create table if not exists subscription_events (
      id uuid primary key default uuid_generate_v4(),
      subscription_id uuid references subscriptions(id),
      checkout_id uuid references subscription_checkouts(id),
      event_type text not null,
      provider text not null,
      idempotency_key text not null unique,
      payload jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    )
  `);

  await database.query(`
    create table if not exists business_workspaces (
      id uuid primary key default uuid_generate_v4(),
      user_id uuid not null references users(id),
      name text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (user_id)
    )
  `);

  await database.query(`
    create table if not exists business_members (
      id uuid primary key default uuid_generate_v4(),
      workspace_id uuid not null references business_workspaces(id) on delete cascade,
      user_id uuid references users(id) on delete set null,
      seat_key text,
      invited_email text,
      name text not null,
      role_key text not null,
      role_title text not null,
      access text not null,
      status text not null default 'offline',
      sort_order integer not null default 100,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await database.query(`
    alter table business_members
      add column if not exists user_id uuid references users(id) on delete set null,
      add column if not exists seat_key text,
      add column if not exists invited_email text
  `);

  await database.query(`
    drop index if exists business_members_workspace_seat_key_idx
  `);

  await database.query(`
    create unique index if not exists business_members_workspace_seat_key_idx
      on business_members(workspace_id, seat_key)
  `);

  await database.query(`
    create index if not exists business_members_user_workspace_idx
      on business_members(user_id, workspace_id)
      where user_id is not null
  `);

  await database.query(`
    create table if not exists business_groups (
      id uuid primary key default uuid_generate_v4(),
      workspace_id uuid not null references business_workspaces(id) on delete cascade,
      name text not null,
      purpose text not null default 'team',
      created_by_user_id uuid references users(id) on delete set null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (workspace_id, name)
    )
  `);

  await database.query(`
    create unique index if not exists business_groups_workspace_name_idx
      on business_groups(workspace_id, name)
  `);

  await database.query(`
    create table if not exists business_group_members (
      id uuid primary key default uuid_generate_v4(),
      group_id uuid not null references business_groups(id) on delete cascade,
      member_id uuid not null references business_members(id) on delete cascade,
      role_key text not null default 'member',
      created_at timestamptz not null default now(),
      unique (group_id, member_id)
    )
  `);

  await database.query(`
    create unique index if not exists business_group_members_group_member_idx
      on business_group_members(group_id, member_id)
  `);

  await database.query(`
    create table if not exists business_deals (
      id uuid primary key default uuid_generate_v4(),
      workspace_id uuid not null references business_workspaces(id) on delete cascade,
      slug text not null,
      client text not null,
      request text not null,
      stage text not null,
      amount text not null,
      source text not null,
      next_step text not null,
      problem text not null,
      sort_order integer not null default 100,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (workspace_id, slug)
    )
  `);

  await database.query(`
    create table if not exists business_deal_notes (
      id uuid primary key default uuid_generate_v4(),
      deal_id uuid not null references business_deals(id) on delete cascade,
      text text not null,
      created_at timestamptz not null default now()
    )
  `);

  await database.query(`
    create index if not exists business_deal_notes_deal_created_idx
      on business_deal_notes(deal_id, created_at asc)
  `);

  await database.query(`
    create table if not exists business_ideas (
      id uuid primary key default uuid_generate_v4(),
      workspace_id uuid not null references business_workspaces(id) on delete cascade,
      slug text not null,
      advisor_key text not null,
      title text not null,
      effort text not null,
      effect text not null,
      text text not null,
      next_step text not null,
      status text not null default 'suggested',
      sort_order integer not null default 100,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (workspace_id, slug)
    )
  `);

  await database.query(`
    create index if not exists business_ideas_workspace_status_idx
      on business_ideas(workspace_id, status)
  `);

  await database.query(`
    create table if not exists business_websites (
      id uuid primary key default uuid_generate_v4(),
      user_id uuid not null references users(id),
      workspace_id uuid references business_workspaces(id) on delete set null,
      country text not null default 'KZ',
      status text not null default 'draft',
      slug text not null unique,
      title text not null,
      prompt text not null default '',
      site_type text not null default 'landing',
      style text not null default 'clean',
      content jsonb not null default '{}'::jsonb,
      publication_path text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      published_at timestamptz
    )
  `);

  await database.query(`
    create index if not exists business_websites_user_updated_idx
      on business_websites(user_id, updated_at desc)
  `);

  await database.query(`
    create index if not exists business_websites_workspace_status_idx
      on business_websites(workspace_id, status)
  `);

  await database.query(`
    create table if not exists business_employee_activity (
      id uuid primary key default uuid_generate_v4(),
      workspace_id uuid not null references business_workspaces(id) on delete cascade,
      member_id uuid references business_members(id) on delete set null,
      user_id uuid references users(id) on delete set null,
      conversation_id uuid references conversations(id) on delete set null,
      message_id uuid references messages(id) on delete set null,
      activity_type text not null,
      amount integer not null default 1,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    )
  `);

  await database.query(`
    create index if not exists business_employee_activity_workspace_created_idx
      on business_employee_activity(workspace_id, created_at desc)
  `);

  await database.query(`
    create table if not exists business_employee_daily_reports (
      id uuid primary key default uuid_generate_v4(),
      workspace_id uuid not null references business_workspaces(id) on delete cascade,
      member_id uuid references business_members(id) on delete set null,
      user_id uuid references users(id) on delete set null,
      report_date date not null,
      requests_count integer not null default 0,
      chats_count integer not null default 0,
      client_reports_count integer not null default 0,
      last_activity_at timestamptz,
      summary text not null default '',
      metrics jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (workspace_id, user_id, report_date)
    )
  `);

  await database.query(`
    alter table business_employee_daily_reports
      add column if not exists last_activity_at timestamptz
  `);

  await database.query(`
    create table if not exists business_client_reports (
      id uuid primary key default uuid_generate_v4(),
      workspace_id uuid not null references business_workspaces(id) on delete cascade,
      member_id uuid references business_members(id) on delete set null,
      user_id uuid references users(id) on delete set null,
      deal_id uuid references business_deals(id) on delete set null,
      conversation_id uuid references conversations(id) on delete set null,
      client_name text not null default '',
      report text not null,
      next_step text,
      sentiment text,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    )
  `);

  await database.query(`
    create index if not exists business_client_reports_workspace_created_idx
      on business_client_reports(workspace_id, created_at desc)
  `);

  await database.query(`
    create table if not exists business_customer_conversations (
      id uuid primary key default uuid_generate_v4(),
      workspace_id uuid not null references business_workspaces(id) on delete cascade,
      channel text not null default 'manual',
      customer_name text not null default '',
      customer_contact text not null default '',
      source text not null default '',
      status text not null default 'new',
      owner_rating text,
      ai_rating text not null default 'good',
      analysis jsonb not null default '{}'::jsonb,
      training_allowed boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await database.query(`
    create index if not exists business_customer_conversations_workspace_updated_idx
      on business_customer_conversations(workspace_id, updated_at desc)
  `);

  await database.query(`
    create index if not exists business_customer_conversations_workspace_status_idx
      on business_customer_conversations(workspace_id, status)
  `);

  await database.query(`
    create table if not exists business_customer_messages (
      id uuid primary key default uuid_generate_v4(),
      conversation_id uuid not null references business_customer_conversations(id) on delete cascade,
      role text not null,
      author_name text not null default '',
      content text not null,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    )
  `);

  await database.query(`
    create index if not exists business_customer_messages_conversation_created_idx
      on business_customer_messages(conversation_id, created_at asc)
  `);

  await database.query(`
    create table if not exists business_team_messages (
      id uuid primary key default uuid_generate_v4(),
      workspace_id uuid not null references business_workspaces(id) on delete cascade,
      member_id uuid references business_members(id) on delete set null,
      author_name text not null,
      role_title text not null default '',
      text text not null,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    )
  `);

  await database.query(`
    create index if not exists business_team_messages_workspace_created_idx
      on business_team_messages(workspace_id, created_at asc)
  `);

  await database.query(`
    create table if not exists mailing_audiences (
      id uuid primary key default uuid_generate_v4(),
      user_id uuid not null references users(id),
      name text not null,
      source text not null default 'manual',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (user_id, name)
    )
  `);

  await database.query(`
    create table if not exists mailing_contacts (
      id uuid primary key default uuid_generate_v4(),
      user_id uuid not null references users(id),
      audience_id uuid not null references mailing_audiences(id) on delete cascade,
      email text not null,
      name text,
      status text not null default 'active',
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (audience_id, email)
    )
  `);

  await database.query(`
    create index if not exists mailing_contacts_audience_status_idx
      on mailing_contacts(audience_id, status)
  `);

  await database.query(`
    create table if not exists mailing_campaigns (
      id uuid primary key default uuid_generate_v4(),
      user_id uuid not null references users(id),
      audience_id uuid not null references mailing_audiences(id),
      name text not null,
      from_email text not null,
      from_name text not null default '',
      reply_to text not null default '',
      subject text not null,
      html text not null,
      text text not null default '',
      tag text not null unique,
      status text not null default 'draft',
      total_count integer not null default 0,
      sent_count integer not null default 0,
      opened_count integer not null default 0,
      unsubscribed_count integer not null default 0,
      bounced_count integer not null default 0,
      failed_count integer not null default 0,
      last_sync_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await database.query(`
    create index if not exists mailing_campaigns_user_created_idx
      on mailing_campaigns(user_id, created_at desc)
  `);

  await database.query(`
    create table if not exists mailing_recipients (
      id uuid primary key default uuid_generate_v4(),
      campaign_id uuid not null references mailing_campaigns(id) on delete cascade,
      contact_id uuid references mailing_contacts(id) on delete set null,
      email text not null,
      name text,
      status text not null default 'queued',
      smtp_message_id text,
      opened_at timestamptz,
      unsubscribed_at timestamptz,
      last_event_at timestamptz,
      error text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (campaign_id, email)
    )
  `);

  await database.query(`
    create index if not exists mailing_recipients_campaign_status_idx
      on mailing_recipients(campaign_id, status)
  `);

  await database.query(`
    create table if not exists user_projects (
      id uuid primary key default uuid_generate_v4(),
      user_id uuid not null references users(id) on delete cascade,
      name text not null,
      description text not null default '',
      project_type text not null default 'general',
      status text not null default 'active',
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await database.query(`
    create index if not exists user_projects_user_updated_idx
      on user_projects(user_id, updated_at desc)
  `);

  await database.query(`
    create table if not exists user_media_assets (
      id uuid primary key default uuid_generate_v4(),
      user_id uuid not null references users(id) on delete cascade,
      project_id uuid references user_projects(id) on delete set null,
      file_id uuid references files(id) on delete set null,
      media_type text not null,
      title text not null,
      status text not null default 'ready',
      duration_seconds integer,
      transcript text,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await database.query(`
    create index if not exists user_media_assets_user_type_created_idx
      on user_media_assets(user_id, media_type, created_at desc)
  `);

  await database.query(`
    create table if not exists custom_ai_bots (
      id uuid primary key default uuid_generate_v4(),
      owner_user_id uuid not null references users(id),
      workspace_id uuid references business_workspaces(id) on delete set null,
      name text not null,
      slug text not null,
      status text not null default 'draft',
      channel text not null default 'internal',
      purpose text not null default '',
      target_audience text not null default '',
      default_language text not null default 'ru',
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (owner_user_id, slug)
    )
  `);

  await database.query(`
    create table if not exists telegram_bot_orders (
      id uuid primary key default uuid_generate_v4(),
      user_id uuid not null references users(id) on delete cascade,
      workspace_id uuid references business_workspaces(id) on delete set null,
      country text not null,
      currency text not null,
      amount_minor bigint not null,
      status text not null default 'ready_for_payment',
      company_name text not null,
      owner_name text not null default '',
      contact text not null,
      business_description text not null,
      services text not null,
      audience text not null default '',
      bot_purpose text not null,
      tone text not null default 'friendly',
      response_rules text not null,
      escalation_contact text not null,
      faq text not null default '',
      source_links text not null default '',
      bot_username text,
      bot_token_provided boolean not null default false,
      bot_token_hint text,
      setup_summary text not null default '',
      system_prompt text not null default '',
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await database.query(`
    create index if not exists custom_ai_bots_workspace_status_idx
      on custom_ai_bots(workspace_id, status)
  `);

  await database.query(`
    create index if not exists telegram_bot_orders_user_created_idx
      on telegram_bot_orders(user_id, created_at desc)
  `);

  await database.query(`
    create index if not exists telegram_bot_orders_workspace_status_idx
      on telegram_bot_orders(workspace_id, status, created_at desc)
      where workspace_id is not null
  `);

  await database.query(`
    create table if not exists custom_ai_bot_versions (
      id uuid primary key default uuid_generate_v4(),
      bot_id uuid not null references custom_ai_bots(id) on delete cascade,
      version_number integer not null,
      provider text,
      model text,
      system_prompt text not null default '',
      behavior_rules jsonb not null default '{}'::jsonb,
      tools_config jsonb not null default '{}'::jsonb,
      is_active boolean not null default false,
      created_by_user_id uuid references users(id),
      created_at timestamptz not null default now(),
      unique (bot_id, version_number)
    )
  `);

  await database.query(`
    create unique index if not exists custom_ai_bot_versions_one_active_idx
      on custom_ai_bot_versions(bot_id)
      where is_active = true
  `);

  await database.query(`
    create table if not exists bot_knowledge_sources (
      id uuid primary key default uuid_generate_v4(),
      bot_id uuid not null references custom_ai_bots(id) on delete cascade,
      file_id uuid references files(id) on delete set null,
      source_type text not null,
      title text not null,
      uri text,
      content_text text,
      checksum text,
      sync_status text not null default 'pending',
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await database.query(`
    create index if not exists bot_knowledge_sources_bot_status_idx
      on bot_knowledge_sources(bot_id, sync_status)
  `);

  await database.query(`
    create table if not exists bot_knowledge_chunks (
      id uuid primary key default uuid_generate_v4(),
      source_id uuid not null references bot_knowledge_sources(id) on delete cascade,
      bot_id uuid not null references custom_ai_bots(id) on delete cascade,
      chunk_index integer not null,
      content text not null,
      token_count integer not null default 0,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      unique (source_id, chunk_index)
    )
  `);

  await database.query(`
    create index if not exists bot_knowledge_chunks_bot_idx
      on bot_knowledge_chunks(bot_id)
  `);

  await database.query(`
    alter table conversations
      add column if not exists custom_bot_id uuid references custom_ai_bots(id) on delete set null
  `);

  await database.query(`
    create index if not exists conversations_custom_bot_created_idx
      on conversations(custom_bot_id, created_at desc)
  `);

  await database.query(`
    create table if not exists message_attachments (
      id uuid primary key default uuid_generate_v4(),
      message_id uuid not null references messages(id) on delete cascade,
      file_id uuid references files(id) on delete set null,
      name text not null,
      mime_type text not null default 'application/octet-stream',
      size_bytes bigint not null default 0,
      extracted_text text,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    )
  `);

  await database.query(`
    create index if not exists message_attachments_message_idx
      on message_attachments(message_id)
  `);

  await database.query(`
    create table if not exists conversation_summaries (
      id uuid primary key default uuid_generate_v4(),
      conversation_id uuid not null references conversations(id) on delete cascade,
      summary text not null,
      last_message_id uuid references messages(id) on delete set null,
      token_count integer not null default 0,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (conversation_id)
    )
  `);

  await database.query(`
    create table if not exists message_answer_variants (
      id uuid primary key default uuid_generate_v4(),
      conversation_id uuid not null references conversations(id) on delete cascade,
      user_message_id uuid not null references messages(id) on delete cascade,
      assistant_message_id uuid not null references messages(id) on delete cascade,
      agent_slug text,
      provider text,
      model text,
      variant_index integer not null default 1,
      status text not null default 'candidate',
      is_selected boolean not null default false,
      selected_by_user_id uuid references users(id) on delete set null,
      selected_at timestamptz,
      route_metadata jsonb not null default '{}'::jsonb,
      provider_usage jsonb not null default '{}'::jsonb,
      quality_metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (assistant_message_id),
      unique (conversation_id, user_message_id, variant_index)
    )
  `);

  await database.query(`
    create index if not exists message_answer_variants_user_message_idx
      on message_answer_variants(conversation_id, user_message_id, is_selected)
  `);

  await database.query(`
    create table if not exists message_feedback (
      id uuid primary key default uuid_generate_v4(),
      user_id uuid not null references users(id),
      conversation_id uuid not null references conversations(id) on delete cascade,
      message_id uuid not null references messages(id) on delete cascade,
      answer_variant_id uuid references message_answer_variants(id) on delete set null,
      rating text not null,
      selected_as_best boolean not null default false,
      reason_tags text[] not null default array[]::text[],
      comment text,
      created_at timestamptz not null default now()
    )
  `);

  await database.query(`
    create index if not exists message_feedback_message_created_idx
      on message_feedback(message_id, created_at desc)
  `);

  await database.query(`
    create table if not exists ai_error_events (
      id uuid primary key default uuid_generate_v4(),
      user_id uuid references users(id) on delete set null,
      conversation_id uuid references conversations(id) on delete set null,
      message_id uuid references messages(id) on delete set null,
      answer_variant_id uuid references message_answer_variants(id) on delete set null,
      bot_id uuid references custom_ai_bots(id) on delete set null,
      stage text not null,
      severity text not null default 'error',
      error_code text not null,
      error_message text not null,
      provider text,
      model text,
      agent_slug text,
      prompt_excerpt text,
      request_payload jsonb not null default '{}'::jsonb,
      response_payload jsonb not null default '{}'::jsonb,
      status text not null default 'open',
      resolution_note text,
      created_at timestamptz not null default now(),
      resolved_at timestamptz
    )
  `);

  await database.query(`
    create index if not exists ai_error_events_status_created_idx
      on ai_error_events(status, created_at desc)
  `);

  await database.query(`
    create table if not exists ai_improvement_tasks (
      id uuid primary key default uuid_generate_v4(),
      error_event_id uuid references ai_error_events(id) on delete set null,
      feedback_id uuid references message_feedback(id) on delete set null,
      answer_variant_id uuid references message_answer_variants(id) on delete set null,
      bot_id uuid references custom_ai_bots(id) on delete set null,
      title text not null,
      description text not null default '',
      priority text not null default 'normal',
      status text not null default 'open',
      owner_user_id uuid references users(id) on delete set null,
      resolution_note text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      resolved_at timestamptz
    )
  `);

  await database.query(`
    create index if not exists ai_improvement_tasks_status_created_idx
      on ai_improvement_tasks(status, created_at desc)
  `);

  await database.query(`
    create table if not exists bot_runs (
      id uuid primary key default uuid_generate_v4(),
      bot_id uuid not null references custom_ai_bots(id) on delete cascade,
      bot_version_id uuid references custom_ai_bot_versions(id) on delete set null,
      user_id uuid references users(id) on delete set null,
      conversation_id uuid references conversations(id) on delete set null,
      input_message_id uuid references messages(id) on delete set null,
      output_message_id uuid references messages(id) on delete set null,
      answer_variant_id uuid references message_answer_variants(id) on delete set null,
      error_event_id uuid references ai_error_events(id) on delete set null,
      channel text not null default 'internal',
      status text not null default 'completed',
      latency_ms integer,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    )
  `);

  await database.query(`
    create index if not exists bot_runs_bot_created_idx
      on bot_runs(bot_id, created_at desc)
  `);

  await database.query(`
    create table if not exists ai_quality_reviews (
      id uuid primary key default uuid_generate_v4(),
      reviewer_user_id uuid references users(id) on delete set null,
      conversation_id uuid references conversations(id) on delete set null,
      answer_variant_id uuid references message_answer_variants(id) on delete set null,
      bot_id uuid references custom_ai_bots(id) on delete set null,
      score integer,
      labels text[] not null default array[]::text[],
      notes text,
      status text not null default 'open',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await database.query(`
    create table if not exists workspace_knowledge_entries (
      id uuid primary key default uuid_generate_v4(),
      workspace_id uuid not null references business_workspaces(id) on delete cascade,
      created_by_user_id uuid references users(id) on delete set null,
      type text not null,
      title text not null,
      content text not null,
      source_url text,
      tags text[] not null default array[]::text[],
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await database.query(`
    create table if not exists business_jobs (
      id uuid primary key default uuid_generate_v4(),
      workspace_id uuid not null references business_workspaces(id) on delete cascade,
      created_by_user_id uuid references users(id) on delete set null,
      channel text not null,
      capability text not null,
      task_type text not null,
      status text not null default 'queued',
      payload jsonb not null default '{}'::jsonb,
      result jsonb,
      provider text,
      model text,
      error_message text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      started_at timestamptz,
      finished_at timestamptz
    )
  `);

  await database.query(`
    create index if not exists users_created_idx
      on users(created_at desc)
  `);

  await database.query(`
    create index if not exists users_email_trgm_idx
      on users using gin ((coalesce(email, '')) gin_trgm_ops)
  `);

  await database.query(`
    create index if not exists users_phone_trgm_idx
      on users using gin ((coalesce(phone, '')) gin_trgm_ops)
  `);

  await database.query(`
    create index if not exists users_display_name_trgm_idx
      on users using gin ((coalesce(display_name, '')) gin_trgm_ops)
  `);

  await database.query(`
    create index if not exists ledger_entries_wallet_created_idx
      on ledger_entries(wallet_id, created_at desc)
  `);

  await database.query(`
    create index if not exists payments_user_created_idx
      on payments(user_id, created_at desc)
  `);

  await database.query(`
    create index if not exists payments_provider_status_created_idx
      on payments(provider, status, created_at desc)
  `);

  await database.query(`
    create index if not exists subscription_checkouts_provider_checkout_idx
      on subscription_checkouts(provider, provider_checkout_id)
  `);

  await database.query(`
    create index if not exists subscription_checkouts_provider_status_currency_idx
      on subscription_checkouts(provider, status, currency)
  `);

  await database.query(`
    create index if not exists subscription_events_checkout_created_idx
      on subscription_events(checkout_id, created_at desc)
      where checkout_id is not null
  `);

  await database.query(`
    create index if not exists conversations_user_updated_idx
      on conversations(user_id, updated_at desc)
  `);

  await database.query(`
    create index if not exists messages_conversation_created_idx
      on messages(conversation_id, created_at asc)
  `);

  await database.query(`
    create index if not exists memory_items_user_enabled_updated_idx
      on memory_items(user_id, enabled, updated_at desc)
  `);

  await database.query(`
    create index if not exists usage_events_user_created_idx
      on usage_events(user_id, created_at desc)
  `);

  await database.query(`
    create index if not exists files_user_created_idx
      on files(user_id, created_at desc)
  `);

  await database.query(`
    create index if not exists mailing_audiences_user_created_idx
      on mailing_audiences(user_id, created_at desc)
  `);

  await database.query(`
    create index if not exists mailing_contacts_user_audience_created_idx
      on mailing_contacts(user_id, audience_id, created_at desc)
  `);

  await database.query(`
    create index if not exists mailing_contacts_user_audience_status_email_idx
      on mailing_contacts(user_id, audience_id, status, email)
  `);

  await database.query(`
    create index if not exists business_members_workspace_sort_idx
      on business_members(workspace_id, sort_order asc, created_at asc)
  `);

  await database.query(`
    create index if not exists business_groups_workspace_created_idx
      on business_groups(workspace_id, created_at asc)
  `);

  await database.query(`
    create index if not exists business_group_members_group_created_idx
      on business_group_members(group_id, created_at asc)
  `);

  await database.query(`
    create index if not exists business_deals_workspace_sort_idx
      on business_deals(workspace_id, sort_order asc, created_at asc)
  `);

  await database.query(`
    create index if not exists business_ideas_workspace_sort_idx
      on business_ideas(workspace_id, sort_order asc, created_at asc)
  `);

  await database.query(`
    create index if not exists business_employee_daily_reports_member_date_idx
      on business_employee_daily_reports(member_id, report_date)
      where member_id is not null
  `);

  await database.query(`
    create index if not exists business_employee_activity_created_idx
      on business_employee_activity(created_at desc)
  `);

  await database.query(`
    create index if not exists user_media_assets_project_idx
      on user_media_assets(project_id)
      where project_id is not null
  `);

  await database.query(`
    create index if not exists generation_jobs_user_status_created_idx
      on generation_jobs(user_id, status, created_at desc)
  `);

  await database.query(`
    create index if not exists audit_logs_actor_created_idx
      on audit_logs(actor_user_id, created_at desc)
      where actor_user_id is not null
  `);

  await database.query(`
    create index if not exists feature_flags_enabled_key_idx
      on feature_flags(enabled, key)
  `);

  await database.query(`
    create index if not exists ai_provider_settings_enabled_mode_idx
      on ai_provider_settings(enabled, traffic_mode)
  `);

  await database.query(`
    create index if not exists promotions_active_placement_idx
      on promotions(active, placement, priority asc)
  `);

  await database.query(`
    create index if not exists content_blocks_key_locale_idx
      on content_blocks(key, locale)
  `);

  await database.query(`
    create index if not exists ai_quality_reviews_status_created_idx
      on ai_quality_reviews(status, created_at desc)
  `);

  await database.query(`
    create index if not exists workspace_knowledge_entries_workspace_updated_idx
      on workspace_knowledge_entries(workspace_id, updated_at desc)
  `);

  await database.query(`
    create index if not exists business_jobs_workspace_created_idx
      on business_jobs(workspace_id, created_at desc)
  `);

  await database.query(`
    create index if not exists business_jobs_workspace_status_created_idx
      on business_jobs(workspace_id, status, created_at desc)
  `);

  await database.query(`
    create table if not exists abuse_rate_limits (
      id uuid primary key default uuid_generate_v4(),
      bucket_key text not null,
      window_start timestamptz not null,
      window_end timestamptz not null,
      count integer not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique(bucket_key, window_start)
    )
  `);

  await database.query(`
    create index if not exists abuse_rate_limits_window_end_idx
      on abuse_rate_limits(window_end)
  `);

  await database.query(`
    with plan_limits(plan_slug, monthly_credits) as (
      values
        ('base', 2000::bigint),
        ('ultra', 5000::bigint),
        ('pro', 20000::bigint),
        ('business', 50000::bigint)
    ),
    latest_active_subscription as (
      select distinct on (user_id)
        user_id,
        plan_slug
      from subscriptions
      where status = 'active'
      order by user_id, created_at desc
    )
    update wallets w
    set available_credits = plan_limits.monthly_credits,
        updated_at = now()
    from latest_active_subscription s
    join plan_limits on plan_limits.plan_slug = s.plan_slug
    where w.user_id = s.user_id
      and w.currency = 'NOMDUCHAT'
      and w.available_credits > plan_limits.monthly_credits
  `);
}

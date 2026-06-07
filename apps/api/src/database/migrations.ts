import type { DatabaseClient } from "./database.types.js";

export async function runDatabaseMigrations(database: DatabaseClient) {
  await database.query(`create extension if not exists "uuid-ossp"`);

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
    create unique index if not exists business_members_workspace_seat_key_idx
      on business_members(workspace_id, seat_key)
      where seat_key is not null
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
    create index if not exists custom_ai_bots_workspace_status_idx
      on custom_ai_bots(workspace_id, status)
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
}

# NomduChat Database Schema

Дата: 2026-07-20

## 1. Текущее состояние

Миграции находятся в `apps/api/src/database/migrations.ts`. Схема создается SQL-скриптом при запуске миграций. Используются PostgreSQL extensions:

- `uuid-ossp`;
- `pg_trgm`.

`pgvector` пока не включен.

## 2. Основные существующие таблицы

### Users and auth

- `users`
- `oauth_accounts`
- `password_reset_tokens`

Сейчас нет отдельной production-модели refresh sessions/revoked sessions.

### Billing and subscriptions

- `wallets`
- `ledger_entries`
- `credit_reservations`
- `payments`
- `plans`
- `plan_prices`
- `subscription_checkouts`
- `subscriptions`
- `subscription_events`

Основа хорошая: деньги/credits хранятся integer/bigint, есть reservations and ledger. Нужно расширить `usage_events`.

### AI providers and agents

- `ai_providers`
- `ai_models`
- `country_provider_rules`
- `ai_provider_settings`
- `agents`

Важно: таблицы есть, но текущий runtime catalog все еще в основном строится из `provider-registry.ts`. Следующий этап — сделать DB catalog источником правды.

### Chats

- `conversations`
- `messages`
- `message_attachments`
- `conversation_summaries`
- `message_answer_variants`
- `message_feedback`
- `memory_items`
- `ai_error_events`
- `ai_improvement_tasks`
- `ai_quality_reviews`

Нет полноценной структуры branches/message versions.

### Media

- `files`
- `generation_jobs`
- `user_media_assets`

Проблема: нет object storage metadata model и artifact может попадать в job metadata как base64.

### Projects and business

- `user_projects`
- `business_workspaces`
- `business_members`
- `business_groups`
- `business_group_members`
- `business_deals`
- `business_deal_notes`
- `business_ideas`
- `business_websites`
- `business_jobs`
- `workspace_knowledge_entries`

`user_projects` пока базовые. `business_workspaces` частично закрывает B2B, но не заменяет полноценные organizations.

### Mailings and notifications

- `mailing_audiences`
- `mailing_contacts`
- `mailing_campaigns`
- `mailing_recipients`
- `notification_events`

### Admin and control

- `audit_logs`
- `feature_flags`
- `promotions`
- `content_blocks`

### Bots and knowledge

- `custom_ai_bots`
- `custom_ai_bot_versions`
- `bot_knowledge_sources`
- `bot_knowledge_chunks`
- `bot_runs`
- `telegram_bot_orders`

## 3. Целевая схема

### Auth/session

```text
users
user_profiles
sessions
oauth_accounts
password_reset_tokens
login_attempts
```

`sessions`:

- `id`
- `user_id`
- `refresh_token_hash`
- `device_id`
- `ip_hash`
- `user_agent`
- `expires_at`
- `revoked_at`
- `created_at`

### Organizations

```text
organizations
organization_members
organization_invites
organization_usage_limits
organization_audit_logs
```

Roles:

```text
owner
admin
manager
member
viewer
```

### Model catalog

```text
providers
provider_credentials
models
model_capabilities
model_prices
model_health_snapshots
provider_rate_limits
country_provider_rules
```

Do not store provider API keys as plain text. Use encrypted values or external secret manager references.

### Chats v2

```text
chats
chat_branches
messages
message_versions
message_attachments
message_answer_variants
message_feedback
conversation_summaries
```

Required fields:

```text
messages.parent_message_id
messages.branch_id
messages.version
messages.status
messages.model_id
messages.provider_id
messages.usage_event_id
```

### Files/documents

```text
files
file_versions
document_chunks
document_embeddings
file_processing_jobs
file_access_grants
```

`document_chunks`:

- `id`
- `file_id`
- `project_id`
- `chunk_index`
- `content`
- `token_count`
- `embedding vector`
- `metadata`

Requires `pgvector`.

### Projects

```text
projects
project_members
project_chats
project_files
project_assets
project_memory_items
project_tasks
project_activity
```

### Media and jobs

```text
generation_jobs
generation_job_events
media_assets
media_asset_versions
job_artifacts
```

Artifacts store object storage references, not base64.

### AI apps and assistants

```text
applications
application_fields
application_runs
assistants
assistant_files
assistant_runs
assistant_memory_items
```

### Agents

```text
agent_runs
agent_steps
agent_tool_calls
agent_outputs
agent_run_events
```

### Billing

```text
wallets
wallet_transactions
credit_reservations
usage_events
provider_cost_events
plans
plan_features
subscriptions
payments
refunds
promo_codes
```

`usage_events` target:

```text
id
request_id
user_id
organization_id
provider
model
action_type
status
input_tokens
output_tokens
media_units
provider_cost_minor
internal_cost_credits
currency
reservation_id
created_at
completed_at
metadata
```

### Public API

```text
api_keys
api_key_scopes
api_usage_events
api_webhooks
api_webhook_deliveries
```

### Notifications

```text
notifications
notification_events
email_deliveries
push_tokens
user_notification_settings
```

## 4. Индексы

Обязательные индексы:

- `users(email)`
- `users(created_at desc)`
- `chats(user_id, updated_at desc)`
- `messages(chat_id, branch_id, created_at asc)`
- `message_attachments(message_id)`
- `generation_jobs(user_id, status, created_at desc)`
- `media_assets(user_id, media_type, created_at desc)`
- `usage_events(user_id, created_at desc)`
- `usage_events(organization_id, created_at desc)`
- `usage_events(request_id)`
- `wallet_transactions(wallet_id, created_at desc)`
- `document_chunks(file_id, chunk_index)`
- vector index on `document_embeddings.embedding`
- `audit_logs(actor_user_id, created_at desc)`
- `api_keys(key_hash)`

## 5. Delete policies

- User deletion should anonymize user profile but preserve billing/legal records.
- Project deletion should soft-delete project, then async-delete object storage files if user confirms.
- File deletion must remove chunks, embeddings and object storage references.
- Organization deletion must require owner confirmation and audit log.
- Payment and usage events are retained for compliance.

## 6. Migration priorities

1. Add request/correlation id support around existing tables where needed.
2. Add `request_id/status/provider_cost/internal_cost` to `usage_events`.
3. Add `object_storage_key`/artifact references and migrate media away from base64 metadata.
4. Add `chat_branches` and `message_versions`.
5. Add document chunks and pgvector.
6. Add organizations/RBAC tables.
7. Add public API key tables.

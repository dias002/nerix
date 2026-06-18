# nomduchat Database Production Readiness

This document defines how nomduchat stores data when the product starts carrying real users and many GB of chat history.

## Storage Split

PostgreSQL is the source of truth for structured product data:

- users, auth profiles, OAuth accounts, roles and permissions;
- conversations, messages, memory items and answer feedback;
- wallets, ledger entries, reservations, plans, checkouts and subscriptions;
- business cabinet data, employee activity and reports;
- mailing audiences, contacts, campaigns and recipients;
- file metadata, projects, media metadata, bot configs and audit logs.

Object storage is required for binary or bulky user assets:

- uploaded files;
- generated images, audio and video;
- original documents used as knowledge sources;
- exported reports and large media outputs.

The database stores metadata and `storage_key` references. The bytes live in MinIO locally and in S3-compatible object storage in production.

Redis is not a primary database. Use it for cache, rate limits, short-lived locks and future queues.

## Current Migration Baseline

`apps/api/src/database/migrations.ts` must be able to initialize an empty managed PostgreSQL database. Do not rely only on `infra/postgres/init/001_init.sql`, because that file runs only when the local Docker volume is created.

Both migration paths include indexes for the tables expected to grow fastest:

- `conversations(user_id, updated_at desc)`;
- `messages(conversation_id, created_at asc)`;
- `memory_items(user_id, enabled, updated_at desc)`;
- `usage_events(user_id, created_at desc)`;
- `ledger_entries(wallet_id, created_at desc)`;
- `subscription_checkouts(provider, provider_checkout_id)`;
- `files(user_id, created_at desc)`;
- mailing, business, project, job and audit lookup indexes;
- trigram indexes for admin user search by email, phone and display name.

## Production Requirements

Before real users:

1. Use managed PostgreSQL, not a local Docker volume.
2. Enable automated backups and point-in-time recovery.
3. Set backup retention to at least 7 days for MVP, 30 days for production.
4. Store attachments and generated media in S3-compatible object storage.
5. Keep `DATABASE_URL`, object storage credentials and payment credentials out of Git.
6. Monitor disk usage, CPU, memory, slow queries, connection count and backup health.
7. Use a connection limit/pool suitable for the API runtime.

## Growth Rules

Plain text chat data can live in PostgreSQL for many GB. The first scaling step is good indexes and pagination. The next step is partitioning.

Prepare partitioning for `messages`, `usage_events`, `ledger_entries`, `audit_logs` and `business_employee_activity` when any of these is true:

- a table approaches tens of millions of rows;
- a table approaches 100 GB;
- backups or restores become too slow;
- common queries start touching old data unnecessarily.

For an existing multi-GB database, create new indexes with `CREATE INDEX CONCURRENTLY` during a maintenance window instead of letting app startup build heavy indexes synchronously.

## What Not To Store In PostgreSQL

Do not store raw images, audio, video or large generated files in `bytea` columns. Keep only metadata, extracted text when useful, content hashes and object storage keys.

For very large documents, store the original in object storage and split searchable text into chunks in `bot_knowledge_chunks`.

## Local Versus Production

Local development:

```bash
npm run infra:up
npm run api:dev
npm run web:dev
```

Production:

- managed PostgreSQL for relational data;
- S3-compatible object storage for files;
- Redis for cache/queues;
- separate backup and monitoring configured by the infrastructure provider.

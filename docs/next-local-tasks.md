# Next Local Tasks

## 1. Make API Runnable With Real Persistence

- replace in-memory repositories with PostgreSQL-backed repositories;
- add database migration runner after the initial SQL stabilizes;
- implement users table access;
- implement wallet read;
- implement append-only ledger writes.

## 2. Connect Web To API

- create API client in `apps/web`;
- replace mock balance with `/billing/wallet`;
- replace local agents array with `/agents`;
- send chat messages to `/chat/messages`;
- show local mock usage.

## 3. Implement Real Wallet Logic

- topup mock endpoint;
- reserve credits;
- capture final credits;
- refund on failed AI job;
- idempotency key for payment webhook.

## 4. Build AI Gateway Mock Properly

- classify user prompt;
- choose agent;
- estimate credits;
- create async job for image/video/music;
- return provider/model decision.

## 5. Add First Real Provider Later

Only after wallet and usage logs work:

- add first text provider;
- start with backend-only OpenAI/Anthropic/Gemini adapters behind AI Gateway;
- stream chat responses;
- record usage;
- charge credits;
- add country/provider rule checks.

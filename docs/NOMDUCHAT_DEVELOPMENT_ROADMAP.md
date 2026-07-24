# NomduChat Development Roadmap

Дата: 2026-07-20

## Phase 0. Audit and stabilization

Goal: stop accidental growth, document architecture, improve debugging.

Tasks:

1. Create architecture docs.
2. Add `X-Request-Id` to every API response.
3. Add requestId to error responses.
4. Keep tests green.
5. Review main navigation and hide unfinished production-dead-end pages.
6. Add health/diagnostics for providers.
7. Add API checklist for App Review demo account.

Done when:

- docs exist;
- API tests pass;
- every API response has request id;
- no new large feature is started without feature flag.

## Phase 1. Provider Layer v1

Goal: make providers modular and auditable.

Tasks:

1. Create unified provider gateway types.
2. Move model catalog read path toward DB-backed source.
3. Add provider health checks.
4. Add timeout and normalized provider errors.
5. Add fallback chain per model.
6. Add model route explanation API.
7. Add tests for routing, provider failure and fallback.

Done when:

- frontend can render models from API;
- admin can see provider health;
- failed provider call produces safe user error and logged technical reason.

## Phase 2. Billing v1

Goal: every AI action has correct cost accounting.

Tasks:

1. Extend `usage_events`.
2. Add idempotency keys for chat/media.
3. Normalize provider usage.
4. Capture/refund text requests.
5. Add operation history endpoint.
6. Add admin view for spend/margin.
7. Add tests for double request, provider error after reserve, refund.

Done when:

- duplicate request cannot double charge;
- failed provider call returns credits;
- admin can trace requestId -> usage event -> ledger entry.

## Phase 3. Files and documents

Goal: safe uploads and document analysis.

Tasks:

1. Add object storage adapter.
2. Add upload endpoint.
3. Validate size/MIME.
4. Store files outside DB.
5. Extract text from TXT/PDF/DOCX.
6. Add document chunks.
7. Add pgvector migration.
8. Attach files to chat/project.
9. Add file deletion policy.

Done when:

- chat can use uploaded document through snippets/retrieval;
- large files are not stored as DB base64;
- user can delete file and derived chunks.

## Phase 4. Jobs and media worker

Goal: make long-running generation durable.

Tasks:

1. Add Redis/BullMQ queue.
2. Add worker process.
3. Move image/video/voice/music jobs to queue.
4. Store artifacts in object storage.
5. Add job events.
6. Add notifications on completion.
7. Add stuck job recovery.

Done when:

- HTTP request returns job quickly;
- user can leave page and later see result;
- failed job refunds automatically.

## Phase 5. Chat v2

Goal: product-grade chat.

Tasks:

1. Add `chat_branches`.
2. Add message versions.
3. Implement edit-and-branch.
4. Add stop generation.
5. Add real progress events.
6. Add source/file display.
7. Add search and pagination.
8. Add export.

Done when:

- editing an old message does not destroy old answer;
- long chats are paginated;
- frontend displays real model choice and progress.

## Phase 6. Projects v2

Goal: projects become working context, not folders.

Tasks:

1. Add project instructions.
2. Add project files.
3. Add project chats.
4. Add project memory.
5. Add project activity.
6. Add project templates.
7. Add project members for organizations.

Done when:

- chat inside project uses project context;
- project has files/results/history;
- project can be shared by permissions.

## Phase 7. Apps and assistants

Goal: ready AI tools and personal assistants become configurable.

Tasks:

1. Add applications tables.
2. Add dynamic form schema.
3. Add admin CRUD for apps.
4. Add assistant CRUD.
5. Add assistant files.
6. Add assistant run history.
7. Add tests.

Done when:

- new AI app can be added without code deploy;
- user can create assistant with instructions and files.

## Phase 8. Agent mode

Goal: multi-step AI work with visible execution.

Tasks:

1. Add agent run tables.
2. Add plan/step/tool call records.
3. Add tools: search, files, documents, media.
4. Add sandbox for code execution.
5. Add user stop/resume.
6. Add final outputs.

Done when:

- user sees plan and steps;
- every tool call is logged;
- sandbox has no access to server secrets.

## Phase 9. Organizations and public API

Goal: commercial B2B layer.

Tasks:

1. Add organizations and RBAC.
2. Add shared balance.
3. Add team projects.
4. Add API keys.
5. Add API rate limits.
6. Add API docs.
7. Add webhooks.
8. Add organization analytics.

Done when:

- organization owner can invite members;
- API key can call model router and billing;
- usage is separated by organization.

## Phase 10. Product polish

Goal: product feels alive and consistent.

Tasks:

1. Finish design system migration.
2. Improve mobile UX.
3. Add onboarding to first result.
4. Add empty/error/offline states.
5. Add command palette coverage.
6. Add gallery examples.
7. Add release notes.
8. Add performance budget.

Done when:

- no main page is a dead end;
- mobile works with keyboard/file picker;
- UI is consistent and fast.

## Immediate next iteration

Start with Phase 0:

1. Add request/correlation id.
2. Add tests.
3. Run API tests and build.
4. Then continue with provider health endpoint.

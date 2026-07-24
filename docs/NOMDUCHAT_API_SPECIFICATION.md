# NomduChat API Specification

Дата: 2026-07-20

## 1. Общие правила API

Base API is Fastify HTTP JSON API. Streaming chat uses SSE-style event stream.

Every response must include:

```text
X-Request-Id: <request id>
```

Every error response:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Human readable message",
    "requestId": "optional when implemented"
  }
}
```

Target rules:

- no provider technical errors to users;
- stable error codes;
- idempotency keys for expensive actions;
- bearer auth for web/mobile clients;
- RBAC checks on backend;
- pagination on list endpoints;
- no API keys or provider secrets to frontend.

## 2. Existing public/system endpoints

```text
GET /health
GET /health/database
GET /geo/country
POST /support/tickets
GET /public/websites/:slug
```

## 3. Existing auth endpoints

```text
POST /auth/register
POST /auth/login
GET /auth/me
GET /auth/linked-accounts
POST /auth/linked-accounts/:provider/unlink
POST /auth/password-reset/request
POST /auth/password-reset/confirm
GET /auth/oauth/:provider/start
GET /auth/oauth/:provider/callback
```

Target additions:

```text
POST /auth/refresh
POST /auth/logout
GET /auth/sessions
DELETE /auth/sessions/:sessionId
```

## 4. Existing user endpoints

```text
GET /users/me
PATCH /users/me
GET /users/me/export
POST /users/me/delete
```

Target additions:

```text
GET /users/me/memory
PATCH /users/me/memory/:memoryId
DELETE /users/me/memory/:memoryId
GET /users/me/notification-settings
PATCH /users/me/notification-settings
```

## 5. Existing AI/model endpoints

```text
GET /ai/providers
POST /ai/route
GET /agents
GET /agents/:id
```

Target additions:

```text
GET /ai/models
GET /ai/models/:modelId
GET /ai/providers/health
POST /ai/estimate
POST /ai/route/explain
```

`GET /ai/models` should return DB-backed model catalog.

## 6. Existing chat endpoints

```text
GET /usage/limits
GET /chat/conversations
GET /chat/conversations/:conversationId
GET /memory/items
POST /chat/messages
POST /chat/messages/stream
POST /chat/messages/regenerate
POST /chat/answers/:assistantMessageId/select
POST /chat/messages/:messageId/feedback
```

Target chat v2 endpoints:

```text
GET /chats
POST /chats
GET /chats/:chatId
PATCH /chats/:chatId
DELETE /chats/:chatId
POST /chats/:chatId/archive
POST /chats/:chatId/pin
GET /chats/:chatId/branches
POST /chats/:chatId/messages
POST /chats/:chatId/messages/stream
POST /messages/:messageId/edit
POST /messages/:messageId/regenerate
POST /messages/:messageId/stop
GET /messages/:messageId/versions
POST /messages/:messageId/feedback
GET /chats/search
```

Streaming events:

```text
event: progress
event: model
event: delta
event: tool_call
event: usage
event: done
event: error
```

## 7. Existing generation/media endpoints

```text
GET /generation/jobs
POST /generation/jobs
GET /generation/jobs/:jobId
POST /generation/jobs/:jobId/refresh
POST /generation/jobs/:jobId/cancel
GET /generation/jobs/:jobId/artifact
GET /generation/assets
```

Target media endpoints:

```text
GET /media/assets
GET /media/assets/:assetId
DELETE /media/assets/:assetId
POST /media/images
POST /media/images/:assetId/edit
POST /media/videos
POST /media/voice
POST /media/music
GET /jobs/:jobId
GET /jobs/:jobId/events
POST /jobs/:jobId/cancel
GET /jobs/:jobId/artifacts
```

Long-running actions return a job immediately.

## 8. Existing subscription and billing endpoints

```text
GET /plans
POST /subscriptions/checkout
POST /subscriptions/mock/complete
GET /subscriptions/current
GET /subscriptions/checkouts
POST /subscriptions/cancel
POST /subscriptions/webhooks/yookassa
POST /subscriptions/webhooks/kaspi
GET /billing/wallet
GET /billing/ledger
POST /billing/estimate
```

Target additions:

```text
GET /billing/usage
GET /billing/reservations
POST /billing/topup
GET /billing/invoices
GET /billing/operation-history
POST /subscriptions/iap/apple/verify
POST /subscriptions/iap/google/verify
```

## 9. Existing project endpoints

```text
GET /projects
POST /projects
PATCH /projects/:projectId
DELETE /projects/:projectId
```

Target project endpoints:

```text
GET /projects
POST /projects
GET /projects/:projectId
PATCH /projects/:projectId
DELETE /projects/:projectId
GET /projects/:projectId/chats
POST /projects/:projectId/chats
GET /projects/:projectId/files
POST /projects/:projectId/files
GET /projects/:projectId/assets
GET /projects/:projectId/memory
PATCH /projects/:projectId/memory/:memoryId
GET /projects/:projectId/activity
GET /projects/:projectId/members
POST /projects/:projectId/members
```

## 10. Existing business/admin endpoints

Business:

```text
GET /business/workspace
POST /business/members
POST /business/deals/:dealId/notes
PATCH /business/ideas/:ideaId
GET /business/ops
POST /business/ops/conversations
POST /business/ops/conversations/:conversationId/messages
PATCH /business/ops/conversations/:conversationId/rating
POST /business/ops/team/messages
GET /business/jobs
GET /business/jobs/:jobId
POST /business/jobs/:jobId/cancel
GET /business/knowledge-base
POST /business/knowledge-base
PATCH /business/knowledge-base/:entryId
DELETE /business/knowledge-base/:entryId
GET /business/websites
POST /business/websites/draft
GET /business/websites/:siteId
PATCH /business/websites/:siteId
POST /business/websites/:siteId/publish
```

Admin:

```text
GET /admin/overview
GET /admin/users
GET /admin/control
GET /admin/ai-budget
PATCH /admin/control/feature-flags/:key
PATCH /admin/control/ai-providers/:code
PATCH /admin/control/agents/:id
PATCH /admin/control/promotions/:slug
PATCH /admin/control/content-blocks/:key
PATCH /admin/pricing
```

Target admin additions:

```text
GET /admin/models
POST /admin/models
PATCH /admin/models/:modelId
GET /admin/usage
GET /admin/provider-health
GET /admin/jobs
GET /admin/audit-log
GET /admin/applications
POST /admin/applications
PATCH /admin/applications/:appId
```

## 11. Existing mailings and notifications

```text
GET /mailings/audiences
POST /mailings/audiences
GET /mailings/audiences/:audienceId/contacts
POST /mailings/audiences/:audienceId/import
GET /mailings/campaigns
POST /mailings/campaigns
POST /mailings/campaigns/:campaignId/send
POST /mailings/campaigns/:campaignId/sync
GET /mailings/campaigns/:campaignId/recipients
POST /notifications/lifecycle/run
```

Target notifications:

```text
GET /notifications
PATCH /notifications/:notificationId/read
POST /notifications/test
GET /notification-settings
PATCH /notification-settings
```

## 12. Target public business API

External API should be separate from internal web API:

```text
POST /v1/chat/completions
POST /v1/images/generations
POST /v1/files
GET /v1/files/:fileId
POST /v1/jobs
GET /v1/jobs/:jobId
POST /v1/webhooks
GET /v1/usage
GET /v1/models
```

Required:

- API keys;
- scopes;
- rate limits;
- request id;
- idempotency key;
- webhook signing;
- separate usage accounting.

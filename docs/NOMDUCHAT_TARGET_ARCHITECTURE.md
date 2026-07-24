# NomduChat Target Architecture

Дата: 2026-07-20

Цель: развивать NomduChat как самостоятельную AI-платформу уровня сильного агрегатора, не копируя MashaGPT визуально или брендово. Архитектура должна поддерживать несколько моделей, автоматический выбор, файлы, проекты, медиа, приложения, помощников, агентов, биллинг, команды и бизнес API.

## 1. Архитектурный принцип

На ближайших этапах используется модульный монолит. Микросервисы не нужны, пока доменные границы можно держать внутри одного API.

Главное правило: frontend не знает конкретных API-ключей и не зависит от конкретного AI-провайдера. Все внешние AI-сервисы проходят через backend provider gateway.

## 2. Слои

```text
Client Layer
├── Web SPA
├── Mobile shell / iOS / Android
└── Public API clients

API Layer
├── HTTP routes
├── SSE/WebSocket streams
├── Auth context
├── RBAC
├── Rate limit
├── Request/correlation id
└── Error normalization

Domain Layer
├── Chat Service
├── Model Router
├── Provider Gateway
├── Project Service
├── File Service
├── Document Service
├── Media Service
├── Application Service
├── Assistant Service
├── Agent Service
├── Billing Service
├── Subscription Service
├── Organization Service
├── Notification Service
└── Analytics/Admin Service

Infrastructure Layer
├── PostgreSQL
├── Redis
├── BullMQ workers
├── S3-compatible object storage
├── pgvector
├── SMTP/SMTP.BZ
├── Payment providers
└── Monitoring
```

## 3. Request context

Каждый запрос должен иметь:

- `requestId`;
- `userId`, если авторизован;
- `organizationId`, если выбран workspace;
- `country`;
- `language`;
- `clientPlatform`;
- `isAdmin`;
- `permissions`.

`requestId` возвращается в `X-Request-Id` и пишется в логи, billing events, provider calls, jobs.

## 4. Auth and permissions

Target:

- access token + refresh token;
- session table;
- session revoke;
- password reset;
- OAuth accounts;
- app review/demo account only as controlled production exception;
- RBAC for admin and organizations;
- no trust in `userId`, `organizationId`, `role` from frontend.

Roles:

```text
system admin
organization owner
organization admin
manager
member
viewer
personal user
```

## 5. Unified AI Provider Gateway

Target interface:

```ts
interface AIProvider {
  providerId: string;
  healthCheck(): Promise<ProviderHealth>;
  streamChat(request: UnifiedChatRequest): AsyncIterable<UnifiedChatChunk>;
  completeChat?(request: UnifiedChatRequest): Promise<UnifiedChatResult>;
  generateImage?(request: UnifiedImageRequest): Promise<UnifiedMediaResult>;
  generateVideo?(request: UnifiedVideoRequest): Promise<UnifiedJobStart>;
  synthesizeSpeech?(request: UnifiedSpeechRequest): Promise<UnifiedMediaResult>;
  analyzeDocument?(request: UnifiedDocumentRequest): Promise<UnifiedDocumentResult>;
  calculateUsageCost(usage: ProviderUsage): Promise<CalculatedUsage>;
}
```

Обязательные cross-cutting функции:

- timeout;
- retry только для safe transient ошибок;
- circuit breaker;
- fallback policy;
- health cache;
- idempotency key;
- usage normalization;
- provider error normalization;
- no API keys on frontend.

## 6. Model catalog

Модели должны храниться в базе и управляться из админки.

Минимальные поля:

```text
id
provider
providerModelId
displayName
description
category
capabilities
contextWindow
supportsStreaming
supportsVision
supportsFiles
supportsTools
supportsImageGeneration
supportsVideoGeneration
inputPrice
outputPrice
internalInputMultiplier
internalOutputMultiplier
minimumPlan
status
priority
fallbackModelId
icon
sortOrder
```

Frontend получает каталог через API и не хранит модельные списки вручную.

## 7. Model Router

`Nomdu Auto` должен учитывать:

- task type;
- modality;
- message length;
- attachments;
- image/document presence;
- project context size;
- code/reasoning/web-search needs;
- subscription;
- balance;
- model cost;
- model speed;
- model quality;
- provider health;
- user preference.

Router возвращает:

```text
provider
model
reason
estimatedCost
quality
speed
capabilities
fallbackChain
```

## 8. Chat v2

Chat должен поддерживать:

- streaming;
- stop generation;
- retry;
- regenerate;
- edit user message;
- branch after edit;
- answer variants;
- feedback;
- model switch;
- files/images;
- voice input;
- export.

Data model:

```text
chats
chat_branches
messages
message_versions
message_attachments
message_answer_variants
message_feedback
```

Progress stream:

```ts
type TaskProgressEvent = {
  taskId: string;
  stepId: string;
  label: string;
  status: "pending" | "running" | "completed" | "warning" | "failed" | "skipped";
  progress?: number;
  detail?: string;
  startedAt?: string;
  completedAt?: string;
};
```

Не показывать фейковые этапы. Если backend реально знает только `routing` и `generating`, показывать только их.

## 9. Files and documents

Target pipeline:

```text
Upload
Validate size/MIME
Security scan
Store original in object storage
Extract text
OCR if needed
Chunk
Create embeddings
Store chunks in pgvector
Attach to chat/project
Use relevant chunks in prompts
```

Файлы не должны храниться в PostgreSQL как blob/base64.

## 10. Media

Media actions are background jobs:

```text
Create job
Reserve credits
Queue job
Worker executes provider call
Poll/receive provider completion
Store artifact
Capture/refund credits
Notify user
```

Statuses:

```text
queued
processing
succeeded
failed
cancelled
refunded
```

## 11. Projects

Project is a workspace around a goal:

- title;
- description;
- system instruction;
- default model;
- files;
- chats;
- generated assets;
- tasks;
- memory;
- members;
- access rules.

Project chat uses project context through retrieval, not by appending every file to every prompt.

## 12. Apps, assistants, agents

AI apps:

- admin-managed;
- dynamic forms;
- system prompt;
- model;
- fields;
- examples;
- cost estimate.

Assistants:

- user-created;
- name/avatar/role/system prompt;
- style;
- model;
- tools;
- knowledge files;
- access scope.

Agents:

- run goal;
- create plan;
- execute steps;
- use tools;
- produce files;
- log all tool calls;
- sandbox code execution.

## 13. Billing architecture

Every billable action uses:

```text
estimate
reserve
execute
normalize provider usage
capture
refund unused amount
record usage event
```

Use integer credits/minor currency units only.

## 14. Notifications

Unify:

- transactional emails;
- lifecycle reminders;
- app notifications;
- push notifications later;
- job completion notifications;
- billing notifications.

All notifications must be idempotent.

## 15. Observability

Add:

- request id;
- structured logs;
- provider latency;
- provider error rate;
- queue metrics;
- stuck jobs;
- billing mismatches;
- health endpoints;
- admin dashboard.

## 16. Feature flags

Large features ship behind flags:

- new provider layer;
- file pipeline;
- media worker;
- agents;
- organizations;
- public API;
- mobile IAP.

Flags must be manageable from admin and enforced by backend.

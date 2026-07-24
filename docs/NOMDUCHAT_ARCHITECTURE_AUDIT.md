# NomduChat Architecture Audit

Дата аудита: 2026-07-20

## 1. Текущая архитектура

NomduChat сейчас построен как monorepo:

- `apps/api` — TypeScript backend на Fastify.
- `apps/web` — React/Vite SPA.
- `packages/shared` — общие типы и константы.
- `docs` — технические и продуктовые заметки.

Backend работает как модульный монолит. В `apps/api/src/server/dependencies.ts` собираются репозитории и сервисы, а в `apps/api/src/server/create-app.ts` регистрируются маршруты. Большинство модулей имеют memory- и postgres-реализации репозиториев.

Основные backend-модули:

- `auth` — регистрация, вход, OAuth, восстановление пароля, app review account.
- `users` — профиль, страна, язык, аватар, экспорт и удаление аккаунта.
- `chat` — чаты, streaming, вложения как extracted snippets, regeneration, answer variants, feedback.
- `ai-gateway` — выбор агента, провайдера, модели, оценка расхода, text completion.
- `generation` — image/video/avatar/music/voice jobs, media provider adapter, artifacts, media assets.
- `billing` — wallets, reservations, ledger.
- `subscriptions` — планы, checkout, webhooks Kaspi/YooKassa, текущая подписка.
- `projects` — базовые пользовательские проекты.
- `business`, `business-ops`, `business-jobs`, `business-websites`, `telegram-bots` — бизнес-кабинет, заявки, сайтогенератор, Telegram bot orders.
- `mailings` — аудитории, контакты, кампании, SMTP.BZ transport.
- `notifications` — transactional/lifecycle emails.
- `support` — обращения в поддержку.
- `admin` — overview, users, control, AI budget, pricing.
- `security` — abuse guard, rate limiting, Turnstile hook.

Frontend уже содержит публичные и workspace-страницы:

- public: home, pricing/legal, FAQ, contacts, translate, SEO/articles, tools, business, referral.
- workspace: chat, projects, apps, media, avatar, agents, memory, mailings, business, admin, balance, settings.
- shared UI: `WorkspaceLayout`, `CommandPalette`, `MobileNavigation`, `EmptyState`, `ModelReason`, `TaskProgress`, shadcn-style UI primitives.

## 2. Что уже работает

- Базовая авторизация по email/password.
- OAuth flow для поддерживаемых провайдеров.
- Восстановление пароля через email.
- App Review demo account path.
- Обновление профиля, страны, языка и avatar data URL.
- Публичное определение страны по headers.
- Rate limiting на регистрацию, login, public AI route и дорогие действия.
- Чаты с созданием, историей, streaming route и non-streaming route.
- Ручной выбор текстовой модели из hardcoded catalog.
- Автоматический выбор провайдера/модели на базовых правилах.
- Text completion через OpenAI, Anthropic, Gemini и mock provider.
- Media generation jobs через mock, Gemini/OpenAI/HeyGen adapters.
- Image reference flow для image edit.
- Бесплатная генерация profile avatar через специальное unmetered-правило.
- Wallet reservations/capture/refund.
- Планы `base`, `ultra`, `pro`, `business`.
- Checkout через Kaspi/YooKassa/mock.
- Idempotency для части subscription events/topup.
- Transactional emails: welcome, checkout, paid, unpaid reminders, ending reminders.
- Lifecycle notification endpoint.
- Mass mailing campaigns через SMTP.BZ.
- Support tickets.
- Базовые user projects.
- Business workspace и часть CRM/ops сценариев.
- Admin overview/users/control/pricing/AI budget.
- API и сервисные тесты на критичные части.

## 3. Найденные проблемы

### AI layer

- Нет единого полного `AIProvider` контракта для text, image, document, video, speech, health, cost.
- Text completion и media generation живут в разных абстракциях.
- Model catalog в основном hardcoded в `provider-registry.ts`, а не управляется из базы и админки.
- Auto routing пока простое: для OpenAI text по умолчанию выбирается `gpt-4o-mini`, без глубокого анализа сложности, бюджета, latency, качества и health.
- Production country/provider policy пока выглядит как hook/reason, а не как enforceable policy.
- Provider fallback в text completion работает только в non-production и в основном на mock.
- Нет централизованных provider timeout/retry/circuit breaker/health checks.
- Не видно полноценного учета provider latency и ошибок по request/correlation id.

### Chat

- Сообщения хранятся линейно. Есть `message_answer_variants`, но нет полноценной модели ветвления `parentMessageId`, `branchId`, `version`.
- Вложения в чате приходят как metadata/snippets. Нет полноценного file pipeline: upload, object storage, extraction, OCR, chunking, embeddings.
- Streaming отправляет `start`, `delta`, `done`, но нет реальных многоэтапных backend-событий `TaskProgressEvent`.
- Usage в ответах остается estimated/reserved, фактический расход text completion не нормализован по provider usage.

### Files and media

- Таблица `files` есть, но полноценного S3-compatible object storage слоя не видно.
- Media artifact может храниться как base64 в metadata generation job. Для production это плохо масштабируется.
- Видео/долгие генерации стартуют из request flow и обновляются через manual refresh. Нет durable queue/worker.
- Нет вирусной проверки, MIME sniffing pipeline, OCR, document chunks и pgvector.

### Billing

- Есть wallets/reservations/ledger, но billing не покрывает все AI-действия единым `usage_events` lifecycle.
- Нет жесткого flow `estimate -> reserve -> execute -> normalize usage -> capture/refund` для каждого provider/action.
- В `usage_events` нет organizationId, requestId, providerCost/internalCost, status, currency в целевом виде.
- Планы определены в коде `subscriptions/plans.ts`; в базе есть `plans/plan_prices`, но code-driven source пока доминирует.
- Для iOS нужно отдельное compliance-решение: StoreKit/IAP для consumer digital content или Apple-compliant access model без внешних checkout ссылок в приложении.

### Projects and memory

- `projects` сейчас базовые: title/description/type/status/metadata.
- Нет project files, project chats, project instructions, members, knowledge search и project memory как отдельной доменной модели.
- `memory_items` есть только на уровне пользователя, без понятной политики согласия, scope и редактирования.

### Applications, assistants, agents

- Есть `agents` и `custom_ai_bots`, но AI apps/assistants не являются полноценно управляемыми продуктами с динамическими формами, knowledge files, tools и permission model.
- Агентский режим с `agent_runs`, `agent_steps`, `agent_tool_calls` не реализован в целевом виде.
- Нет sandbox для безопасного выполнения кода.

### Organization and API

- Business workspace частично покрывает командную работу, но нет общей организации с RBAC `owner/admin/manager/member/viewer`, shared balance, API keys и audit policy.
- Public business API не выделен.
- Нет rate limits/API keys/IP restrictions/webhooks для внешних клиентов.

### Frontend

- Есть новые дизайн-компоненты, но страницы неоднородны по визуальному уровню.
- Часть разделов выглядит как полноценный продукт, часть как ранняя витрина.
- Навигация содержит будущие разделы; нужно скрывать то, что не имеет backend-логики.
- Не все состояния страниц покрывают loading/empty/error/offline/permission/subscription required.
- Мобильный UX требует отдельного прохода по keyboard/safe-area/file picker/session recovery.

### Security

- Access token реализован как HS256 JWT, refresh tokens/session revocation не видны.
- CSRF не критичен при bearer-only auth, но если появятся cookies, нужна отдельная защита.
- Есть rate limiting, но нет полной политики idempotency для всех дорогих действий.
- Нет централизованного correlation/request id в API-ответах.
- Не видно encrypt-at-rest policy для чувствительных provider credentials.
- Нет полного audit log покрытия опасных admin actions.

### Observability

- Есть health endpoints для API и database.
- Нет единого correlation id.
- Нет структурированного provider/job/billing tracing.
- Нет queue health, stuck job detection, provider latency dashboard.

## 4. Технический долг

- Hardcoded модельный каталог и тарифы.
- Смешение production-функций и demo/fallback поведения.
- Base64 artifacts в DB metadata.
- Нет durable background queue.
- Нет полноценного file/document processing pipeline.
- Нет unified usage accounting.
- Нет полноценного branch model для чатов.
- Несогласованность терминов `agent`, `assistant`, `app`, `bot`.
- Разные email-потоки: transactional, lifecycle, mass mailing.
- API ошибки не содержат requestId.
- Много страниц фронта требуют ручной проверки на реальную backend-связку.

## 5. Риски масштабирования

- Большие изображения/видео в JSONB metadata быстро раздуют базу.
- Долгие генерации без worker/queue будут нестабильны при росте нагрузки.
- Hardcoded providers/models усложнят добавление новых моделей.
- Неполный billing lifecycle повышает риск двойного списания или бесплатного expensive action.
- Отсутствие object storage и CDN ударит по скорости медиатеки.
- Линейные чаты без пагинации/виртуализации будут тормозить на длинной истории.
- Нет pgvector/RAG pipeline для проектов и документов.

## 6. Неработающие или частично работающие функции

Ниже не утверждается, что функция полностью сломана. Это список функций, которые требуют отдельной проверки или доработки до product-ready уровня.

- Полноценные проекты с контекстом, документами, участниками и памятью.
- Полноценный каталог AI-приложений с динамическими формами из админки.
- Персональные AI-помощники с knowledge files и инструментами.
- Агентский режим с планом, шагами, инструментами и sandbox.
- Public API для бизнеса.
- Организации с RBAC и shared balance.
- Фоновая очередь для видео/аудио/агентов.
- Документы: PDF/DOCX/XLSX/OCR/chunks/embeddings.
- Unified provider health/cost/fallback.
- Mobile subscription/IAP strategy.
- Все frontend empty/error/loading states.

## 7. Рекомендуемая целевая архитектура

На ближайшем этапе оставить модульный монолит, но ужесточить границы доменов:

```text
Web SPA / Mobile Shell
        ↓
Fastify API Gateway
        ↓
Auth + RBAC + Rate Limit + Request Context
        ↓
Domain Services
├── Chat
├── Model Router
├── Provider Gateway
├── Projects
├── Files/Documents
├── Media
├── Apps
├── Assistants
├── Agents
├── Billing
├── Subscriptions
├── Organizations
├── Notifications
└── Analytics/Admin
        ↓
Infrastructure
├── PostgreSQL
├── Redis/BullMQ
├── S3-compatible storage
├── Worker process
├── pgvector
└── Monitoring
```

## 8. Пошаговый план миграции

1. Стабилизация: request id, ошибки, тесты, audit docs, скрыть пустые UI-разделы.
2. Provider layer: единый контракт, model catalog, health, timeout, fallback.
3. Billing: единый usage event lifecycle и idempotency.
4. Files/storage: S3, безопасный upload, extraction, OCR, chunks.
5. Jobs/worker: Redis/BullMQ, durable jobs для media/agents/docs.
6. Chat v2: branches, message versions, SSE progress events.
7. Projects v2: files, instructions, context search, members.
8. Apps/assistants: admin-managed tools and forms.
9. Organizations/API: RBAC, API keys, shared balance.
10. Product polish: frontend consistency, mobile UX, onboarding, analytics.

## 9. Что можно сохранить

- Monorepo structure.
- Fastify modular monolith.
- React/Vite frontend.
- Memory/Postgres repository pattern.
- Existing auth/password reset/OAuth base.
- Existing chat streaming route.
- Existing generation job abstraction.
- Existing billing wallet/reservation foundation.
- Existing subscription checkout/webhook foundation.
- Existing mailings and transactional email transport.
- Existing admin foundation.
- Existing tests.

## 10. Что необходимо переписать или вынести

- Provider registry from code-only to DB/catalog + admin.
- Completion/media providers into one provider gateway contract.
- Media artifact storage from DB metadata to object storage.
- Long-running operations into queue/worker.
- Files/documents into full processing pipeline.
- Billing into full usage ledger with provider/internal cost.
- Projects into domain model with memory and knowledge.
- Chat branches and message versions.
- Organization/API modules.
- Frontend navigation and state coverage for unfinished sections.

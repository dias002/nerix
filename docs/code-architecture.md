# Code Architecture

## Monorepo

```text
apps/web        UI prototype and future production web app
apps/api        Backend API and business logic
apps/mobile     Flutter app placeholder
packages/shared Shared TypeScript contracts
infra           Local services: PostgreSQL, Redis, MinIO
docs            Product and engineering notes
```

## API Layers

The API is intentionally split into testable layers:

```text
routes -> services -> repositories
```

- `routes` parse HTTP input and return HTTP responses.
- `services` contain business decisions.
- `repositories` hide persistence and can later move from memory to PostgreSQL.
- `domain` contains shared business rules such as credits and typed results.
- `server/create-app.ts` builds Fastify without listening on a port, so tests can use `app.inject()`.
- `database` owns PostgreSQL connectivity and exposes a small `DatabaseClient` interface.

## Current Modules

```text
users       current user profile mock
agents      agent registry and task-to-agent selection
billing     wallet, estimates, reserve/capture/refund
ai-gateway  modality classification and provider/model routing
chat        conversation/message flow through AI Gateway
database    Postgres pool, health checks, and future persistence adapters
```

## File Size Rule

Project-owned code should be split by responsibility before files become hard to scan:

```text
feature.routes.ts       HTTP input/output only
feature.service.ts      business logic
feature.repository.ts   persistence
feature.types.ts        local feature contracts
```

Large data objects, such as UI translations or country lists, should live in data modules instead of being mixed with React providers or services.

## Country And Provider Policy

The repo now supports a broad ISO country list through `packages/shared/src/countries.ts`.

Local development uses:

```text
AI_PROVIDER_POLICY=dev_allow_all
```

In this mode every selected country follows the same provider path. This is for architecture testing only: wallet, routing, model selection, and UI can be built before legal/provider restrictions are finalized.

Before production, switch to:

```text
AI_PROVIDER_POLICY=production_rules
```

Then country/provider restrictions must be implemented according to actual provider contracts and launch countries.

Real provider keys are backend-only:

```text
OPENAI_API_KEY
ANTHROPIC_API_KEY
GOOGLE_AI_API_KEY
```

No provider key should ever be added to `apps/web` or `apps/mobile`.

## Important Rules

- AI provider keys must only live in `apps/api`.
- Web and Flutter must call Nerix API, never provider APIs directly.
- Billing must stay append-only through ledger entries.
- Provider routing must be explicit by country and modality.
- Long jobs such as image/video/music should go through queues later.

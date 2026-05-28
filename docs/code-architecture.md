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

## Current Modules

```text
users       current user profile mock
agents      agent registry and task-to-agent selection
billing     wallet, estimates, reserve/capture/refund
ai-gateway  modality classification and provider/model routing
chat        conversation/message flow through AI Gateway
```

## Important Rules

- AI provider keys must only live in `apps/api`.
- Web and Flutter must call Nerix API, never provider APIs directly.
- Billing must stay append-only through ledger entries.
- Provider routing must be explicit by country and modality.
- Long jobs such as image/video/music should go through queues later.


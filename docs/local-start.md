# Local Start

## What to Build First

Start locally with the foundation that will not need to be thrown away later:

1. Keep the visual prototype in `apps/web`.
2. Build a real backend in `apps/api`.
3. Store shared contracts in `packages/shared`.
4. Run PostgreSQL and Redis locally through Docker.
5. Implement internal Nerix credits before connecting paid AI providers.

## Recommended Order

```text
1. Web shell and UX prototype
2. Backend health check
3. PostgreSQL schema
4. Users and sessions
5. Wallet and append-only ledger
6. Agent registry
7. Chat and messages
8. AI Gateway with mock provider
9. Real text provider
10. Payments and webhooks
```

## Commands

From the repo root:

```bash
npm run web:dev
npm run web:build
npm run infra:up
```

The API scaffold is present, but dependencies still need to be installed before it can run.

## Product Rule

The frontend and Flutter app must never call AI providers directly. All requests must go through:

```text
Client -> Nerix API -> AI Gateway -> Provider
```

This protects API keys, lets Nerix count usage, apply country/provider rules, charge internal credits, and block abuse.


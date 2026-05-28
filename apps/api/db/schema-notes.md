# Database Notes

The initial SQL schema lives in:

```text
infra/postgres/init/001_init.sql
```

This is intentionally SQL-first for the local foundation. Later the project can move to Prisma or Drizzle migrations, but the financial model should stay strict:

- wallets store current available and reserved credits;
- ledger entries are append-only;
- payment webhooks must be idempotent;
- every AI usage event must be linked to user, agent, provider, model, and charged credits.


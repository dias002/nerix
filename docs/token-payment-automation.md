# Token Payment Automation

This document describes the production flow for selling nomduchat token plans through a merchant account.

## Flow

1. User selects a plan in the web app.
2. Web app calls `POST /subscriptions/checkout` with `planId` and `country`.
3. API creates a provider checkout for the selected country:
   - `KZ` -> `kaspi`
   - `RU` -> `yookassa`
4. Provider receives payment under the merchant/IP account.
5. Provider sends webhook to the API.
6. API completes the checkout, creates or replaces the active subscription, and grants plan credits to the exact `userId`.
7. Wallet ledger stores a `topup` entry with `reference_type = subscription` and `reference_id = subscription.id`.

Credits are internal nomduchat credits. AI provider costs are paid from the platform provider account as users consume those credits.

## Webhooks

YooKassa:

```text
POST /subscriptions/webhooks/yookassa
```

Supported events:

```text
payment.succeeded -> completes checkout and grants credits
payment.canceled  -> cancels checkout without credits
```

Kaspi adapter:

```text
POST /subscriptions/webhooks/kaspi
```

The Kaspi endpoint accepts a normalized payload from a gateway/middleware:

```json
{
  "providerCheckoutId": "kaspi_checkout_id",
  "status": "paid"
}
```

Accepted success statuses: `paid`, `success`, `succeeded`, `completed`, `approved`.

## Idempotency

Webhook handlers are idempotent:

- Provider event ids are stored in `subscription_events.idempotency_key`.
- Token top-ups use `BillingService.topupOnce`.
- PostgreSQL prevents duplicate subscription top-ups with `ledger_entries_subscription_topup_once_idx`.

If a provider retries the same paid webhook, the user still receives the plan credits only once.

## Required Env

```env
PAYMENT_WEBHOOK_SECRET=
KASPI_CHECKOUT_URL=
KASPI_API_TOKEN=
YOOKASSA_SHOP_ID=
YOOKASSA_SECRET_KEY=
YOOKASSA_RETURN_URL=https://your-domain.kz/workspace/balance
```

Set `PAYMENT_WEBHOOK_SECRET` when webhook requests go through your own gateway. Send it as:

```text
x-nomduchat-webhook-secret: <secret>
```

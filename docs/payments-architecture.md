# Payments Architecture

## Goal

Users buy internal nomduchat credits, not provider tokens directly. nomduchat spends provider APIs from the backend and charges the user's internal wallet through the ledger.

## Current Product Decision

MVP countries:

```text
KZ
RU
```

MVP payment providers:

```text
KZ -> Kaspi
RU -> YooKassa
```

MVP billing model:

```text
subscription only
3 paid plans
monthly period first
credits reset to the plan limit every billing period
```

Prices are not final. Use MashaGPT as a market benchmark, not as a copy:

```text
Base   ~ 990 RUB/month
Ultra  ~ 1,990 RUB/month
Pro    ~ 19,990 RUB/month
```

For Kazakhstan, convert to KZT only after payment costs, provider costs, VAT/tax assumptions, and target margin are known.

## Payment Flow

```text
User chooses package
-> nomduchat creates payment intent/order
-> Payment provider opens checkout
-> Provider sends webhook to nomduchat API
-> nomduchat verifies/parses provider event
-> nomduchat completes pending checkout
-> nomduchat writes ledger topup entry
-> User wallet balance increases
```

The frontend must not complete a checkout by itself. A plan button creates a pending checkout and redirects to the provider when a real checkout URL is available. In local/mock mode the checkout remains pending until the backend dev endpoint or provider webhook completes it.

## AI Usage Flow

```text
User sends AI request
-> Billing estimates credits
-> Wallet reserves credits
-> AI Gateway sends request to provider
-> Usage is recorded
-> Billing captures final credits
-> Unused reserved credits are refunded
```

## Provider Abstraction

Payment logic should not depend directly on one provider. Add a `PaymentProvider` interface later:

```text
createPaymentIntent
verifyWebhook
parseWebhookEvent
refundPayment
```

Then adapters can be added for Kaspi, YooKassa, card acquiring, invoices, or later regional payment methods.

For subscriptions, the provider abstraction should also support:

```text
createSubscriptionCheckout
verifyWebhook
parseSubscriptionEvent
cancelSubscription
resumeSubscription
```

The internal billing state should not trust the frontend. Subscription activation, renewal, cancellation, and failed payments must come from verified provider webhooks.

## Minimum Tables

The current SQL schema already has the base:

```text
payments
wallets
ledger_entries
users
audit_logs
```

Later add:

```text
payment_provider_accounts
payment_webhook_events
plans
subscriptions
promo_codes
refunds
```

For subscription MVP, add these before real provider launch:

```text
plans
subscriptions
subscription_events
payment_provider_customers
```

## Rules

- Payment webhooks must use idempotency keys.
- Never update wallet balance without a ledger entry.
- Do not accept money in a region where the product cannot legally provide the paid service.
- Expensive media jobs should show estimated credits before the user starts the job.
- Business customers should support invoice-based payments later.
- Kaspi and YooKassa logic must be separate adapters behind one internal payment interface.
- KZ and RU payment routing must be explicit by user country.
- A subscription renewal should create a payment record and a ledger topup/reset entry only after a verified provider event.
- Plan prices must be stored server-side; the frontend can display prices but must never decide payable amounts.

## First Practical Step

For MVP, implement a mock subscription provider first:

```text
GET  /plans
POST /subscriptions/checkout
POST /subscriptions/mock/complete
POST /subscriptions/webhooks/yookassa
POST /subscriptions/cancel
GET  /subscriptions/current
```

`POST /subscriptions/mock/complete` is for backend/dev tests only. YooKassa card payments for RU users should complete through `POST /subscriptions/webhooks/yookassa` after `payment.succeeded`. Kaspi remains a configurable checkout-link adapter until the real Kaspi contract endpoint/webhook format is available.

# Payments Architecture

## Goal

Users buy internal Nerix credits, not provider tokens directly. Nerix spends provider APIs from the backend and charges the user's internal wallet through the ledger.

## Payment Flow

```text
User chooses package
-> Nerix creates payment intent/order
-> Payment provider opens checkout
-> Provider sends webhook to Nerix API
-> Nerix verifies webhook signature
-> Nerix writes payment record
-> Nerix writes ledger topup entry
-> User wallet balance increases
```

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

Then adapters can be added for the selected Kazakhstan payment partner, bank acquiring, card acquiring, invoices, or later regional payment methods.

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

## Rules

- Payment webhooks must use idempotency keys.
- Never update wallet balance without a ledger entry.
- Do not accept money in a region where the product cannot legally provide the paid service.
- Expensive media jobs should show estimated credits before the user starts the job.
- Business customers should support invoice-based payments later.

## First Practical Step

For MVP, implement a mock payment provider first:

```text
POST /payments/intents
POST /payments/mock/complete
GET  /payments/:id
```

After wallet and ledger are stable, replace mock completion with a real provider webhook.


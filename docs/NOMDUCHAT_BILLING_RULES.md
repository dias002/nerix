# NomduChat Billing Rules

Дата: 2026-07-20

## 1. Текущее состояние

В проекте уже есть billing foundation:

- `wallets.available_credits`
- `wallets.reserved_credits`
- `ledger_entries`
- `credit_reservations`
- `BillingService.reserve`
- `BillingService.capture`
- `BillingService.refund`
- subscription checkout completion grants monthly credits through `topupOnce`

Планы сейчас:

```text
base      2 000 credits
ultra     5 000 credits
pro      20 000 credits
business 50 000 credits
```

Цены в коде заданы через KZT и конвертацию в RUB. В базе есть `plans` and `plan_prices`, но source of truth все еще смешан.

## 2. Главный принцип

Каждое платное AI-действие должно быть финансово атомарным:

```text
estimate
reserve
execute
normalize usage
capture actual cost
refund unused reservation
record usage event
```

Если provider fail до результата, лимит/credits не списываются. Если часть результата готова, списание должно соответствовать фактически выполненной части.

## 3. Единицы учета

Использовать только integer:

- money: minor units (`amount_minor`);
- internal balance: integer credits;
- provider usage: integer tokens/units;
- media units: integer count/duration/frames.

Не использовать floating point для денег или credits.

## 4. Cost model

Target fields:

```text
providerCostMinor
providerCurrency
internalCostCredits
inputTokens
outputTokens
mediaUnits
modelMultiplier
planDiscount
```

Для текста:

```text
input tokens * model input price
output tokens * model output price
internal multiplier
minimum charge
```

Для изображений:

```text
base model price
quality multiplier
size/aspect multiplier
count
```

Для видео:

```text
model price per second
duration
resolution multiplier
queue priority multiplier
```

Для voice:

```text
characters or audio seconds
voice tier multiplier
```

Для agent:

```text
sum of all underlying model/tool/file/media usage
agent overhead fee if configured
```

## 5. Reservation rules

Before execution:

1. Resolve user and organization.
2. Check subscription and plan access.
3. Check feature flag.
4. Estimate cost.
5. Create `usage_event` with `status = reserved`.
6. Reserve credits transactionally.
7. Execute provider call/job.

After success:

1. Normalize provider usage.
2. Calculate final internal credits.
3. Capture final credits.
4. Refund unused reserved credits.
5. Mark usage event `completed`.
6. Store provider raw usage in metadata.

After failure:

1. Refund reservation.
2. Mark usage event `failed` or `refunded`.
3. Attach safe error code and requestId.

## 6. Idempotency

Every expensive action requires idempotency:

- chat message send;
- media job creation;
- file processing;
- subscription checkout;
- webhook processing;
- API request from business clients.

Idempotency key scope:

```text
userId + organizationId + actionType + idempotencyKey
```

If same key arrives again, return the existing result instead of charging twice.

## 7. Subscription access

Access decisions must check:

- active subscription;
- plan feature;
- model minimum plan;
- daily/monthly limits;
- organization limit;
- remaining balance;
- platform rules.

Free plan:

- limited text requests;
- no expensive media except explicitly free onboarding/profile avatar actions;
- no video/music/agent unless feature flag explicitly allows trial.

## 8. Usage event target schema

```text
usage_events
├── id
├── request_id
├── user_id
├── organization_id
├── provider
├── model
├── action_type
├── status
├── input_tokens
├── output_tokens
├── media_units
├── provider_cost_minor
├── provider_currency
├── internal_cost_credits
├── reservation_id
├── idempotency_key
├── started_at
├── completed_at
└── metadata
```

## 9. App Store / mobile rule

For iOS, do not expose external payment links for consumer digital content inside the app.

Product policy:

- Web can use Kaspi/YooKassa where legally configured.
- iOS consumer subscriptions or credits that unlock in-app digital AI services should use StoreKit/In-App Purchase unless the app qualifies for an Apple-approved alternative model.
- If the iOS app only allows login to an already purchased business account, make that business model explicit in App Review notes and do not show external checkout prompts.
- Keep demo account funded and unrestricted for review.

## 10. Refund rules

Refund credits when:

- provider timeout before usable result;
- provider error;
- validation failure after reservation;
- cancellation before provider completed;
- duplicate idempotent request.

Do not refund automatically when:

- user received the requested result;
- user closes the browser after job was queued and job later succeeds;
- user dislikes a correct generation result.

Manual admin refund must create audit log.

## 11. Admin billing controls

Admin must see:

- credits sold;
- credits consumed;
- provider cost;
- internal revenue;
- gross margin;
- failed/refunded operations;
- model-level spend;
- user-level spend;
- suspicious activity;
- open reservations.

Admin must control:

- plan credits;
- model multipliers;
- feature access per plan;
- provider budget caps;
- emergency model disable;
- promo codes;
- manual credit adjustments with audit log.

## 12. Immediate billing gaps

- Add request id to all API/billing paths.
- Extend `usage_events`.
- Ensure text completion capture uses normalized provider usage.
- Move plan source of truth into DB/admin.
- Add idempotency to all expensive API actions.
- Add App Store specific checkout policy in mobile client.

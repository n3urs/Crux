# Crux Billing — Implementation Summary

Stripe subscription billing for the Crux gym management SaaS platform.
This is B2B billing — gyms pay Crux for platform access.

## What was implemented

### Files created

| File | Purpose |
|------|---------|
| `src/main/database/platformDb.js` | Global SQLite DB at `data/platform.db` — stores billing records for all gyms |
| `src/config/stripe.js` | Stripe client initialisation (uses `STRIPE_SECRET_KEY` env var) |
| `src/routes/billing.js` | All billing API routes + webhook handler |
| `src/middleware/requireBilling.js` | Subscription gating middleware (not wired in yet) |

### Files modified

| File | Change |
|------|--------|
| `server.js` | Added Stripe env var docs, mounted billing webhook + router before gym context middleware |
| `scripts/provision-gym.js` | Inserts a 14-day trial billing record into platform.db on gym creation |
| `src/public/app.js` | Added "Billing" tab to Settings page with status, plan comparison, and upgrade/portal buttons |

## Platform database schema

`data/platform.db` contains two tables:

- **`gym_billing`** — one row per gym, tracks Stripe customer/subscription IDs, plan, status, trial/renewal dates
- **`billing_events`** — immutable log of every Stripe webhook event (idempotent, deduped by `stripe_event_id`)

## API routes

All routes are at `/billing/` and are mounted **before** the gym context middleware.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/billing/plans` | Public — returns plan list with prices |
| GET | `/billing/status?gymId=` | Returns billing status for a gym |
| POST | `/billing/create-checkout` | Creates Stripe Checkout session (or mock URL if no key) |
| POST | `/billing/portal` | Creates Stripe Customer Portal session |
| POST | `/billing/webhook` | Stripe webhook endpoint (raw body, signature verified) |

## Graceful degradation

When `STRIPE_SECRET_KEY` is not set (or is `sk_test_placeholder`):
- `POST /billing/create-checkout` returns `{ url: successUrl + '?mock=1' }` — no Stripe call
- `POST /billing/portal` returns mock URL
- All read routes (`/plans`, `/status`) always work regardless

## Environment variables to set

Add these to `/etc/dynamic.env` (or your env file) when going live:

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_GROWTH=price_...
STRIPE_PRICE_SCALE=price_...
```

## Plans

| Plan | Price | priceId env var |
|------|-------|-----------------|
| Starter | £59/mo | `STRIPE_PRICE_STARTER` |
| Growth | £99/mo | `STRIPE_PRICE_GROWTH` |
| Scale | £149/mo | `STRIPE_PRICE_SCALE` |

## Billing middleware (not wired in yet)

`src/middleware/requireBilling.js` is ready to use but intentionally not applied to any routes.

To gate a route:
```js
const requireBilling = require('./src/middleware/requireBilling');
app.use('/api/members', requireBilling, require('./src/routes/members'));
```

Behaviour:
- No billing record → allow (treat as trialing)
- `trialing` and trial not expired → allow
- `trialing` and trial expired → 402
- `active` → allow
- `past_due` → allow + `X-Billing-Warning: past_due` header
- `cancelled` or `unpaid` → 402 `{ error: 'subscription_required', upgradeUrl: '/billing/create-checkout' }`

## Webhook events handled

- `checkout.session.completed` → mark active, store subscription ID
- `customer.subscription.updated` → sync status, plan, period end
- `customer.subscription.deleted` → mark cancelled
- `invoice.payment_failed` → mark past_due
- `invoice.payment_succeeded` → mark active

## Setting up Stripe webhook

In the Stripe dashboard, create a webhook pointing to:
```
https://yourplatform.cruxgym.co.uk/billing/webhook
```

Events to subscribe to:
- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`
- `invoice.payment_succeeded`

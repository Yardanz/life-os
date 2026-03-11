# NOWPayments Billing Integration

Deterministic entitlement flow for Operator License.

## Flow (text diagram)

1. Client calls `POST /api/billing/nowpayments/create` with `planCode`.
2. Server creates `BillingOrder` (`CREATED` -> `INVOICE_CREATED`) and `BillingPayment`.
3. Server calls NOWPayments `POST /invoice` and returns hosted `checkoutUrl`.
4. User completes payment at provider invoice URL.
5. NOWPayments sends webhook to `POST /api/webhooks/nowpayments` (legacy alias: `/api/billing/nowpayments/ipn`).
6. Server verifies HMAC signature.
7. Server stores raw event (`BillingPaymentEvent`), upserts `BillingPayment`, updates `BillingOrder.status` idempotently.
8. On confirmed payment (`confirmed`/`finished` -> `PAID`), server upserts/extends `Entitlement(OPERATOR_LICENSE)`.

Rule: entitlement is granted only via IPN.

## Endpoints

- `POST /api/billing/nowpayments/create`
  - Auth required.
  - Body: `{ planCode: "OPERATOR_MONTHLY" | "OPERATOR_YEARLY" }`
  - Response: `{ ok: true, data: { orderId, checkoutUrl } }`
- `POST /api/webhooks/nowpayments`
  - Public webhook endpoint.
  - Raw body + `x-nowpayments-sig` verification.
  - Idempotent event handling and entitlement activation.
- `GET /api/billing/orders/:orderId`
  - Auth required.
  - Used by billing status page polling.

Compatibility:

- `POST /api/billing/create-invoice` remains available and uses the same service.
- `POST /api/billing/nowpayments/ipn` remains available as webhook alias.

## UI Routes

- `/pricing` capability spec with billing CTA.
- `/app/settings/billing` entitlement status + order history.
- `/billing/status?order=<id>` status page with polling.
- `/billing/success`, `/billing/cancel` informational fallback routes.

## Environment Variables

- `NOWPAYMENTS_API_KEY`
- `NOWPAYMENTS_IPN_SECRET`
- `NOWPAYMENTS_BASE_URL`
- `PUBLIC_APP_URL`

Do not expose these values to client runtime.

## Signature Verification

Server performs HMAC SHA-512 verification using `NOWPAYMENTS_IPN_SECRET`.

Procedure:

1. Parse raw payload JSON.
2. Build canonical payload JSON with stable sorted keys.
3. Compute `hmac_sha512(canonicalPayload, secret)`.
4. Compare to `x-nowpayments-sig` using constant-time comparison.
5. Reject invalid/missing signatures with `401`.

## Status Mapping

| NOWPayments status                   | Internal order status |
| ------------------------------------ | --------------------- |
| `waiting` / `confirming` / `sending` | `PENDING`             |
| `partially_paid`                     | `PARTIAL`             |
| `confirmed` / `finished`             | `PAID`                |
| `canceled` / `cancelled`             | `CANCELED`            |
| `failed` / `expired`                 | `FAILED`              |
| `refunded`                           | `REFUNDED`            |

## Entitlement Rules

- Key: `OPERATOR_LICENSE`.
- Status active if:
  - `status === ACTIVE`
  - `now < expiresAt`
- On paid order:
  - If active entitlement exists, extend from current `expiresAt`.
  - Else start from `now`.

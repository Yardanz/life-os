# NOWPayments Billing Integration

Deterministic entitlement flow for Operator License.

## Flow (text diagram)
1. Client calls `POST /api/billing/create-invoice` with `planCode`.
2. Server creates `BillingOrder` (`CREATED` -> `INVOICE_CREATED`) and returns `invoiceUrl`.
3. User completes payment at provider invoice URL.
4. NOWPayments sends IPN to `POST /api/billing/nowpayments/ipn`.
5. Server verifies HMAC signature.
6. Server stores `BillingPaymentEvent`, updates `BillingOrder.status`.
7. On `PAID`, server upserts/extends `Entitlement(OPERATOR_LICENSE)`.

Rule: entitlement is granted only via IPN.

## Endpoints
- `POST /api/billing/create-invoice`
  - Auth required.
  - Body: `{ planCode: "OPERATOR_MONTHLY" | "OPERATOR_YEARLY" }`
  - Response: `{ ok: true, data: { orderId, invoiceUrl } }`
- `POST /api/billing/nowpayments/ipn`
  - Public webhook endpoint.
  - Raw body + `x-nowpayments-sig` verification.
  - Writes payment event/order status; grants entitlement on paid status.

## UI Routes
- `/pricing` capability spec with billing CTA.
- `/app/settings/billing` entitlement status + order history.
- `/billing/mock-invoice` temporary placeholder invoice route.
- `/billing/success`, `/billing/cancel` informational routes.

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

| NOWPayments status | Internal order status |
|---|---|
| `waiting` / `confirming` / `confirmed` / `sending` | `PENDING` |
| `partially_paid` | `PARTIAL` |
| `finished` | `PAID` |
| `failed` / `expired` | `FAILED` |
| `refunded` | `REFUNDED` |

## Entitlement Rules
- Key: `OPERATOR_LICENSE`.
- Status active if:
  - `status === ACTIVE`
  - `now < expiresAt`
- On paid order:
  - If active entitlement exists, extend from current `expiresAt`.
  - Else start from `now`.


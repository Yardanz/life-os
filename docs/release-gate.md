# Preflight Release Gate

Operational preflight checklist for LIFE OS public release.

Use this file as a pass/fail gate before deploy.

## A) Content & Tone Checks
- [ ] PASS [ ] FAIL Public pages use operational language only.
- [ ] PASS [ ] FAIL No beta/early-access wording on `/`, `/demo`, `/pricing`, `/release`, `/operator`, `/support`.
- [ ] PASS [ ] FAIL Labels are consistent: `SYSTEM STATUS`, `GUARDRAIL`, `AUTHORITY`, `MODEL CONFIDENCE`, `CALIBRATION`.
- [ ] PASS [ ] FAIL Warning copy is short and non-emotional.
- [ ] PASS [ ] FAIL Capability wording matches current gating behavior.

## B) Auth & Permission Checks
- [ ] PASS [ ] FAIL Unauthenticated access to `/app` routes is blocked.
- [ ] PASS [ ] FAIL Auth callback URLs resolve correctly for `/`, `/pricing`, `/status`, `/app`.
- [ ] PASS [ ] FAIL No debug/admin controls are exposed in production UI.
- [ ] PASS [ ] FAIL No debug/admin endpoints are reachable in production.

## C) Demo / Snapshot Read-Only Verification
- [ ] PASS [ ] FAIL `/demo` scenario runner is client-side only (no mutating API/server actions).
- [ ] PASS [ ] FAIL `/demo` reset clears only demo state.
- [ ] PASS [ ] FAIL Read-only demo sessions block write actions in `/app`.
- [ ] PASS [ ] FAIL Snapshot pages render read-only state only.
- [ ] PASS [ ] FAIL Snapshot revoke/expiry invalidation does not expose user data.

## D) Security & Privacy Checks
- [ ] PASS [ ] FAIL Snapshot pages are non-indexable (`robots: noindex,nofollow`).
- [ ] PASS [ ] FAIL Snapshot pages are non-cacheable (`Cache-Control: no-store, max-age=0`, `Pragma: no-cache`).
- [ ] PASS [ ] FAIL Snapshot unavailable responses are generic (no revoked/expired detail leakage).
- [ ] PASS [ ] FAIL User-facing faults do not expose stack traces.
- [ ] PASS [ ] FAIL Error ID path is present for recoverable system faults.
- [ ] PASS [ ] FAIL No tokens are written to console logs.
- [ ] PASS [ ] FAIL No PII fields (email, userId, OAuth identifiers) are exposed in snapshot payloads.

## E) Data Export Checks
- [ ] PASS [ ] FAIL Export endpoint requires auth.
- [ ] PASS [ ] FAIL Export is scoped to current user only.
- [ ] PASS [ ] FAIL CSV/JSON outputs contain expected entities only.
- [ ] PASS [ ] FAIL Export metadata masks user id where emitted.
- [ ] PASS [ ] FAIL Export output does not include secrets/tokens/provider credentials.

## F) Deployment / Environment Checks
- [ ] PASS [ ] FAIL `DATABASE_URL` present.
- [ ] PASS [ ] FAIL Auth secret present (`AUTH_SECRET`/`NEXTAUTH_SECRET` by stack config).
- [ ] PASS [ ] FAIL OAuth provider keys configured for enabled providers.
- [ ] PASS [ ] FAIL `SYSTEM_VERSION` resolves (`NEXT_PUBLIC_VERSION` or `VERSION` or commit SHA).
- [ ] PASS [ ] FAIL `/api/health` returns `{ ok: true }`.
- [ ] PASS [ ] FAIL `/api/ready` policy is verified (token/internal).
- [ ] PASS [ ] FAIL `/.well-known/security.txt`, `/robots.txt`, `/sitemap.xml` resolve in deploy.

## Deployment Flags
- `SOFT_LAUNCH_MODE=true|false`
  - Enables invite-only gating logic for `/app` when public app access is disabled.
- `PUBLIC_APP_ACCESS=true|false`
  - `true`: any authenticated user can access `/app` (admin remains allowed).
  - `false`: `/app` restricted to admin/whitelist by deployment gate.
- `PUBLIC_OAUTH_ENABLED=true|false`
  - `false`: auth modal/buttons render disabled with operational containment message.
- `NEXT_PUBLIC_PUBLIC_OAUTH_ENABLED=true|false`
  - Client-side mirror used by auth UI for deterministic button disable state.
- `SOFT_LAUNCH_WHITELIST=email1,email2`
  - Invite allowlist for restricted deployments.
- `ADMIN_EMAIL=...`
  - Admin bootstrap email, always allowed by admin/deployment gates.

## G) Known Risks + Mitigations
### Known risks
- In-memory rate limiting/telemetry resets on process restart.
- Mailto support path has no delivery acknowledgment from backend.
- Dev diagnostics may still emit non-sensitive operational logs.

### Mitigations
- Treat limits/telemetry as anti-abuse/ops hints, not billing/forensics.
- Configure monitored `SUPPORT_EMAIL` and link `/status` + `/security`.
- Keep observability sanitation strict and avoid identifiers in user-facing messages.

## Quick Audit (Current Branch)
- [x] PASS [ ] FAIL `/demo` uses local scenario state only; no mutating API calls in `app/demo` + `components/demo`.
- [x] PASS [ ] FAIL Snapshot page is dynamic, noindex, and no-cache:
  - `app/s/[token]/page.tsx`
  - `next.config.ts` (`/s/:path*` headers)
- [x] PASS [ ] FAIL No dev/admin API routes remain in `app/api`.
- [x] PASS [ ] FAIL No token logging found in audited server/client logs (`console.*` grep over `app`, `lib`, `components`).

## Fixes Applied
- Removed `userId` from control-room API diagnostic strings:
  - `app/api/control-room/route.ts`
- Removed `userId` from `recalculateDay` missing-checkin error text:
  - `lib/services/recalculateDay.ts`
- Removed runtime Google Font fetch from root layout to keep production build deterministic in restricted environments:
  - `app/layout.tsx`
  - `app/globals.css`

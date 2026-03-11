# Go/No-Go Rubric

Operational release gate for LIFE OS.

## A) GO Criteria (all must be true)
- [ ] Security: snapshot pages enforce `no-store` + `noindex`, token is not logged, rate limiting is active on sensitive endpoints.
- [ ] Auth: OAuth callback flow is stable, no redirect loops from landing/auth/app.
- [ ] Data safety: Delete Account is transactional, Export works, Reset works.
- [ ] Demo: controlled scenario run + reset works, no DB writes from `/demo` scenario runner.
- [ ] `/app` gating: deployment flags behave correctly (restricted vs public access).
- [ ] Smoke test: 100% PASS (`docs/smoke-test.md`).
- [ ] No debug/admin tools are exposed in production.

## B) NO-GO Criteria (any is immediate no-go)
- [ ] PII leak detected in snapshot payloads or logs.
- [ ] Snapshot pages are cacheable or indexable.
- [ ] Any debug/admin endpoint is reachable in production.
- [ ] Demo scenario path writes to DB.
- [ ] Account deletion leaves orphaned records or fails silently.
- [ ] Hard crash on empty/partial state in `/app`.

## C) Release Flags Matrix

| Mode | SOFT_LAUNCH_MODE | PUBLIC_APP_ACCESS | PUBLIC_OAUTH_ENABLED | Notes |
|---|---:|---:|---:|---|
| Soft launch (invite-only) | `true` | `false` | `true` | Auth enabled, `/app` only for admin/whitelist. |
| Private operator test (single admin) | `false` | `false` | `true` | Only admin/whitelist can enter `/app`; keep whitelist minimal. |
| Public app access (auth open) | `false` | `true` | `true` | Any authenticated user can access `/app`. |

Emergency containment profile:
- `PUBLIC_OAUTH_ENABLED=false` (keeps auth UI visible but sign-in disabled).

## Decision
- [ ] GO
- [ ] NO-GO
- Decision timestamp:
- Decision owner:
- Notes:

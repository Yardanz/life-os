# Release Candidate Report

Date: 2026-03-03  
Scope: RC packaging and verification pass (no engine math changes).

## Build Info
- System version source: `lib/version.ts`
- RC marker: `0.1.0-rc.1`
- Commit hash: not embedded in this report (available via `VERCEL_GIT_COMMIT_SHA` when set)
- Local quality checks:
  - [ ] PASS [ ] FAIL `npm run lint`
  - [ ] PASS [ ] FAIL `npm run build`

## Deployment Flags Used
- `SOFT_LAUNCH_MODE`: [ ] true [ ] false
- `PUBLIC_APP_ACCESS`: [ ] true [ ] false
- `PUBLIC_OAUTH_ENABLED`: [ ] true [ ] false
- Notes:
  - Public routes remain public: `/demo`, `/release`, `/operator`, `/support`, `/privacy`, `/terms`, `/status`.

## Smoke Test Results
Based on `docs/smoke-test.md`.

1. [ ] PASS [ ] FAIL Open `/`.
2. [ ] PASS [ ] FAIL Validate nav links `/demo`, `/pricing`, `/privacy`, `/terms`, `/status`.
3. [ ] PASS [ ] FAIL Open `/demo`.
4. [ ] PASS [ ] FAIL Run controlled scenario + reset.
5. [ ] PASS [ ] FAIL Click `Enter Control Room` and verify auth protection.
6. [ ] PASS [ ] FAIL OAuth login (Google/GitHub) returns to expected callback.
7. [ ] PASS [ ] FAIL First-run onboarding/calibration notice in `/app`.
8. [ ] PASS [ ] FAIL Daily check-in save path.
9. [ ] PASS [ ] FAIL Calibration progress + confidence visible.
10. [ ] PASS [ ] FAIL Generate protocol.
11. [ ] PASS [ ] FAIL Apply protocol.
12. [ ] PASS [ ] FAIL Directives + Constraint Trace + Integrity visibility.
13. [ ] PASS [ ] FAIL Snapshot generate + open.
14. [ ] PASS [ ] FAIL Snapshot revoke behavior.
15. [ ] PASS [ ] FAIL Snapshot expired-token behavior.
16. [ ] PASS [ ] FAIL Export JSON/CSV behavior.
17. [ ] PASS [ ] FAIL Rate-limit sanity check.
18. [ ] PASS [ ] FAIL Reset system flow.
19. [ ] PASS [ ] FAIL Error ID surface path.
20. [ ] PASS [ ] FAIL Delete account flow (transactional + sign-out + redirect).

## Demo Scenario Run Verification
- [ ] PASS [ ] FAIL `/demo` scenario runner is client-side simulation only.
- [ ] PASS [ ] FAIL No DB write route/server action is called by scenario runner.

## Snapshot Verification
- [ ] PASS [ ] FAIL `/s/[token]` is dynamic and non-indexable.
- [ ] PASS [ ] FAIL Cache policy is no-store/no-cache for snapshot routes.
- [ ] PASS [ ] FAIL Revoked/expired tokens return generic unavailable response.
- [ ] PASS [ ] FAIL Snapshot payload excludes PII and raw check-in fields.

## Issues Found
- None recorded in this RC pass.

## Fix Status
- No additional defect fix was required beyond RC packaging updates.

## Fixes Applied
- Added RC version fallback in `lib/version.ts`:
  - `SYSTEM_VERSION` fallback set to `0.1.0-rc.1`.
- Updated `/release` version section with RC verification line:
  - "Release Candidate build. Operational verification in progress."

## Remaining Known Risks
- In-memory observability/rate-limit buffers reset on process restart.
- OAuth availability depends on deployment provider configuration.
- Snapshot/public behavior remains token-based; token handling policy should remain strict.

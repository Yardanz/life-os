# Smoke Test (Manual, <15 min)

Strict manual release smoke script for LIFE OS.

## Preconditions
- Local app is running and reachable.
- OAuth providers are configured (Google/GitHub).
- Test browser session can use incognito/private mode.
- One disposable test account is available for destructive steps.

## Test Steps
1. Open `/`.
   Expected: public landing loads with no runtime errors.
2. Validate public nav links: `/demo`, `/pricing`, `/privacy`, `/terms`, `/status`.
   Expected: all links resolve; no broken routes.
3. Open `/demo`.
   Expected: interactive preview loads without auth.
4. In `/demo`, run Controlled Scenario (`Run scenario`), then `Reset`.
   Expected: state advances; event log updates; reset clears demo state.
5. From public layer, click `Enter Control Room`.
   Expected: auth flow opens; unauthenticated user cannot access `/app` directly.
6. Authenticate with Google or GitHub.
   Expected: successful login and redirect to `/app` (or intended callback URL).
7. On first load in `/app`, verify calibration/operator onboarding surfaces.
   Expected: first-run guidance visible for low/no data.
8. Open Daily Check-in and submit valid values.
   Expected: save succeeds; no crash; check-in reflects in UI/event log.
9. Verify calibration progress and confidence display.
   Expected: X/7 and confidence appear; copy indicates limited confidence during calibration.
10. Generate protocol.
    Expected: protocol appears as recommended/available per current state.
11. Apply protocol.
    Expected: active protocol state updates; event log includes protocol applied entry.
12. Verify Operational Directives, Constraint Trace, and Integrity panels.
    Expected: panels show active-state data (or explicit deterministic lock-state if no active protocol).
13. Try snapshot workflow: generate snapshot link, open `/s/<token>`.
    Expected: snapshot page is read-only, generic, no personal identifiers.
14. Revoke snapshot in `/app` and refresh the same `/s/<token>`.
    Expected: generic unavailable response.
15. Validate expiry behavior with a seeded/expired snapshot token (if available in test data).
    Expected: generic unavailable response for expired token.
16. Run export (`JSON` and/or `CSV`) from `/app`.
    Expected: download starts; data is scoped to current user only.
17. Trigger mild rate limit on one sensitive path (e.g., export multiple times quickly).
    Expected: safe rate-limit message, no crash, recover after retry window.
18. Run `Reset System` with typed confirmation.
    Expected: reset completes; baseline/calibration returns to fresh state.
19. Validate Error ID surface (forced failure path if available in dev tooling).
    Expected: UI shows `System fault. Error ID: ...` without stack trace exposure.
20. Run `Delete Account` (typed confirmation `DELETE`) on disposable account.
    Expected: transactional delete, sign-out, redirect to `/`.

## Pass Criteria
- No unhandled runtime crashes.
- No stack traces in user-visible UI.
- No personal identifiers exposed in snapshot pages.
- Auth protections and admin/dev gates behave as expected.
- Core control loop remains operational after first check-in and protocol apply.

## Notes
- If a step is intentionally environment-dependent (OAuth provider outage, missing test expired token), mark as `BLOCKED` with reason and continue.
- Record any deviation with route, timestamp, and screenshot.

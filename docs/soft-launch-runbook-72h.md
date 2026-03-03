# Soft Launch Runbook (72h)

Operational runbook for first 72 hours after release candidate deployment.

## A) Pre-launch (T-30 min)
- [ ] Set deployment flags for intended mode:
  - [ ] `SOFT_LAUNCH_MODE`
  - [ ] `PUBLIC_APP_ACCESS`
  - [ ] `PUBLIC_OAUTH_ENABLED`
- [ ] Verify `/status` responds and shows operational state.
- [ ] Verify `/release` shows RC version marker.
- [ ] Run `/demo` controlled scenario once (`Run scenario` + `Reset`).
- [ ] Run critical smoke subset:
  - [ ] Login flow to `/app` works.
  - [ ] First check-in save works.
  - [ ] Protocol generate + apply works.
  - [ ] Snapshot generate + revoke works.
  - [ ] Export works.

## B) Hour 0-6

### Monitor cadence
- [ ] Check Internal Health Console every 30-60 min:
  - active users
  - check-ins volume
  - LOCKDOWN count
  - active protocol ratio
  - error count and latest Error IDs

### Support intake
- [ ] Verify `/support` channel is reachable.
- [ ] Confirm triage template is used (`docs/support-triage-template.md`).

### Incident triggers (simple thresholds)
- [ ] Error events spike above baseline (example: > 20/hour).
- [ ] LOCKDOWN ratio exceeds threshold among active users (example: > 35%).
- [ ] Protocol apply failures repeated (example: >= 5 within 30 min).

### Immediate actions
- [ ] Capture Error IDs and timestamps.
- [ ] If access instability is broad, set `PUBLIC_APP_ACCESS=false`.
- [ ] Use `PUBLIC_OAUTH_ENABLED=false` only for emergency containment.
- [ ] Preserve current deployment flags in incident notes.

## C) Hour 6-24

### Daily review checklist
- [ ] Compare error counts vs first 6h baseline.
- [ ] Review support tickets and group by root cause.
- [ ] Confirm no PII exposure in snapshots/reports/logs.
- [ ] Confirm admin routes remain admin-only.

### Triage categories
- [ ] Functional defect
- [ ] UX confusion
- [ ] Model interpretation mismatch (UI copy/trace)
- [ ] Performance

### Response template
- [ ] Error ID:
- [ ] Route/page:
- [ ] Steps:
- [ ] Expected:
- [ ] Actual:
- [ ] Severity:
- [ ] Owner:
- [ ] ETA:

## D) Day 2-3

### Stabilization targets
- [ ] Error rate trends down vs day 1.
- [ ] Protocol enforcement adoption is stable.
- [ ] Snapshot usage remains safe (no abuse indicators, revoke/expiry behavior intact).

### Access expansion decision
- [ ] Expand whitelist only (keep invite mode), or
- [ ] Enable `PUBLIC_APP_ACCESS=true`, or
- [ ] Keep restricted mode.
- Decision owner:
- Decision timestamp:

## E) Incident Playbooks

### 1) Auth incident
Immediate action:
- [ ] Confirm provider availability and callback URL health.
- [ ] Switch to restricted access if needed (`PUBLIC_APP_ACCESS=false`).
Containment flags:
- [ ] Keep `PUBLIC_OAUTH_ENABLED=true` unless emergency.
- [ ] If emergency containment needed, set `PUBLIC_OAUTH_ENABLED=false`.
Communication line:
- "Authentication path unstable. Access is temporarily restricted while recovery is in progress."

### 2) Snapshot abuse suspicion
Immediate action:
- [ ] Revoke affected snapshot tokens.
- [ ] Validate noindex/no-store headers and token handling.
Containment flags:
- [ ] Keep public routes online.
- [ ] Restrict `/app` if abuse appears account-driven (`PUBLIC_APP_ACCESS=false`).
Communication line:
- "Snapshot access is under containment review. Public token handling safeguards are active."

### 3) Data corruption suspicion
Immediate action:
- [ ] Freeze risky write operations operationally (restrict access if required).
- [ ] Capture Error IDs and affected routes.
- [ ] Validate DB integrity on impacted entities.
Containment flags:
- [ ] Set `PUBLIC_APP_ACCESS=false` during investigation.
- [ ] Keep `PUBLIC_OAUTH_ENABLED` unchanged unless auth itself is impacted.
Communication line:
- "Data integrity checks are running. Access is temporarily constrained to prevent further impact."


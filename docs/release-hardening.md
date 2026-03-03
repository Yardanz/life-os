# Release Hardening Pass

## A) Accessibility + Focus
- Checked:
  - Shared modal shell behavior (`ModalShell`) for focus trap, ESC close, outside click close, and body scroll lock.
  - Auth modal, check-in modal, explain/status modals.
- Changed:
  - Added `data-autofocus` to first primary auth action in `components/auth/AuthModal.tsx`.
  - Added `data-autofocus` to first check-in input in `components/checkin/DailyCheckinForm.tsx`.
  - Added accessible popover wiring in Control Room diagnosis Why button (`aria-expanded`, `aria-controls`, `aria-describedby`, `role="tooltip"`) in `components/control-room/ControlRoomDashboard.tsx`.
- Remaining risks:
  - Some legacy info hints still use `title` attributes (browser-native tooltip behavior).

## B) Empty / Partial State Resilience
- Checked:
  - Core `/app` operational panels under zero-data, no active protocol, calibration, and read-only conditions.
  - Snapshot page formatting for null/invalid values.
- Changed:
  - Added safe numeric formatting helper in `app/s/[token]/page.tsx` to avoid `NaN` and render `--`.
  - Guarded confidence display in `components/control-room/SystemStatusBar.tsx` to prevent `NaN%`.
- Remaining risks:
  - Very rare malformed backend payloads in non-snapshot routes may still rely on upstream sanitization.

## C) Security / Privacy Hardening
- Checked:
  - Snapshot page noindex metadata and dynamic/no-store behavior.
  - Error handling paths already using Error ID payloads.
  - No token logging introduced in UI changes.
- Changed:
  - Unified invalid snapshot responses to generic `Snapshot unavailable.` for revoked/expired/not-found in `app/s/[token]/page.tsx`, reducing token-state disclosure.
- Remaining risks:
  - Existing server debug logs outside this pass may still include operational identifiers in development.

## D) Performance / Hydration
- Checked:
  - Hydration-sensitive state initialization in `/demo` and `/app` view-mode path.
- Changed:
  - Made demo language initialization hydration-safe by deferring URL-derived language to `useEffect` in `app/demo/page.tsx`.
  - Kept SSR-stable default rendering paths (`simplified` for Control Room view mode, deterministic demo initial scenario).
- Remaining risks:
  - Returning users with stored FULL view still switch after hydration by design (stateful preference sync).

## E) Copy + Consistency
- Checked:
  - Operational labels in authority/status layer and modal copy.
  - No beta/early-access wording in public UI.
- Changed:
  - Kept label set consistent in system status layer (`SYSTEM STATUS`, `GUARDRAIL`, `AUTHORITY`, `MODEL CONFIDENCE`, `CALIBRATION`).
  - Maintained concise warning style and generic unavailable/error wording.
- Remaining risks:
  - Future content updates must preserve same terminology; this pass did not refactor i18n dictionaries globally.

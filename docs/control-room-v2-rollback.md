# Control Room V2 Rollback

Control Room UI is now feature-flagged.

- `CONTROL_ROOM_V2=true`: render `ControlRoomV2`
- `CONTROL_ROOM_V2=false`: render `ControlRoomLegacy`

Instant rollback:

1. Set `CONTROL_ROOM_V2=false` in environment.
2. Restart the app process (or redeploy if running in hosted environment).

No data models or backend logic are changed by this switch.

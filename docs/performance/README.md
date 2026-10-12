# Performance artifacts

- `report.md` is the canonical architecture and device measurement report.
- `runs/release-final-sf-cleared/` is the canonical Release A–H run set except Scene C, whose 80dp clearance fixture was superseded by `runs/release-scene-C-exact-topbar/`.
- `runs/debug-final-sf-cleared/` provides the Debug A baseline. Its Scene C also used the superseded clearance fixture.
- `runs/release-js-diagnostic/` contains overlay-instrumented JS RAF measurements and is diagnostic only.
- Other `runs/*` folders are intermediate geometry, clip, harness, smoke, or probe experiments. They are retained as provenance and must not be substituted for the canonical samples above.
- `traces/` contains the saved Perfetto traces and query output for Release D/F/G.

The runner uses route-driven synthetic motion by default. On this device, `adb shell input swipe` is rejected with `SecurityException: INJECT_EVENTS`; synthetic cases do not certify physical touch cadence.

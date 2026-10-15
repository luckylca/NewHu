# Performance workflow

Long-running historical experiment output (runs/, traces/, APK/build caches and report snapshots) was distilled into the repository root AGENTS.md and removed from the worktree.

Keep repeatable analysis code under scripts/performance/ and Perfetto config under scripts/performance/configs/. Write generated captures to .perf-runs/ or an explicit OUT_DIR; Git ignores those outputs.

Synthetic ADB input frequency is not physical touch FPS. Compare scroll offset, moving frames, route-scene glass optics and installed APK/source SHA together. See AGENTS.md for protocol and rejected approaches.

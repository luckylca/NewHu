# Liquid Glass Native Benchmark

This Android-only sample consumes the package's standalone `android-core` Android library. It does not start React Native, Expo, NewHu, or `liquid-glass-kit`.

It presents a native `RecyclerView` with comment-like rows and package `LocalGlassView` cells, plus a backdrop `LiquidGlassView` title bar. `mode=live` samples the current route source. `mode=frozen` creates one RenderNode-backed frozen source with a 32 dp RenderEffect blur before the measured scroll.

## Build and run

```bash
cd project/react-native-liquid-glass/example/android-native
ANDROID_HOME="$HOME/Library/Android/sdk" ./gradlew :app:assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.newhu.liquidglass.nativebenchmark/.MainActivity --ei count 80 --es mode live
```

The activity waits for initial layout, then performs one 12-second native scroll. The ViewHolder creates each row hierarchy once; binding only updates its text and avatar color. The scroll driver uses its own last target rather than querying the RecyclerView's current offset every frame. No `adb input swipe` or `adb input tap` is used. Save the `LiquidGlassNative` logcat output with the corresponding device `gfxinfo`, framestats, and Perfetto trace.

Arguments:

- `count`: 5, 20, or 80 rows (default 80)
- `backdrop`: `off`, `frozen`, or `live` (default `live`); `mode=live|frozen` remains as a compatibility alias
- `local`: boolean, enables per-row Local Glass (default `true`)
- `telemetry`: boolean, enables Core counters/logging (default `true`)

The four cost-isolation cases use `local=false backdrop=off` (Recycler only), `local=true backdrop=off` (Local Glass), `local=true backdrop=frozen` (frozen top bar), and `local=true backdrop=live` (live top bar). Build both variants with `./gradlew :app:assembleDebug :app:assembleRelease` and compare telemetry on/off explicitly. The release sample is non-debuggable and can be installed with the local debug signing key.

For five repeat runs, the helper builds the selected variant, installs it on `a4976c80`, uses the same 12-second animation, and saves per-run logcat, gfxinfo, framestats, and thermal snapshots:

```bash
./run-benchmark.sh release off false true 5 80 /absolute/path/to/recycler-only
./run-benchmark.sh release off true true 5 80 /absolute/path/to/local-only
./run-benchmark.sh release frozen true true 5 80 /absolute/path/to/frozen
./run-benchmark.sh release live true true 5 80 /absolute/path/to/live
./run-benchmark.sh release live true false 5 80 /absolute/path/to/live-telemetry-off
```

Use `debug live true true 5 80` for the Debug/Telemetry-On control. The nine positional arguments are `variant backdrop local telemetry runs count outputDir scrollCache scrollDriver`. Pass `true` for `scrollCache` to use the experimental scroll-aware overscan source window; it is off by default for baseline runs. `scrollDriver=query` is a diagnostic control that restores the old per-frame `computeVerticalScrollOffset()` query; `target` uses the locally tracked target.

The activity reports P50/P90/P95/P99/worst FrameMetrics total, UI, RenderThread, and GPU time, deadline misses, and 8.33/16.67 ms over-budget counts. Native Glass telemetry and Local Glass shader counters are emitted at the end.

## Source boundary

`android-core/build.gradle` builds only the package-owned `com.newhu.liquidglass` engine sources and AndroidX annotations. The Expo module and its React Native dependencies are not on the app compile classpath. Build the standalone library target with `./gradlew :liquidglass-core:assembleDebug` from this sample project.

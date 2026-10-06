#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ADB_BIN="${ADB:-adb}"
APP_ID="${APP_ID:-com.anonymous.NewHu}"
RUNS="${RUNS:-3}"
SCENES="${SCENES:-normal card waterfall comments child}"
BUILD_LABEL="${BUILD_LABEL:-release}"
COUNT="${COUNT:-40}"
WARMUP_SECONDS="${WARMUP_SECONDS:-3}"
DURATION_SECONDS="${DURATION_SECONDS:-12}"
START_DELAY_MS="${START_DELAY_MS:-1800}"
TELEMETRY="${TELEMETRY:-0}"
HARDWARE_LAYER="${HARDWARE_LAYER:-0}"
THEME="${THEME:-liquidGlass}"
RENDERER="${RENDERER:-legacy}"
GLASS_ENGINE="${GLASS_ENGINE:-legacy}"
DISPLAY_ID="${DISPLAY_ID:-4630947108695800451}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="${OUT_DIR:-$ROOT_DIR/docs/performance/runs/$STAMP-local-glass-$BUILD_LABEL}"

mkdir -p "$OUT_DIR"
command -v "$ADB_BIN" >/dev/null
"$ADB_BIN" get-state >/dev/null

"$ADB_BIN" shell wm size > "$OUT_DIR/device-size.txt" 2>&1
"$ADB_BIN" shell wm density > "$OUT_DIR/device-density.txt" 2>&1
"$ADB_BIN" shell settings get system peak_refresh_rate > "$OUT_DIR/peak-refresh-rate.txt" 2>&1
"$ADB_BIN" shell settings get system min_refresh_rate > "$OUT_DIR/min-refresh-rate.txt" 2>&1
"$ADB_BIN" shell dumpsys display > "$OUT_DIR/dumpsys-display.txt" 2>&1
"$ADB_BIN" shell dumpsys window > "$OUT_DIR/dumpsys-window.txt" 2>&1

printf 'scene,run,theme,renderer,glass_engine,wallpaper,actions,active_seconds,telemetry_overlay,hardware_layer\n' > "$OUT_DIR/manifest.csv"

for scene in $SCENES; do
    for run in $(seq 1 "$RUNS"); do
        run_dir="$OUT_DIR/scene-$scene/run-$run"
        mkdir -p "$run_dir"
        uri="newhu://dev/local-glass-benchmark?scene=$scene&count=$COUNT&run=$run&startDelayMs=$START_DELAY_MS&telemetry=$TELEMETRY&hardwareLayer=$HARDWARE_LAYER&theme=$THEME&renderer=$RENDERER&engine=$GLASS_ENGINE"
        escaped_uri="${uri//&/\\&}"
        "$ADB_BIN" shell am force-stop "$APP_ID"
        "$ADB_BIN" logcat -c
        "$ADB_BIN" shell am start -W -a android.intent.action.VIEW -d "$escaped_uri" "$APP_ID" > "$run_dir/launch.txt" 2>&1
        ready_wait_ms=0
        while ! "$ADB_BIN" logcat -d -s ReactNativeJS:I | rg -q "\[LOCAL_GLASS_BENCHMARK_READY\] scene=$scene count=$COUNT"; do
            if (( ready_wait_ms >= (WARMUP_SECONDS + 30) * 1000 )); then
                echo "benchmark route did not become ready: scene=$scene count=$COUNT" >&2
                exit 1
            fi
            sleep 0.2
            ready_wait_ms=$((ready_wait_ms + 200))
        done
        "$ADB_BIN" logcat -d -s ReactNativeJS:I | rg "\[LOCAL_GLASS_BENCHMARK_READY\] scene=$scene count=$COUNT" > "$run_dir/ready.txt"
        sleep 0.2

        sf_layer="$("$ADB_BIN" shell dumpsys SurfaceFlinger --list | tr -d '\r' | sed -nE "s/^RequestedLayerState\\{(${APP_ID//./\\.}\\/${APP_ID//./\\.}\\.MainActivity#[0-9]+).*/\\1/p" | tail -n 1)"
        printf '%s\n' "$sf_layer" > "$run_dir/surfaceflinger-layer.txt"
        if [[ -n "$sf_layer" ]]; then
            "$ADB_BIN" shell dumpsys SurfaceFlinger --latency-clear "$sf_layer" >/dev/null 2>&1 || true
        fi
        "$ADB_BIN" shell dumpsys gfxinfo "$APP_ID" reset >/dev/null 2>&1
        "$ADB_BIN" logcat -c
        start_gap_ms=$((START_DELAY_MS - 1400))
        (( start_gap_ms < 0 )) && start_gap_ms=0
        active_wait_seconds=$((DURATION_SECONDS + (start_gap_ms + 999) / 1000))
        sleep "$active_wait_seconds"
        printf 'scene=%s run=%s theme=%s renderer=%s engine=%s route-auto=true active=%s count=%s startDelayMs=%s reset-before-start=true\n' "$scene" "$run" "$THEME" "$RENDERER" "$GLASS_ENGINE" "$DURATION_SECONDS" "$COUNT" "$START_DELAY_MS" > "$run_dir/run.txt"
        printf '%s,%s,%s,%s,%s,off,route-auto,%s,%s,%s\n' "$scene" "$run" "$THEME" "$RENDERER" "$GLASS_ENGINE" "$DURATION_SECONDS" "$TELEMETRY" "$HARDWARE_LAYER" >> "$OUT_DIR/manifest.csv"

        "$ADB_BIN" shell dumpsys gfxinfo "$APP_ID" > "$run_dir/gfxinfo.txt" 2>&1
        "$ADB_BIN" shell dumpsys gfxinfo "$APP_ID" framestats > "$run_dir/framestats.txt" 2>&1
        if [[ -n "$sf_layer" ]]; then
            "$ADB_BIN" shell dumpsys SurfaceFlinger --latency "$sf_layer" > "$run_dir/surfaceflinger-latency.txt" 2>&1 || true
        else
            "$ADB_BIN" shell dumpsys SurfaceFlinger --latency > "$run_dir/surfaceflinger-latency.txt" 2>&1 || true
        fi
        "$ADB_BIN" exec-out screencap -p -d "$DISPLAY_ID" > "$run_dir/screenshot.png"
        "$ADB_BIN" shell uiautomator dump /sdcard/local-glass-window.xml >/dev/null 2>&1 || true
        "$ADB_BIN" pull /sdcard/local-glass-window.xml "$run_dir/window.xml" >/dev/null 2>&1 || true
        "$ADB_BIN" logcat -d -s ReactNativeJS:I LiquidGlassPerf:I | rg '\[LOCAL_GLASS_COUNTS\]|\[LOCAL_GLASS_BENCHMARK_START\]|LiquidGlassPerf:' > "$run_dir/logcat.txt" || true
        printf 'saved %s run %s to %s\n' "$scene" "$run" "$run_dir"
    done
done

python3 "$ROOT_DIR/scripts/performance/analyze-android-glass.py" "$OUT_DIR"
echo "local-glass benchmark artifacts: $OUT_DIR"

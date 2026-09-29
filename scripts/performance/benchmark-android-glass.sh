#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ADB_BIN="${ADB:-adb}"
APP_ID="${APP_ID:-com.anonymous.NewHu}"
RUNS="${RUNS:-3}"
BUILD_LABEL="${BUILD_LABEL:-release}"
SCENES="${SCENES:-A A-wallpaper B C D E F G H}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="${OUT_DIR:-$ROOT_DIR/docs/performance/runs/$STAMP-$BUILD_LABEL}"
WIDTH="${WIDTH:-1224}"
HEIGHT="${HEIGHT:-2912}"
INPUT_BACKEND="${INPUT_BACKEND:-adb}"
WARMUP_SECONDS="${WARMUP_SECONDS:-3}"
OVERLAY="${OVERLAY:-0}"

mkdir -p "$OUT_DIR"
command -v "$ADB_BIN" >/dev/null
"$ADB_BIN" get-state >/dev/null

"$ADB_BIN" shell wm size > "$OUT_DIR/device-size.txt" 2>&1
"$ADB_BIN" shell wm density > "$OUT_DIR/device-density.txt" 2>&1
"$ADB_BIN" shell settings get system peak_refresh_rate > "$OUT_DIR/peak-refresh-rate.txt" 2>&1
"$ADB_BIN" shell settings get system min_refresh_rate > "$OUT_DIR/min-refresh-rate.txt" 2>&1
"$ADB_BIN" shell settings get system user_refresh_rate > "$OUT_DIR/user-refresh-rate.txt" 2>&1
"$ADB_BIN" shell dumpsys display > "$OUT_DIR/dumpsys-display.txt" 2>&1
"$ADB_BIN" shell dumpsys window > "$OUT_DIR/dumpsys-window.txt" 2>&1

launch_scene() {
    local scene="$1" case_name="$2" run_name="$3" wallpaper="$4"
    local uri="newhu://dev/performance-benchmark?scene=$scene&run=$run_name&nativeTelemetry=1&wallpaper=$wallpaper"
    if [[ -n "$case_name" ]]; then uri+="&case=$case_name"; fi
    if [[ "$OVERLAY" == "1" ]]; then uri+="&telemetry=1"; fi
    local escaped_uri="${uri//&/\\&}"
    "$ADB_BIN" shell am start -W -a android.intent.action.VIEW -d "$escaped_uri" "$APP_ID" >/dev/null 2>&1
}

run_motion() {
    local scene="$1"
    local run_dir="$2"
    if [[ "$INPUT_BACKEND" == route-auto ]]; then
        sleep 11
        case "$scene" in
            A|C|D|E) printf 'synthetic-scrollTo\n' ;;
            H) printf 'synthetic-tab-selection\n' ;;
            B) printf 'static\n' ;;
            *) printf 'route-cycle\n' ;;
        esac
        return 0
    fi
    if [[ "$INPUT_BACKEND" == adb ]]; then
        # Direct shell input is a physical gesture path when the device grants the
        # shell input permission. Some OEM builds reject it with INJECT_EVENTS.
        local end=$(( $(date +%s) + 12 ))
        local x=$((WIDTH / 2)) y_top=$((HEIGHT * 80 / 100)) y_bottom=$((HEIGHT * 34 / 100))
        local tab_y=$((HEIGHT * 13 / 100)) left=$((WIDTH * 15 / 100)) right=$((WIDTH * 85 / 100))
        local direction=0
        while (( $(date +%s) < end )); do
            case "$scene" in
                H)
                    if ((direction % 2 == 0)); then
                        "$ADB_BIN" shell input swipe "$left" "$tab_y" "$right" "$tab_y" 320
                    else
                        "$ADB_BIN" shell input swipe "$right" "$tab_y" "$left" "$tab_y" 320
                    fi
                    ;;
                B) "$ADB_BIN" shell input tap "$x" "$((HEIGHT / 2))" ;;
                *)
                    if ((direction % 2 == 0)); then
                        "$ADB_BIN" shell input swipe "$x" "$y_top" "$x" "$y_bottom" 430
                    else
                        "$ADB_BIN" shell input swipe "$x" "$y_bottom" "$x" "$y_top" 430
                    fi
                    ;;
            esac
            direction=$((direction + 1))
        done
        printf '%s\n' "$direction"
    else
        echo "Unsupported INPUT_BACKEND=$INPUT_BACKEND (use adb for physical input or route-auto for synthetic motion)" >&2
        return 2
    fi
}

printf 'scene,run,wallpaper,actions,active_seconds,telemetry_overlay\n' > "$OUT_DIR/manifest.csv"
for scene in $SCENES; do
    for run in $(seq 1 "$RUNS"); do
        route_scene="$scene"
        wallpaper=off
        if [[ "$scene" == A-wallpaper ]]; then
            route_scene=A
            wallpaper=on
        fi
        case_name=""
        case "$route_scene" in
            F) case_name="dialog" ;;
            G) case_name="sheet" ;;
        esac
        if [[ "$INPUT_BACKEND" == route-auto ]]; then
            case "$route_scene" in
                A|C|D|E) case_name="scroll" ;;
                H) case_name="tab" ;;
            esac
        fi
        run_name="$scene-$run"
        run_dir="$OUT_DIR/scene-$scene/run-$run"
        mkdir -p "$run_dir"
        launch_scene "$route_scene" "$case_name" "$run_name" "$wallpaper"
        sleep "$WARMUP_SECONDS"
        sf_layer="$("$ADB_BIN" shell dumpsys SurfaceFlinger --list | tr -d '\r' | sed -nE "s/^RequestedLayerState\\{(${APP_ID//./\\.}\\/${APP_ID//./\\.}\\.MainActivity#[0-9]+).*/\\1/p" | tail -n 1)"
        printf '%s\n' "$sf_layer" > "$run_dir/surfaceflinger-layer.txt"
        if [[ -n "$sf_layer" ]]; then
            # Clear the 128-frame ring at the measurement boundary. Otherwise an
            # idle route can inherit presents from the preceding scene.
            "$ADB_BIN" shell dumpsys SurfaceFlinger --latency-clear "$sf_layer" >/dev/null 2>&1 || true
        fi
        "$ADB_BIN" logcat -c
        "$ADB_BIN" shell dumpsys gfxinfo "$APP_ID" reset >/dev/null 2>&1
        started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
        if [[ "$route_scene" == F || "$route_scene" == G ]]; then
            # The route's 12-second dialog/sheet cycle starts after a 2-second warm-up.
            sleep 11
            actions=20
            measured_seconds=11
        elif [[ "$INPUT_BACKEND" == route-auto ]]; then
            actions="$(run_motion "$route_scene" "$run_dir")"
            measured_seconds=11
        else
            actions="$(run_motion "$route_scene" "$run_dir")"
            sleep 0.5
            measured_seconds=12
        fi
        ended_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
        printf '%s,%s,%s,%s,%s,%s\n' "$scene" "$run" "$wallpaper" "$actions" "$measured_seconds" "$OVERLAY" >> "$OUT_DIR/manifest.csv"
        printf 'scene=%s run=%s driver=%s overlay=%s started=%s ended=%s actions=%s\n' "$scene" "$run" "$INPUT_BACKEND" "$OVERLAY" "$started_at" "$ended_at" "$actions" > "$run_dir/run.txt"
        "$ADB_BIN" shell dumpsys gfxinfo "$APP_ID" > "$run_dir/gfxinfo.txt" 2>&1
        "$ADB_BIN" shell dumpsys gfxinfo "$APP_ID" framestats > "$run_dir/framestats.txt" 2>&1
        "$ADB_BIN" logcat -d -s LiquidGlassPerf:I GlassBenchInput:I ReactNativeJS:I > "$run_dir/logcat.txt" 2>&1
        if [[ -n "$sf_layer" ]]; then
            "$ADB_BIN" shell dumpsys SurfaceFlinger --latency "$sf_layer" > "$run_dir/surfaceflinger-latency.txt" 2>&1 || true
        else
            "$ADB_BIN" shell dumpsys SurfaceFlinger --latency > "$run_dir/surfaceflinger-latency.txt" 2>&1 || true
        fi
        echo "saved $scene run $run to $run_dir"
    done
done

python3 "$ROOT_DIR/scripts/performance/analyze-android-glass.py" "$OUT_DIR"
echo "benchmark artifacts: $OUT_DIR"

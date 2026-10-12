#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ADB_BIN="${ADB:-$HOME/Library/Android/sdk/platform-tools/adb}"
APP_ID="${APP_ID:-com.anonymous.NewHu}"
PAGE="${1:-}"
RUNS="${RUNS:-5}"
DURATION_MS="${DURATION_MS:-12000}"
SWIPE_MS="${SWIPE_MS:-600}"
BENCHMARK_QUERY="${BENCHMARK_QUERY:-}"
OUT_DIR="${OUT_DIR:-$ROOT_DIR/docs/performance/runs/$(date +%Y%m%d-%H%M%S)-page-$PAGE}"
WARMUP_SECONDS="${WARMUP_SECONDS:-8}"

case "$PAGE" in
    home) ROUTE="home" ;;
    settings) ROUTE="settings" ;;
    animationSettings) ROUTE="animationSettings" ;;
    privacy-personalization) ROUTE="privacy-personalization" ;;
    devmode) ROUTE="devmode" ;;
    ai-analysis-settings) ROUTE="ai-analysis-settings" ;;
    themeSet) ROUTE="themeSet" ;;
    userinfo) ROUTE="userinfo" ;;
    product-v1) ROUTE="product-v1" ;;
    question) ROUTE="question" ;;
    people) ROUTE="people" ;;
    *)
        echo "Usage: $0 <home|settings|animationSettings|privacy-personalization|devmode|ai-analysis-settings|themeSet|userinfo|product-v1|question|people>" >&2
        exit 2
        ;;
esac

if [[ ("$PAGE" == "question" || "$PAGE" == "people") && -z "$BENCHMARK_QUERY" ]]; then
    echo "A real route identifier is required for feed benchmarks; set BENCHMARK_QUERY (for example id=<question-id> or urlToken=<user-token>)." >&2
    exit 2
fi

if [[ -z "${DEVICE_ID:-}" ]]; then
    connected_devices=()
    while IFS= read -r serial; do
        connected_devices+=("$serial")
    done < <("$ADB_BIN" devices | awk 'NR > 1 && $2 == "device" { print $1 }')
    if [[ "${#connected_devices[@]}" -ne 1 ]]; then
        echo "Set DEVICE_ID when zero or multiple Android devices are connected." >&2
        exit 2
    fi
    DEVICE_ID="${connected_devices[0]}"
fi

mkdir -p "$OUT_DIR"
"$ADB_BIN" -s "$DEVICE_ID" get-state >/dev/null
device_size="$("$ADB_BIN" -s "$DEVICE_ID" shell wm size | sed -n 's/.*:[[:space:]]*\([0-9][0-9]*\)x\([0-9][0-9]*\).*/\1 \2/p' | tail -n 1)"
read -r screen_width screen_height <<< "$device_size"
if [[ -z "${screen_width:-}" || -z "${screen_height:-}" ]]; then
    echo "Could not read Android display size." >&2
    exit 1
fi
center_x=$((screen_width / 2))
swipe_start_y=$((screen_height * 3 / 4))
swipe_end_y=$((screen_height / 4))

"$ADB_BIN" -s "$DEVICE_ID" shell wm size > "$OUT_DIR/device-size.txt"
"$ADB_BIN" -s "$DEVICE_ID" shell wm density > "$OUT_DIR/device-density.txt"
"$ADB_BIN" -s "$DEVICE_ID" shell settings get system peak_refresh_rate > "$OUT_DIR/peak-refresh-rate.txt"
"$ADB_BIN" -s "$DEVICE_ID" shell dumpsys display > "$OUT_DIR/dumpsys-display.txt"
"$ADB_BIN" -s "$DEVICE_ID" shell dumpsys package "$APP_ID" > "$OUT_DIR/package-info.txt"
printf 'device=%s\npage=%s\nmode=Release\nrefresh_target=120Hz\nroute=newhu://%s\nextra_route_query=%s\nscroll_driver=adb shell input swipe\nrequested_duration_ms=%s\nswipe_duration_ms=%s\nruns=%s\n' \
    "$DEVICE_ID" "$PAGE" "$ROUTE" "$BENCHMARK_QUERY" "$DURATION_MS" "$SWIPE_MS" "$RUNS" > "$OUT_DIR/environment.txt"
printf 'scene,run,active_seconds\n' > "$OUT_DIR/manifest.csv"

swipe_count=$(((DURATION_MS + SWIPE_MS - 1) / SWIPE_MS))
for run_number in $(seq 1 "$RUNS"); do
    run_dir="$OUT_DIR/scene-$PAGE/run-$run_number"
    mkdir -p "$run_dir"
    uri="newhu://$ROUTE"
    if [[ -n "$BENCHMARK_QUERY" ]]; then uri+="?$BENCHMARK_QUERY"; fi
    escaped_uri="${uri//&/\\&}"

    "$ADB_BIN" -s "$DEVICE_ID" shell am force-stop "$APP_ID"
    "$ADB_BIN" -s "$DEVICE_ID" logcat -c
    "$ADB_BIN" -s "$DEVICE_ID" shell am start -W -a android.intent.action.VIEW -d "$escaped_uri" "$APP_ID" > "$run_dir/launch.txt" 2>&1
    sleep "$WARMUP_SECONDS"
    if [[ "$run_number" == "1" ]]; then
        "$ADB_BIN" -s "$DEVICE_ID" shell screencap -p /sdcard/newhu-page-benchmark.png
        "$ADB_BIN" -s "$DEVICE_ID" pull /sdcard/newhu-page-benchmark.png "$run_dir/ready.png" >/dev/null
    fi
    "$ADB_BIN" -s "$DEVICE_ID" shell dumpsys gfxinfo "$APP_ID" reset > "$run_dir/gfxinfo-reset.txt" 2>&1
    "$ADB_BIN" -s "$DEVICE_ID" shell dumpsys SurfaceFlinger --latency-clear > /dev/null 2>&1 || true

    started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    for swipe_index in $(seq 1 "$swipe_count"); do
        if (( swipe_index % 2 == 1 )); then
            y1="$swipe_start_y"
            y2="$swipe_end_y"
        else
            y1="$swipe_end_y"
            y2="$swipe_start_y"
        fi
        "$ADB_BIN" -s "$DEVICE_ID" shell input swipe "$center_x" "$y1" "$center_x" "$y2" "$SWIPE_MS"
    done
    ended_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    active_seconds=$(((swipe_count * SWIPE_MS + 999) / 1000))
    printf 'page=%s run=%s started=%s ended=%s requested_duration_ms=%s swipe_count=%s swipe_duration_ms=%s driver=adb-input-swipe warmup_before_reset=true\n' \
        "$PAGE" "$run_number" "$started_at" "$ended_at" "$DURATION_MS" "$swipe_count" "$SWIPE_MS" > "$run_dir/run.txt"
    printf '%s,%s,%s\n' "$PAGE" "$run_number" "$active_seconds" >> "$OUT_DIR/manifest.csv"

    "$ADB_BIN" -s "$DEVICE_ID" shell dumpsys gfxinfo "$APP_ID" > "$run_dir/gfxinfo.txt" 2>&1
    "$ADB_BIN" -s "$DEVICE_ID" shell dumpsys gfxinfo "$APP_ID" framestats > "$run_dir/framestats.txt" 2>&1
    "$ADB_BIN" -s "$DEVICE_ID" logcat -d -s ReactNativeJS:I LiquidGlassPerf:I > "$run_dir/logcat.txt" 2>&1
    "$ADB_BIN" -s "$DEVICE_ID" shell dumpsys SurfaceFlinger --latency > "$run_dir/surfaceflinger-latency.txt" 2>&1 || true
    echo "saved $PAGE run $run_number"
done

python3 "$ROOT_DIR/scripts/performance/analyze-android-glass.py" "$OUT_DIR"
printf '\nPage benchmark artifacts: %s\n' "$OUT_DIR"

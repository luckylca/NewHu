#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
PAGE="${1:?usage: run-page-frame-timeline.sh PAGE OUTPUT_DIRECTORY}"
OUT_DIR="${2:?usage: run-page-frame-timeline.sh PAGE OUTPUT_DIRECTORY}"
ADB_BIN="${ADB:-$HOME/Library/Android/sdk/platform-tools/adb}"
DEVICE_ID="${DEVICE_ID:-9ea3b4d2}"
APP_ID="${APP_ID:-com.anonymous.NewHu}"
BENCHMARK_QUERY="${BENCHMARK_QUERY:-}"
SWIPE_MS="${SWIPE_MS:-10000}"
INTERACTION_MODE="${INTERACTION_MODE:-scroll}"
TRACE_DURATION_MS="${TRACE_DURATION_MS:-}"
TRACE_NAME="newhu-release-${PAGE}-$(basename "$OUT_DIR").pftrace"

if [[ "$PAGE" == "animationSettings" && "$INTERACTION_MODE" == "animation-toggle" ]]; then
  TRACE_DURATION_MS="${TRACE_DURATION_MS:-10000}"
else
  TRACE_DURATION_MS="${TRACE_DURATION_MS:-24000}"
fi

if [[ "$INTERACTION_MODE" == "idle" ]]; then
  ACTION_DESCRIPTION="no synthetic input; stationary screen for the full trace"
elif [[ "$INTERACTION_MODE" == "inertia" ]]; then
  ACTION_DESCRIPTION="three 220ms alternating ADB flings with 3s post-touch settling windows; synthetic input, offset cadence analyzed separately"
elif [[ "$INTERACTION_MODE" == "animation-toggle" ]]; then
  ACTION_DESCRIPTION="12 ADB taps; six Reduce UI Animations on/off cycles at (800,565); setting restored to initial value"
else
  ACTION_DESCRIPTION="10s continuous vertical ADB swipe plus four 180ms reverse swipes; synthetic input"
fi

case "$PAGE" in
  home) ROUTE="home"; SOURCE_FILE="$ROOT_DIR/app/home.tsx" ;;
  settings) ROUTE="settings"; SOURCE_FILE="$ROOT_DIR/app/settings.tsx" ;;
  animationSettings) ROUTE="animationSettings"; SOURCE_FILE="$ROOT_DIR/app/animationSettings.tsx" ;;
  about) ROUTE="about"; SOURCE_FILE="$ROOT_DIR/app/about.tsx" ;;
  storage-management) ROUTE="storage-management"; SOURCE_FILE="$ROOT_DIR/app/storage-management.tsx" ;;
  legal) ROUTE="legal"; SOURCE_FILE="$ROOT_DIR/app/legal.tsx" ;;
  privacy-personalization) ROUTE="privacy-personalization"; SOURCE_FILE="$ROOT_DIR/app/privacy-personalization.tsx" ;;
  devmode) ROUTE="devmode"; SOURCE_FILE="$ROOT_DIR/app/devmode.tsx" ;;
  ai-analysis-settings) ROUTE="ai-analysis-settings"; SOURCE_FILE="$ROOT_DIR/app/ai-analysis-settings.tsx" ;;
  themeSet) ROUTE="themeSet"; SOURCE_FILE="$ROOT_DIR/app/themeSet.tsx" ;;
  userinfo) ROUTE="userinfo"; SOURCE_FILE="$ROOT_DIR/app/userinfo.tsx" ;;
  product-v1) ROUTE="product-v1"; SOURCE_FILE="$ROOT_DIR/app/product-v1.tsx" ;;
  question) ROUTE="question"; SOURCE_FILE="$ROOT_DIR/app/question.tsx" ;;
  people) ROUTE="people"; SOURCE_FILE="$ROOT_DIR/app/people.tsx" ;;
  *)
    echo "Unsupported page: $PAGE" >&2
    exit 2
    ;;
esac

if [[ ("$PAGE" == "question" || "$PAGE" == "people") && -z "$BENCHMARK_QUERY" ]]; then
  echo "Set BENCHMARK_QUERY to a real route ID or user token." >&2
  exit 2
fi

mkdir -p "$OUT_DIR"
uri="newhu://$ROUTE"
if [[ -n "$BENCHMARK_QUERY" ]]; then uri+="?$BENCHMARK_QUERY"; fi
escaped_uri="${uri//&/\\&}"

printf 'head=%s\nsource=working-tree-built-as-Release\ndevice=%s\napp=%s\npage=%s\nroute=%s\nquery=%s\nmode=Release\nrefresh_target=120Hz\ntrace_duration_ms=%s\ninteraction_mode=%s\naction_description=%s\n' \
  "$(git -C "$ROOT_DIR" rev-parse HEAD)" "$DEVICE_ID" "$APP_ID" "$PAGE" "$uri" "$BENCHMARK_QUERY" "$TRACE_DURATION_MS" "$INTERACTION_MODE" "$ACTION_DESCRIPTION" > "$OUT_DIR/environment.txt"
RELEASE_APK_PATH="${RELEASE_APK_PATH:-$ROOT_DIR/android/app/build/outputs/apk/release/app-release.apk}"
if [[ -f "$RELEASE_APK_PATH" ]]; then
  printf 'release_apk=%s\nrelease_apk_sha256=%s\n' "$RELEASE_APK_PATH" "$(shasum -a 256 "$RELEASE_APK_PATH" | awk '{print $1}')" >> "$OUT_DIR/environment.txt"
fi
git -C "$ROOT_DIR" status --porcelain=v2 --branch > "$OUT_DIR/source-worktree-status.txt"
shasum -a 256 "$SOURCE_FILE" \
  "$ROOT_DIR/project/react-native-hyper-ui/src/components/PageScaffold.tsx" \
  "$ROOT_DIR/app/item/[type]/[id]/_layout.tsx" \
  "$ROOT_DIR/project/react-native-liquid-glass/src/GlassSurface.tsx" \
  "$ROOT_DIR/scripts/performance/run-page-frame-timeline.sh" \
  "$ROOT_DIR/scripts/performance/analyze-comments-trace.py" \
  > "$OUT_DIR/source-hashes.txt"

"$ADB_BIN" -s "$DEVICE_ID" get-state > "$OUT_DIR/adb-state.txt"
"$ADB_BIN" -s "$DEVICE_ID" shell dumpsys display > "$OUT_DIR/display-before.txt"
"$ADB_BIN" -s "$DEVICE_ID" shell dumpsys thermalservice > "$OUT_DIR/thermal-before.txt"
"$ADB_BIN" -s "$DEVICE_ID" shell dumpsys battery > "$OUT_DIR/battery-before.txt"
"$ADB_BIN" -s "$DEVICE_ID" shell am force-stop "$APP_ID"
"$ADB_BIN" -s "$DEVICE_ID" shell am start -W -a android.intent.action.VIEW -d "$escaped_uri" "$APP_ID" > "$OUT_DIR/launch.txt" 2>&1
sleep 8
"$ADB_BIN" -s "$DEVICE_ID" shell screencap -p /sdcard/newhu-page-frame-ready.png
"$ADB_BIN" -s "$DEVICE_ID" pull /sdcard/newhu-page-frame-ready.png "$OUT_DIR/ready.png" > "$OUT_DIR/ready-pull.txt" 2>&1
"$ADB_BIN" -s "$DEVICE_ID" shell dumpsys gfxinfo "$APP_ID" reset > "$OUT_DIR/gfxinfo-reset.txt" 2>&1
"$ADB_BIN" -s "$DEVICE_ID" shell dumpsys SurfaceFlinger --latency-clear > "$OUT_DIR/surfaceflinger-clear.txt" 2>&1 || true

TRACE_CONFIG_PATH="${TRACE_CONFIG_PATH:-$ROOT_DIR/scripts/performance/configs/android-route-frametimeline.pbtxt}"
python3 - "$TRACE_CONFIG_PATH" "$OUT_DIR/trace-config.pbtxt" "$TRACE_DURATION_MS" <<'PY'
import pathlib
import re
import sys

source = pathlib.Path(sys.argv[1]).read_text()
source = re.sub(r"duration_ms:\s*\d+", f"duration_ms: {sys.argv[3]}", source, count=1)
pathlib.Path(sys.argv[2]).write_text(source)
PY

"$ADB_BIN" -s "$DEVICE_ID" shell perfetto --txt --background-wait -c - \
  -o "/data/misc/perfetto-traces/$TRACE_NAME" \
  < "$OUT_DIR/trace-config.pbtxt" > "$OUT_DIR/perfetto-start.txt" 2>&1

if [[ "$INTERACTION_MODE" == "idle" ]]; then
  printf 'index,action,driver\n' > "$OUT_DIR/gestures.csv"
  printf 'index,action,driver\n' > "$OUT_DIR/action-timeline.csv"
  sleep "$(( (TRACE_DURATION_MS + 999) / 1000 + 1 ))"
elif [[ "$INTERACTION_MODE" == "inertia" ]]; then
  POST_TOUCH_WAIT_MS="${POST_TOUCH_WAIT_MS:-3000}"
  printf 'index,gesture,driver,duration_ms,uptime_before,uptime_after,post_touch_wait_ms\n' > "$OUT_DIR/gestures.csv"
  printf 'index,action,driver,uptime_before,uptime_after,post_touch_wait_ms\n' > "$OUT_DIR/action-timeline.csv"
  for index in 1 2 3; do
    if (( index % 2 == 1 )); then y1=2700; y2=650; else y1=650; y2=2700; fi
    uptime_before=$("$ADB_BIN" -s "$DEVICE_ID" shell cat /proc/uptime | awk '{print $1}')
    "$ADB_BIN" -s "$DEVICE_ID" shell input swipe 720 "$y1" 720 "$y2" 220
    uptime_after=$("$ADB_BIN" -s "$DEVICE_ID" shell cat /proc/uptime | awk '{print $1}')
    printf '%s,fast-fling,adb-input-swipe,220,%s,%s,%s\n' "$index" "$uptime_before" "$uptime_after" "$POST_TOUCH_WAIT_MS" >> "$OUT_DIR/gestures.csv"
    printf '%s,fast-fling,adb-input-swipe,%s,%s,%s\n' "$index" "$uptime_before" "$uptime_after" "$POST_TOUCH_WAIT_MS" >> "$OUT_DIR/action-timeline.csv"
    sleep "$(awk -v ms="$POST_TOUCH_WAIT_MS" 'BEGIN { printf "%.3f", ms / 1000 }')"
  done
  remaining_seconds=$(( (TRACE_DURATION_MS + 999) / 1000 - 10 ))
  if (( remaining_seconds > 0 )); then sleep "$remaining_seconds"; fi
elif [[ "$INTERACTION_MODE" == "animation-toggle" ]]; then
  if [[ "$PAGE" != "animationSettings" ]]; then
    echo "animation-toggle interaction is only valid for animationSettings" >&2
    exit 2
  fi
  printf 'index,device_uptime_seconds,action,driver,x,y\n' > "$OUT_DIR/gestures.csv"
  printf 'index,device_uptime_seconds,action,driver,x,y\n' > "$OUT_DIR/action-timeline.csv"
  for cycle in 1 2 3 4 5 6; do
    for state in reduce-on reduce-off; do
      if [[ "$state" == "reduce-on" ]]; then
        index=$(( (cycle - 1) * 2 + 1 ))
      else
        index=$(( cycle * 2 ))
      fi
      uptime=$("$ADB_BIN" -s "$DEVICE_ID" shell cat /proc/uptime | awk '{print $1}')
      printf '%s,%s,%s,adb-input-tap,800,565\n' "$index" "$uptime" "$state" >> "$OUT_DIR/gestures.csv"
      printf '%s,%s,%s,adb-input-tap,800,565\n' "$index" "$uptime" "$state" >> "$OUT_DIR/action-timeline.csv"
      "$ADB_BIN" -s "$DEVICE_ID" shell input tap 800 565
      sleep 0.28
    done
  done
  sleep 4
else
  printf 'index,duration_ms,gesture,driver\n' > "$OUT_DIR/gestures.csv"
  printf '1,%s,continuous-swipe,adb-input-swipe\n' "$SWIPE_MS" >> "$OUT_DIR/gestures.csv"
  "$ADB_BIN" -s "$DEVICE_ID" shell input swipe 720 2600 720 550 "$SWIPE_MS"
  for index in 1 2 3 4; do
    if (( index % 2 == 1 )); then y1=2600; y2=550; else y1=550; y2=2600; fi
    printf '%s,180,fast-swipe,adb-input-swipe\n' "$((index + 1))" >> "$OUT_DIR/gestures.csv"
    "$ADB_BIN" -s "$DEVICE_ID" shell input swipe 720 "$y1" 720 "$y2" 180
    sleep 0.25
  done
  sleep 11
fi

"$ADB_BIN" -s "$DEVICE_ID" shell screencap -p /sdcard/newhu-page-frame-after.png
"$ADB_BIN" -s "$DEVICE_ID" pull /sdcard/newhu-page-frame-after.png "$OUT_DIR/after.png" > "$OUT_DIR/after-pull.txt" 2>&1
"$ADB_BIN" -s "$DEVICE_ID" shell dumpsys gfxinfo "$APP_ID" > "$OUT_DIR/gfxinfo.txt" 2>&1
"$ADB_BIN" -s "$DEVICE_ID" shell dumpsys gfxinfo "$APP_ID" framestats > "$OUT_DIR/framestats.txt" 2>&1
"$ADB_BIN" -s "$DEVICE_ID" shell dumpsys SurfaceFlinger --latency > "$OUT_DIR/surfaceflinger-latency.txt" 2>&1 || true
"$ADB_BIN" -s "$DEVICE_ID" shell dumpsys display > "$OUT_DIR/display-after.txt"
"$ADB_BIN" -s "$DEVICE_ID" shell dumpsys thermalservice > "$OUT_DIR/thermal-after.txt"
"$ADB_BIN" -s "$DEVICE_ID" shell dumpsys battery > "$OUT_DIR/battery-after.txt"
"$ADB_BIN" -s "$DEVICE_ID" shell dumpsys meminfo "$APP_ID" > "$OUT_DIR/meminfo-after.txt"
"$ADB_BIN" -s "$DEVICE_ID" logcat -d -v time -s ReactNativeJS:I AndroidRuntime:E LiquidGlassPerf:I > "$OUT_DIR/logcat.txt"
"$ADB_BIN" -s "$DEVICE_ID" pull "/data/misc/perfetto-traces/$TRACE_NAME" "$OUT_DIR/frame-timeline.pftrace" > "$OUT_DIR/perfetto-pull.txt" 2>&1
python3 "$ROOT_DIR/scripts/performance/analyze-comments-trace.py" "$OUT_DIR" > "$OUT_DIR/analyzer-console.txt"

printf 'Release FrameTimeline artifacts: %s\n' "$OUT_DIR"

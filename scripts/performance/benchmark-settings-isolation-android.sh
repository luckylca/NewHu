#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ADB_BIN="${ADB:-$HOME/Library/Android/sdk/platform-tools/adb}"
APP_ID="${APP_ID:-com.anonymous.NewHu}"
DEVICE_ID="${DEVICE_ID:-a4976c80}"
RUNS="${RUNS:-5}"
CASES="${CASES:-A B C D E F}"
OUT_DIR="${OUT_DIR:-$ROOT_DIR/docs/performance/runs/$(date +%Y%m%d)-settings-isolation-release}"
READY_TIMEOUT_SECONDS="${READY_TIMEOUT_SECONDS:-35}"
DURATION_MS="${DURATION_MS:-12000}"
PERFETTO="${PERFETTO:-0}"
TRACE_CASE="${TRACE_CASE:-A}"
TRACE_RUN="${TRACE_RUN:-1}"
DURATION_SECONDS=$((DURATION_MS / 1000))

mkdir -p "$OUT_DIR"
"$ADB_BIN" -s "$DEVICE_ID" get-state >/dev/null
"$ADB_BIN" -s "$DEVICE_ID" shell wm size > "$OUT_DIR/device-size.txt"
"$ADB_BIN" -s "$DEVICE_ID" shell wm density > "$OUT_DIR/device-density.txt"
"$ADB_BIN" -s "$DEVICE_ID" shell settings get system peak_refresh_rate > "$OUT_DIR/peak-refresh-rate.txt"
"$ADB_BIN" -s "$DEVICE_ID" shell dumpsys display > "$OUT_DIR/dumpsys-display.txt"
"$ADB_BIN" -s "$DEVICE_ID" shell dumpsys package "$APP_ID" > "$OUT_DIR/package-info.txt"
printf 'device=%s\nmode=Release\nrefresh_target=120Hz\nroute=newhu://settings\nscroll_driver=ScrollView/FlatList scrollTo animated=true\nscroll_distance_dp=640\nscroll_duration_ms=%s\nmanual_touch=not tested; no ADB input injection\nruns_per_case=%s\nperfetto=%s\n' "$DEVICE_ID" "$DURATION_MS" "$RUNS" "$PERFETTO" > "$OUT_DIR/environment.txt"
printf 'scene,run,active_seconds\n' > "$OUT_DIR/manifest.csv"

for case_name in $CASES; do
    for run_number in $(seq 1 "$RUNS"); do
        run_dir="$OUT_DIR/scene-$case_name/run-$run_number"
        mkdir -p "$run_dir"
        uri="newhu://settings?settingsBenchCase=$case_name&settingsBenchRun=$run_number&settingsBenchDurationMs=$DURATION_MS"
        escaped_uri="${uri//&/\\&}"
        "$ADB_BIN" -s "$DEVICE_ID" shell am force-stop "$APP_ID"
        "$ADB_BIN" -s "$DEVICE_ID" logcat -c
        "$ADB_BIN" -s "$DEVICE_ID" shell am start -W -a android.intent.action.VIEW -d "$escaped_uri" "$APP_ID" > "$run_dir/launch.txt" 2>&1

        deadline=$((SECONDS + READY_TIMEOUT_SECONDS))
        while ! "$ADB_BIN" -s "$DEVICE_ID" logcat -d -s ReactNativeJS:I | rg -q "\[SETTINGS_ISOLATION_READY\] case=$case_name run=$run_number"; do
            if (( SECONDS >= deadline )); then
                "$ADB_BIN" -s "$DEVICE_ID" logcat -d -s ReactNativeJS:I > "$run_dir/ready-timeout-logcat.txt"
                echo "Settings benchmark failed to become ready: case=$case_name run=$run_number" >&2
                exit 1
            fi
            sleep 0.2
        done
        "$ADB_BIN" -s "$DEVICE_ID" logcat -d -s ReactNativeJS:I | rg "\[SETTINGS_ISOLATION_READY\] case=$case_name run=$run_number" > "$run_dir/ready.txt"
        if [[ "$run_number" == "1" ]]; then
            "$ADB_BIN" -s "$DEVICE_ID" shell screencap -p /sdcard/newhu-settings-isolation.png
            "$ADB_BIN" -s "$DEVICE_ID" pull /sdcard/newhu-settings-isolation.png "$run_dir/ready.png" >/dev/null
        fi
        "$ADB_BIN" -s "$DEVICE_ID" shell dumpsys gfxinfo "$APP_ID" reset > "$run_dir/gfxinfo-reset.txt" 2>&1
        "$ADB_BIN" -s "$DEVICE_ID" shell dumpsys SurfaceFlinger --latency-clear > /dev/null 2>&1 || true
        "$ADB_BIN" -s "$DEVICE_ID" logcat -c
        trace_pid=""
        remote_trace="/data/misc/perfetto-traces/newhu-settings-scroll-${case_name}-${run_number}-$$.perfetto-trace"
        if [[ "$PERFETTO" == "1" && "$case_name" == "$TRACE_CASE" && "$run_number" == "$TRACE_RUN" ]]; then
            trace_seconds=$((DURATION_SECONDS + 5))
            printf 'perfetto --time %ss --buffer 64mb --app %s gfx view sched freq idle input wm am binder_driver -o %s\n' "$trace_seconds" "$APP_ID" "$remote_trace" > "$run_dir/perfetto-command.txt"
            "$ADB_BIN" -s "$DEVICE_ID" shell perfetto --time "${trace_seconds}s" --buffer 64mb --app "$APP_ID" gfx view sched freq idle input wm am binder_driver -o "$remote_trace" > "$run_dir/perfetto-console.txt" 2>&1 &
            trace_pid=$!
        fi

        start_deadline=$((SECONDS + 8))
        while ! "$ADB_BIN" -s "$DEVICE_ID" logcat -d -s ReactNativeJS:I | rg -q "\[SETTINGS_ISOLATION_START\] case=$case_name run=$run_number"; do
            if (( SECONDS >= start_deadline )); then
                echo "Settings benchmark did not start: case=$case_name run=$run_number" >&2
                exit 1
            fi
            sleep 0.1
        done
        started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
        done_deadline=$((SECONDS + DURATION_SECONDS + 15))
        while ! "$ADB_BIN" -s "$DEVICE_ID" logcat -d -s ReactNativeJS:I | rg -q "\[SETTINGS_ISOLATION_DONE\] case=$case_name run=$run_number"; do
            if (( SECONDS >= done_deadline )); then
                echo "Settings benchmark did not finish: case=$case_name run=$run_number" >&2
                exit 1
            fi
            sleep 0.2
        done
        ended_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
        printf 'case=%s run=%s started=%s ended=%s duration_ms=%s driver=animated-scrollTo reset-before-start=true\n' "$case_name" "$run_number" "$started_at" "$ended_at" "$DURATION_MS" > "$run_dir/run.txt"
        printf '%s,%s,%s\n' "$case_name" "$run_number" "$DURATION_SECONDS" >> "$OUT_DIR/manifest.csv"

        if [[ -n "$trace_pid" ]]; then
            wait "$trace_pid"
            "$ADB_BIN" -s "$DEVICE_ID" pull "$remote_trace" "$run_dir/settings-scroll.perfetto-trace" > "$run_dir/perfetto-pull.txt" 2>&1
        fi

        "$ADB_BIN" -s "$DEVICE_ID" shell dumpsys gfxinfo "$APP_ID" > "$run_dir/gfxinfo.txt" 2>&1
        "$ADB_BIN" -s "$DEVICE_ID" shell dumpsys gfxinfo "$APP_ID" framestats > "$run_dir/framestats.txt" 2>&1
        "$ADB_BIN" -s "$DEVICE_ID" logcat -d -s ReactNativeJS:I LiquidGlassPerf:I > "$run_dir/logcat.txt" 2>&1
        "$ADB_BIN" -s "$DEVICE_ID" shell dumpsys SurfaceFlinger --latency > "$run_dir/surfaceflinger-latency.txt" 2>&1 || true
        echo "saved Settings case=$case_name run=$run_number"
    done
done

python3 "$ROOT_DIR/scripts/performance/analyze-android-glass.py" "$OUT_DIR"
echo "Settings isolation artifacts: $OUT_DIR"

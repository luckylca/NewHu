#!/bin/sh
set -eu

sample_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repo_root=$(CDPATH= cd -- "$sample_dir/../../../.." && pwd)
variant=${1:-release}
backdrop=${2:-live}
local_enabled=${3:-true}
telemetry_enabled=${4:-true}
runs=${5:-5}
count=${6:-80}
run_root=${7:-"$repo_root/docs/performance/runs/20261005-native-benchmark-clean/${variant}-${backdrop}-local${local_enabled}-telemetry${telemetry_enabled}"}
scroll_cache=${8:-false}
scroll_driver=${9:-target}
optics_model=${10:-heightField}
adb=${ADB:-"$HOME/Library/Android/sdk/platform-tools/adb"}
serial=${ADB_SERIAL:-a4976c80}
wait_seconds=${BENCHMARK_TOTAL_WAIT_SECONDS:-17}
screenshot_after_seconds=${BENCHMARK_SCREENSHOT_AFTER_SECONDS:-0}

case "$variant" in
    debug) gradle_task=assembleDebug ;;
    release) gradle_task=assembleRelease ;;
    *) printf 'variant must be debug or release\n' >&2; exit 2 ;;
esac
case "$backdrop" in
    off|frozen|live) ;;
    *) printf 'backdrop must be off, frozen, or live\n' >&2; exit 2 ;;
esac
case "$local_enabled:$telemetry_enabled" in
    true:true|true:false|false:true|false:false) ;;
    *) printf 'local and telemetry must be true or false\n' >&2; exit 2 ;;
esac
case "$scroll_cache" in
    true|false) ;;
    *) printf 'scrollCache must be true or false\n' >&2; exit 2 ;;
esac
case "$scroll_driver" in
    target|query) ;;
    *) printf 'scrollDriver must be target or query\n' >&2; exit 2 ;;
esac
case "$optics_model" in
    heightField|sdfScaleLens) ;;
    *) printf 'opticsModel must be heightField or sdfScaleLens\n' >&2; exit 2 ;;
esac
case "$count" in
    5|20|80) ;;
    *) printf 'count must be 5, 20, or 80\n' >&2; exit 2 ;;
esac

if [ "$backdrop" = "off" ]; then
    local_enabled=${local_enabled:-false}
fi

cd "$sample_dir"
./gradlew ":app:$gradle_task"
apk="app/build/outputs/apk/$variant/app-$variant.apk"
"$adb" -s "$serial" install -r "$apk"
mkdir -p "$run_root"
"$adb" -s "$serial" shell dumpsys display > "$run_root/display.txt"
{
    printf 'device=%s\n' "$serial"
    printf 'variant=%s\n' "$variant"
    printf 'count=%s\n' "$count"
    printf 'backdrop=%s\n' "$backdrop"
    printf 'local=%s\n' "$local_enabled"
    printf 'telemetry=%s\n' "$telemetry_enabled"
    printf 'scroll_cache=%s\n' "$scroll_cache"
    printf 'scroll_driver=%s\n' "$scroll_driver"
    printf 'optics_model=%s\n' "$optics_model"
    printf 'apk_sha256=%s\n' "$(shasum -a 256 "$apk" | cut -d ' ' -f 1)"
    printf 'started_at=%s\n' "$(date '+%Y-%m-%d %H:%M:%S %z')"
    printf 'auto_scroll_ms=12000\n'
    printf 'wait_seconds=%s\n' "$wait_seconds"
} > "$run_root/manifest.txt"

run=1
while [ "$run" -le "$runs" ]; do
    output="$run_root/run-$run"
    mkdir -p "$output"
    "$adb" -s "$serial" shell am force-stop com.newhu.liquidglass.nativebenchmark
    "$adb" -s "$serial" shell dumpsys thermalservice > "$output/thermal-before.txt"
    "$adb" -s "$serial" shell dumpsys gfxinfo com.newhu.liquidglass.nativebenchmark reset > "$output/gfxinfo-reset.txt"
    "$adb" -s "$serial" logcat -c
    "$adb" -s "$serial" shell am start \
        -n com.newhu.liquidglass.nativebenchmark/.MainActivity \
        --ei count "$count" \
        --es backdrop "$backdrop" \
        --ez local "$local_enabled" \
        --ez telemetry "$telemetry_enabled" \
        --ez scrollCache "$scroll_cache" \
        --es opticsModel "$optics_model" \
        --ez naiveScrollDriver "$( [ "$scroll_driver" = query ] && printf true || printf false )" > "$output/launch.txt"
    if [ "$screenshot_after_seconds" -gt 0 ] && [ "$screenshot_after_seconds" -lt "$wait_seconds" ]; then
        sleep "$screenshot_after_seconds"
        remote_screenshot="/sdcard/liquidglass-native-benchmark-$run.png"
        "$adb" -s "$serial" shell screencap -p "$remote_screenshot"
        "$adb" -s "$serial" pull "$remote_screenshot" "$output/mid-scroll.png" > /dev/null
        "$adb" -s "$serial" shell rm -f "$remote_screenshot"
        sleep $((wait_seconds - screenshot_after_seconds))
    else
        sleep "$wait_seconds"
    fi
    "$adb" -s "$serial" logcat -d -s LiquidGlassNative:I LiquidGlassPerf:I > "$output/logcat.txt"
    "$adb" -s "$serial" shell dumpsys gfxinfo com.newhu.liquidglass.nativebenchmark > "$output/gfxinfo.txt"
    "$adb" -s "$serial" shell dumpsys gfxinfo com.newhu.liquidglass.nativebenchmark framestats > "$output/framestats.txt"
    "$adb" -s "$serial" shell dumpsys thermalservice > "$output/thermal-after.txt"
    if ! rg -q '\[GLASS_NATIVE_FINISH\]' "$output/logcat.txt"; then
        printf 'benchmark did not finish: %s\n' "$output" >&2
        exit 1
    fi
    printf 'saved %s\n' "$output"
    run=$((run + 1))
done

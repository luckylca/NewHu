#!/usr/bin/env python3
"""Correlate synthetic swipe input with native offset and present updates after ACTION_UP."""
import csv
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path


ACTIVITY_PREFIX = "TX - com.anonymous.NewHu/com.anonymous.NewHu.MainActivity"


def read_csv(path):
    with path.open(newline="") as stream:
        return list(csv.DictReader(stream))


def percentile(values, q):
    if not values:
        return None
    ordered = sorted(values)
    return ordered[max(0, min(len(ordered) - 1, round((len(ordered) - 1) * q)))]


def stats(values):
    return {
        "count": len(values),
        "p50_ms": percentile(values, 0.50),
        "p90_ms": percentile(values, 0.90),
        "p95_ms": percentile(values, 0.95),
        "p99_ms": percentile(values, 0.99),
        "max_ms": max(values) if values else None,
        "over_8_33ms": sum(value > 8.333 for value in values),
        "over_16_67ms": sum(value > 16.667 for value in values),
        "over_50ms": sum(value > 50 for value in values),
    }


def intervals(rows):
    timestamps = sorted({int(row["ts"]) for row in rows if row.get("ts", "").isdigit()})
    return [(right - left) / 1e6 for left, right in zip(timestamps, timestamps[1:]) if right > left]


def in_window(rows, start_ns, end_ns):
    return [row for row in rows if row.get("ts", "").isdigit()
            and start_ns <= int(row["ts"]) < end_ns]


def main():
    if len(sys.argv) != 2:
        raise SystemExit("usage: analyze-posttouch-windows.py RUN_DIR")
    run_dir = Path(sys.argv[1]).resolve()
    gestures = read_csv(run_dir / "gestures.csv")
    fabrics = read_csv(run_dir / "fabric-main-slices.csv")
    inputs = read_csv(run_dir / "input-dispatch-slices.csv")
    frames = read_csv(run_dir / "actual-frame-timeline.csv")

    windows = []
    for index, gesture in enumerate(gestures):
        if not gesture.get("uptime_after"):
            continue
        release_ns = round(float(gesture["uptime_after"]) * 1e9)
        next_start_ns = (round(float(gestures[index + 1]["uptime_before"]) * 1e9)
                         if index + 1 < len(gestures) else None)
        requested_end_ns = release_ns + round(float(gesture.get("post_touch_wait_ms", 0) or 0) * 1e6)
        end_ns = min(requested_end_ns, next_start_ns) if next_start_ns else requested_end_ns
        offset_rows = in_window(
            [row for row in fabrics if row.get("name") == "ReactScrollView.onScrollChanged"],
            release_ns,
            end_ns,
        )
        app_frames = in_window(
            [row for row in frames if (row.get("layer_name") or "").startswith(ACTIVITY_PREFIX)],
            release_ns,
            end_ns,
        )
        extra_frames = defaultdict(list)
        for row in in_window(frames, release_ns, end_ns):
            layer = row.get("layer_name") or "[unnamed layer]"
            if not layer.startswith(ACTIVITY_PREFIX):
                extra_frames[layer].append(row)
        moves = [row for row in inputs
                 if "ACTION_MOVE" in row.get("name", "")
                 and row.get("ts", "").isdigit()
                 and round(float(gesture["uptime_before"]) * 1e9) <= int(row["ts"]) <= release_ns]
        app_frame_intervals = intervals(app_frames)
        offset_intervals = intervals(offset_rows)
        windows.append({
            "index": int(gesture["index"]),
            "input": {
                "driver": gesture.get("driver"),
                "gesture_duration_ms": int(gesture.get("duration_ms", 0) or 0),
                "move_dispatches": len(moves),
                "move_dispatch_interval_ms": stats(intervals(moves)),
            },
            "post_touch_window_ms": round((end_ns - release_ns) / 1e6, 3),
            "native_scroll_offset_callbacks": len(offset_rows),
            "native_scroll_offset_interval_ms": stats(offset_intervals),
            "activity_layer_frames": len(app_frames),
            "activity_layer_frame_interval_ms": stats(app_frame_intervals),
            "activity_layer_deadline_misses": sum(
                "App Deadline Missed" in (row.get("jank_type") or "") for row in app_frames
            ),
            "other_surface_layers": {
                layer: {
                    "frames": len(rows),
                    "frame_interval_ms": stats(intervals(rows)),
                    "deadline_misses": sum(
                        "App Deadline Missed" in (row.get("jank_type") or "") for row in rows
                    ),
                }
                for layer, rows in extra_frames.items()
            },
        })

    aggregate_offsets = [
        value
        for window in windows
        for value in _interval_values(
            [row for row in fabrics if row.get("name") == "ReactScrollView.onScrollChanged"],
            round(float(next(g for g in gestures if int(g["index"]) == window["index"])["uptime_after"]) * 1e9),
            round(float(next(g for g in gestures if int(g["index"]) == window["index"])["uptime_after"]) * 1e9)
            + round(window["post_touch_window_ms"] * 1e6),
        )
    ]
    result = {
        "method": "ACTION_MOVE dispatch is measured only through adb input swipe completion; native offset callbacks and FrameTimeline activity presents are measured in the subsequent post-touch settling window.",
        "synthetic_input": True,
        "activity_layer_prefix": ACTIVITY_PREFIX,
        "post_touch_offset_interval_ms_all_windows": stats(aggregate_offsets),
        "windows": windows,
    }
    (run_dir / "post-touch-summary.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))


def _interval_values(rows, start_ns, end_ns):
    return intervals(in_window(rows, start_ns, end_ns))


if __name__ == "__main__":
    main()

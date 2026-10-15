#!/usr/bin/env python3
"""Extract Android FrameTimeline and React Native Fabric slices from one Comments trace."""
import csv
import json
import os
import re
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path


def percentile(values, q):
    values = sorted(values)
    if not values:
        return None
    return values[max(0, min(len(values) - 1, round((len(values) - 1) * q)))]


def stats(values):
    return {
        "count": len(values),
        "p50_ms": percentile(values, .50),
        "p90_ms": percentile(values, .90),
        "p95_ms": percentile(values, .95),
        "p99_ms": percentile(values, .99),
        "max_ms": max(values) if values else None,
    }


def run_query(tp, trace, run_dir, name, sql):
    sql_path = run_dir / f"{name}.sql"
    csv_path = run_dir / f"{name}.csv"
    log_path = run_dir / f"trace-processor-{name}.txt"
    sql_path.write_text(sql.strip() + "\n")
    proc = subprocess.run([tp, "query", "-f", str(sql_path), str(trace)], capture_output=True, text=True)
    log_path.write_text(proc.stderr)
    if proc.returncode:
        raise RuntimeError(f"Trace Processor failed for {name}: {proc.stderr[-2000:]}")
    csv_path.write_text(proc.stdout)
    with csv_path.open(newline="") as f:
        return list(csv.DictReader(f))


def main():
    if len(sys.argv) < 2:
        raise SystemExit("usage: analyze-comments-trace.py RUN_DIR [TRACE_PROCESSOR]")
    run_dir = Path(sys.argv[1]).resolve()
    trace = run_dir / "frame-timeline.pftrace"
    tp = sys.argv[2] if len(sys.argv) > 2 else os.environ.get("TRACE_PROCESSOR")
    if not tp:
        candidates = list((Path.home() / ".local/share/perfetto/prebuilts").glob("trace_processor_shell-*"))
        tp = str(candidates[0]) if candidates else "trace_processor_shell"
    if not trace.is_file() or trace.stat().st_size == 0:
        raise SystemExit(f"missing non-empty trace: {trace}")

    actual = run_query(tp, trace, run_dir, "actual-frame-timeline", """
        SELECT ts,dur,surface_frame_token,display_frame_token,present_type,on_time_finish,
               jank_type,jank_severity_type,jank_tag,jank_score,layer_name
        FROM actual_frame_timeline_slice
        WHERE layer_name LIKE '%com.anonymous.NewHu%'
        ORDER BY ts;
    """)
    expected = run_query(tp, trace, run_dir, "expected-frame-timeline", """
        SELECT ts,dur,surface_frame_token,display_frame_token,layer_name
        FROM expected_frame_timeline_slice
        WHERE layer_name LIKE '%com.anonymous.NewHu%'
        ORDER BY ts;
    """)
    fabric = run_query(tp, trace, run_dir, "fabric-main-slices", """
        SELECT t.tid,t.name AS thread,s.ts,s.dur,s.name
        FROM slice s JOIN thread_track tt ON s.track_id=tt.id JOIN thread t USING (utid)
        WHERE t.upid=(SELECT upid FROM thread WHERE name='anonymous.NewHu' LIMIT 1)
          AND (s.name LIKE '%mountViews%' OR s.name LIKE '%UPDATE_PROPS%'
            OR s.name LIKE '%UPDATE_LAYOUT%' OR s.name LIKE '%UPDATE_STATE%'
            OR s.name='ReactScrollView.onScrollChanged' OR s.name LIKE 'Choreographer#doFrame%')
        ORDER BY s.ts;
    """)
    input_dispatch = run_query(tp, trace, run_dir, "input-dispatch-slices", """
        SELECT t.tid,t.name AS thread,s.ts,s.dur,s.name
        FROM slice s JOIN thread_track tt ON s.track_id=tt.id JOIN thread t USING (utid)
        WHERE t.name='anonymous.NewHu'
          AND s.name LIKE 'dispatchInputEvent MotionEvent ACTION_%'
        ORDER BY s.ts;
    """)
    states = run_query(tp, trace, run_dir, "app-thread-states", """
        SELECT t.tid,t.name AS thread,s.state,COUNT(*) AS samples,
               SUM(s.dur)/1e6 AS duration_ms,MAX(s.dur)/1e6 AS max_state_ms
        FROM thread_state s JOIN thread t USING (utid)
        WHERE t.upid=(SELECT upid FROM thread WHERE name='anonymous.NewHu' LIMIT 1)
          AND t.name IN ('anonymous.NewHu','mqt_v_js','RenderThread')
        GROUP BY t.tid,t.name,s.state ORDER BY t.tid,duration_ms DESC;
    """)

    # A Skia Canvas or another native SurfaceView can add multiple app-owned
    # SurfaceFlinger layers. Keep their timelines separate: summing them
    # double-counts presents and deadline misses. The activity's BLAST layer is
    # the app content surface used for the page-level cadence below.
    activity_layer_prefix = "TX - com.anonymous.NewHu/com.anonymous.NewHu.MainActivity"
    activity_actual = [r for r in actual if (r.get("layer_name") or "").startswith(activity_layer_prefix)]
    activity_expected = [r for r in expected if (r.get("layer_name") or "").startswith(activity_layer_prefix)]

    def summarize_layer(rows):
        durations = [int(r["dur"]) / 1e6 for r in rows
                     if r.get("dur", "").isdigit() and int(r["dur"]) > 0]
        timestamps = sorted(int(r["ts"]) for r in rows if r.get("ts", "").isdigit())
        intervals = [(b - a) / 1e6 for a, b in zip(timestamps, timestamps[1:]) if b > a]
        return {
            "actual_frames": len(rows),
            "actual_duration_ms": stats(durations),
            "actual_present_interval_ms": stats(intervals),
            "actual_intervals_over_8_33ms": sum(v > 8.333 for v in intervals),
            "actual_intervals_over_16_67ms": sum(v > 16.667 for v in intervals),
            "deadline_missed_frames": sum("App Deadline Missed" in (r.get("jank_type") or "") for r in rows),
            "late_present_frames": sum(r.get("present_type") == "Late Present" for r in rows),
            "on_time_present_frames": sum(r.get("present_type") == "On-time Present" for r in rows),
        }

    actual_dur = [int(r["dur"]) / 1e6 for r in activity_actual
                  if r.get("dur", "").isdigit() and int(r["dur"]) > 0]
    actual_ts = sorted(int(r["ts"]) for r in activity_actual if r.get("ts", "").isdigit())
    expected_ts = sorted(int(r["ts"]) for r in activity_expected if r.get("ts", "").isdigit())
    present_intervals = [(b-a)/1e6 for a,b in zip(actual_ts, actual_ts[1:]) if b > a]
    expected_intervals = [(b-a)/1e6 for a,b in zip(expected_ts, expected_ts[1:]) if b > a]
    scroll_callback_ts = sorted(int(r["ts"]) for r in fabric
                                if r.get("name") == "ReactScrollView.onScrollChanged" and r.get("ts", "").isdigit())
    scroll_callback_intervals = [(b-a)/1e6 for a,b in zip(scroll_callback_ts, scroll_callback_ts[1:]) if b > a]
    input_move_ts = sorted(int(r["ts"]) for r in input_dispatch
                           if "ACTION_MOVE" in r.get("name", "") and r.get("ts", "").isdigit())
    input_move_intervals = [(b-a)/1e6 for a,b in zip(input_move_ts, input_move_ts[1:]) if b > a]
    jank = Counter(r.get("jank_type") for r in activity_actual)
    actual_by_layer = defaultdict(list)
    for row in actual:
        actual_by_layer[row.get("layer_name") or "[unnamed layer]"].append(row)
    expected_counts = Counter(row.get("layer_name") or "[unnamed layer]" for row in expected)
    other_surface_layers = {
        layer: {
            **summarize_layer(rows),
            "expected_frames": expected_counts.get(layer, 0),
        }
        for layer, rows in actual_by_layer.items()
        if not layer.startswith(activity_layer_prefix)
    }
    frame_summary = {
        "app_layer": activity_layer_prefix,
        "expected_frames": len(activity_expected),
        "actual_frames": len(activity_actual),
        "actual_duration_ms": stats(actual_dur),
        "actual_present_interval_ms": stats(present_intervals),
        "expected_interval_ms": stats(expected_intervals),
        "actual_intervals_over_8_33ms": sum(v > 8.333 for v in present_intervals),
        "actual_intervals_over_16_67ms": sum(v > 16.667 for v in present_intervals),
        "actual_durations_over_8_33ms": sum(v > 8.333 for v in actual_dur),
        "actual_durations_over_16_67ms": sum(v > 16.667 for v in actual_dur),
        "app_deadline_missed_frames": sum("App Deadline Missed" in (r.get("jank_type") or "") for r in activity_actual),
        "jank_type_counts": dict(jank),
        "late_present_frames": sum(r.get("present_type") == "Late Present" for r in activity_actual),
        "on_time_present_frames": sum(r.get("present_type") == "On-time Present" for r in activity_actual),
        "other_surface_layers": other_surface_layers,
        "native_scroll_changed_callbacks": len(scroll_callback_ts),
        "native_scroll_callback_interval_ms": stats(scroll_callback_intervals),
        "app_input_move_dispatches": len(input_move_ts),
        "app_input_move_dispatch_interval_ms": stats(input_move_intervals),
    }

    grouped = defaultdict(list)
    for row in fabric:
        name = row.get("name", "")
        if row.get("dur", "").isdigit():
            grouped[name].append(int(row["dur"]) / 1e6)
    fabric_summary = {}
    for name, durations in sorted(grouped.items(), key=lambda item: max(item[1]), reverse=True):
        if "UPDATE_PROPS" in name or "UPDATE_LAYOUT" in name or "UPDATE_STATE" in name or "mountViews" in name or name == "ReactScrollView.onScrollChanged" or name.startswith("Choreographer#doFrame"):
            fabric_summary[name] = stats(durations)
    operations = {op: stats([int(r["dur"])/1e6 for r in fabric if op in r.get("name", "") and r.get("dur", "").isdigit()])
                  for op in ("UPDATE_PROPS", "UPDATE_LAYOUT", "UPDATE_STATE", "mountViews")}
    operations["ReactScrollView.onScrollChanged"] = stats([int(r["dur"])/1e6 for r in fabric if r.get("name") == "ReactScrollView.onScrollChanged" and r.get("dur", "").isdigit()])
    frame_summary["thread_state_running_ms"] = {
        r["thread"]: round(float(r["duration_ms"]), 3)
        for r in states if r.get("state") == "Running"
    }
    result = {"frame_timeline": frame_summary, "main_thread_fabric_slices": operations, "fabric_slices_by_event": fabric_summary, "app_thread_states": states}
    (run_dir / "trace-analysis-summary.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({"frame_timeline": frame_summary, "main_thread_fabric_slices": operations, "thread_state_running_ms": frame_summary["thread_state_running_ms"]}, indent=2))


if __name__ == "__main__":
    main()

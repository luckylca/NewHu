#!/usr/bin/env python3
"""Summarize Android gfxinfo and FrameStats without treating cumulative frames as FPS."""

import csv
import re
import sys
from pathlib import Path
from statistics import median


root = Path(sys.argv[1]).resolve()
rows = []
pattern = re.compile(r"(\d+(?:\.\d+)?)ms")
fields = {
    "requests": "requests",
    "captures": "captures",
    "sourceDirty": "source_dirty",
    "geometryDirty": "geometry_dirty",
    "opticsDirty": "optics_dirty",
    "materialDirty": "material_dirty",
    "noIntersection": "no_intersection",
    "alreadyDirty": "already_dirty",
    "scheduled": "scheduled",
    "glassDraws": "glass_draws",
    "effects": "effect_builds",
    "geometryLookups": "geometry_lookups",
    "uiFrames": "route_frames",
    "descendantInvalidationReceived": "descendant_invalidation_received",
    "descendantInvalidationCoalesced": "descendant_invalidation_coalesced",
    "scrollEventsReceived": "scroll_events_received",
    "glassFrameScheduled": "glass_frame_scheduled",
    "glassFrameExecuted": "glass_frame_executed",
    "consumerInvalidationExecuted": "consumer_invalidation_executed",
    "settleCaptureExecuted": "settle_capture_executed",
}


def metric(text, expression, cast=float):
    match = re.search(expression, text)
    return cast(match.group(1)) if match else None


def percentile(values, percent):
    values = sorted(values)
    if not values:
        return None
    index = max(0, min(len(values) - 1, round((len(values) - 1) * percent / 100)))
    return values[index]


def parse_frame_stats(path):
    lines = path.read_text(errors="replace").splitlines()
    header_index = next((i for i, line in enumerate(lines) if line.startswith("Flags,FrameTimelineVsyncId,")), None)
    if header_index is None:
        return []
    parsed = []
    for row in csv.DictReader(lines[header_index:]):
        if not (row.get("Flags", "").isdigit() and row.get("FrameTimelineVsyncId", "").isdigit()):
            continue
        item = {}
        for key, value in row.items():
            try:
                item[key] = int(value)
            except (TypeError, ValueError):
                item[key] = 0
        parsed.append(item)
    return parsed


def parse_surfaceflinger_latency(path):
    lines = path.read_text(errors="replace").splitlines()
    if not lines:
        return None, []
    try:
        period_nanos = int(lines[0].strip())
    except ValueError:
        return None, []
    present_times = []
    for line in lines[1:]:
        values = line.split()
        if len(values) < 3:
            continue
        try:
            desired, actual, _ready = (int(value) for value in values[:3])
        except ValueError:
            continue
        if desired > 0 and actual > 0:
            present_times.append(actual)
    return period_nanos, present_times


for manifest_line in csv.DictReader((root / "manifest.csv").open()):
    scene, run = manifest_line["scene"], manifest_line["run"]
    active_seconds = float(manifest_line["active_seconds"])
    run_dir = root / f"scene-{scene}" / f"run-{run}"
    gfx = (run_dir / "gfxinfo.txt").read_text(errors="replace")
    logs = (run_dir / "logcat.txt").read_text(errors="replace")
    frame_stats = parse_frame_stats(run_dir / "framestats.txt")
    sf_period_nanos, sf_present_times = parse_surfaceflinger_latency(run_dir / "surfaceflinger-latency.txt")
    frame_count = metric(gfx, r"Total frames rendered:\s*(\d+)", int)
    no_frames = frame_count == 0
    gpu = {
        f"gpu_{p}": metric(gfx, rf"{p}th gpu percentile:\s*{pattern.pattern}")
        for p in (50, 90, 95, 99)
    }
    if no_frames:
        gpu = {key: None for key in gpu}
    counters = {value: 0 for value in fields.values()}
    counter_samples = 0
    js_samples = []
    for line in logs.splitlines():
        if "LiquidGlassPerf" not in line:
            if "[GLASS_JS]" in line:
                sample = {}
                for key in ("hz", "fps", "p50", "p90", "p95", "p99", "jank"):
                    value = re.search(rf"\b{key}=([\d.]+)", line)
                    if value:
                        sample[key] = float(value.group(1))
                if sample:
                    js_samples.append(sample)
            continue
        counter_samples += 1
        for log_key, csv_key in fields.items():
            value = re.search(rf"\b{log_key}=(\d+)", line)
            if value:
                counters[csv_key] += int(value.group(1))

    vsync_times = [row["IntendedVsync"] for row in frame_stats if row.get("IntendedVsync", 0) > 0]
    frame_spans_ms = [
        (row["FrameCompleted"] - row["FrameStartTime"]) / 1_000_000
        for row in frame_stats
        if row.get("FrameCompleted", 0) > row.get("FrameStartTime", 0) > 0
    ]
    ui_spans_ms = [
        (row["IssueDrawCommandsStart"] - row["PerformTraversalsStart"]) / 1_000_000
        for row in frame_stats
        if row.get("IssueDrawCommandsStart", 0) > row.get("PerformTraversalsStart", 0) > 0
    ]
    render_thread_spans_ms = [
        (row["SwapBuffers"] - row["IssueDrawCommandsStart"]) / 1_000_000
        for row in frame_stats
        if row.get("SwapBuffers", 0) > row.get("IssueDrawCommandsStart", 0) > 0
    ]
    gpu_spans_ms = [
        (row["GpuCompleted"] - row["SwapBuffers"]) / 1_000_000
        for row in frame_stats
        if row.get("GpuCompleted", 0) > row.get("SwapBuffers", 0) > 0
    ]
    sf_intervals_ms = [
        (later - earlier) / 1_000_000
        for earlier, later in zip(sf_present_times, sf_present_times[1:])
        if later > earlier
    ]
    sf_present_span_seconds = (
        (max(sf_present_times) - min(sf_present_times)) / 1_000_000_000
        if len(sf_present_times) > 1 else None
    )
    sf_present_fps = (len(sf_present_times) - 1) / sf_present_span_seconds if len(sf_present_times) > 1 and sf_present_span_seconds else None
    sf_gap_limit_ms = sf_period_nanos * 1.5 / 1_000_000 if sf_period_nanos else None
    sf_gap_count = sum(interval > sf_gap_limit_ms for interval in sf_intervals_ms) if sf_gap_limit_ms else None
    sample_span_seconds = (max(vsync_times) - min(vsync_times)) / 1_000_000_000 if len(vsync_times) > 1 else None
    sample_fps = (len(vsync_times) / sample_span_seconds) if sample_span_seconds else None

    row = {
        "scene": scene,
        "run": run,
        "active_seconds": active_seconds,
        "gfxinfo_frames_total_non_fps": frame_count,
        "frame_timeline_sample_frames": len(vsync_times),
        "frame_timeline_sample_span_s": round(sample_span_seconds, 3) if sample_span_seconds else None,
        "frame_timeline_fps_last_window_only": round(sample_fps, 2) if sample_fps else None,
        **{
            f"frame_timeline_render_p{p}_ms": round(percentile(frame_spans_ms, p), 3) if frame_spans_ms else None
            for p in (50, 90, 95, 99)
        },
        **{
            f"ui_thread_sample_p{p}_ms": round(percentile(ui_spans_ms, p), 3) if ui_spans_ms else None
            for p in (50, 90, 95, 99)
        },
        **{
            f"render_thread_sample_p{p}_ms": round(percentile(render_thread_spans_ms, p), 3) if render_thread_spans_ms else None
            for p in (50, 90, 95, 99)
        },
        **{
            f"gpu_sample_p{p}_ms": round(percentile(gpu_spans_ms, p), 3) if gpu_spans_ms else None
            for p in (50, 90, 95, 99)
        },
        "surfaceflinger_present_samples_last_window": len(sf_present_times),
        "surfaceflinger_period_ms": round(sf_period_nanos / 1_000_000, 3) if sf_period_nanos else None,
        "surfaceflinger_present_span_s": round(sf_present_span_seconds, 3) if sf_present_span_seconds else None,
        "surfaceflinger_presented_hz_last_window": round(sf_present_fps, 2) if sf_present_fps else None,
        "surfaceflinger_present_interval_p50_ms": round(percentile(sf_intervals_ms, 50), 3) if sf_intervals_ms else None,
        "surfaceflinger_present_interval_p90_ms": round(percentile(sf_intervals_ms, 90), 3) if sf_intervals_ms else None,
        "surfaceflinger_present_interval_p95_ms": round(percentile(sf_intervals_ms, 95), 3) if sf_intervals_ms else None,
        "surfaceflinger_present_interval_p99_ms": round(percentile(sf_intervals_ms, 99), 3) if sf_intervals_ms else None,
        "surfaceflinger_gaps_over_1_5_periods_last_window": sf_gap_count,
        "js_overlay_samples": len(js_samples),
        "js_fps_median": round(median([sample["fps"] for sample in js_samples if "fps" in sample]), 2) if any("fps" in sample for sample in js_samples) else None,
        "js_interval_p50_median_ms": round(median([sample["p50"] for sample in js_samples if "p50" in sample]), 2) if any("p50" in sample for sample in js_samples) else None,
        "js_interval_p90_median_ms": round(median([sample["p90"] for sample in js_samples if "p90" in sample]), 2) if any("p90" in sample for sample in js_samples) else None,
        "js_interval_p95_median_ms": round(median([sample["p95"] for sample in js_samples if "p95" in sample]), 2) if any("p95" in sample for sample in js_samples) else None,
        "js_interval_p99_median_ms": round(median([sample["p99"] for sample in js_samples if "p99" in sample]), 2) if any("p99" in sample for sample in js_samples) else None,
        "js_jank_percent_median": round(median([sample["jank"] for sample in js_samples if "jank" in sample]), 2) if any("jank" in sample for sample in js_samples) else None,
        "native_counter_lines": counter_samples,
        "janky_frames_legacy_16ms": metric(gfx, r"Janky frames:\s*(\d+)", int),
        "janky_percent_legacy_16ms": metric(gfx, r"Janky frames:\s*\d+\s*\(([\d.]+)%\)"),
        "gfxinfo_p50_ms_whole_sample": None if no_frames else metric(gfx, r"50th percentile:\s*(\d+)ms", int),
        "gfxinfo_p90_ms_whole_sample": None if no_frames else metric(gfx, r"90th percentile:\s*(\d+)ms", int),
        "gfxinfo_p95_ms_whole_sample": None if no_frames else metric(gfx, r"95th percentile:\s*(\d+)ms", int),
        "gfxinfo_p99_ms_whole_sample": None if no_frames else metric(gfx, r"99th percentile:\s*(\d+)ms", int),
        "slow_ui": metric(gfx, r"Number Slow UI thread:\s*(\d+)", int),
        "slow_bitmap": metric(gfx, r"Number Slow bitmap uploads:\s*(\d+)", int),
        "slow_draw": metric(gfx, r"Number Slow issue draw commands:\s*(\d+)", int),
        "gfxinfo_deadline_missed_legacy": metric(gfx, r"Number Frame deadline missed:\s*(\d+)", int),
        **gpu,
        **counters,
    }
    rows.append(row)

columns = list(rows[0]) if rows else []
with (root / "summary.csv").open("w", newline="") as handle:
    writer = csv.DictWriter(handle, fieldnames=columns)
    writer.writeheader()
    writer.writerows(rows)

summary_lines = [
    f"# Android Liquid Glass benchmark ({root.name})",
    "",
    "SurfaceFlinger samples the app's BLAST layer presented timestamps (last ~128 frames), so cadence and present intervals are tail-window values. FrameStats stage spans are also a tail window. GfxInfo percentiles and its Frame deadline missed counter cover the full active sample; percentile bins are rounded to whole milliseconds and its jank percentage uses Android's legacy 16 ms threshold. Cumulative `Total frames rendered` is never divided by wall time to fabricate FPS.",
    "",
    "| Scene | Runs | SF presented Hz (tail) | Present interval P50/P90/P95/P99 ms | SF gaps >1.5 periods | FrameStats work P50/P90/P95/P99 ms (tail) | UI/RT/GPU stage P95 ms (tail) | HWUI deadline misses | GfxInfo P50/P90/P95/P99 ms | GPU P50/P90/P95/P99 ms | Captures/run | No-intersection/run | JS overlay FPS/P95/jank median |",
    "|---|---:|---:|---|---:|---|---|---:|---|---|---:|---:|---|",
]
for scene in sorted({row["scene"] for row in rows}):
    group = [row for row in rows if row["scene"] == scene]

    def med(key):
        values = [row[key] for row in group if row[key] is not None]
        return f"{median(values):g}" if values else "n/a"

    present_times = "/".join(med(f"surfaceflinger_present_interval_p{p}_ms") for p in (50, 90, 95, 99))
    frame_times = "/".join(med(f"frame_timeline_render_p{p}_ms") for p in (50, 90, 95, 99))
    thread_times = "/".join(med(key) for key in ("ui_thread_sample_p95_ms", "render_thread_sample_p95_ms", "gpu_sample_p95_ms"))
    gfx_times = "/".join(med(f"gfxinfo_p{p}_ms_whole_sample") for p in (50, 90, 95, 99))
    gpu_times = "/".join(med(f"gpu_{p}") for p in (50, 90, 95, 99))
    summary_lines.append(
        f"| {scene} | {len(group)} | {med('surfaceflinger_presented_hz_last_window')} | {present_times} | {med('surfaceflinger_gaps_over_1_5_periods_last_window')} | {frame_times} | {thread_times} | {med('gfxinfo_deadline_missed_legacy')} | {gfx_times} | {gpu_times} | {med('captures')} | {med('no_intersection')} | {med('js_fps_median')}/{med('js_interval_p95_median_ms')}/{med('js_jank_percent_median')}% |"
    )
summary_lines.extend([
    "",
    "Native telemetry counts are summed from one-second `LiquidGlassPerf` log deltas. The JS RAF overlay is opt-in and reports 0.5-second windows; it is disabled for the primary runs unless the manifest says `telemetry_overlay=1`. Scene A is the no-glass ScrollView baseline; C checks that below-glass scrolling does not recapture the fixed TopAppBar; D places glass over moving content and should capture at display cadence. `route-auto` motion is synthetic JS/scrollTo or selection changes, not a physical gesture or RNGH touch-cadence result.",
    "",
])
(root / "summary.md").write_text("\n".join(summary_lines))
print(root / "summary.md")

#!/usr/bin/env python3
"""Map Comments append/React commit log times to Perfetto Fabric main-thread slices."""
import csv
import json
import os
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo


LOG_TIME = re.compile(r"^(\d{2})-(\d{2}) (\d{2}:\d{2}:\d{2}\.\d{3})")
TRACE_EVENT = re.compile(r"\[(COMMENTS_PERF_APPEND|COMMENTS_PERF_REACT_COMMIT)\] (\{.*\})")


def read_clock_anchor(tp: str, run_dir: Path) -> tuple[int, int]:
    sql = run_dir / "clock-realtime-anchor.sql"
    sql.write_text(
        "SELECT ts,clock_value FROM clock_snapshot "
        "WHERE clock_name='REALTIME' ORDER BY ts LIMIT 1;\n"
    )
    proc = subprocess.run(
        [tp, "query", "-f", str(sql), str(run_dir / "frame-timeline.pftrace")],
        capture_output=True,
        text=True,
        check=True,
    )
    for line in proc.stdout.splitlines():
        fields = next(csv.reader([line]))
        if fields and fields[0] == "ts":
            continue
        if len(fields) >= 2 and fields[0].isdigit() and fields[1].isdigit():
            return int(fields[0]), int(fields[1])
    raise RuntimeError("Perfetto trace has no REALTIME clock snapshot")


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("usage: correlate-comments-fabric.py RUN_DIR [YYYY-MM-DD] [TRACE_PROCESSOR]")
    run_dir = Path(sys.argv[1]).resolve()
    log_date = sys.argv[2] if len(sys.argv) >= 3 else "2026-10-12"
    tp = sys.argv[3] if len(sys.argv) >= 4 else os.environ.get("TRACE_PROCESSOR")
    if not tp:
        candidates = list((Path.home() / ".local/share/perfetto/prebuilts").glob("trace_processor_shell-*"))
        tp = str(candidates[0]) if candidates else "trace_processor_shell"

    anchor_trace_ns, anchor_realtime_ns = read_clock_anchor(tp, run_dir)
    trace_slices = list(csv.DictReader((run_dir / "fabric-main-slices.csv").open(newline="")))
    events = []
    for line in (run_dir / "logcat.txt").read_text(errors="replace").splitlines():
        time_match = LOG_TIME.match(line)
        event_match = TRACE_EVENT.search(line)
        if not time_match or not event_match:
            continue
        month, day, clock_text = time_match.groups()
        local_time = datetime.strptime(f"{log_date[:4]}-{month}-{day} {clock_text}", "%Y-%m-%d %H:%M:%S.%f").replace(tzinfo=ZoneInfo("Asia/Shanghai"))
        fields = json.loads(event_match.group(2))
        events.append({
            "event": event_match.group(1),
            "local_time": local_time.isoformat(timespec="milliseconds"),
            "realtime_ns": int(local_time.timestamp() * 1_000_000_000),
            **fields,
        })

    output = []
    for event in events:
        event_trace_ns = anchor_trace_ns + event["realtime_ns"] - anchor_realtime_ns
        nearby = []
        for item in trace_slices:
            start_ns = int(item["ts"])
            duration_ns = int(item["dur"])
            delta_ms = (start_ns - event_trace_ns) / 1_000_000
            if abs(delta_ms) <= 500:
                nearby.append({
                    "name": item["name"],
                    "duration_ms": duration_ns / 1_000_000,
                    "start_delta_ms": delta_ms,
                    "end_delta_ms": (start_ns + duration_ns - event_trace_ns) / 1_000_000,
                })
        nearby.sort(key=lambda item: (-item["duration_ms"], abs(item["start_delta_ms"])))
        output.append({
            "event": event["event"],
            "local_time": event["local_time"],
            "source": event.get("source"),
            "added_rows": event.get("rows", event.get("addedRows")),
            "total_rows": event.get("totalRows"),
            "api_ms": event.get("apiMs"),
            "cache_write_ms": event.get("cacheWriteMs"),
            "state_to_effect_ms": event.get("stateToEffectMs"),
            "nearby_fabric_slices_within_500ms": nearby[:12],
        })

    path = run_dir / "fabric-append-correlations.json"
    path.write_text(json.dumps({
        "timezone": "Asia/Shanghai",
        "clock_anchor_trace_ns": anchor_trace_ns,
        "clock_anchor_realtime_ns": anchor_realtime_ns,
        "events": output,
    }, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"output": str(path), "events": output}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

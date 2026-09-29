-- Correlate app FrameTimeline frames with app-process CPU-running intervals.
-- Run with: trace_processor query -f this-file trace.pftrace
WITH frames AS (
  SELECT e.id, e.ts AS start_ts, a.ts + a.dur AS end_ts,
         a.on_time_finish, a.jank_type, a.jank_severity_type
  FROM expected_frame_timeline_slice e
  JOIN actual_frame_timeline_slice a
    ON a.surface_frame_token = e.surface_frame_token
   AND a.layer_name LIKE '%com.anonymous.NewHu%'
  WHERE e.layer_name LIKE '%com.anonymous.NewHu%'
), per_frame_thread AS (
  SELECT f.id, f.end_ts - f.start_ts AS frame_window_ns,
         f.on_time_finish, f.jank_type, f.jank_severity_type,
         t.name AS thread,
         SUM(MAX(0, MIN(s.ts + s.dur, f.end_ts) - MAX(s.ts, f.start_ts))) AS cpu_ns
  FROM frames f
  JOIN thread_state s ON s.ts < f.end_ts AND s.ts + s.dur > f.start_ts
  JOIN thread t USING (utid)
  JOIN process p USING (upid)
  WHERE p.name = 'com.anonymous.NewHu' AND s.state = 'Running'
  GROUP BY f.id, t.name
)
SELECT thread, COUNT(*) AS frames,
       ROUND(PERCENTILE(cpu_ns / 1e6, 50), 3) AS cpu_p50_ms,
       ROUND(PERCENTILE(cpu_ns / 1e6, 90), 3) AS cpu_p90_ms,
       ROUND(PERCENTILE(cpu_ns / 1e6, 95), 3) AS cpu_p95_ms,
       ROUND(PERCENTILE(cpu_ns / 1e6, 99), 3) AS cpu_p99_ms,
       ROUND(MAX(cpu_ns / 1e6), 3) AS cpu_max_ms
FROM per_frame_thread
GROUP BY thread
ORDER BY cpu_p95_ms DESC;

WITH frames AS (
  SELECT e.id, e.ts AS start_ts, a.ts + a.dur AS end_ts,
         a.on_time_finish, a.jank_type, a.jank_severity_type
  FROM expected_frame_timeline_slice e
  JOIN actual_frame_timeline_slice a
    ON a.surface_frame_token = e.surface_frame_token
   AND a.layer_name LIKE '%com.anonymous.NewHu%'
  WHERE e.layer_name LIKE '%com.anonymous.NewHu%'
)
SELECT COUNT(*) AS frames,
       SUM(CASE WHEN on_time_finish = 0 THEN 1 ELSE 0 END) AS deadline_misses,
       ROUND(PERCENTILE((end_ts-start_ts)/1e6, 50),3) AS app_window_p50_ms,
       ROUND(PERCENTILE((end_ts-start_ts)/1e6, 95),3) AS app_window_p95_ms,
       ROUND(PERCENTILE((end_ts-start_ts)/1e6, 99),3) AS app_window_p99_ms,
       ROUND(MAX((end_ts-start_ts)/1e6),3) AS app_window_max_ms
FROM frames;

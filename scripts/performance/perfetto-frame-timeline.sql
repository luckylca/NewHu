WITH app_frames AS (
  SELECT
    ts,
    dur,
    layer_name,
    jank_type,
    jank_severity_type,
    on_time_finish,
    present_type,
    LAG(ts) OVER (PARTITION BY layer_name ORDER BY ts) AS previous_ts
  FROM actual_frame_timeline_slice
  WHERE layer_name LIKE '%com.anonymous.NewHu%'
)
SELECT
  layer_name,
  COUNT(*) AS submitted_frames,
  ROUND((MAX(ts) - MIN(ts)) / 1e9, 3) AS active_present_span_s,
  ROUND((COUNT(*) - 1) * 1e9 / NULLIF(MAX(ts) - MIN(ts), 0), 2) AS average_submitted_hz,
  ROUND(PERCENTILE((ts - previous_ts) / 1e6, 50), 3) AS present_interval_p50_ms,
  ROUND(PERCENTILE((ts - previous_ts) / 1e6, 90), 3) AS present_interval_p90_ms,
  ROUND(PERCENTILE((ts - previous_ts) / 1e6, 95), 3) AS present_interval_p95_ms,
  ROUND(PERCENTILE((ts - previous_ts) / 1e6, 99), 3) AS present_interval_p99_ms,
  SUM(CASE WHEN ts - previous_ts > 12500000 THEN 1 ELSE 0 END) AS gaps_over_1_5_periods,
  SUM(CASE WHEN jank_type NOT IN ('None', '') THEN 1 ELSE 0 END) AS janky_presentations,
  SUM(CASE WHEN on_time_finish = 0 THEN 1 ELSE 0 END) AS app_deadline_misses
FROM app_frames
WHERE previous_ts IS NOT NULL OR ts IS NOT NULL
GROUP BY layer_name;

SELECT
  t.name AS thread,
  ROUND(SUM(CASE WHEN s.state = 'Running' THEN s.dur ELSE 0 END) / 1e6, 2) AS cpu_running_ms,
  ROUND(
    100.0 * SUM(CASE WHEN s.state = 'Running' THEN s.dur ELSE 0 END) /
      NULLIF((SELECT end_ts - start_ts FROM trace_bounds), 0),
    2
  ) AS trace_wall_percent
FROM thread_state s
JOIN thread t USING (utid)
JOIN process p USING (upid)
WHERE p.name = 'com.anonymous.NewHu'
GROUP BY t.name
HAVING SUM(CASE WHEN s.state = 'Running' THEN s.dur ELSE 0 END) > 0
ORDER BY cpu_running_ms DESC;

SELECT
  name,
  COUNT(*) AS events,
  ROUND(SUM(dur) / 1e6, 3) AS total_ms,
  ROUND(MAX(dur) / 1e6, 3) AS max_ms
FROM slice
WHERE name LIKE '%GC%' OR name LIKE '%Garbage%'
GROUP BY name
ORDER BY total_ms DESC;

package com.newhu.liquidglass.nativebenchmark

import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.view.FrameMetrics
import android.view.Window
import java.util.concurrent.ConcurrentLinkedQueue
import kotlin.math.ceil

internal class NativeFrameMetrics(private val window: Window) {
    private val thread = HandlerThread("GlassNativeFrameMetrics").apply { start() }
    private val handler = Handler(thread.looper)
    private val frames = ConcurrentLinkedQueue<FrameSample>()
    @Volatile private var measuring = false
    private var listenerRegistered = false

    private val listener = Window.OnFrameMetricsAvailableListener { _, metrics, _ ->
        if (!measuring) return@OnFrameMetricsAvailableListener
        val total = metric(metrics, FrameMetrics.TOTAL_DURATION)
        val ui = metric(metrics, FrameMetrics.INPUT_HANDLING_DURATION) +
            metric(metrics, FrameMetrics.ANIMATION_DURATION) +
            metric(metrics, FrameMetrics.LAYOUT_MEASURE_DURATION) +
            metric(metrics, FrameMetrics.DRAW_DURATION)
        val render = metric(metrics, FrameMetrics.SYNC_DURATION) +
            metric(metrics, FrameMetrics.COMMAND_ISSUE_DURATION) +
            metric(metrics, FrameMetrics.SWAP_BUFFERS_DURATION)
        val gpu = if (Build.VERSION.SDK_INT >= 24) metric(metrics, FrameMetrics.GPU_DURATION) else 0L
        val deadline = if (Build.VERSION.SDK_INT >= 31) metric(metrics, FrameMetrics.DEADLINE) else 0L
        frames.add(FrameSample(total, ui, render, gpu, deadline))
    }

    fun start() {
        frames.clear()
        measuring = true
        window.addOnFrameMetricsAvailableListener(listener, handler)
        listenerRegistered = true
    }

    fun stopAndReport(tag: String): String {
        measuring = false
        removeListener()
        val samples = frames.toList()
        val total = samples.map { it.totalNanos }
        val ui = samples.map { it.uiNanos }
        val render = samples.map { it.renderNanos }
        val gpu = samples.map { it.gpuNanos }
        val deadlineMisses = samples.count { it.deadlineNanos > 0L && it.totalNanos > it.deadlineNanos }
        val over120Hz = samples.count { it.totalNanos > 8_333_333L }
        val over60Hz = samples.count { it.totalNanos > 16_666_667L }
        return "[$tag] frames=${samples.size} " +
            "totalMs=${percentiles(total)} uiMs=${percentiles(ui)} renderThreadMs=${percentiles(render)} gpuMs=${percentiles(gpu)} " +
            "deadlineMisses=$deadlineMisses over8_33ms=$over120Hz over16_67ms=$over60Hz " +
            "jank120HzPct=${percent(over120Hz, samples.size)} jank60HzPct=${percent(over60Hz, samples.size)}"
    }

    fun release() {
        measuring = false
        removeListener()
        thread.quitSafely()
    }

    private fun removeListener() {
        if (!listenerRegistered) return
        window.removeOnFrameMetricsAvailableListener(listener)
        listenerRegistered = false
    }

    private fun percentiles(values: List<Long>): String {
        if (values.isEmpty()) return "n/a"
        val sorted = values.sorted()
        fun percentile(value: Double): String {
            val index = ceil(value * sorted.size).toInt().minus(1).coerceIn(0, sorted.lastIndex)
            return String.format("%.2f", sorted[index] / 1_000_000.0)
        }
        return "${percentile(0.50)}/${percentile(0.90)}/${percentile(0.95)}/${percentile(0.99)}/${percentile(1.0)}"
    }

    private fun metric(metrics: FrameMetrics, id: Int): Long = runCatching { metrics.getMetric(id) }.getOrDefault(0L)

    private fun percent(count: Int, total: Int): String =
        if (total == 0) "0.00" else String.format("%.2f", 100.0 * count / total)

    private data class FrameSample(
        val totalNanos: Long,
        val uiNanos: Long,
        val renderNanos: Long,
        val gpuNanos: Long,
        val deadlineNanos: Long,
    )
}

package com.newhu.liquidglass.telemetry

import android.os.Handler
import android.os.Looper
import android.util.Log
import android.graphics.Rect
import java.util.concurrent.atomic.AtomicLong
import java.util.concurrent.ConcurrentHashMap

/** Opt-in, low-frequency native counters for the development benchmark route. */
object LiquidGlassPerfTelemetry {

    @Volatile
    private var enabled = false

    private val requests = AtomicLong()
    private val sourceContentDirties = AtomicLong()
    private val consumerGeometryDirties = AtomicLong()
    private val opticsDirties = AtomicLong()
    private val materialDirties = AtomicLong()
    private val captures = AtomicLong()
    private val capturedPixels = AtomicLong()
    private val skippedNoIntersection = AtomicLong()
    private val skippedAlreadyDirty = AtomicLong()
    private val captureSchedules = AtomicLong()
    private val consumerDraws = AtomicLong()
    private val effectBuilds = AtomicLong()
    private val geometryLookups = AtomicLong()
    private val routeDraws = AtomicLong()
    private val routeTreeTraversals = AtomicLong()
    private val routeRenderNodeRecords = AtomicLong()
    private val sourceRenderNodeReuses = AtomicLong()
    private val sourceRenderNodeRecordedPixels = AtomicLong()
    private val regionRenderNodeRecords = AtomicLong()
    private val regionRenderNodeReuses = AtomicLong()
    private val regionRenderNodeRecordedPixels = AtomicLong()
    private val sourceWindowRefreshes = AtomicLong()
    private val sourceWindowRecordedPixels = AtomicLong()
    private val scrollSampleOffsetUpdates = AtomicLong()
    private val scrollWindowReuseFrames = AtomicLong()
    private val routeScreenComposites = AtomicLong()
    private val routeScrollReuses = AtomicLong()
    private val descendantInvalidationsReceived = AtomicLong()
    private val descendantInvalidationsCoalesced = AtomicLong()
    private val scrollEventsReceived = AtomicLong()
    private val glassFramesScheduled = AtomicLong()
    private val glassFramesExecuted = AtomicLong()
    private val consumerInvalidationsExecuted = AtomicLong()
    private val settleCapturesExecuted = AtomicLong()
    private val frozenSnapshotBlurRecords = AtomicLong()
    private val frozenSnapshotRequests = AtomicLong()
    private val frozenSnapshotFailures = AtomicLong()
    private val backdropSamples = AtomicLong()
    private val providerGeometry = ConcurrentHashMap<String, ProviderGeometry>()
    private val providerCaptures = ConcurrentHashMap<String, ProviderCapture>()
    @Volatile private var displayRefreshRate = 0f

    private data class ProviderGeometry(
        val width: Int,
        val height: Int,
        val rects: List<Rect>,
    )

    private data class ProviderCapture(
        val count: AtomicLong = AtomicLong(),
        val pixels: AtomicLong = AtomicLong(),
        @Volatile var mode: String = "",
    )

    private val mainHandler = Handler(Looper.getMainLooper())
    private var previousLog = counters()

    private val logRunnable = object : Runnable {
        override fun run() {
            if (!enabled) return
            val current = counters()
            val previous = previousLog
            Log.i(
                "LiquidGlassPerf",
                "hz=${displayRefreshRate.toInt()} requests=${delta(current, previous, "backdropRequestCount")} " +
                    "captures=${delta(current, previous, "backdropCaptureCount")} " +
                    "capturePixels=${delta(current, previous, "backdropCapturedPixelCount")} " +
                    "providerCaptures=${providerCaptureSummary()} " +
                    "sourceDirty=${delta(current, previous, "sourceContentDirtyCount")} " +
                    "geometryDirty=${delta(current, previous, "consumerGeometryDirtyCount")} " +
                    "opticsDirty=${delta(current, previous, "opticsDirtyCount")} " +
                    "materialDirty=${delta(current, previous, "materialDirtyCount")} " +
                    "noIntersection=${delta(current, previous, "captureSkippedNoIntersection")} " +
                    "alreadyDirty=${delta(current, previous, "captureSkippedAlreadyDirty")} " +
                    "scheduled=${delta(current, previous, "captureScheduledCount")} " +
                    "glassDraws=${delta(current, previous, "consumerDrawCount")} " +
                    "effects=${delta(current, previous, "effectBuildCount")} " +
                "geometryLookups=${delta(current, previous, "geometryLookupCount")} " +
                    "routeDispatch=${delta(current, previous, "routeDispatchCount")} " +
                    "routeTraversal=${delta(current, previous, "routeTreeTraversalCount")} " +
                    "routeNodeRecord=${delta(current, previous, "routeRenderNodeRecordCount")} " +
                    "sourceNodeRecord=${delta(current, previous, "sourceRenderNodeRecordCount")} " +
                    "sourceNodeReuse=${delta(current, previous, "sourceRenderNodeReuseCount")} " +
                    "sourceNodePixels=${delta(current, previous, "sourceRenderNodeRecordedPixelCount")} " +
                    "sourceTreeTraversal=${delta(current, previous, "sourceTreeTraversalCount")} " +
                    "regionNodeRecord=${delta(current, previous, "regionRenderNodeRecordCount")} " +
                    "regionNodeReuse=${delta(current, previous, "regionRenderNodeReuseCount")} " +
                    "scrollWindowRefresh=${delta(current, previous, "scrollWindowRefreshCount")} " +
                    "scrollSampleOffset=${delta(current, previous, "scrollSampleOffsetUpdateCount")} " +
                    "scrollWindowReuse=${delta(current, previous, "scrollWindowReuseFrameCount")} " +
                    "routeScreenComposite=${delta(current, previous, "routeScreenCompositeCount")} " +
                    "routeScrollReuse=${delta(current, previous, "routeScrollReuseCount")} " +
                    "descendantInvalidationReceived=${delta(current, previous, "descendantInvalidationReceivedCount")} " +
                    "descendantInvalidationCoalesced=${delta(current, previous, "descendantInvalidationCoalescedCount")} " +
                    "scrollEventsReceived=${delta(current, previous, "scrollEventsReceivedCount")} " +
                    "glassFrameScheduled=${delta(current, previous, "glassFrameScheduledCount")} " +
                    "glassFrameExecuted=${delta(current, previous, "glassFrameExecutedCount")} " +
                    "consumerInvalidationExecuted=${delta(current, previous, "consumerInvalidationExecutedCount")} " +
                    "settleCaptureExecuted=${delta(current, previous, "settleCaptureExecutedCount")} " +
                    "frozenSnapshotBlur=${delta(current, previous, "frozenSnapshotBlurRecordCount")} " +
                    "frozenSnapshotRequests=${delta(current, previous, "frozenSnapshotRequestCount")} " +
                    "frozenSnapshotFailures=${delta(current, previous, "frozenSnapshotFailureCount")} " +
                    "backdropSamples=${delta(current, previous, "backdropSampleCount")} " +
                    "activeConsumers=${current["activeConsumerCount"] ?: 0L} " +
                    "consumerAreaPx=${current["totalConsumerPixelArea"] ?: 0L} " +
                    "unionAreaPx=${current["unionBoundingRectArea"] ?: 0L} " +
                    "unionPercent=${current["unionBoundingRectPercent"] ?: 0L} " +
                    "consumerRects=${providerRectSummary()}",
            )
            previousLog = current
            mainHandler.postDelayed(this, 1_000L)
        }
    }

    fun setEnabled(value: Boolean) {
        if (enabled == value) {
            if (value) mainHandler.post {
                reset()
                previousLog = counters()
                mainHandler.removeCallbacks(logRunnable)
                mainHandler.postDelayed(logRunnable, 1_000L)
            }
            return
        }
        enabled = value
        mainHandler.post {
            if (value) {
                reset()
                previousLog = counters()
                mainHandler.removeCallbacks(logRunnable)
                mainHandler.postDelayed(logRunnable, 1_000L)
            } else {
                mainHandler.removeCallbacks(logRunnable)
            }
        }
    }

    fun snapshot(): Map<String, Number> = counters() + mapOf("displayRefreshRate" to displayRefreshRate)

    fun displayRefreshRate(value: Float) {
        if (enabled) displayRefreshRate = value
    }

    fun backdropRequest() { if (enabled) requests.incrementAndGet() }
    fun sourceContentDirty() { if (enabled) sourceContentDirties.incrementAndGet() }
    fun consumerGeometryDirty() { if (enabled) consumerGeometryDirties.incrementAndGet() }
    fun opticsDirty() { if (enabled) opticsDirties.incrementAndGet() }
    fun materialDirty() { if (enabled) materialDirties.incrementAndGet() }
    fun backdropCapture(
        providerId: String,
        width: Int,
        height: Int,
        capturedPixelArea: Long = width.coerceAtLeast(0).toLong() * height.coerceAtLeast(0),
        mode: String,
    ) {
        if (!enabled) return
        captures.incrementAndGet()
        val pixels = capturedPixelArea.coerceAtLeast(0L)
        capturedPixels.addAndGet(pixels)
        providerCaptures.computeIfAbsent(providerId) { ProviderCapture() }.apply {
            count.incrementAndGet()
            this.pixels.addAndGet(pixels)
            this.mode = mode
        }
    }
    fun captureSkippedNoIntersection() { if (enabled) skippedNoIntersection.incrementAndGet() }
    fun captureSkippedAlreadyDirty() { if (enabled) skippedAlreadyDirty.incrementAndGet() }
    fun captureScheduled() { if (enabled) captureSchedules.incrementAndGet() }
    fun consumerDraw() { if (enabled) consumerDraws.incrementAndGet() }
    fun routeDraw() { if (enabled) routeDraws.incrementAndGet() }
    fun routeTreeTraversal() { if (enabled) routeTreeTraversals.incrementAndGet() }
    fun routeRenderNodeRecord() { if (enabled) routeRenderNodeRecords.incrementAndGet() }
    fun sourceRenderNodeReuse() { if (enabled) sourceRenderNodeReuses.incrementAndGet() }
    fun sourceRenderNodeRecorded(width: Int, height: Int) {
        if (!enabled) return
        sourceRenderNodeRecordedPixels.addAndGet(width.coerceAtLeast(0).toLong() * height.coerceAtLeast(0))
    }
    fun sourceWindowRecorded(width: Int, height: Int) {
        if (!enabled) return
        sourceWindowRefreshes.incrementAndGet()
        sourceWindowRecordedPixels.addAndGet(width.coerceAtLeast(0).toLong() * height.coerceAtLeast(0))
    }
    fun scrollSampleOffsetUpdated() { if (enabled) scrollSampleOffsetUpdates.incrementAndGet() }
    fun scrollWindowReused() { if (enabled) scrollWindowReuseFrames.incrementAndGet() }
    fun regionRenderNodeRecord(width: Int, height: Int) {
        if (!enabled) return
        regionRenderNodeRecords.incrementAndGet()
        regionRenderNodeRecordedPixels.addAndGet(width.coerceAtLeast(0).toLong() * height.coerceAtLeast(0))
    }
    fun regionRenderNodeReuse() { if (enabled) regionRenderNodeReuses.incrementAndGet() }
    fun routeScreenComposite() { if (enabled) routeScreenComposites.incrementAndGet() }
    fun routeScrollReuse() { if (enabled) routeScrollReuses.incrementAndGet() }
    fun descendantInvalidationReceived() { if (enabled) descendantInvalidationsReceived.incrementAndGet() }
    fun descendantInvalidationCoalesced() { if (enabled) descendantInvalidationsCoalesced.incrementAndGet() }
    fun scrollEventReceived() { if (enabled) scrollEventsReceived.incrementAndGet() }
    fun glassFrameScheduled() { if (enabled) glassFramesScheduled.incrementAndGet() }
    fun glassFrameExecuted() { if (enabled) glassFramesExecuted.incrementAndGet() }
    fun consumerInvalidationExecuted() { if (enabled) consumerInvalidationsExecuted.incrementAndGet() }
    fun settleCaptureExecuted() { if (enabled) settleCapturesExecuted.incrementAndGet() }
    fun frozenSnapshotBlurRecorded() { if (enabled) frozenSnapshotBlurRecords.incrementAndGet() }
    fun frozenSnapshotRequested() { if (enabled) frozenSnapshotRequests.incrementAndGet() }
    fun frozenSnapshotFailed() { if (enabled) frozenSnapshotFailures.incrementAndGet() }
    fun backdropSample() { if (enabled) backdropSamples.incrementAndGet() }
    fun effectBuild() { if (enabled) effectBuilds.incrementAndGet() }
    fun geometryLookup() { if (enabled) geometryLookups.incrementAndGet() }

    fun isEnabled(): Boolean = enabled

    fun updateProviderGeometry(providerId: String, width: Int, height: Int, rects: Collection<Rect>) {
        if (!enabled) return
        providerGeometry[providerId] = ProviderGeometry(width, height, rects.map(::Rect))
    }

    fun removeProviderGeometry(providerId: String) {
        if (enabled) providerGeometry.remove(providerId)
    }

    private fun counters(): Map<String, Long> {
        var activeConsumerCount = 0L
        var totalConsumerPixelArea = 0L
        var unionBoundingRectArea = 0L
        var providerArea = 0L
        for (geometry in providerGeometry.values) {
            providerArea += geometry.width.coerceAtLeast(0).toLong() * geometry.height.coerceAtLeast(0)
            if (geometry.rects.isEmpty()) continue
            activeConsumerCount += geometry.rects.size
            val union = Rect()
            for ((index, rect) in geometry.rects.withIndex()) {
                val area = rect.width().coerceAtLeast(0).toLong() * rect.height().coerceAtLeast(0)
                totalConsumerPixelArea += area
                if (index == 0) union.set(rect) else union.union(rect)
            }
            unionBoundingRectArea += union.width().coerceAtLeast(0).toLong() * union.height().coerceAtLeast(0)
        }
        val unionPercent = if (providerArea > 0L) (unionBoundingRectArea * 10_000L / providerArea) else 0L
        return mapOf(
        "backdropRequestCount" to requests.get(),
        "sourceContentDirtyCount" to sourceContentDirties.get(),
        "consumerGeometryDirtyCount" to consumerGeometryDirties.get(),
        "opticsDirtyCount" to opticsDirties.get(),
        "materialDirtyCount" to materialDirties.get(),
        "backdropCaptureCount" to captures.get(),
        "backdropCapturedPixelCount" to capturedPixels.get(),
        "captureSkippedNoIntersection" to skippedNoIntersection.get(),
        "captureSkippedAlreadyDirty" to skippedAlreadyDirty.get(),
        "captureScheduledCount" to captureSchedules.get(),
        "consumerDrawCount" to consumerDraws.get(),
        "effectBuildCount" to effectBuilds.get(),
        "geometryLookupCount" to geometryLookups.get(),
        "uiFrameCount" to routeDraws.get(),
        "routeDispatchCount" to routeDraws.get(),
        "routeTreeTraversalCount" to routeTreeTraversals.get(),
        "routeRenderNodeRecordCount" to routeRenderNodeRecords.get(),
        "sourceRenderNodeRecordCount" to routeRenderNodeRecords.get(),
        "sourceRenderNodeReuseCount" to sourceRenderNodeReuses.get(),
        "sourceRenderNodeRecordedPixelCount" to sourceRenderNodeRecordedPixels.get(),
        "sourceTreeTraversalCount" to routeTreeTraversals.get(),
        "regionRenderNodeRecordCount" to regionRenderNodeRecords.get(),
        "regionRenderNodeReuseCount" to regionRenderNodeReuses.get(),
        "regionRenderNodeRecordedPixelCount" to regionRenderNodeRecordedPixels.get(),
        "scrollWindowRefreshCount" to sourceWindowRefreshes.get(),
        "sourceWindowRecordedPixelCount" to sourceWindowRecordedPixels.get(),
        "scrollSampleOffsetUpdateCount" to scrollSampleOffsetUpdates.get(),
        "scrollWindowReuseFrameCount" to scrollWindowReuseFrames.get(),
        "routeScreenCompositeCount" to routeScreenComposites.get(),
        "routeScrollReuseCount" to routeScrollReuses.get(),
        "descendantInvalidationReceivedCount" to descendantInvalidationsReceived.get(),
        "descendantInvalidationCoalescedCount" to descendantInvalidationsCoalesced.get(),
        "scrollEventsReceivedCount" to scrollEventsReceived.get(),
        "glassFrameScheduledCount" to glassFramesScheduled.get(),
        "glassFrameExecutedCount" to glassFramesExecuted.get(),
        "consumerInvalidationExecutedCount" to consumerInvalidationsExecuted.get(),
        "settleCaptureExecutedCount" to settleCapturesExecuted.get(),
        "frozenSnapshotBlurRecordCount" to frozenSnapshotBlurRecords.get(),
        "frozenSnapshotRequestCount" to frozenSnapshotRequests.get(),
        "frozenSnapshotFailureCount" to frozenSnapshotFailures.get(),
        "backdropSampleCount" to backdropSamples.get(),
        "activeConsumerCount" to activeConsumerCount,
        "totalConsumerPixelArea" to totalConsumerPixelArea,
        "unionBoundingRectArea" to unionBoundingRectArea,
        "unionBoundingRectPercent" to unionPercent,
        )
    }

    private fun providerRectSummary(): String {
        if (!enabled) return "[]"
        return providerGeometry.entries.sortedBy { it.key }.joinToString(prefix = "[", postfix = "]", separator = ";") { (id, geometry) ->
            val rects = geometry.rects.joinToString(separator = "|") { "${it.left},${it.top},${it.right},${it.bottom}" }
            "$id:${geometry.width}x${geometry.height}:$rects"
        }
    }

    private fun providerCaptureSummary(): String {
        if (!enabled) return "[]"
        return providerCaptures.entries.sortedBy { it.key }.joinToString(prefix = "[", postfix = "]", separator = ";") { (id, capture) ->
            "$id:${capture.count.get()}x${capture.pixels.get()}:${capture.mode}"
        }
    }

    private fun delta(current: Map<String, Long>, previous: Map<String, Long>, key: String): Long =
        (current[key] ?: 0L) - (previous[key] ?: 0L)

    private fun reset() {
        requests.set(0L)
        sourceContentDirties.set(0L)
        consumerGeometryDirties.set(0L)
        opticsDirties.set(0L)
        materialDirties.set(0L)
        captures.set(0L)
        capturedPixels.set(0L)
        skippedNoIntersection.set(0L)
        skippedAlreadyDirty.set(0L)
        captureSchedules.set(0L)
        consumerDraws.set(0L)
        effectBuilds.set(0L)
        geometryLookups.set(0L)
        routeDraws.set(0L)
        routeTreeTraversals.set(0L)
        routeRenderNodeRecords.set(0L)
        sourceRenderNodeReuses.set(0L)
        sourceRenderNodeRecordedPixels.set(0L)
        regionRenderNodeRecords.set(0L)
        regionRenderNodeReuses.set(0L)
        regionRenderNodeRecordedPixels.set(0L)
        sourceWindowRefreshes.set(0L)
        sourceWindowRecordedPixels.set(0L)
        scrollSampleOffsetUpdates.set(0L)
        scrollWindowReuseFrames.set(0L)
        routeScreenComposites.set(0L)
        routeScrollReuses.set(0L)
        descendantInvalidationsReceived.set(0L)
        descendantInvalidationsCoalesced.set(0L)
        scrollEventsReceived.set(0L)
        glassFramesScheduled.set(0L)
        glassFramesExecuted.set(0L)
        consumerInvalidationsExecuted.set(0L)
        settleCapturesExecuted.set(0L)
        frozenSnapshotBlurRecords.set(0L)
        frozenSnapshotRequests.set(0L)
        frozenSnapshotFailures.set(0L)
        backdropSamples.set(0L)
        providerCaptures.clear()
    }
}

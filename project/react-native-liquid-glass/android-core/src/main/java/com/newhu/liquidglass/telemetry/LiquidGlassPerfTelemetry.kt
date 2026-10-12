package com.newhu.liquidglass.telemetry

import android.graphics.Rect
import android.os.Build
import android.os.Trace
import com.newhu.liquidglass.backdrop.GlassBackdropDirtyReason
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
    private val providerDirty = ConcurrentHashMap<String, ProviderDirtyCounters>()
    private val providerScroll = ConcurrentHashMap<String, ProviderScrollCounters>()
    private val scrollViewCounters = ConcurrentHashMap<String, ProviderScrollCounters>()
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

    private data class ProviderDirtyCounters(
        val paintDirtyReceived: AtomicLong = AtomicLong(),
        val structureDirtyReceived: AtomicLong = AtomicLong(),
        val sourceGeometryDirtyReceived: AtomicLong = AtomicLong(),
        val consumerGeometryDirtyReceived: AtomicLong = AtomicLong(),
        val opticsDirtyReceived: AtomicLong = AtomicLong(),
        val materialDirtyReceived: AtomicLong = AtomicLong(),
        val scrollDirtyReceived: AtomicLong = AtomicLong(),
        val scrollEventsReceived: AtomicLong = AtomicLong(),
        val sourceRerecordRequired: AtomicLong = AtomicLong(),
        val sourceRerecordAvoided: AtomicLong = AtomicLong(),
        val consumerRefreshOnly: AtomicLong = AtomicLong(),
        val sourceRerecordByStructure: AtomicLong = AtomicLong(),
        val sourceRerecordByGeometry: AtomicLong = AtomicLong(),
        val sourceRerecordByRevision: AtomicLong = AtomicLong(),
        val sourceRerecordByInitialCapture: AtomicLong = AtomicLong(),
        val sourceRerecordExecuted: AtomicLong = AtomicLong(),
        val scrollReuseFrame: AtomicLong = AtomicLong(),
        val scrollSettleRerecord: AtomicLong = AtomicLong(),
        val settleCaptureExecuted: AtomicLong = AtomicLong(),
    )

    private data class ProviderScrollCounters(
        val touchDownEvents: AtomicLong = AtomicLong(),
        val touchMoveEvents: AtomicLong = AtomicLong(),
        val touchUpEvents: AtomicLong = AtomicLong(),
        val touchCancelEvents: AtomicLong = AtomicLong(),
        val pendingTouchDownMs: AtomicLong = AtomicLong(),
        val offsetUpdateCount: AtomicLong = AtomicLong(),
        val offsetIntervalCount: AtomicLong = AtomicLong(),
        val offsetIntervalUnder8Ms: AtomicLong = AtomicLong(),
        val offsetInterval8To12Ms: AtomicLong = AtomicLong(),
        val offsetInterval12To17Ms: AtomicLong = AtomicLong(),
        val offsetIntervalOver17Ms: AtomicLong = AtomicLong(),
        val touchToOffsetLatencyCount: AtomicLong = AtomicLong(),
        val touchToOffsetLatencySumMs: AtomicLong = AtomicLong(),
        val touchToOffsetLatencyMaxMs: AtomicLong = AtomicLong(),
        val dragOffsetUpdateCount: AtomicLong = AtomicLong(),
        val frameSampleCount: AtomicLong = AtomicLong(),
        val frameOffsetChangedCount: AtomicLong = AtomicLong(),
        val frameRepeatedOffsetCount: AtomicLong = AtomicLong(),
        val frameIntervalUnder8Ms: AtomicLong = AtomicLong(),
        val frameInterval8To12Ms: AtomicLong = AtomicLong(),
        val frameInterval12To17Ms: AtomicLong = AtomicLong(),
        val frameIntervalOver17Ms: AtomicLong = AtomicLong(),
        val dragFrameSampleCount: AtomicLong = AtomicLong(),
        val dragFrameOffsetChangedCount: AtomicLong = AtomicLong(),
        val dragFrameRepeatedOffsetCount: AtomicLong = AtomicLong(),
        val lastOffsetUpdateMs: AtomicLong = AtomicLong(),
        val lastFrameTimeNs: AtomicLong = AtomicLong(),
    )

    fun setEnabled(value: Boolean) {
        enabled = value
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
    fun scrollEventReceived(providerId: String) {
        if (!enabled) return
        scrollEventsReceived.incrementAndGet()
        providerDirty.computeIfAbsent(providerId) { ProviderDirtyCounters() }.scrollEventsReceived.incrementAndGet()
    }

    /** MotionEvent eventTime uses the same uptime clock as the scroll observer. */
    fun scrollTouchDown(
        providerId: String,
        eventTimeMs: Long,
        viewKey: String? = null,
        dispatchUptimeMs: Long = eventTimeMs,
        rawX: Float = 0f,
        rawY: Float = 0f,
    ) {
        if (!enabled) return
        val counters = providerScroll.computeIfAbsent(providerId) { ProviderScrollCounters() }
        counters.touchDownEvents.incrementAndGet()
        counters.pendingTouchDownMs.set(eventTimeMs)
        val viewCounters = viewKey?.let { scrollViewCounters.computeIfAbsent(scrollViewCounterKey(providerId, it)) { ProviderScrollCounters() } }
        viewCounters?.touchDownEvents?.incrementAndGet()
        viewCounters?.pendingTouchDownMs?.set(eventTimeMs)
        recordTouchTrace(providerId, viewKey, 0, eventTimeMs, dispatchUptimeMs, rawX, rawY)
    }

    fun scrollTouchMove(
        providerId: String,
        viewKey: String?,
        eventTimeMs: Long,
        dispatchUptimeMs: Long,
        rawX: Float,
        rawY: Float,
    ) {
        if (!enabled) return
        providerScroll.computeIfAbsent(providerId) { ProviderScrollCounters() }.touchMoveEvents.incrementAndGet()
        viewKey?.let { scrollViewCounters.computeIfAbsent(scrollViewCounterKey(providerId, it)) { ProviderScrollCounters() } }
            ?.touchMoveEvents?.incrementAndGet()
        recordTouchTrace(providerId, viewKey, 1, eventTimeMs, dispatchUptimeMs, rawX, rawY)
    }

    fun scrollTouchEnd(
        providerId: String,
        viewKey: String?,
        cancelled: Boolean,
        eventTimeMs: Long,
        dispatchUptimeMs: Long,
        rawX: Float,
        rawY: Float,
    ) {
        if (!enabled) return
        val providerCounters = providerScroll.computeIfAbsent(providerId) { ProviderScrollCounters() }
        val viewCounters = viewKey?.let { scrollViewCounters.computeIfAbsent(scrollViewCounterKey(providerId, it)) { ProviderScrollCounters() } }
        // Ignore offsets arriving later from fling/settle when measuring
        // touch-to-first-offset latency. That metric belongs to this drag only.
        providerCounters.pendingTouchDownMs.set(0L)
        viewCounters?.pendingTouchDownMs?.set(0L)
        if (cancelled) {
            providerCounters.touchCancelEvents.incrementAndGet()
            viewCounters?.touchCancelEvents?.incrementAndGet()
        } else {
            providerCounters.touchUpEvents.incrementAndGet()
            viewCounters?.touchUpEvents?.incrementAndGet()
        }
        recordTouchTrace(providerId, viewKey, if (cancelled) 3 else 2, eventTimeMs, dispatchUptimeMs, rawX, rawY)
    }

    fun scrollOffsetUpdated(providerId: String, uptimeMs: Long, offsetX: Int, offsetY: Int) {
        scrollOffsetUpdated(providerId, null, uptimeMs, offsetX, offsetY)
    }

    fun scrollOffsetUpdated(
        providerId: String,
        viewKey: String?,
        uptimeMs: Long,
        offsetX: Int,
        offsetY: Int,
        touchActive: Boolean = false,
    ) {
        if (!enabled) return
        val counters = providerScroll.computeIfAbsent(providerId) { ProviderScrollCounters() }
        recordOffset(counters, uptimeMs, touchActive)
        val viewCounters = viewKey?.let { scrollViewCounters.computeIfAbsent(scrollViewCounterKey(providerId, it)) { ProviderScrollCounters() } }
        if (viewCounters != null) recordOffset(viewCounters, uptimeMs, touchActive)
        if (Build.VERSION.SDK_INT >= 29) {
            val traceId = providerId.replace(Regex("[^A-Za-z0-9_.-]"), "_")
            Trace.setCounter("NewHu.Scroll.$traceId.X", offsetX.toLong())
            Trace.setCounter("NewHu.Scroll.$traceId.Y", offsetY.toLong())
            if (viewKey != null) {
                val viewTraceId = "${traceSafe(providerId)}.${traceSafe(viewKey)}"
                Trace.setCounter("NewHu.ScrollView.$viewTraceId.X", offsetX.toLong())
                Trace.setCounter("NewHu.ScrollView.$viewTraceId.Y", offsetY.toLong())
            }
        }
    }

    fun scrollFrameSample(providerId: String, frameTimeNs: Long, offsetChanged: Boolean, touchActive: Boolean = false) {
        if (!enabled) return
        val counters = providerScroll.computeIfAbsent(providerId) { ProviderScrollCounters() }
        counters.frameSampleCount.incrementAndGet()
        if (offsetChanged) counters.frameOffsetChangedCount.incrementAndGet()
        else counters.frameRepeatedOffsetCount.incrementAndGet()
        val previousNs = counters.lastFrameTimeNs.getAndSet(frameTimeNs)
        if (previousNs > 0L && frameTimeNs >= previousNs) {
            val intervalMs = (frameTimeNs - previousNs) / 1_000_000L
            recordInterval(intervalMs, counters.frameIntervalUnder8Ms, counters.frameInterval8To12Ms,
                counters.frameInterval12To17Ms, counters.frameIntervalOver17Ms)
        }
        if (touchActive) {
            counters.dragFrameSampleCount.incrementAndGet()
            if (offsetChanged) counters.dragFrameOffsetChangedCount.incrementAndGet()
            else counters.dragFrameRepeatedOffsetCount.incrementAndGet()
        }
        if (Build.VERSION.SDK_INT >= 29) {
            Trace.setCounter("NewHu.ScrollFrame.${providerId.replace(Regex("[^A-Za-z0-9_.-]"), "_")}.changed", if (offsetChanged) 1L else 0L)
        }
    }

    fun scrollViewFrameSample(
        providerId: String,
        viewKey: String,
        frameTimeNs: Long,
        offsetChanged: Boolean,
        touchActive: Boolean,
    ) {
        if (!enabled) return
        val counters = scrollViewCounters.computeIfAbsent(scrollViewCounterKey(providerId, viewKey)) { ProviderScrollCounters() }
        counters.frameSampleCount.incrementAndGet()
        if (offsetChanged) counters.frameOffsetChangedCount.incrementAndGet()
        else counters.frameRepeatedOffsetCount.incrementAndGet()
        val previousNs = counters.lastFrameTimeNs.getAndSet(frameTimeNs)
        if (previousNs > 0L && frameTimeNs >= previousNs) {
            val intervalMs = (frameTimeNs - previousNs) / 1_000_000L
            recordInterval(intervalMs, counters.frameIntervalUnder8Ms, counters.frameInterval8To12Ms,
                counters.frameInterval12To17Ms, counters.frameIntervalOver17Ms)
        }
        if (touchActive) {
            counters.dragFrameSampleCount.incrementAndGet()
            if (offsetChanged) counters.dragFrameOffsetChangedCount.incrementAndGet()
            else counters.dragFrameRepeatedOffsetCount.incrementAndGet()
        }
        if (Build.VERSION.SDK_INT >= 29) {
            val traceId = "${traceSafe(providerId)}.${traceSafe(viewKey)}"
            Trace.setCounter("NewHu.ScrollFrameView.$traceId.changed", if (offsetChanged) 1L else 0L)
        }
    }

    private fun recordOffset(counters: ProviderScrollCounters, uptimeMs: Long, touchActive: Boolean) {
        counters.offsetUpdateCount.incrementAndGet()
        val previous = counters.lastOffsetUpdateMs.getAndSet(uptimeMs)
        if (previous > 0L && uptimeMs >= previous) {
            counters.offsetIntervalCount.incrementAndGet()
            recordInterval(uptimeMs - previous, counters.offsetIntervalUnder8Ms, counters.offsetInterval8To12Ms,
                counters.offsetInterval12To17Ms, counters.offsetIntervalOver17Ms)
        }
        val touchDownMs = counters.pendingTouchDownMs.getAndSet(0L)
        if (touchDownMs > 0L && uptimeMs >= touchDownMs) {
            val latency = uptimeMs - touchDownMs
            counters.touchToOffsetLatencyCount.incrementAndGet()
            counters.touchToOffsetLatencySumMs.addAndGet(latency)
            counters.touchToOffsetLatencyMaxMs.accumulateAndGet(latency, Math::max)
        }
        if (touchActive) counters.dragOffsetUpdateCount.incrementAndGet()
    }

    private fun recordTouchTrace(
        providerId: String,
        viewKey: String?,
        action: Int,
        eventTimeMs: Long,
        dispatchUptimeMs: Long,
        rawX: Float,
        rawY: Float,
    ) {
        if (Build.VERSION.SDK_INT < 29) return
        val traceId = "${traceSafe(providerId)}.${traceSafe(viewKey ?: "noTarget")}"
        Trace.setCounter("NewHu.ScrollTouch.$traceId.action", action.toLong())
        Trace.setCounter("NewHu.ScrollTouch.$traceId.eventTimeMs", eventTimeMs)
        Trace.setCounter("NewHu.ScrollTouch.$traceId.dispatchUptimeMs", dispatchUptimeMs)
        Trace.setCounter("NewHu.ScrollTouch.$traceId.x", rawX.toLong())
        Trace.setCounter("NewHu.ScrollTouch.$traceId.y", rawY.toLong())
    }

    private fun scrollViewCounterKey(providerId: String, viewKey: String): String = "$providerId|$viewKey"

    private fun traceSafe(value: String): String = value.replace(Regex("[^A-Za-z0-9_.-]"), "_")

    private fun recordInterval(
        intervalMs: Long,
        under8: AtomicLong,
        from8To12: AtomicLong,
        from12To17: AtomicLong,
        over17: AtomicLong,
    ) {
        when {
            intervalMs < 8L -> under8.incrementAndGet()
            intervalMs < 12L -> from8To12.incrementAndGet()
            intervalMs < 17L -> from12To17.incrementAndGet()
            else -> over17.incrementAndGet()
        }
    }
    fun dirtyReceived(providerId: String, reason: GlassBackdropDirtyReason) {
        if (!enabled) return
        val counters = providerDirty.computeIfAbsent(providerId) { ProviderDirtyCounters() }
        when (reason) {
            GlassBackdropDirtyReason.SOURCE_PAINT -> {
                sourceContentDirties.incrementAndGet()
                counters.paintDirtyReceived.incrementAndGet()
            }
            GlassBackdropDirtyReason.SOURCE_STRUCTURE -> counters.structureDirtyReceived.incrementAndGet()
            GlassBackdropDirtyReason.SOURCE_GEOMETRY -> counters.sourceGeometryDirtyReceived.incrementAndGet()
            GlassBackdropDirtyReason.CONSUMER_GEOMETRY -> {
                consumerGeometryDirties.incrementAndGet()
                counters.consumerGeometryDirtyReceived.incrementAndGet()
            }
            GlassBackdropDirtyReason.OPTICS -> {
                opticsDirties.incrementAndGet()
                counters.opticsDirtyReceived.incrementAndGet()
            }
            GlassBackdropDirtyReason.MATERIAL -> {
                materialDirties.incrementAndGet()
                counters.materialDirtyReceived.incrementAndGet()
            }
            GlassBackdropDirtyReason.SCROLL -> counters.scrollDirtyReceived.incrementAndGet()
            GlassBackdropDirtyReason.SOURCE_REVISION,
            GlassBackdropDirtyReason.INITIAL_CAPTURE -> Unit
        }
    }
    fun sourceRerecordRequired(providerId: String) {
        if (enabled) providerDirty.computeIfAbsent(providerId) { ProviderDirtyCounters() }.sourceRerecordRequired.incrementAndGet()
    }
    fun sourceRerecordAvoided(providerId: String, count: Long = 1L) {
        if (enabled && count > 0L) {
            providerDirty.computeIfAbsent(providerId) { ProviderDirtyCounters() }.sourceRerecordAvoided.addAndGet(count)
        }
    }
    fun sourceRerecordExecuted(providerId: String, reasons: Collection<GlassBackdropDirtyReason>) {
        if (!enabled) return
        val counters = providerDirty.computeIfAbsent(providerId) { ProviderDirtyCounters() }
        counters.sourceRerecordExecuted.incrementAndGet()
        for (reason in reasons) {
            when (reason) {
                GlassBackdropDirtyReason.SOURCE_STRUCTURE -> counters.sourceRerecordByStructure.incrementAndGet()
                GlassBackdropDirtyReason.SOURCE_GEOMETRY -> counters.sourceRerecordByGeometry.incrementAndGet()
                GlassBackdropDirtyReason.SOURCE_REVISION -> counters.sourceRerecordByRevision.incrementAndGet()
                GlassBackdropDirtyReason.INITIAL_CAPTURE -> counters.sourceRerecordByInitialCapture.incrementAndGet()
                else -> Unit
            }
        }
    }
    fun consumerRefreshOnly(providerId: String) {
        if (enabled) providerDirty.computeIfAbsent(providerId) { ProviderDirtyCounters() }.consumerRefreshOnly.incrementAndGet()
    }
    fun scrollReuseFrame(providerId: String) {
        if (enabled) providerDirty.computeIfAbsent(providerId) { ProviderDirtyCounters() }.scrollReuseFrame.incrementAndGet()
    }
    fun scrollSettleRerecord(providerId: String) {
        if (enabled) providerDirty.computeIfAbsent(providerId) { ProviderDirtyCounters() }.scrollSettleRerecord.incrementAndGet()
    }
    fun settleCaptureExecuted(providerId: String) {
        if (enabled) {
            settleCapturesExecuted.incrementAndGet()
            providerDirty.computeIfAbsent(providerId) { ProviderDirtyCounters() }.settleCaptureExecuted.incrementAndGet()
        }
    }
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
        val aggregate = mapOf(
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
        val providerCounters = LinkedHashMap<String, Long>()
        providerDirty.entries.sortedBy { it.key }.forEach { (id, value) ->
            val prefix = "provider.$id."
            providerCounters[prefix + "paintDirtyReceived"] = value.paintDirtyReceived.get()
            providerCounters[prefix + "structureDirtyReceived"] = value.structureDirtyReceived.get()
            providerCounters[prefix + "sourceGeometryDirtyReceived"] = value.sourceGeometryDirtyReceived.get()
            providerCounters[prefix + "consumerGeometryDirtyReceived"] = value.consumerGeometryDirtyReceived.get()
            providerCounters[prefix + "opticsDirtyReceived"] = value.opticsDirtyReceived.get()
            providerCounters[prefix + "materialDirtyReceived"] = value.materialDirtyReceived.get()
            providerCounters[prefix + "scrollDirtyReceived"] = value.scrollDirtyReceived.get()
            providerCounters[prefix + "scrollEventsReceived"] = value.scrollEventsReceived.get()
            providerCounters[prefix + "sourceRerecordRequired"] = value.sourceRerecordRequired.get()
            providerCounters[prefix + "sourceRerecordAvoided"] = value.sourceRerecordAvoided.get()
            providerCounters[prefix + "consumerRefreshOnly"] = value.consumerRefreshOnly.get()
            providerCounters[prefix + "sourceRerecordByStructure"] = value.sourceRerecordByStructure.get()
            providerCounters[prefix + "sourceRerecordByGeometry"] = value.sourceRerecordByGeometry.get()
            providerCounters[prefix + "sourceRerecordByRevision"] = value.sourceRerecordByRevision.get()
            providerCounters[prefix + "sourceRerecordByInitialCapture"] = value.sourceRerecordByInitialCapture.get()
            providerCounters[prefix + "sourceRerecordExecuted"] = value.sourceRerecordExecuted.get()
            providerCounters[prefix + "scrollReuseFrame"] = value.scrollReuseFrame.get()
            providerCounters[prefix + "scrollSettleRerecord"] = value.scrollSettleRerecord.get()
            providerCounters[prefix + "settleCaptureExecuted"] = value.settleCaptureExecuted.get()
        }
        val scrollTotals = linkedMapOf<String, Long>()
        val scrollFields = listOf(
            "touchDownEvents", "touchMoveEvents", "touchUpEvents", "touchCancelEvents",
            "offsetUpdateCount", "offsetIntervalCount", "offsetIntervalUnder8Ms",
            "offsetInterval8To12Ms", "offsetInterval12To17Ms", "offsetIntervalOver17Ms",
            "touchToOffsetLatencyCount", "touchToOffsetLatencySumMs", "touchToOffsetLatencyMaxMs",
            "dragOffsetUpdateCount",
            "frameSampleCount", "frameOffsetChangedCount", "frameRepeatedOffsetCount",
            "frameIntervalUnder8Ms", "frameInterval8To12Ms", "frameInterval12To17Ms", "frameIntervalOver17Ms",
            "dragFrameSampleCount", "dragFrameOffsetChangedCount", "dragFrameRepeatedOffsetCount",
        )
        for (field in scrollFields) scrollTotals["scroll${field.replaceFirstChar { it.uppercase() }}"] = 0L
        providerScroll.entries.sortedBy { it.key }.forEach { (id, value) ->
            val fields = mapOf(
                "touchDownEvents" to value.touchDownEvents.get(),
                "touchMoveEvents" to value.touchMoveEvents.get(),
                "touchUpEvents" to value.touchUpEvents.get(),
                "touchCancelEvents" to value.touchCancelEvents.get(),
                "offsetUpdateCount" to value.offsetUpdateCount.get(),
                "offsetIntervalCount" to value.offsetIntervalCount.get(),
                "offsetIntervalUnder8Ms" to value.offsetIntervalUnder8Ms.get(),
                "offsetInterval8To12Ms" to value.offsetInterval8To12Ms.get(),
                "offsetInterval12To17Ms" to value.offsetInterval12To17Ms.get(),
                "offsetIntervalOver17Ms" to value.offsetIntervalOver17Ms.get(),
                "touchToOffsetLatencyCount" to value.touchToOffsetLatencyCount.get(),
                "touchToOffsetLatencySumMs" to value.touchToOffsetLatencySumMs.get(),
                "touchToOffsetLatencyMaxMs" to value.touchToOffsetLatencyMaxMs.get(),
                "dragOffsetUpdateCount" to value.dragOffsetUpdateCount.get(),
                "frameSampleCount" to value.frameSampleCount.get(),
                "frameOffsetChangedCount" to value.frameOffsetChangedCount.get(),
                "frameRepeatedOffsetCount" to value.frameRepeatedOffsetCount.get(),
                "frameIntervalUnder8Ms" to value.frameIntervalUnder8Ms.get(),
                "frameInterval8To12Ms" to value.frameInterval8To12Ms.get(),
                "frameInterval12To17Ms" to value.frameInterval12To17Ms.get(),
                "frameIntervalOver17Ms" to value.frameIntervalOver17Ms.get(),
                "dragFrameSampleCount" to value.dragFrameSampleCount.get(),
                "dragFrameOffsetChangedCount" to value.dragFrameOffsetChangedCount.get(),
                "dragFrameRepeatedOffsetCount" to value.dragFrameRepeatedOffsetCount.get(),
            )
            val prefix = "provider.$id."
            fields.forEach { (field, count) ->
                val snapshotField = "scroll${field.replaceFirstChar { it.uppercase() }}"
                providerCounters[prefix + snapshotField] = count
                scrollTotals[snapshotField] = (scrollTotals[snapshotField] ?: 0L) + count
            }
        }
        scrollViewCounters.entries.sortedBy { it.key }.forEach { (key, value) ->
            val separator = key.indexOf('|')
            if (separator <= 0 || separator == key.lastIndex) return@forEach
            val providerId = key.substring(0, separator)
            val viewKey = key.substring(separator + 1)
            val prefix = "scrollView.$providerId.$viewKey."
            providerCounters[prefix + "touchDownEvents"] = value.touchDownEvents.get()
            providerCounters[prefix + "touchMoveEvents"] = value.touchMoveEvents.get()
            providerCounters[prefix + "touchUpEvents"] = value.touchUpEvents.get()
            providerCounters[prefix + "touchCancelEvents"] = value.touchCancelEvents.get()
            providerCounters[prefix + "offsetUpdateCount"] = value.offsetUpdateCount.get()
            providerCounters[prefix + "offsetIntervalCount"] = value.offsetIntervalCount.get()
            providerCounters[prefix + "offsetIntervalUnder8Ms"] = value.offsetIntervalUnder8Ms.get()
            providerCounters[prefix + "offsetInterval8To12Ms"] = value.offsetInterval8To12Ms.get()
            providerCounters[prefix + "offsetInterval12To17Ms"] = value.offsetInterval12To17Ms.get()
            providerCounters[prefix + "offsetIntervalOver17Ms"] = value.offsetIntervalOver17Ms.get()
            providerCounters[prefix + "touchToOffsetLatencyCount"] = value.touchToOffsetLatencyCount.get()
            providerCounters[prefix + "touchToOffsetLatencySumMs"] = value.touchToOffsetLatencySumMs.get()
            providerCounters[prefix + "touchToOffsetLatencyMaxMs"] = value.touchToOffsetLatencyMaxMs.get()
            providerCounters[prefix + "dragOffsetUpdateCount"] = value.dragOffsetUpdateCount.get()
            providerCounters[prefix + "frameSampleCount"] = value.frameSampleCount.get()
            providerCounters[prefix + "frameOffsetChangedCount"] = value.frameOffsetChangedCount.get()
            providerCounters[prefix + "frameRepeatedOffsetCount"] = value.frameRepeatedOffsetCount.get()
            providerCounters[prefix + "frameIntervalUnder8Ms"] = value.frameIntervalUnder8Ms.get()
            providerCounters[prefix + "frameInterval8To12Ms"] = value.frameInterval8To12Ms.get()
            providerCounters[prefix + "frameInterval12To17Ms"] = value.frameInterval12To17Ms.get()
            providerCounters[prefix + "frameIntervalOver17Ms"] = value.frameIntervalOver17Ms.get()
            providerCounters[prefix + "dragFrameSampleCount"] = value.dragFrameSampleCount.get()
            providerCounters[prefix + "dragFrameOffsetChangedCount"] = value.dragFrameOffsetChangedCount.get()
            providerCounters[prefix + "dragFrameRepeatedOffsetCount"] = value.dragFrameRepeatedOffsetCount.get()
        }
        val dirtyTotals = mapOf(
            "paintDirtyReceived" to providerDirty.values.sumOf { it.paintDirtyReceived.get() },
            "structureDirtyReceived" to providerDirty.values.sumOf { it.structureDirtyReceived.get() },
            "sourceGeometryDirtyReceived" to providerDirty.values.sumOf { it.sourceGeometryDirtyReceived.get() },
            "consumerGeometryDirtyReceived" to providerDirty.values.sumOf { it.consumerGeometryDirtyReceived.get() },
            "opticsDirtyReceived" to providerDirty.values.sumOf { it.opticsDirtyReceived.get() },
            "materialDirtyReceived" to providerDirty.values.sumOf { it.materialDirtyReceived.get() },
            "scrollDirtyReceived" to providerDirty.values.sumOf { it.scrollDirtyReceived.get() },
            "scrollEventsReceivedByProvider" to providerDirty.values.sumOf { it.scrollEventsReceived.get() },
            "sourceRerecordRequired" to providerDirty.values.sumOf { it.sourceRerecordRequired.get() },
            "sourceRerecordAvoided" to providerDirty.values.sumOf { it.sourceRerecordAvoided.get() },
            "consumerRefreshOnly" to providerDirty.values.sumOf { it.consumerRefreshOnly.get() },
            "sourceRerecordByStructure" to providerDirty.values.sumOf { it.sourceRerecordByStructure.get() },
            "sourceRerecordByGeometry" to providerDirty.values.sumOf { it.sourceRerecordByGeometry.get() },
            "sourceRerecordByRevision" to providerDirty.values.sumOf { it.sourceRerecordByRevision.get() },
            "sourceRerecordByInitialCapture" to providerDirty.values.sumOf { it.sourceRerecordByInitialCapture.get() },
            "sourceRerecordExecuted" to providerDirty.values.sumOf { it.sourceRerecordExecuted.get() },
            "scrollReuseFrame" to providerDirty.values.sumOf { it.scrollReuseFrame.get() },
            "scrollSettleRerecord" to providerDirty.values.sumOf { it.scrollSettleRerecord.get() },
        )
        return aggregate + dirtyTotals + scrollTotals + providerCounters
    }

}

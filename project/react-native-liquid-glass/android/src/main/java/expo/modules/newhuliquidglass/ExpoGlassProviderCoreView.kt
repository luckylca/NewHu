package expo.modules.newhuliquidglass

import android.content.Context
import android.graphics.Canvas
import android.graphics.Rect
import android.graphics.RenderNode
import android.os.Build
import android.os.Looper
import android.view.View
import android.view.MotionEvent
import android.view.ViewGroup
import android.widget.ScrollView
import com.newhu.liquidglass.backdrop.BackdropRecorder
import com.newhu.liquidglass.backdrop.GlassBackdropCoordinator
import com.newhu.liquidglass.backdrop.GlassBackdropCoordinatorHost
import com.newhu.liquidglass.backdrop.GlassBackdropDirtyReason
import com.newhu.liquidglass.backdrop.FrozenBackdrop
import com.newhu.liquidglass.backdrop.LiquidGlassBackdropSource
import com.newhu.liquidglass.telemetry.LiquidGlassPerfTelemetry
import com.newhu.liquidglass.telemetry.LiquidGlassTrace
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView
import java.util.IdentityHashMap

internal class ExpoGlassProviderCoreView(
    context: Context,
    appContext: AppContext,
) : ExpoView(context, appContext), LiquidGlassBackdropSource, GlassBackdropCoordinatorHost {
    private val recorder = BackdropRecorder()
    private val sourceLocation = IntArray(2)
    private val consumerLocation = IntArray(2)
    private val consumerBounds = IdentityHashMap<View, Rect>()
    private var frozenBackdrop: FrozenBackdrop? = null
    private var backdropDirty = true
    private var oneShotCaptured = false
    private var scrollWindowCapturePending = false
    private var scrollWindowCaptureActive = false
    private var scrollWindowBounds: Rect? = null
    private var recordedScrollOffsetY = 0
    private val consumerLayoutListener = View.OnLayoutChangeListener { consumer, _, _, _, _, _, _, _, _ ->
        updateConsumerBounds(consumer)
    }
    private val directChildBounds = IdentityHashMap<View, Rect>()
    private val directChildLayoutListener = View.OnLayoutChangeListener { child, left, top, right, bottom, _, _, _, _ ->
        val next = Rect(left, top, right, bottom)
        val previous = directChildBounds.put(child, next)
        if (previous != next && shouldCapture()) {
            coordinator.markDirty(GlassBackdropDirtyReason.SOURCE_GEOMETRY)
        }
    }

    var providerId: String = "default"
        set(value) {
            if (field == value) return
            if (isAttachedToWindow) {
                CoreLiquidGlassRegistry.unregisterProvider(field, this)
                LiquidGlassPerfTelemetry.removeProviderGeometry(field)
            }
            field = value
            if (isAttachedToWindow) {
                CoreLiquidGlassRegistry.registerProvider(value, this)
                reportProviderGeometry()
            }
        }

    var underlayProviderId: String? = null
        set(value) {
            if (field == value) return
            field = value
            if (shouldCapture()) coordinator.markDirty(GlassBackdropDirtyReason.SOURCE_REVISION)
        }

    var captureMode: String = "live"
        set(value) {
            if (field == value) return
            field = value
            when (value) {
                "oneShot", "oneShotPassThrough" -> {
                    coordinator.cancel(clearSourceDirties = true)
                    oneShotCaptured = false
                    resetScrollWindow()
                    frozenBackdrop?.release()
                    frozenBackdrop = null
                    updateScrollObservation()
                    coordinator.markDirty(GlassBackdropDirtyReason.INITIAL_CAPTURE)
                }
                "frozen" -> {
                    coordinator.cancel(clearSourceDirties = true)
                    resetScrollWindow()
                    backdropDirty = false
                    oneShotCaptured = true
                    updateScrollObservation()
                }
                "static" -> {
                    coordinator.cancel(clearSourceDirties = true)
                    resetScrollWindow()
                    if (!recorder.hasRecording) coordinator.markDirty(GlassBackdropDirtyReason.INITIAL_CAPTURE)
                    updateScrollObservation()
                }
                else -> {
                    coordinator.cancel(clearSourceDirties = true)
                    resetScrollWindow()
                    oneShotCaptured = false
                    frozenBackdrop?.release()
                    frozenBackdrop = null
                    updateScrollObservation()
                    if (recorder.hasConsumers) coordinator.markDirty(GlassBackdropDirtyReason.SOURCE_REVISION)
                }
            }
        }

    var snapshotBlurRadiusDp: Float = 0f
        set(value) {
            val next = value.coerceAtLeast(0f)
            if (field == next) return
            field = next
            if (captureMode == "oneShot" || captureMode == "oneShotPassThrough") {
                oneShotCaptured = false
                coordinator.markDirty(GlassBackdropDirtyReason.SOURCE_REVISION)
            }
        }

    var sourceRevision: String? = null
        set(value) {
            if (field == value) return
            field = value
            if (captureMode == "oneShot" || captureMode == "oneShotPassThrough") oneShotCaptured = false
            if (shouldCapture()) coordinator.markDirty(GlassBackdropDirtyReason.SOURCE_REVISION)
        }

    private val coordinator = GlassBackdropCoordinator(
        sourceView = this,
        providerId = { providerId },
        host = this,
    )

    override val hasBackdropConsumers: Boolean
        get() = recorder.hasConsumers

    fun setDetailedScrollTelemetryEnabled(enabled: Boolean) {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            coordinator.setDetailedScrollTelemetryEnabled(enabled)
        } else {
            post { coordinator.setDetailedScrollTelemetryEnabled(enabled) }
        }
    }

    override fun dispatchTouchEvent(event: MotionEvent): Boolean {
        coordinator.onMotionEvent(event)
        return super.dispatchTouchEvent(event)
    }

    override val canCaptureBackdrop: Boolean
        get() = isAttachedToWindow && shouldCapture() && width > 0 && height > 0

    override val sourceView: View
        get() = this

    override fun requestBackdropSourceRecord() {
        val tracing = LiquidGlassTrace.isEnabled()
        if (tracing) LiquidGlassTrace.beginSection("Provider.requestBackdropSourceRecord")
        try {
            if (tracing) LiquidGlassTrace.counter("${traceProviderId()}.requestSourceRecord", 1L)
            if (!canCaptureBackdrop) {
                coordinator.sourceRecordDeferred()
                return
            }
            backdropDirty = true
            postInvalidateOnAnimation()
        } finally {
            if (tracing) LiquidGlassTrace.endSection()
        }
    }

    override fun refreshBackdropConsumers() {
        recorder.invalidateConsumers()
    }

    override fun onBackdropScrollReuseFrame() {
        val tracing = LiquidGlassTrace.isEnabled()
        if (tracing) LiquidGlassTrace.beginSection("Provider.onBackdropScrollReuseFrame")
        try {
        LiquidGlassPerfTelemetry.routeScrollReuse()
        val scroll = findVerticalScrollView(this)
        if (tracing) {
            LiquidGlassTrace.counter("${traceProviderId()}.scrollY", scroll?.scrollY?.toLong() ?: -1L)
            LiquidGlassTrace.counter("${traceProviderId()}.scrollRangeY", scroll?.let { maxOf(0, (it.getChildAt(0)?.height ?: it.height) - it.height).toLong() } ?: -1L)
            LiquidGlassTrace.counter("${traceProviderId()}.scrollWindowActive", if (scrollWindowCaptureActive) 1L else 0L)
            LiquidGlassTrace.counter("${traceProviderId()}.scrollWindowPending", if (scrollWindowCapturePending) 1L else 0L)
        }
        if (captureMode == "oneShotPassThrough" && scroll != null && consumerBounds.isNotEmpty() && width > 0 && height > 0) {
            val scrollOffsetY = scroll.scrollY
            if (!scrollWindowCaptureActive || shouldRecordScrollWindow(scrollOffsetY)) {
                if (!scrollWindowCaptureActive) recorder.clearConsumerRegions()
                scrollWindowCapturePending = true
                backdropDirty = true
                postInvalidateOnAnimation()
            } else {
                recorder.invalidateConsumers()
            }
        } else {
            recorder.invalidateConsumers()
        }
        } finally {
            if (tracing) LiquidGlassTrace.endSection()
        }
    }

    override val contentRenderNode: RenderNode?
        get() = frozenBackdrop?.contentRenderNode ?: recorder.contentNode

    override val hasRecording: Boolean
        get() = contentRenderNode?.hasDisplayList() == true

    override val requiresCaptureOnConsumerMovement: Boolean
        get() = false

    override val recordedOriginX: Int
        get() = recorder.originX

    override val recordedOriginY: Int
        get() = recorder.originY

    override fun renderNodeFor(consumer: View): RenderNode? =
        recorder.regionNodeFor(consumer) ?: contentRenderNode

    override fun recordedOriginXFor(consumer: View): Int = recorder.recordedOriginXFor(consumer)

    override fun recordedOriginYFor(consumer: View): Int {
        if (!scrollWindowCaptureActive) return recorder.recordedOriginYFor(consumer)
        return recorder.originY - (currentVerticalScrollOffsetY() - recordedScrollOffsetY)
    }

    override fun registerConsumer(consumer: View) {
        val hadRecording = hasRecording
        recorder.register(consumer)
        if (!consumerBounds.containsKey(consumer)) consumer.addOnLayoutChangeListener(consumerLayoutListener)
        updateConsumerBounds(consumer)
        coordinator.refreshScrollTargets()
        updateScrollObservation()
        if (!hadRecording && captureMode != "frozen") coordinator.markDirty(GlassBackdropDirtyReason.INITIAL_CAPTURE)
    }

    override fun unregisterConsumer(consumer: View) {
        recorder.unregister(consumer)
        consumer.removeOnLayoutChangeListener(consumerLayoutListener)
        consumerBounds.remove(consumer)
        reportProviderGeometry()
        updateScrollObservation()
        if (!recorder.hasConsumers) {
            coordinator.cancel(clearSourceDirties = true)
            if (captureMode != "static") {
                backdropDirty = false
                recorder.release()
                frozenBackdrop?.release()
                frozenBackdrop = null
                LiquidGlassPerfTelemetry.removeProviderGeometry(providerId)
            }
        } else {
            reportProviderGeometry()
        }
    }

    override fun requestCaptureFrame() {
        if (shouldCapture()) coordinator.markDirty(GlassBackdropDirtyReason.SOURCE_PAINT)
    }

    override fun onConsumerGeometryChanged(consumer: View) {
        updateConsumerBounds(consumer)
    }

    override fun onConsumerDirty(consumer: View, reason: GlassBackdropDirtyReason) {
        coordinator.markDirty(reason, consumerAlreadyInvalidated = true)
    }

    fun setCaptureModeImperatively(mode: String) {
        val tracing = LiquidGlassTrace.isEnabled()
        if (tracing) LiquidGlassTrace.beginSection("Provider.imperativeCaptureMode")
        try {
            if (tracing) {
                LiquidGlassTrace.counter("${traceProviderId()}.imperativeRequestedModeHash", mode.hashCode().toLong())
                LiquidGlassTrace.counter("${traceProviderId()}.imperativeCurrentModeHash", captureMode.hashCode().toLong())
            }
            // Route transition controls target the route host and all its child
            // providers. Keep this explicitly configured source in pass-through
            // mode so its ScrollView always draws through the native view tree.
            if (captureMode == "oneShotPassThrough") {
                if (tracing) LiquidGlassTrace.counter("${traceProviderId()}.imperativePreservedPassThrough", 1L)
                return
            }
            if (mode in setOf("live", "static", "oneShot", "oneShotPassThrough", "frozen")) captureMode = mode
        } finally {
            if (tracing) LiquidGlassTrace.endSection()
        }
    }

    fun prepareFrozenBackdropImperatively(blurRadiusDp: Float) {
        if (captureMode == "oneShotPassThrough") {
            if (LiquidGlassTrace.isEnabled()) {
                LiquidGlassTrace.counter("${traceProviderId()}.prepareFrozenPreservedPassThrough", 1L)
            }
            return
        }
        if (Build.VERSION.SDK_INT < 31 || !isAttachedToWindow || !recorder.hasRecording) {
            LiquidGlassPerfTelemetry.frozenSnapshotRequested()
            LiquidGlassPerfTelemetry.frozenSnapshotFailed()
            captureMode = "oneShot"
            return
        }
        LiquidGlassPerfTelemetry.frozenSnapshotRequested()
        val next = runCatching { FrozenBackdrop(this, providerId, blurRadiusDp) }
            .onSuccess { LiquidGlassPerfTelemetry.frozenSnapshotBlurRecorded() }
            .onFailure { LiquidGlassPerfTelemetry.frozenSnapshotFailed() }
            .getOrNull()
        if (next == null) {
            captureMode = "oneShot"
            return
        }
        frozenBackdrop?.release()
        frozenBackdrop = next
        backdropDirty = false
        oneShotCaptured = true
        captureMode = "frozen"
        updateConsumerRegions(next.contentRenderNode)
        recorder.invalidateConsumers()
        invalidate()
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        CoreLiquidGlassRegistry.registerProvider(providerId, this)
        if (captureMode == "oneShot" || captureMode == "oneShotPassThrough") oneShotCaptured = false
        if (captureMode == "frozen" && recorder.hasConsumers && !recorder.hasRecording) captureMode = "oneShot"
        updateScrollObservation()
        coordinator.refreshScrollTargets()
        if (recorder.hasConsumers && shouldCapture() && !recorder.hasRecording) {
            coordinator.markDirty(GlassBackdropDirtyReason.INITIAL_CAPTURE)
        }
    }

    override fun onDetachedFromWindow() {
        CoreLiquidGlassRegistry.unregisterProvider(providerId, this)
        coordinator.setScrollObservationEnabled(false)
        coordinator.cancel(clearSourceDirties = true)
        frozenBackdrop?.release()
        frozenBackdrop = null
        backdropDirty = false
        oneShotCaptured = false
        LiquidGlassPerfTelemetry.removeProviderGeometry(providerId)
        recorder.release()
        resetScrollWindow()
        super.onDetachedFromWindow()
    }

    override fun onSizeChanged(width: Int, height: Int, oldWidth: Int, oldHeight: Int) {
        super.onSizeChanged(width, height, oldWidth, oldHeight)
        if (shouldCapture() && width > 0 && height > 0 &&
            (width != oldWidth || height != oldHeight)
        ) {
            coordinator.markDirty(GlassBackdropDirtyReason.SOURCE_GEOMETRY)
            updateScrollObservation()
        }
    }

    override fun onDescendantInvalidated(child: View, target: View) {
        if (shouldCapture() && recorder.hasConsumers) {
            LiquidGlassPerfTelemetry.descendantInvalidationReceived()
            if (!recorder.isConsumerSubtree(target, this)) {
                coordinator.markDirty(GlassBackdropDirtyReason.SOURCE_PAINT)
            }
        }
        super.onDescendantInvalidated(child, target)
    }

    override fun onViewAdded(child: View) {
        super.onViewAdded(child)
        directChildBounds[child] = Rect(child.left, child.top, child.right, child.bottom)
        child.addOnLayoutChangeListener(directChildLayoutListener)
        coordinator.refreshScrollTargets()
        if (shouldCapture()) {
            coordinator.markDirty(GlassBackdropDirtyReason.SOURCE_STRUCTURE)
        }
    }

    override fun onViewRemoved(child: View) {
        child.removeOnLayoutChangeListener(directChildLayoutListener)
        directChildBounds.remove(child)
        super.onViewRemoved(child)
        coordinator.refreshScrollTargets()
        if (shouldCapture()) {
            coordinator.markDirty(GlassBackdropDirtyReason.SOURCE_STRUCTURE)
        }
    }

    override fun dispatchDraw(canvas: Canvas) {
        val tracing = LiquidGlassTrace.isEnabled()
        if (!tracing) {
            dispatchProviderChildren(canvas)
            return
        }
        LiquidGlassTrace.beginSection("Provider.dispatchDraw")
        try {
            LiquidGlassTrace.counter("${traceProviderId()}.dispatchDrawScrollY", currentVerticalScrollOffsetY().toLong())
            LiquidGlassTrace.counter("${traceProviderId()}.dispatchDrawScrollWindowPending", if (scrollWindowCapturePending) 1L else 0L)
            LiquidGlassTrace.counter("${traceProviderId()}.dispatchDrawScrollWindowActive", if (scrollWindowCaptureActive) 1L else 0L)
            LiquidGlassTrace.counter("${traceProviderId()}.dispatchDrawHasRecording", if (recorder.hasRecording) 1L else 0L)
            LiquidGlassTrace.counter("${traceProviderId()}.dispatchDrawChildren", childCount.toLong())
            dispatchProviderChildren(canvas)
        } finally {
            LiquidGlassTrace.endSection()
        }
    }

    private fun dispatchProviderChildren(canvas: Canvas) {
        val tracing = LiquidGlassTrace.isEnabled()
        if (tracing) {
            val prefix = traceProviderId()
            LiquidGlassTrace.counter("$prefix.drawCaptureModeHash", captureMode.hashCode().toLong())
            LiquidGlassTrace.counter("$prefix.drawHasConsumers", if (recorder.hasConsumers) 1L else 0L)
            LiquidGlassTrace.counter("$prefix.drawBackdropDirty", if (backdropDirty) 1L else 0L)
        }
        LiquidGlassPerfTelemetry.routeDraw()
        if (!recorder.hasConsumers) {
            if (tracing) LiquidGlassTrace.counter("${traceProviderId()}.drawPath", 0L)
            LiquidGlassPerfTelemetry.routeTreeTraversal()
            super.dispatchDraw(canvas)
            return
        }
        if (captureMode == "oneShotPassThrough") {
            if (tracing) LiquidGlassTrace.counter("${traceProviderId()}.drawPath", 1L)
            val recordScrollWindow = scrollWindowCapturePending && coordinator.isScrollActive &&
                !coordinator.hasPendingSourceRerecord
            val shouldRecord = shouldCapture() &&
                (recordScrollWindow || backdropDirty || !recorder.hasRecording || coordinator.shouldRecordSourceNow)
            if (shouldRecord && canvas.isHardwareAccelerated && width > 0 && height > 0) {
                backdropDirty = false
                val didRecord = if (recordScrollWindow) {
                    val bounds = calculateScrollCaptureBounds()
                    val traceRecord = tracingForProvider()
                    if (traceRecord) LiquidGlassTrace.beginSection("Provider.recordWindowAndDispatchTree")
                    val recordStartedNs = if (traceRecord) android.os.SystemClock.elapsedRealtimeNanos() else 0L
                    try {
                        recorder.recordWindow(width, height, bounds) { target ->
                            dispatchBackdropContent(target)
                        }.also { recorded ->
                            if (recorded) {
                                scrollWindowBounds = bounds
                                recordedScrollOffsetY = currentVerticalScrollOffsetY()
                            }
                        }
                    } finally {
                        if (traceRecord) {
                            LiquidGlassTrace.counter("${traceProviderId()}.recordWindowElapsedNs", android.os.SystemClock.elapsedRealtimeNanos() - recordStartedNs)
                            LiquidGlassTrace.endSection()
                        }
                    }
                } else {
                    resetScrollWindow()
                    recorder.recordOnly(width, height, drawContent = ::dispatchBackdropContent)
                    true
                }
                if (didRecord) {
                    scrollWindowCapturePending = false
                    scrollWindowCaptureActive = recordScrollWindow
                    if (!recordScrollWindow) resetScrollWindow()
                } else {
                    backdropDirty = true
                }
                if (recorder.hasRecording) {
                    oneShotCaptured = true
                    coordinator.sourceRecordCompleted()
                    if (!scrollWindowCaptureActive) contentRenderNode?.let(::updateConsumerRegions)
                    // recordOnly() already schedules Consumer redraws. Window
                    // records do not, so only those need an explicit invalidate.
                    if (recordScrollWindow) recorder.invalidateConsumers()
                    if (!recordScrollWindow) {
                        LiquidGlassPerfTelemetry.routeRenderNodeRecord()
                        LiquidGlassPerfTelemetry.routeTreeTraversal()
                    }
                    LiquidGlassPerfTelemetry.backdropCapture(
                        providerId = providerId,
                        width = width,
                        height = height,
                        capturedPixelArea = consumerBounds.values.sumOf {
                            it.width().coerceAtLeast(0).toLong() * it.height().coerceAtLeast(0)
                        },
                        mode = if (scrollWindowCaptureActive) "oneShot-pass-through-scroll-window" else "oneShot-pass-through",
                    )
                } else {
                    backdropDirty = true
                    coordinator.sourceRecordDeferred()
                }
            } else if (shouldRecord) {
                coordinator.sourceRecordDeferred()
            }
            // Keep the normal RN ScrollView draw path on screen. The Glass
            // consumer samples the separately retained one-shot RenderNode.
            LiquidGlassPerfTelemetry.routeTreeTraversal()
            dispatchPassThroughScreenTree(canvas)
            return
        }
        if (tracing) LiquidGlassTrace.counter("${traceProviderId()}.drawPath", 2L)
        val shouldRecord = shouldCapture() &&
            (backdropDirty || !recorder.hasRecording || coordinator.shouldRecordSourceNow)
        if (shouldRecord) {
            backdropDirty = false
            if (captureMode == "oneShot") oneShotCaptured = true
        }
        val shared = recorder.drawShared(canvas, width, height, shouldRecord, ::dispatchBackdropContent)
        if (shared && shouldRecord) {
            coordinator.sourceRecordCompleted()
            if (captureMode == "oneShot" && snapshotBlurRadiusDp > 0f) {
                LiquidGlassPerfTelemetry.frozenSnapshotRequested()
                frozenBackdrop?.release()
                frozenBackdrop = runCatching { FrozenBackdrop(this, providerId, snapshotBlurRadiusDp) }
                    .onSuccess { LiquidGlassPerfTelemetry.frozenSnapshotBlurRecorded() }
                    .onFailure { LiquidGlassPerfTelemetry.frozenSnapshotFailed() }
                    .getOrNull()
            }
            contentRenderNode?.let(::updateConsumerRegions)
            LiquidGlassPerfTelemetry.backdropCapture(
                providerId = providerId,
                width = width,
                height = height,
                capturedPixelArea = consumerBounds.values.sumOf { it.width().coerceAtLeast(0).toLong() * it.height().coerceAtLeast(0) },
                mode = if (captureMode == "live") "render-node-region-slices" else captureMode,
            )
        } else if (shouldRecord) {
            backdropDirty = true
            coordinator.sourceRecordDeferred()
        }
    }

    private fun dispatchBackdropContent(canvas: Canvas) {
        val tracing = LiquidGlassTrace.isEnabled()
        if (tracing) LiquidGlassTrace.beginSection("Provider.captureTreeTraversal")
        try {
            underlayProviderId?.let(CoreLiquidGlassRegistry::provider)?.contentRenderNode?.let { node ->
                if (node.hasDisplayList()) canvas.drawRenderNode(node)
            }
            super.dispatchDraw(canvas)
        } finally {
            if (tracing) LiquidGlassTrace.endSection()
        }
    }

    private fun dispatchPassThroughScreenTree(canvas: Canvas) {
        val tracing = LiquidGlassTrace.isEnabled()
        if (tracing) LiquidGlassTrace.beginSection("Provider.screenTreeTraversal")
        try {
            super.dispatchDraw(canvas)
        } finally {
            if (tracing) LiquidGlassTrace.endSection()
        }
    }

    private fun shouldCapture(): Boolean = when (captureMode) {
        "live", "static" -> true
        "oneShot" -> !oneShotCaptured
        // Pass-through keeps the visible route on the normal View drawing path,
        // while remaining eligible for a source rerecord when the coordinator
        // receives an explicit structure, geometry, or revision dirty. Ordinary
        // descendant paint invalidations stay paint-only in the coordinator.
        "oneShotPassThrough" -> true
        else -> false
    }

    private fun updateConsumerBounds(consumer: View) {
        if (width <= 0 || height <= 0 || consumer.width <= 0 || consumer.height <= 0) return
        getLocationInWindow(sourceLocation)
        consumer.getLocationInWindow(consumerLocation)
        val left = consumerLocation[0] - sourceLocation[0]
        val top = consumerLocation[1] - sourceLocation[1]
        val next = Rect(
            left.coerceIn(0, width),
            top.coerceIn(0, height),
            (left + consumer.width).coerceIn(0, width),
            (top + consumer.height).coerceIn(0, height),
        )
        if (consumerBounds[consumer] == next) return
        consumerBounds[consumer] = next
        reportProviderGeometry()
        if (scrollWindowCaptureActive) {
            resetScrollWindow()
            recorder.clearConsumerRegions()
            coordinator.markDirty(GlassBackdropDirtyReason.SOURCE_GEOMETRY)
        } else {
            if (recorder.hasRecording) contentRenderNode?.let(::updateConsumerRegions)
            coordinator.markDirty(GlassBackdropDirtyReason.CONSUMER_GEOMETRY)
        }
    }

    private fun updateConsumerRegions(source: RenderNode) {
        if (consumerBounds.isEmpty()) return
        recorder.updateConsumerRegions(consumerBounds, source, width, height)
    }

    private fun calculateScrollCaptureBounds(): Rect {
        val bounds = Rect()
        consumerBounds.values.forEach { consumer ->
            if (consumer.width() <= 0 || consumer.height() <= 0) return@forEach
            if (bounds.isEmpty) bounds.set(consumer) else bounds.union(consumer)
        }
        if (bounds.isEmpty) return Rect(0, 0, width, height)
        val margin = (128f * resources.displayMetrics.density).toInt()
        val overscan = (384f * resources.displayMetrics.density).toInt()
        bounds.set(
            0,
            (bounds.top - margin).coerceAtLeast(0),
            width,
            (bounds.bottom + margin + overscan).coerceAtMost(height),
        )
        return bounds
    }

    private fun shouldRecordScrollWindow(scrollOffsetY: Int): Boolean {
        if (!recorder.hasRecording) return true
        val bounds = scrollWindowBounds ?: return true
        if (coordinator.hasPendingSourceRerecord) return false
        val deltaY = scrollOffsetY - recordedScrollOffsetY
        val margin = (128f * resources.displayMetrics.density).toInt()
        for (consumer in consumerBounds.values) {
            val sampleTop = consumer.top + deltaY - bounds.top - margin
            val sampleBottom = consumer.bottom + deltaY - bounds.top + margin
            if (sampleTop < 0 || sampleBottom >= bounds.height()) return true
        }
        return false
    }

    private fun currentVerticalScrollOffsetY(): Int = findVerticalScrollView(this)?.scrollY ?: 0

    private fun findVerticalScrollView(view: View): ScrollView? {
        if (view !== this && view is ScrollView) return view
        if (view is ViewGroup) {
            for (index in 0 until view.childCount) {
                findVerticalScrollView(view.getChildAt(index))?.let { return it }
            }
        }
        return null
    }

    private fun resetScrollWindow() {
        scrollWindowCapturePending = false
        scrollWindowCaptureActive = false
        scrollWindowBounds = null
        recordedScrollOffsetY = 0
    }

    private fun reportProviderGeometry() {
        LiquidGlassPerfTelemetry.updateProviderGeometry(providerId, width, height, consumerBounds.values)
    }

    private fun traceProviderId(): String = LiquidGlassTrace.safe(providerId)

    private fun tracingForProvider(): Boolean = LiquidGlassTrace.isEnabled()

    private fun updateScrollObservation() {
        coordinator.setScrollObservationEnabled(
            recorder.hasConsumers && (captureMode == "live" || captureMode == "oneShotPassThrough") && isAttachedToWindow,
        )
    }
}

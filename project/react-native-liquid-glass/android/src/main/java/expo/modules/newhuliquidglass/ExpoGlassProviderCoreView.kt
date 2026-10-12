package expo.modules.newhuliquidglass

import android.content.Context
import android.graphics.Canvas
import android.graphics.Rect
import android.graphics.RenderNode
import android.os.Build
import android.os.Looper
import android.view.View
import android.view.MotionEvent
import com.newhu.liquidglass.backdrop.BackdropRecorder
import com.newhu.liquidglass.backdrop.GlassBackdropCoordinator
import com.newhu.liquidglass.backdrop.GlassBackdropCoordinatorHost
import com.newhu.liquidglass.backdrop.GlassBackdropDirtyReason
import com.newhu.liquidglass.backdrop.FrozenBackdrop
import com.newhu.liquidglass.backdrop.LiquidGlassBackdropSource
import com.newhu.liquidglass.telemetry.LiquidGlassPerfTelemetry
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
                    frozenBackdrop?.release()
                    frozenBackdrop = null
                    updateScrollObservation()
                    coordinator.markDirty(GlassBackdropDirtyReason.INITIAL_CAPTURE)
                }
                "frozen" -> {
                    coordinator.cancel(clearSourceDirties = true)
                    backdropDirty = false
                    oneShotCaptured = true
                    updateScrollObservation()
                }
                "static" -> {
                    coordinator.cancel(clearSourceDirties = true)
                    if (!recorder.hasRecording) coordinator.markDirty(GlassBackdropDirtyReason.INITIAL_CAPTURE)
                    updateScrollObservation()
                }
                else -> {
                    coordinator.cancel(clearSourceDirties = true)
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
        if (!canCaptureBackdrop) {
            coordinator.sourceRecordDeferred()
            return
        }
        backdropDirty = true
        postInvalidateOnAnimation()
    }

    override fun refreshBackdropConsumers() {
        recorder.invalidateConsumers()
    }

    override fun onBackdropScrollReuseFrame() {
        LiquidGlassPerfTelemetry.routeScrollReuse()
        recorder.invalidateConsumers()
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

    override fun recordedOriginYFor(consumer: View): Int = recorder.recordedOriginYFor(consumer)

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
        if (mode in setOf("live", "static", "oneShot", "oneShotPassThrough", "frozen")) captureMode = mode
    }

    fun prepareFrozenBackdropImperatively(blurRadiusDp: Float) {
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
        LiquidGlassPerfTelemetry.routeDraw()
        if (!recorder.hasConsumers) {
            LiquidGlassPerfTelemetry.routeTreeTraversal()
            super.dispatchDraw(canvas)
            return
        }
        if (captureMode == "oneShotPassThrough") {
            val shouldRecord = shouldCapture() &&
                (backdropDirty || !recorder.hasRecording || coordinator.shouldRecordSourceNow)
            if (shouldRecord && canvas.isHardwareAccelerated && width > 0 && height > 0) {
                backdropDirty = false
                recorder.recordOnly(width, height, drawContent = ::dispatchBackdropContent)
                if (recorder.hasRecording) {
                    oneShotCaptured = true
                    coordinator.sourceRecordCompleted()
                    contentRenderNode?.let(::updateConsumerRegions)
                    LiquidGlassPerfTelemetry.routeRenderNodeRecord()
                    LiquidGlassPerfTelemetry.routeTreeTraversal()
                    LiquidGlassPerfTelemetry.backdropCapture(
                        providerId = providerId,
                        width = width,
                        height = height,
                        capturedPixelArea = consumerBounds.values.sumOf {
                            it.width().coerceAtLeast(0).toLong() * it.height().coerceAtLeast(0)
                        },
                        mode = "oneShot-pass-through",
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
            super.dispatchDraw(canvas)
            return
        }
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
        underlayProviderId?.let(CoreLiquidGlassRegistry::provider)?.contentRenderNode?.let { node ->
            if (node.hasDisplayList()) canvas.drawRenderNode(node)
        }
        super.dispatchDraw(canvas)
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
        if (recorder.hasRecording) contentRenderNode?.let(::updateConsumerRegions)
        coordinator.markDirty(GlassBackdropDirtyReason.CONSUMER_GEOMETRY)
    }

    private fun updateConsumerRegions(source: RenderNode) {
        if (consumerBounds.isEmpty()) return
        recorder.updateConsumerRegions(consumerBounds, source, width, height)
    }

    private fun reportProviderGeometry() {
        LiquidGlassPerfTelemetry.updateProviderGeometry(providerId, width, height, consumerBounds.values)
    }

    private fun updateScrollObservation() {
        coordinator.setScrollObservationEnabled(
            recorder.hasConsumers && (captureMode == "live" || captureMode == "oneShotPassThrough") && isAttachedToWindow,
        )
    }
}

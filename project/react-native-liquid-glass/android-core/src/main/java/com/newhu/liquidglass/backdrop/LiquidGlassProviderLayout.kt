package com.newhu.liquidglass.backdrop

import android.content.Context
import android.graphics.Canvas
import android.graphics.Rect
import android.graphics.RenderNode
import android.os.Build
import android.util.AttributeSet
import android.view.View
import android.view.MotionEvent
import android.widget.FrameLayout
import com.newhu.liquidglass.telemetry.LiquidGlassPerfTelemetry
import java.util.IdentityHashMap

/**
 * The View-system backdrop provider: place the content that lives *behind* the
 * glass inside this layout. On Android 10+ with hardware acceleration the
 * children are recorded into a reusable [RenderNode] that every registered
 * [LiquidGlassView] re-projects through its own blur/refraction pipeline.
 */
public open class LiquidGlassProviderLayout @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0,
) : FrameLayout(context, attrs, defStyleAttr), LiquidGlassBackdropSource, GlassBackdropCoordinatorHost {

    private val recorder = BackdropRecorder()
    private val sourceLocation = IntArray(2)
    private val consumerLocation = IntArray(2)
    private val consumerRegions = IdentityHashMap<View, Rect>()
    private var scrollSource: GlassScrollSource? = null
    private var sourceWindowBounds: Rect? = null
    private var recordedScrollOffsetY = 0
    private var recordedContentVersion = Long.MIN_VALUE
    private val directChildBounds = IdentityHashMap<View, Rect>()
    private val coordinator = GlassBackdropCoordinator(
        sourceView = this,
        providerId = { "android-core" },
        host = this,
        externalScrollActive = { scrollSource?.isScrolling == true },
    )

    private val directChildLayoutListener = View.OnLayoutChangeListener { child, left, top, right, bottom, _, _, _, _ ->
        val next = Rect(left, top, right, bottom)
        val previous = directChildBounds.put(child, next)
        if (previous != next) {
            coordinator.markDirty(GlassBackdropDirtyReason.SOURCE_GEOMETRY)
        }
    }

    override val hasBackdropConsumers: Boolean
        get() = recorder.hasConsumers

    /** Opt-in native scroll-offset telemetry for host benchmarks. */
    public fun setScrollTelemetryEnabled(enabled: Boolean) {
        coordinator.setDetailedScrollTelemetryEnabled(enabled)
    }

    override val canCaptureBackdrop: Boolean
        get() = isAttachedToWindow && width > 0 && height > 0

    override val sourceView: View
        get() = this

    override val contentRenderNode: RenderNode?
        get() = recorder.contentNode

    override val hasRecording: Boolean
        get() = recorder.hasRecording

    override val requiresCaptureOnConsumerMovement: Boolean
        get() = false

    override fun dispatchTouchEvent(event: MotionEvent): Boolean {
        coordinator.onMotionEvent(event)
        return super.dispatchTouchEvent(event)
    }

    override fun renderNodeFor(consumer: View): RenderNode? =
        if (scrollSource == null) recorder.regionNodeFor(consumer) ?: recorder.contentNode else recorder.contentNode

    override fun recordedOriginXFor(consumer: View): Int = recorder.recordedOriginXFor(consumer)

    override fun recordedOriginYFor(consumer: View): Int {
        val source = scrollSource ?: return recorder.recordedOriginYFor(consumer)
        return recorder.originY - (source.scrollOffsetY - recordedScrollOffsetY)
    }

    override fun requestBackdropSourceRecord() {
        postInvalidateOnAnimation()
    }

    override fun refreshBackdropConsumers() {
        recorder.invalidateConsumers()
    }

    override fun onBackdropScrollReuseFrame() {
        val source = scrollSource
        if (source != null && source.isScrolling) LiquidGlassPerfTelemetry.scrollSampleOffsetUpdated()
        if (source != null && shouldRecordScrollWindow(source) &&
            !(coordinator.hasPendingSourceRerecord && coordinator.isScrollActive)
        ) {
            postInvalidateOnAnimation()
        } else {
            recorder.invalidateConsumers()
            if (source != null) {
                LiquidGlassPerfTelemetry.sourceRenderNodeReuse()
                LiquidGlassPerfTelemetry.scrollWindowReused()
            }
        }
    }

    override fun setScrollSource(source: GlassScrollSource?) {
        if (scrollSource === source) return
        scrollSource = source
        sourceWindowBounds = null
        recordedContentVersion = Long.MIN_VALUE
        recorder.clearConsumerRegions()
        coordinator.markDirty(GlassBackdropDirtyReason.SOURCE_REVISION)
        coordinator.refreshScrollTargets()
        invalidate()
    }

    override fun registerConsumer(consumer: View) {
        recorder.register(consumer)
        updateScrollObservation()
        coordinator.refreshScrollTargets()
        coordinator.markDirty(if (recorder.hasRecording) GlassBackdropDirtyReason.CONSUMER_GEOMETRY else GlassBackdropDirtyReason.INITIAL_CAPTURE)
    }

    override fun unregisterConsumer(consumer: View) {
        recorder.unregister(consumer)
        updateScrollObservation()
        if (!recorder.hasConsumers) coordinator.cancel(clearSourceDirties = true)
    }

    override fun dispatchDraw(canvas: Canvas) {
        LiquidGlassPerfTelemetry.routeDraw()
        if (!recorder.hasConsumers) {
            LiquidGlassPerfTelemetry.routeTreeTraversal()
            super.dispatchDraw(canvas)
            return
        }
        val scroll = scrollSource
        if (scroll != null && Build.VERSION.SDK_INT >= 29 && canvas.isHardwareAccelerated) {
            updateConsumerGeometry()
            super.dispatchDraw(canvas)
            if (scroll.contentVersion != recordedContentVersion && !coordinator.hasPendingSourceRerecord) {
                coordinator.markDirty(GlassBackdropDirtyReason.SOURCE_REVISION)
            }
            val pendingSourceStructure = coordinator.hasPendingSourceRerecord
            val shouldRecordWindow = shouldRecordScrollWindow(scroll) &&
                !(pendingSourceStructure && coordinator.isScrollActive)
            if (shouldRecordWindow) {
                val bounds = calculateScrollWindowBounds(scroll)
                val recorded = recorder.recordWindow(width, height, bounds) { target ->
                    super.dispatchDraw(target)
                }
                if (recorded) {
                    sourceWindowBounds = bounds
                    recordedScrollOffsetY = scroll.scrollOffsetY
                    recordedContentVersion = scroll.contentVersion
                    coordinator.sourceRecordCompleted()
                    coordinator.requestConsumerRefresh()
                }
            } else {
                LiquidGlassPerfTelemetry.sourceRenderNodeReuse()
                LiquidGlassPerfTelemetry.scrollWindowReused()
            }
            return
        }
        val shouldRecord = coordinator.shouldRecordSourceNow || !recorder.hasRecording
        val recorded = recorder.drawShared(canvas, width, height, shouldRecord) { target ->
            super.dispatchDraw(target)
        }
        if (recorded && shouldRecord) {
            coordinator.sourceRecordCompleted()
            updateConsumerRegions()
        } else if (coordinator.hasPendingSourceRerecord && !coordinator.isScrollActive) {
            coordinator.sourceRecordDeferred()
        }
    }

    override fun onDescendantInvalidated(child: View, target: View) {
        if (recorder.hasConsumers) {
            LiquidGlassPerfTelemetry.descendantInvalidationReceived()
            // Existing descendants record their own display lists. Only the direct
            // child identity/geometry callbacks below alter this provider's commands.
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
        coordinator.markDirty(GlassBackdropDirtyReason.SOURCE_STRUCTURE)
    }

    override fun onViewRemoved(child: View) {
        child.removeOnLayoutChangeListener(directChildLayoutListener)
        directChildBounds.remove(child)
        super.onViewRemoved(child)
        coordinator.refreshScrollTargets()
        coordinator.markDirty(GlassBackdropDirtyReason.SOURCE_STRUCTURE)
    }

    override fun onSizeChanged(width: Int, height: Int, oldWidth: Int, oldHeight: Int) {
        super.onSizeChanged(width, height, oldWidth, oldHeight)
        if (width != oldWidth || height != oldHeight) {
            coordinator.markDirty(GlassBackdropDirtyReason.SOURCE_GEOMETRY)
            updateScrollObservation()
        }
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        coordinator.setDetailedScrollTelemetryEnabled(LiquidGlassPerfTelemetry.isEnabled())
        updateScrollObservation()
        coordinator.refreshScrollTargets()
        if (recorder.hasConsumers && !recorder.hasRecording) {
            coordinator.markDirty(GlassBackdropDirtyReason.INITIAL_CAPTURE)
        }
    }

    override fun onDetachedFromWindow() {
        coordinator.setScrollObservationEnabled(false)
        coordinator.cancel(clearSourceDirties = true)
        super.onDetachedFromWindow()
        recorder.release()
    }

    override fun requestCaptureFrame() {
        coordinator.markDirty(GlassBackdropDirtyReason.SOURCE_PAINT)
    }

    override fun onConsumerGeometryChanged(consumer: View) {
        updateConsumerGeometry()
        coordinator.markDirty(GlassBackdropDirtyReason.CONSUMER_GEOMETRY)
    }

    override fun onConsumerDirty(consumer: View, reason: GlassBackdropDirtyReason) {
        coordinator.markDirty(reason, consumerAlreadyInvalidated = true)
    }

    private fun updateConsumerRegions() {
        updateConsumerGeometry()
        val sourceNode = recorder.contentNode ?: return
        if (consumerRegions.isEmpty()) return
        val capturedPixels = recorder.updateConsumerRegions(consumerRegions, sourceNode, width, height)
        if (capturedPixels > 0L) {
            LiquidGlassPerfTelemetry.backdropCapture(
                providerId = "android-core",
                width = width,
                height = height,
                capturedPixelArea = capturedPixels,
                mode = "render-node-region-slices",
            )
        }
    }

    private fun updateConsumerGeometry() {
        getLocationInWindow(sourceLocation)
        consumerRegions.clear()
        for (consumer in recorder.consumersSnapshot()) {
            if (consumer.visibility != View.VISIBLE || consumer.width <= 0 || consumer.height <= 0) continue
            consumer.getLocationInWindow(consumerLocation)
            val left = consumerLocation[0] - sourceLocation[0]
            val top = consumerLocation[1] - sourceLocation[1]
            val region = Rect(left, top, left + consumer.width, top + consumer.height)
            if (region.intersect(0, 0, width, height)) consumerRegions[consumer] = region
        }
    }

    private fun shouldRecordScrollWindow(source: GlassScrollSource): Boolean {
        if (coordinator.hasPendingSourceRerecord || sourceWindowBounds == null || !recorder.hasRecording ||
            source.contentVersion != recordedContentVersion
        ) return true
        val bounds = sourceWindowBounds ?: return true
        val deltaY = source.scrollOffsetY - recordedScrollOffsetY
        if (deltaY < 0) return true
        val margin = if (bounds.top == 0) 0 else source.samplingMarginPx.coerceAtLeast(0)
        for (region in consumerRegions.values) {
            val sampleTop = region.top + deltaY - bounds.top - margin
            val sampleBottom = region.bottom + deltaY - bounds.top + source.samplingMarginPx.coerceAtLeast(0)
            if (sampleTop < 0 || sampleBottom >= bounds.height()) return true
        }
        return false
    }

    private fun calculateScrollWindowBounds(source: GlassScrollSource): Rect {
        val margin = source.samplingMarginPx.coerceAtLeast(0)
        val top = (consumerRegions.values.minOfOrNull { it.top } ?: 0) - margin
        val bottom = (consumerRegions.values.maxOfOrNull { it.bottom } ?: height) + margin +
            source.overscanPx.coerceAtLeast(0)
        val clampedTop = top.coerceAtLeast(0)
        val clampedBottom = bottom.coerceAtMost(height).coerceAtLeast(clampedTop + 1)
        return Rect(0, clampedTop, width, clampedBottom)
    }

    private fun updateScrollObservation() {
        coordinator.setScrollObservationEnabled(recorder.hasConsumers && isAttachedToWindow)
    }
}

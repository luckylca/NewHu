package com.newhu.liquidglass.backdrop

import android.content.Context
import android.graphics.Canvas
import android.graphics.Rect
import android.graphics.RenderNode
import android.os.Build
import android.util.AttributeSet
import android.view.View
import android.view.ViewTreeObserver
import android.widget.FrameLayout
import com.newhu.liquidglass.telemetry.LiquidGlassPerfTelemetry
import com.newhu.liquidglass.scheduler.GlassFrameScheduler
import java.util.IdentityHashMap

/**
 * The View-system backdrop provider: place the content that lives *behind* the
 * glass inside this layout. On Android 10+ with hardware acceleration the
 * children are recorded into a reusable [RenderNode] that every registered
 * [LiquidGlassView] re-projects through its own blur/refraction pipeline.
 *
 * [LiquidGlassView]s must be siblings drawn above this layout (never inside it),
 * exactly like the Compose `liquidGlassProvider` / `liquidGlass` pairing.
 */
public open class LiquidGlassProviderLayout @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0,
) : FrameLayout(context, attrs, defStyleAttr), LiquidGlassBackdropSource {

    private val recorder = BackdropRecorder()
    private val sourceLocation = IntArray(2)
    private val consumerLocation = IntArray(2)
    private val consumerRegions = IdentityHashMap<View, Rect>()
    private var observingScroll = false
    private var scrollSource: GlassScrollSource? = null
    private var sourceWindowBounds: Rect? = null
    private var recordedScrollOffsetY = 0
    private var recordedContentVersion = Long.MIN_VALUE
    private var sourceContentDirty = true
    private val frameScheduler = GlassFrameScheduler {
        LiquidGlassPerfTelemetry.consumerInvalidationExecuted()
        val source = scrollSource
        if (source == null) {
            invalidate()
        } else {
            if (source.isScrolling) LiquidGlassPerfTelemetry.scrollSampleOffsetUpdated()
            recorder.invalidateConsumers()
            if (shouldRecordScrollWindow(source)) {
                invalidate()
            } else {
                LiquidGlassPerfTelemetry.sourceRenderNodeReuse()
                LiquidGlassPerfTelemetry.scrollWindowReused()
            }
        }
    }
    private val scrollChangedListener = ViewTreeObserver.OnScrollChangedListener {
        LiquidGlassPerfTelemetry.scrollEventReceived()
        scheduleRefresh()
    }
    override val sourceView: View
        get() = this

    override val contentRenderNode: RenderNode?
        get() = recorder.contentNode

    override val hasRecording: Boolean
        get() = recorder.hasRecording

    override val requiresCaptureOnConsumerMovement: Boolean
        get() = false

    override fun renderNodeFor(consumer: View): RenderNode? =
        if (scrollSource == null) recorder.regionNodeFor(consumer) ?: recorder.contentNode else recorder.contentNode

    override fun recordedOriginXFor(consumer: View): Int = recorder.recordedOriginXFor(consumer)

    override fun recordedOriginYFor(consumer: View): Int {
        val source = scrollSource ?: return recorder.recordedOriginYFor(consumer)
        return recorder.originY - (source.scrollOffsetY - recordedScrollOffsetY)
    }

    override fun setScrollSource(source: GlassScrollSource?) {
        if (scrollSource === source) return
        scrollSource = source
        sourceWindowBounds = null
        recordedContentVersion = Long.MIN_VALUE
        sourceContentDirty = true
        recorder.clearConsumerRegions()
        invalidate()
    }

    override fun registerConsumer(consumer: View) {
        recorder.register(consumer)
        updateScrollObservation()
        scheduleRefresh()
    }

    override fun unregisterConsumer(consumer: View) {
        recorder.unregister(consumer)
        updateScrollObservation()
        if (!recorder.hasConsumers) frameScheduler.cancel()
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
            if (shouldRecordScrollWindow(scroll)) {
                val bounds = calculateScrollWindowBounds(scroll)
                val recorded = recorder.recordWindow(width, height, bounds) { target ->
                    super.dispatchDraw(target)
                }
                if (recorded) {
                    sourceWindowBounds = bounds
                    recordedScrollOffsetY = scroll.scrollOffsetY
                    recordedContentVersion = scroll.contentVersion
                    sourceContentDirty = false
                    recorder.invalidateConsumers()
                }
            } else {
                LiquidGlassPerfTelemetry.sourceRenderNodeReuse()
                LiquidGlassPerfTelemetry.scrollWindowReused()
            }
            return
        }
        val recorded = recorder.drawShared(canvas, width, height, recordBackdrop = true) { target ->
            super.dispatchDraw(target)
        }
        if (recorded) updateConsumerRegions()
    }

    override fun onDescendantInvalidated(child: View, target: View) {
        if (recorder.hasConsumers) {
            LiquidGlassPerfTelemetry.descendantInvalidationReceived()
            if (scrollSource == null || scrollSource?.isScrolling != true) sourceContentDirty = true
            if (!frameScheduler.schedule()) LiquidGlassPerfTelemetry.descendantInvalidationCoalesced()
        }
        super.onDescendantInvalidated(child, target)
    }

    override fun requestCaptureFrame() {
        scheduleRefresh()
    }

    override fun onConsumerGeometryChanged(consumer: View) {
        scheduleRefresh()
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        updateScrollObservation()
    }

    override fun onDetachedFromWindow() {
        frameScheduler.cancel()
        if (observingScroll) {
            val observer = viewTreeObserver
            if (observer.isAlive) observer.removeOnScrollChangedListener(scrollChangedListener)
            observingScroll = false
        }
        super.onDetachedFromWindow()
        recorder.release()
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
        if (sourceContentDirty || sourceWindowBounds == null || !recorder.hasRecording ||
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

    private fun scheduleRefresh() {
        if (!recorder.hasConsumers) return
        if (!frameScheduler.schedule()) LiquidGlassPerfTelemetry.captureSkippedAlreadyDirty()
    }

    private fun updateScrollObservation() {
        val shouldObserve = recorder.hasConsumers && isAttachedToWindow
        if (shouldObserve && !observingScroll) {
            val observer = viewTreeObserver
            if (observer.isAlive) {
                observer.addOnScrollChangedListener(scrollChangedListener)
                observingScroll = true
            }
        } else if (!shouldObserve && observingScroll) {
            val observer = viewTreeObserver
            if (observer.isAlive) observer.removeOnScrollChangedListener(scrollChangedListener)
            observingScroll = false
        }
    }
}

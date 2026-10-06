package expo.modules.newhuliquidglass

import android.content.Context
import android.graphics.Canvas
import android.graphics.Rect
import android.graphics.RenderNode
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import android.view.ViewTreeObserver
import com.newhu.liquidglass.backdrop.BackdropRecorder
import com.newhu.liquidglass.backdrop.FrozenBackdrop
import com.newhu.liquidglass.backdrop.LiquidGlassBackdropSource
import com.newhu.liquidglass.scheduler.GlassFrameScheduler
import com.newhu.liquidglass.telemetry.LiquidGlassPerfTelemetry
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView
import java.util.IdentityHashMap

internal class ExpoGlassProviderCoreView(
    context: Context,
    appContext: AppContext,
) : ExpoView(context, appContext), LiquidGlassBackdropSource {
    private val recorder = BackdropRecorder()
    private val sourceLocation = IntArray(2)
    private val consumerLocation = IntArray(2)
    private val consumerBounds = IdentityHashMap<View, Rect>()
    private val scrollTargets = IdentityHashMap<View, IntArray>()
    private val mainHandler = Handler(Looper.getMainLooper())
    private var frozenBackdrop: FrozenBackdrop? = null
    private var observingScroll = false
    private var backdropDirty = true
    private var oneShotCaptured = false
    private var scrollActive = false
    private var contentDirtyDuringScroll = false
    private var scrollConsumerRefreshPending = false
    private var sourceCapturePending = false
    private val frameScheduler = GlassFrameScheduler {
        if (!recorder.hasConsumers) {
            scrollConsumerRefreshPending = false
            sourceCapturePending = false
            return@GlassFrameScheduler
        }
        if (!scrollActive && sourceCapturePending) {
            sourceCapturePending = false
            scrollConsumerRefreshPending = false
            LiquidGlassPerfTelemetry.sourceContentDirty()
            markBackdropDirty()
            return@GlassFrameScheduler
        }
        if (scrollConsumerRefreshPending) {
            scrollConsumerRefreshPending = false
            LiquidGlassPerfTelemetry.sourceContentDirty()
            LiquidGlassPerfTelemetry.routeScrollReuse()
            recorder.invalidateConsumers()
            LiquidGlassPerfTelemetry.consumerInvalidationExecuted()
        }
    }
    private val scrollChangedListener = ViewTreeObserver.OnScrollChangedListener {
        LiquidGlassPerfTelemetry.scrollEventReceived()
        if (!recorder.hasConsumers || captureMode != "live") return@OnScrollChangedListener
        if (scrollTargets.isEmpty()) refreshScrollTargets()
        if (!hasTrackedScrollMoved()) return@OnScrollChangedListener
        scrollActive = true
        if (sourceCapturePending) {
            sourceCapturePending = false
            contentDirtyDuringScroll = true
        }
        scrollConsumerRefreshPending = true
        frameScheduler.schedule()
        mainHandler.removeCallbacks(settleScrollCapture)
        mainHandler.postDelayed(settleScrollCapture, 200L)
    }
    private val settleScrollCapture = Runnable {
        if (captureMode == "live" && recorder.hasConsumers) {
            scrollActive = false
            if (contentDirtyDuringScroll) {
                contentDirtyDuringScroll = false
                sourceCapturePending = true
                LiquidGlassPerfTelemetry.settleCaptureExecuted()
                frameScheduler.schedule()
            } else if (scrollConsumerRefreshPending) {
                frameScheduler.schedule()
            }
        }
    }
    private val consumerLayoutListener = View.OnLayoutChangeListener { consumer, _, _, _, _, _, _, _, _ ->
        updateConsumerBounds(consumer)
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

    var captureMode: String = "live"
        set(value) {
            if (field == value) return
            field = value
            when (value) {
                "oneShot" -> {
                    clearGlassFrameWork()
                    mainHandler.removeCallbacks(settleScrollCapture)
                    oneShotCaptured = false
                    frozenBackdrop?.release()
                    frozenBackdrop = null
                    updateScrollObservation()
                    markBackdropDirty()
                }
                "frozen" -> {
                    clearGlassFrameWork()
                    mainHandler.removeCallbacks(settleScrollCapture)
                    backdropDirty = false
                    oneShotCaptured = true
                    scrollTargets.clear()
                    updateScrollObservation()
                }
                "static" -> {
                    clearGlassFrameWork()
                    mainHandler.removeCallbacks(settleScrollCapture)
                    scrollTargets.clear()
                    if (!recorder.hasRecording) markBackdropDirty()
                    updateScrollObservation()
                }
                else -> {
                    clearGlassFrameWork()
                    mainHandler.removeCallbacks(settleScrollCapture)
                    oneShotCaptured = false
                    frozenBackdrop?.release()
                    frozenBackdrop = null
                    if (recorder.hasConsumers) refreshScrollTargets()
                    updateScrollObservation()
                    markBackdropDirty()
                }
            }
        }

    var snapshotBlurRadiusDp: Float = 0f
        set(value) {
            val next = value.coerceAtLeast(0f)
            if (field == next) return
            field = next
            if (captureMode == "oneShot") {
                oneShotCaptured = false
                markBackdropDirty()
            }
        }

    var sourceRevision: String? = null
        set(value) {
            if (field == value) return
            field = value
            if (captureMode == "static" || captureMode == "oneShot") markBackdropDirty()
        }

    override val sourceView: View
        get() = this

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
        if (captureMode == "live" && (!hadRecording || scrollTargets.isEmpty())) refreshScrollTargets()
        updateScrollObservation()
        if (!hadRecording && captureMode != "frozen") markBackdropDirty()
    }

    override fun unregisterConsumer(consumer: View) {
        recorder.unregister(consumer)
        consumer.removeOnLayoutChangeListener(consumerLayoutListener)
        consumerBounds.remove(consumer)
        reportProviderGeometry()
        updateScrollObservation()
        if (!recorder.hasConsumers) {
            clearGlassFrameWork()
            mainHandler.removeCallbacks(settleScrollCapture)
            scrollTargets.clear()
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
        if (captureMode == "live" || captureMode == "static") markBackdropDirty()
        if (captureMode == "oneShot" && !oneShotCaptured) markBackdropDirty()
    }

    override fun onConsumerGeometryChanged(consumer: View) {
        updateConsumerBounds(consumer)
    }

    fun setCaptureModeImperatively(mode: String) {
        if (mode in setOf("live", "static", "oneShot", "frozen")) captureMode = mode
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
        if (captureMode == "oneShot") oneShotCaptured = false
        if (captureMode == "frozen" && recorder.hasConsumers && !recorder.hasRecording) captureMode = "oneShot"
        if (captureMode == "live" && recorder.hasConsumers && scrollTargets.isEmpty()) refreshScrollTargets()
        updateScrollObservation()
        if ((captureMode == "static" || captureMode == "oneShot") && !recorder.hasRecording) markBackdropDirty()
    }

    override fun onDetachedFromWindow() {
        CoreLiquidGlassRegistry.unregisterProvider(providerId, this)
        mainHandler.removeCallbacks(settleScrollCapture)
        clearGlassFrameWork()
        updateScrollObservation()
        frozenBackdrop?.release()
        frozenBackdrop = null
        backdropDirty = false
        oneShotCaptured = false
        scrollTargets.clear()
        LiquidGlassPerfTelemetry.removeProviderGeometry(providerId)
        recorder.release()
        super.onDetachedFromWindow()
    }

    override fun onSizeChanged(width: Int, height: Int, oldWidth: Int, oldHeight: Int) {
        if (recorder.hasConsumers && shouldCapture() && width > 0 && height > 0) {
            if (captureMode == "live" && scrollTargets.isEmpty()) refreshScrollTargets()
            updateScrollObservation()
            sourceCapturePending = true
            frameScheduler.schedule()
        }
        super.onSizeChanged(width, height, oldWidth, oldHeight)
    }

    override fun onDescendantInvalidated(child: View, target: View) {
        if (shouldCapture() && recorder.hasConsumers) {
            LiquidGlassPerfTelemetry.descendantInvalidationReceived()
            if (captureMode == "live" && scrollActive) {
                contentDirtyDuringScroll = true
                scrollConsumerRefreshPending = true
            } else {
                sourceCapturePending = true
            }
            if (!frameScheduler.schedule()) LiquidGlassPerfTelemetry.descendantInvalidationCoalesced()
        }
        super.onDescendantInvalidated(child, target)
    }

    override fun dispatchDraw(canvas: Canvas) {
        LiquidGlassPerfTelemetry.routeDraw()
        if (!recorder.hasConsumers) {
            LiquidGlassPerfTelemetry.routeTreeTraversal()
            super.dispatchDraw(canvas)
            return
        }
        val shouldRecord = shouldCapture() && (backdropDirty || !recorder.hasRecording)
        if (shouldRecord) {
            backdropDirty = false
            if (captureMode == "oneShot") oneShotCaptured = true
        }
        val shared = recorder.drawShared(canvas, width, height, shouldRecord, ::dispatchBackdropContent)
        if (shared && shouldRecord) {
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
        else -> false
    }

    private fun markBackdropDirty() {
        if (!shouldCapture() || !recorder.hasConsumers) return
        backdropDirty = true
        postInvalidateOnAnimation()
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
    }

    private fun updateConsumerRegions(source: RenderNode) {
        if (consumerBounds.isEmpty()) return
        recorder.updateConsumerRegions(consumerBounds, source, width, height)
    }

    private fun reportProviderGeometry() {
        LiquidGlassPerfTelemetry.updateProviderGeometry(providerId, width, height, consumerBounds.values)
    }

    private fun clearGlassFrameWork() {
        frameScheduler.cancel()
        sourceCapturePending = false
        scrollConsumerRefreshPending = false
        contentDirtyDuringScroll = false
        scrollActive = false
    }

    private fun refreshScrollTargets() {
        scrollTargets.clear()
        collectScrollTargets(this)
    }

    private fun collectScrollTargets(view: View) {
        if (view !== this && (view.canScrollVertically(-1) || view.canScrollVertically(1) ||
                view.canScrollHorizontally(-1) || view.canScrollHorizontally(1))) {
            scrollTargets[view] = intArrayOf(view.scrollX, view.scrollY)
        }
        if (view is ViewGroup) {
            for (index in 0 until view.childCount) collectScrollTargets(view.getChildAt(index))
        }
    }

    private fun hasTrackedScrollMoved(): Boolean {
        var moved = false
        val iterator = scrollTargets.entries.iterator()
        while (iterator.hasNext()) {
            val (view, previous) = iterator.next()
            if (view.parent == null) {
                iterator.remove()
                continue
            }
            if (view.scrollX != previous[0] || view.scrollY != previous[1]) moved = true
            previous[0] = view.scrollX
            previous[1] = view.scrollY
        }
        if (scrollTargets.isEmpty() && recorder.hasConsumers && captureMode == "live") refreshScrollTargets()
        return moved
    }

    private fun updateScrollObservation() {
        val shouldObserve = recorder.hasConsumers && captureMode == "live" && isAttachedToWindow
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

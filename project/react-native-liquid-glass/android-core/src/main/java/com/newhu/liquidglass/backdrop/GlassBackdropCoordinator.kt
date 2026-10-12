package com.newhu.liquidglass.backdrop

import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.Choreographer
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.ViewTreeObserver
import android.widget.HorizontalScrollView
import android.widget.ScrollView
import com.newhu.liquidglass.scheduler.GlassFrameScheduler
import com.newhu.liquidglass.telemetry.EffectiveScrollFpsProbe
import com.newhu.liquidglass.telemetry.LiquidGlassPerfTelemetry
import java.util.IdentityHashMap

/** Reasons a provider or one of its glass consumers needs another frame. */
public enum class GlassBackdropDirtyReason {
    SOURCE_PAINT,
    SOURCE_STRUCTURE,
    SOURCE_GEOMETRY,
    CONSUMER_GEOMETRY,
    OPTICS,
    MATERIAL,
    SCROLL,
    SOURCE_REVISION,
    INITIAL_CAPTURE,
}

/** Host operations shared by the Expo and regular Android provider adapters. */
public interface GlassBackdropCoordinatorHost {
    public val hasBackdropConsumers: Boolean
    public val canCaptureBackdrop: Boolean
    public fun requestBackdropSourceRecord()
    public fun refreshBackdropConsumers()

    /** Called for a scroll frame; cropped hosts may record a new sampling window here. */
    public fun onBackdropScrollReuseFrame() {
        refreshBackdropConsumers()
    }
}

/**
 * One dirty/coalescing/scroll state machine for every Android Glass backdrop host.
 * The host decides how a requested source record is made; it cannot decide that
 * paint-only or consumer-only dirtiness requires walking the source View tree.
 */
public class GlassBackdropCoordinator(
    private val sourceView: View,
    private val providerId: () -> String,
    private val host: GlassBackdropCoordinatorHost,
    private val externalScrollActive: () -> Boolean = { false },
    private val settleDelayMs: Long = 200L,
) {
    private val sourceRecordCauses = linkedSetOf<GlassBackdropDirtyReason>()
    private val scrollTargets = IdentityHashMap<View, IntArray>()
    private val frameScrollTargets = IdentityHashMap<View, IntArray>()
    private val mainHandler = Handler(Looper.getMainLooper())
    private val choreographer by lazy(LazyThreadSafetyMode.NONE) { Choreographer.getInstance() }
    private var consumerRefreshPending = false
    private var paintDirtyPending = 0L
    private var scrollActive = false
    private var scrollSettleRerecordPending = false
    private var sourceRecordRequestIssued = false
    private var observingScroll = false
    private var samplingScrollFrames = false
    private var refreshedTargetsForUntrackedScroll = false
    private var detailedScrollTelemetryEnabled = false
    private var telemetryTouchTarget: View? = null
    private var telemetryTouchActive = false

    private val scrollFrameCallback = object : Choreographer.FrameCallback {
        override fun doFrame(frameTimeNanos: Long) {
            if (!LiquidGlassPerfTelemetry.isEnabled() || !isScrollActive) {
                samplingScrollFrames = false
                frameScrollTargets.clear()
                return
            }
            LiquidGlassPerfTelemetry.scrollFrameSample(
                providerId(),
                frameTimeNanos,
                sampleFrameScrollMovement(frameTimeNanos),
                telemetryTouchActive,
            )
            choreographer.postFrameCallback(this)
        }
    }

    private val frameScheduler = GlassFrameScheduler(::runScheduledFrame)
    private val settleScroll = Runnable {
        if (!host.hasBackdropConsumers) return@Runnable
        scrollActive = false
        refreshedTargetsForUntrackedScroll = false
        if (sourceRecordCauses.isNotEmpty()) {
            scrollSettleRerecordPending = true
            LiquidGlassPerfTelemetry.settleCaptureExecuted(providerId())
            scheduleFrame()
        } else if (consumerRefreshPending) {
            scheduleFrame()
        }
        stopScrollFrameSampling()
    }
    private val scrollChangedListener = ViewTreeObserver.OnScrollChangedListener {
        val changedTargets = changedScrollTargets()
        var trackedMovement = changedTargets.isNotEmpty()
        LiquidGlassPerfTelemetry.scrollEventReceived(providerId())
        if (detailedScrollTelemetryEnabled && changedTargets.isNotEmpty()) {
            val uptimeMs = SystemClock.uptimeMillis()
            changedTargets.forEach { view ->
                LiquidGlassPerfTelemetry.scrollOffsetUpdated(
                    providerId(),
                    scrollViewTelemetryKey(view),
                    uptimeMs,
                    view.scrollX,
                    view.scrollY,
                    telemetryTouchActive,
                )
            }
        } else if (changedTargets.isNotEmpty()) {
            val view = changedTargets.first()
            LiquidGlassPerfTelemetry.scrollOffsetUpdated(
                providerId(),
                SystemClock.uptimeMillis(),
                view.scrollX,
                view.scrollY,
            )
        }
        if (!trackedMovement && !externalScrollActive() && !refreshedTargetsForUntrackedScroll) {
            // A route child (commonly the virtualized scroll view) can mount
            // below a stable direct child after observation starts. Refresh
            // the target set once when the VTO reports untracked movement.
            refreshScrollTargets()
            refreshedTargetsForUntrackedScroll = true
            val newlyTrackedTargets = changedScrollTargets()
            trackedMovement = newlyTrackedTargets.isNotEmpty()
            if (detailedScrollTelemetryEnabled && newlyTrackedTargets.isNotEmpty()) {
                val uptimeMs = SystemClock.uptimeMillis()
                newlyTrackedTargets.forEach { view ->
                    LiquidGlassPerfTelemetry.scrollOffsetUpdated(
                        providerId(),
                        scrollViewTelemetryKey(view),
                        uptimeMs,
                        view.scrollX,
                        view.scrollY,
                        telemetryTouchActive,
                    )
                }
            }
        }
        if (trackedMovement) refreshedTargetsForUntrackedScroll = false
        // The VTO callback itself is authoritative that a descendant scroll
        // changed. Keep sampling even when the view target was newly mounted.
        if (trackedMovement || externalScrollActive() || host.hasBackdropConsumers) onScrollMoved()
    }

    public val isScrollActive: Boolean
        get() = scrollActive || externalScrollActive()

    public val hasPendingSourceRerecord: Boolean
        get() = sourceRecordCauses.isNotEmpty()

    /** True only when a full source record is safe to start in the current frame. */
    public val shouldRecordSourceNow: Boolean
        get() = hasPendingSourceRerecord && !isScrollActive && host.canCaptureBackdrop

    /** Track source tree changes explicitly so descendant paint invalidations stay cheap. */
    public fun markDirty(reason: GlassBackdropDirtyReason, consumerAlreadyInvalidated: Boolean = false) {
        LiquidGlassPerfTelemetry.dirtyReceived(providerId(), reason)
        when (reason) {
            GlassBackdropDirtyReason.SOURCE_PAINT -> {
                consumerRefreshPending = host.hasBackdropConsumers
                paintDirtyPending += 1L
            }
            GlassBackdropDirtyReason.SOURCE_STRUCTURE,
            GlassBackdropDirtyReason.SOURCE_GEOMETRY,
            GlassBackdropDirtyReason.SOURCE_REVISION,
            GlassBackdropDirtyReason.INITIAL_CAPTURE -> requestSourceRerecord(reason)
            GlassBackdropDirtyReason.CONSUMER_GEOMETRY,
            GlassBackdropDirtyReason.OPTICS,
            GlassBackdropDirtyReason.MATERIAL,
            GlassBackdropDirtyReason.SCROLL -> {
                if (!consumerAlreadyInvalidated) consumerRefreshPending = host.hasBackdropConsumers
            }
        }
        if (!consumerAlreadyInvalidated) scheduleFrame()
    }

    public fun sourceRecordCompleted() {
        val causes = sourceRecordCauses.toList()
        sourceRecordCauses.clear()
        sourceRecordRequestIssued = false
        paintDirtyPending = 0L
        if (causes.isNotEmpty()) LiquidGlassPerfTelemetry.sourceRerecordExecuted(providerId(), causes)
        if (scrollSettleRerecordPending) {
            scrollSettleRerecordPending = false
            LiquidGlassPerfTelemetry.scrollSettleRerecord(providerId())
        }
    }

    /** Retry after a host could not record (for example, its first layout is empty). */
    public fun sourceRecordDeferred() {
        sourceRecordRequestIssued = false
    }

    public fun requestConsumerRefresh() {
        if (!host.hasBackdropConsumers) return
        consumerRefreshPending = true
        scheduleFrame()
    }

    public fun onScrollMoved() {
        if (!host.hasBackdropConsumers) return
        scrollActive = true
        consumerRefreshPending = true
        LiquidGlassPerfTelemetry.dirtyReceived(providerId(), GlassBackdropDirtyReason.SCROLL)
        startScrollFrameSampling()
        scheduleFrame()
        mainHandler.removeCallbacks(settleScroll)
        mainHandler.postDelayed(settleScroll, settleDelayMs)
    }

    public fun setScrollObservationEnabled(enabled: Boolean) {
        val shouldObserve = enabled && sourceView.isAttachedToWindow
        if (shouldObserve == observingScroll) return
        if (shouldObserve) {
            val observer = sourceView.viewTreeObserver
            if (observer.isAlive) {
                observer.addOnScrollChangedListener(scrollChangedListener)
                observingScroll = true
                refreshScrollTargets()
            }
        } else {
            val observer = sourceView.viewTreeObserver
            if (observer.isAlive) observer.removeOnScrollChangedListener(scrollChangedListener)
            observingScroll = false
            scrollTargets.clear()
            frameScrollTargets.clear()
            telemetryTouchTarget = null
            telemetryTouchActive = false
            stopScrollFrameSampling()
        }
    }

    /** Called by both host adapters before forwarding the event to their children. */
    public fun onMotionEvent(event: MotionEvent) {
        if (!LiquidGlassPerfTelemetry.isEnabled()) return
        if (event.actionMasked == MotionEvent.ACTION_DOWN) {
            EffectiveScrollFpsProbe.registerProviderTargets(scrollTargets.keys)
        }
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                val target = findScrollTargetAt(event.rawX.toInt(), event.rawY.toInt())
                telemetryTouchTarget = target
                telemetryTouchActive = true
                LiquidGlassPerfTelemetry.scrollTouchDown(
                    providerId(),
                    event.eventTime,
                    target?.let(::scrollViewTelemetryKey),
                    SystemClock.uptimeMillis(),
                    event.rawX,
                    event.rawY,
                )
            }
            MotionEvent.ACTION_MOVE -> LiquidGlassPerfTelemetry.scrollTouchMove(
                providerId(),
                telemetryTouchTarget?.let(::scrollViewTelemetryKey),
                event.eventTime,
                SystemClock.uptimeMillis(),
                event.rawX,
                event.rawY,
            )
            MotionEvent.ACTION_UP,
            MotionEvent.ACTION_CANCEL -> {
                LiquidGlassPerfTelemetry.scrollTouchEnd(
                    providerId(),
                    telemetryTouchTarget?.let(::scrollViewTelemetryKey),
                    event.actionMasked == MotionEvent.ACTION_CANCEL,
                    event.eventTime,
                    SystemClock.uptimeMillis(),
                    event.rawX,
                    event.rawY,
                )
                telemetryTouchActive = false
            }
        }
    }

    public fun refreshScrollTargets() {
        scrollTargets.clear()
        frameScrollTargets.clear()
        collectScrollTargets(sourceView)
        EffectiveScrollFpsProbe.registerProviderTargets(scrollTargets.keys)
        // Instrumentation reads offsets through the provider's existing
        // ViewTreeObserver. Do not install View.OnScrollChangeListener here:
        // that setter replaces a listener owned by the actual scroll view.
    }

    /** Native per-scroll-view offset callbacks exist only during opt-in Debug telemetry. */
    public fun setDetailedScrollTelemetryEnabled(enabled: Boolean) {
        if (detailedScrollTelemetryEnabled == enabled) return
        detailedScrollTelemetryEnabled = enabled
        if (enabled) refreshScrollTargets()
    }

    public fun cancel(clearSourceDirties: Boolean = false) {
        frameScheduler.cancel()
        mainHandler.removeCallbacks(settleScroll)
        stopScrollFrameSampling()
        consumerRefreshPending = false
        scrollActive = false
        scrollSettleRerecordPending = false
        sourceRecordRequestIssued = false
        if (clearSourceDirties) {
            sourceRecordCauses.clear()
            paintDirtyPending = 0L
        }
    }

    private fun requestSourceRerecord(reason: GlassBackdropDirtyReason) {
        // Count every incoming requirement, even when this frame already has
        // the same reason queued. The reason set below intentionally coalesces
        // those requests into one source record.
        LiquidGlassPerfTelemetry.sourceRerecordRequired(providerId())
        sourceRecordCauses.add(reason)
    }

    private fun scheduleFrame() {
        if (!host.hasBackdropConsumers) return
        frameScheduler.schedule()
    }

    private fun runScheduledFrame() {
        if (!host.hasBackdropConsumers) {
            consumerRefreshPending = false
            return
        }

        if (scrollActive) {
            if (consumerRefreshPending) {
                consumerRefreshPending = false
                if (sourceRecordCauses.isEmpty()) recordPaintOnlyReuse()
                LiquidGlassPerfTelemetry.scrollReuseFrame(providerId())
                host.onBackdropScrollReuseFrame()
            }
            return
        }

        if (sourceRecordCauses.isNotEmpty()) {
            if (!host.canCaptureBackdrop) return
            if (!sourceRecordRequestIssued) {
                sourceRecordRequestIssued = true
                host.requestBackdropSourceRecord()
            }
            return
        }

        if (consumerRefreshPending) {
            consumerRefreshPending = false
            recordPaintOnlyReuse()
            LiquidGlassPerfTelemetry.consumerRefreshOnly(providerId())
            LiquidGlassPerfTelemetry.consumerInvalidationExecuted()
            host.refreshBackdropConsumers()
        }
    }

    private fun recordPaintOnlyReuse() {
        if (paintDirtyPending <= 0L) return
        LiquidGlassPerfTelemetry.sourceRerecordAvoided(providerId(), paintDirtyPending)
        paintDirtyPending = 0L
    }

    private fun collectScrollTargets(view: View) {
        if (view !== sourceView && (canScroll(view) || isScrollContainer(view))) {
            scrollTargets[view] = intArrayOf(view.scrollX, view.scrollY)
        }
        if (view is ViewGroup) {
            for (index in 0 until view.childCount) collectScrollTargets(view.getChildAt(index))
        }
    }

    private fun isScrollContainer(view: View): Boolean =
        view is ScrollView || view is HorizontalScrollView

    private fun changedScrollTargets(): List<View> {
        val changedTargets = mutableListOf<View>()
        val iterator = scrollTargets.entries.iterator()
        while (iterator.hasNext()) {
            val (view, previous) = iterator.next()
            if (view.parent == null) {
                iterator.remove()
                continue
            }
            if (view.scrollX != previous[0] || view.scrollY != previous[1]) {
                changedTargets.add(view)
            }
            previous[0] = view.scrollX
            previous[1] = view.scrollY
        }
        if (scrollTargets.isEmpty() && host.hasBackdropConsumers) refreshScrollTargets()
        return changedTargets
    }

    private fun startScrollFrameSampling() {
        if (samplingScrollFrames || !LiquidGlassPerfTelemetry.isEnabled()) return
        samplingScrollFrames = true
        frameScrollTargets.clear()
        for ((view, _) in scrollTargets) frameScrollTargets[view] = intArrayOf(view.scrollX, view.scrollY)
        choreographer.postFrameCallback(scrollFrameCallback)
    }

    private fun stopScrollFrameSampling() {
        if (!samplingScrollFrames) return
        samplingScrollFrames = false
        choreographer.removeFrameCallback(scrollFrameCallback)
        frameScrollTargets.clear()
    }

    private fun sampleFrameScrollMovement(frameTimeNanos: Long): Boolean {
        var moved = false
        val iterator = frameScrollTargets.entries.iterator()
        var telemetryTargetMoved = false
        while (iterator.hasNext()) {
            val (view, previous) = iterator.next()
            if (view.parent == null) {
                iterator.remove()
                continue
            }
            val changed = view.scrollX != previous[0] || view.scrollY != previous[1]
            if (changed) moved = true
            if (view === telemetryTouchTarget) {
                telemetryTargetMoved = changed
                if (detailedScrollTelemetryEnabled) {
                LiquidGlassPerfTelemetry.scrollViewFrameSample(
                    providerId(),
                    scrollViewTelemetryKey(view),
                    frameTimeNanos,
                    changed,
                    telemetryTouchActive,
                )
                }
            }
            previous[0] = view.scrollX
            previous[1] = view.scrollY
        }
        if (frameScrollTargets.isEmpty()) {
            refreshScrollTargets()
            for ((view, _) in scrollTargets) frameScrollTargets[view] = intArrayOf(view.scrollX, view.scrollY)
        }
        return telemetryTouchTarget?.let { target -> frameScrollTargets.containsKey(target) && telemetryTargetMoved } ?: moved
    }

    private fun findScrollTargetAt(rawX: Int, rawY: Int): View? {
        var best: View? = null
        var bestDepth = -1
        val visibleBounds = android.graphics.Rect()
        for (view in scrollTargets.keys) {
            if (!view.isShown || view.alpha <= 0f || !view.getGlobalVisibleRect(visibleBounds) ||
                !visibleBounds.contains(rawX, rawY) || !canScroll(view)
            ) continue
            var depth = 0
            var ancestor = view.parent
            while (ancestor is View && ancestor !== sourceView) {
                depth += 1
                ancestor = ancestor.parent
            }
            if (depth > bestDepth) {
                best = view
                bestDepth = depth
            }
        }
        return best
    }

    private fun scrollViewTelemetryKey(view: View): String =
        "${view.javaClass.simpleName.ifEmpty { "View" }}_${Integer.toHexString(System.identityHashCode(view))}"

    private fun canScroll(view: View): Boolean =
        view.canScrollVertically(-1) || view.canScrollVertically(1) ||
            view.canScrollHorizontally(-1) || view.canScrollHorizontally(1)
}

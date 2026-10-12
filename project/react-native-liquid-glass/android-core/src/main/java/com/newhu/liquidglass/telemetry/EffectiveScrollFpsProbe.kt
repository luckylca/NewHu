package com.newhu.liquidglass.telemetry

import android.os.SystemClock
import android.os.Build
import android.os.Trace
import android.util.Log
import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.view.Choreographer
import android.view.FrameMetrics
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.ViewTreeObserver
import android.view.Window
import android.widget.HorizontalScrollView
import android.widget.OverScroller
import android.widget.ScrollView
import java.util.IdentityHashMap
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * Debug benchmark probe for the actual offset rendered by native scroll containers.
 * It deliberately runs independently of Glass consumers and records both a
 * Choreographer sample and a root draw sample. Release code never enables it.
 */
public object EffectiveScrollFpsProbe {
    private const val TAG = "LiquidGlassPerf"
    private const val MAX_SAMPLES = 24_000
    private const val ACTIVE_TAIL_NS = 100_000_000L
    private const val POST_TOUCH_CAPTURE_WINDOW_NS = 3_000_000_000L

    private data class OffsetFrameSample(
        val frameTimeNs: Long,
        val x: Int,
        val y: Int,
        val deltaX: Int,
        val deltaY: Int,
        val changed: Boolean,
    )

    private class TargetState(val view: View, val identity: String) {
        var previousX = view.scrollX
        var previousY = view.scrollY
        var nativeX = view.scrollX
        var nativeY = view.scrollY
        var sampledX = view.scrollX
        var sampledY = view.scrollY
        var sampledWidth = view.width
        var sampledHeight = view.height
        val nativeViewId = view.id
        var lastChangedNs = 0L
        var lastActiveSampleNs = 0L
        var lastDrawFrameNs = 0L
        var previousDrawX = view.scrollX
        var previousDrawY = view.scrollY
        var drawLastChangedNs = 0L
        var previousWindowFrameX = view.scrollX
        var previousWindowFrameY = view.scrollY
        var windowFrameLastChangedNs = 0L
        val updateIntervalsNs = ArrayList<Long>()
        val drawUpdateIntervalsNs = ArrayList<Long>()
        val windowFrameUpdateIntervalsNs = ArrayList<Long>()
        val dragUpdateIntervalsNs = ArrayList<Long>()
        val postTouchUpdateIntervalsNs = ArrayList<Long>()
        val nativeScrollIntervalsNs = ArrayList<Long>()
        val nativeDragScrollIntervalsNs = ArrayList<Long>()
        val nativePostTouchScrollIntervalsNs = ArrayList<Long>()
        val touchMoveIntervalsNs = ArrayList<Long>()
        val touchMoveDispatchIntervalsNs = ArrayList<Long>()
        val offsetSamples = ArrayList<OffsetFrameSample>()
        var lastDragChangedNs = 0L
        var lastPostTouchChangedNs = 0L
        var lastNativeScrollChangedNs = 0L
        var lastNativeDragScrollChangedNs = 0L
        var lastNativePostTouchScrollChangedNs = 0L
        var lastTouchMoveEventNs = 0L
        var lastTouchMoveDispatchNs = 0L
        var touchDownEventNs = 0L
        var touchUpEventNs = 0L
        var touchMoveEventCount = 0L
        var touchMoveDispatchCount = 0L
        var touchHistoricalSampleCount = 0L
        var nativeScrollChangeCount = 0L
        var firstNativeScrollChangedNs = 0L
        var lastNativeScrollEventNs = 0L
        var postUpScrollerCaptured = false
        var postUpScrollerPresent = false
        var postUpScrollerFinished = false
        var postUpScrollerCurrentY = 0
        var postUpScrollerFinalY = 0
        var postUpScrollerVelocityPxPerSec = 0f
        var postUpMaxScrollY = 0
        var postUpViewScrollY = 0
        var postTouchScrollerFrameSamples = 0L
        var postTouchScrollerActiveFrameSamples = 0L
        var postTouchScrollerFirstCurrentY = 0
        var postTouchScrollerLastCurrentY = 0
        var postTouchScrollerLastFinalY = 0
        var postTouchScrollerMaxCurrentDeltaPx = 0
        var postTouchViewFirstY = 0
        var postTouchViewLastY = 0
        var updateIntervalCount = 0L
        var drawUpdateIntervalCount = 0L
        var windowFrameUpdateIntervalCount = 0L
        var activeVsyncSamples = 0L
        var changedVsyncSamples = 0L
        var repeatedVsyncSamples = 0L
        var activeDrawSamples = 0L
        var changedDrawSamples = 0L
        var repeatedDrawSamples = 0L
        var activeWindowFrameSamples = 0L
        var changedWindowFrameSamples = 0L
        var repeatedWindowFrameSamples = 0L
        var activeDurationNs = 0L
        var drawActiveDurationNs = 0L
        var windowFrameActiveDurationNs = 0L
        var maxStallNs = 0L
        var drawMaxStallNs = 0L
        var windowFrameMaxStallNs = 0L
    }

    private val states = IdentityHashMap<View, TargetState>()
    private val providerTargets = IdentityHashMap<View, Boolean>()
    private val activeTargets = ArrayList<View>()
    private val frameTimesNs = ArrayList<Long>()
    private val windowFrameTimesNs = ArrayList<Long>()
    private val mainHandler by lazy(LazyThreadSafetyMode.NONE) { android.os.Handler(android.os.Looper.getMainLooper()) }
    private var root: View? = null
    private var frameMetricsWindow: Window? = null
    private var pageLabel = "unlabeled"
    private var running = false
    private var touchActive = false
    private var touchTarget: View? = null
    private var postTouchTarget: View? = null
    private var touchUpEventNs = 0L
    private var lastFocusTarget: View? = null
    private var sessionStartNs = 0L
    private var lastFrameTimeNs = 0L
    private var lastDrawFrameNs = 0L
    private var estimatedVsyncSlots = 0L
    private var missedVsyncSlots = 0L
    private var windowFrameDroppedCallbacks = 0L
    private var displayRefreshHz = 0f
    private var layoutRefreshPosted = false
    private var scrollerFieldLookupComplete = false
    private var scrollerField: java.lang.reflect.Field? = null

    private val frameCallback = object : Choreographer.FrameCallback {
        override fun doFrame(frameTimeNanos: Long) {
            if (!running) return
            sampleVsync(frameTimeNanos)
            Choreographer.getInstance().postFrameCallback(this)
        }
    }

    private val drawListener = ViewTreeObserver.OnDrawListener {
        if (running) sampleRootDraw(lastFrameTimeNs)
    }

    /** Captures the actual native scroll callback, before frame-level sampling. */
    private val scrollChangedListener = ViewTreeObserver.OnScrollChangedListener {
        if (running) sampleNativeScrollChanged(System.nanoTime())
    }

    private val frameMetricsListener = Window.OnFrameMetricsAvailableListener { _, metrics, dropped ->
        if (running) sampleWindowFrame(metrics, dropped)
    }

    private val globalLayoutListener = ViewTreeObserver.OnGlobalLayoutListener {
        if (running && !layoutRefreshPosted) {
            layoutRefreshPosted = true
            mainHandler.postDelayed({
                layoutRefreshPosted = false
                if (running) refreshTargets()
            }, 80L)
        }
    }

    private val attachListener = object : View.OnAttachStateChangeListener {
        override fun onViewAttachedToWindow(view: View) {
            if (running) refreshTargets()
        }

        override fun onViewDetachedFromWindow(view: View) = Unit
    }

    /** Start sampling against the Activity's decor root. Must be called on main. */
    @JvmStatic
    public fun start(rootView: View, refreshRateHz: Float, activityWindow: Window? = null) {
        runOnMain {
            if (root === rootView && running) {
                displayRefreshHz = refreshRateHz
                return@runOnMain
            }
            stopOnMain()
            root = rootView
            displayRefreshHz = refreshRateHz
            rootView.addOnAttachStateChangeListener(attachListener)
            frameMetricsWindow = activityWindow ?: findActivityWindow(rootView.context)
            frameMetricsWindow?.addOnFrameMetricsAvailableListener(frameMetricsListener, mainHandler)
            val observer = rootView.viewTreeObserver
            if (observer.isAlive) {
                observer.addOnGlobalLayoutListener(globalLayoutListener)
                observer.addOnDrawListener(drawListener)
                observer.addOnScrollChangedListener(scrollChangedListener)
            }
            running = true
            beginSessionOnMain("benchmark")
            Choreographer.getInstance().postFrameCallback(frameCallback)
        }
    }

    /** Begin an isolated page measurement after route warmup and before navigation. */
    @JvmStatic
    public fun beginSession(page: String) {
        if (android.os.Looper.myLooper() == android.os.Looper.getMainLooper()) {
            if (running) beginSessionOnMain(page)
            return
        }
        val completed = CountDownLatch(1)
        mainHandler.post {
            try {
                if (running) beginSessionOnMain(page)
            } finally {
                completed.countDown()
            }
        }
        completed.await(2, TimeUnit.SECONDS)
    }

    /** Receives Activity-dispatched MotionEvents before child views, without intercepting them. */
    @JvmStatic
    public fun onMotionEvent(event: MotionEvent) {
        if (!running) return
        val eventTimeNs = event.eventTime * 1_000_000L
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                touchTarget = findTargetAt(event.rawX.toInt(), event.rawY.toInt())
                postTouchTarget = null
                touchUpEventNs = 0L
                lastFocusTarget = touchTarget
                touchActive = touchTarget != null
                touchTarget?.let { target ->
                    synchronized(states) {
                        states[target]?.let { state ->
                            // Separate drags must not inherit the idle gap between ADB/user gestures
                            // as if content had stalled while continuously moving.
                            state.lastChangedNs = 0L
                            state.drawLastChangedNs = 0L
                            state.windowFrameLastChangedNs = 0L
                            state.lastDragChangedNs = 0L
                            state.lastPostTouchChangedNs = 0L
                            state.lastNativeScrollChangedNs = 0L
                            state.lastNativeDragScrollChangedNs = 0L
                            state.lastNativePostTouchScrollChangedNs = 0L
                            state.lastTouchMoveEventNs = 0L
                            state.lastTouchMoveDispatchNs = 0L
                            state.touchDownEventNs = eventTimeNs
                            state.touchUpEventNs = 0L
                        }
                    }
                }
            }
            MotionEvent.ACTION_MOVE -> {
                val target = touchTarget
                if (touchActive && target != null) {
                    synchronized(states) {
                        states[target]?.let { state ->
                            recordTouchMoveDispatch(state, eventTimeNs)
                            for (historyIndex in 0 until event.historySize) {
                                recordTouchMove(state, event.getHistoricalEventTime(historyIndex) * 1_000_000L, historical = true)
                            }
                            recordTouchMove(state, eventTimeNs, historical = false)
                            if (Build.VERSION.SDK_INT >= 29) {
                                val traceId = "${traceSafe(pageLabel)}.${traceSafe(state.identity)}"
                                Trace.setCounter("NewHu.EffectiveScroll.$traceId.touchEventNs", eventTimeNs)
                                Trace.setCounter("NewHu.EffectiveScroll.$traceId.touchX", event.rawX.toLong())
                                Trace.setCounter("NewHu.EffectiveScroll.$traceId.touchY", event.rawY.toLong())
                            }
                        }
                    }
                }
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                val target = touchTarget
                if (target != null) {
                    synchronized(states) {
                        states[target]?.touchUpEventNs = eventTimeNs
                    }
                    postTouchTarget = target
                    touchUpEventNs = eventTimeNs
                    // dispatchTouchEvent runs before the native ScrollView sees ACTION_UP.
                    // Capture on the next main-loop turn so the scroller reflects the
                    // velocity decision made by ReactScrollView for this release.
                    mainHandler.post { capturePostUpScroller(target) }
                }
                touchActive = false
            }
        }
    }

    /** Merge the provider adapter's already-discovered RN scroll descendants into the window probe. */
    @JvmStatic
    public fun registerProviderTargets(views: Collection<View>) {
        if (!running) return
        runOnMain {
            if (!running) return@runOnMain
            synchronized(states) {
                views.forEach { view ->
                    if (view.parent != null && isScrollContainer(view)) {
                        providerTargets[view] = true
                        if (!activeTargets.contains(view)) activeTargets.add(view)
                        if (!states.containsKey(view)) states[view] = TargetState(view, identityFor(view))
                    }
                }
            }
        }
    }

    /** Numeric map is safe for the existing Expo telemetry bridge. */
    @JvmStatic
    public fun snapshot(): Map<String, Number> = synchronized(states) {
        val result = linkedMapOf<String, Number>()
        val durationNs = (SystemClock.elapsedRealtimeNanos() - sessionStartNs).coerceAtLeast(1L)
        result["effectiveScrollProbe.enabled"] = if (running) 1 else 0
        result["effectiveScrollProbe.displayRefreshHz"] = displayRefreshHz
        result["effectiveScrollProbe.elapsedMs"] = durationNs / 1_000_000.0
        result["effectiveScrollProbe.vsyncSamples"] = estimatedVsyncSlots
        result["effectiveScrollProbe.vsyncFps"] = estimatedVsyncSlots * 1_000_000_000.0 / durationNs
        result["effectiveScrollProbe.missedVsyncSlots"] = missedVsyncSlots
        result["effectiveScrollProbe.choreographerCallbackSamples"] = frameTimesNs.size
        result["effectiveScrollProbe.choreographerCallbackFps"] = frameTimesNs.size * 1_000_000_000.0 / durationNs
        result["effectiveScrollProbe.choreographerCallbackIntervalP50Ms"] = percentile(frameIntervals(frameTimesNs), 0.50) / 1_000_000.0
        result["effectiveScrollProbe.choreographerCallbackIntervalP95Ms"] = percentile(frameIntervals(frameTimesNs), 0.95) / 1_000_000.0
        result["effectiveScrollProbe.windowFrameSamples"] = windowFrameTimesNs.size
        result["effectiveScrollProbe.windowFrameFps"] = windowFrameTimesNs.size * 1_000_000_000.0 / durationNs
        result["effectiveScrollProbe.windowFrameIntervalP50Ms"] = percentile(frameIntervals(windowFrameTimesNs), 0.50) / 1_000_000.0
        result["effectiveScrollProbe.windowFrameIntervalP95Ms"] = percentile(frameIntervals(windowFrameTimesNs), 0.95) / 1_000_000.0
        result["effectiveScrollProbe.windowFrameDroppedCallbacks"] = windowFrameDroppedCallbacks
        result["effectiveScrollProbe.windowFrameProbeAttached"] = if (frameMetricsWindow != null) 1 else 0
        result["effectiveScrollProbe.targetCount"] = states.values.count {
            it.activeVsyncSamples > 0L || it.activeWindowFrameSamples > 0L
        }
        var index = 0
        states.values
            .filter { it.activeVsyncSamples > 0L || it.activeDrawSamples > 0L || it.activeWindowFrameSamples > 0L }
            .sortedBy { it.identity }
            .forEach { state ->
                val prefix = "effectiveScrollProbe.target$index."
                val vsyncIntervals = state.updateIntervalsNs
                val drawIntervals = state.drawUpdateIntervalsNs
                val dragIntervals = state.dragUpdateIntervalsNs
                val postTouchIntervals = state.postTouchUpdateIntervalsNs
                val touchIntervals = state.touchMoveIntervalsNs
                val touchDispatchIntervals = state.touchMoveDispatchIntervalsNs
                val nativeIntervals = state.nativeScrollIntervalsNs
                val nativeDragIntervals = state.nativeDragScrollIntervalsNs
                val nativePostTouchIntervals = state.nativePostTouchScrollIntervalsNs
                val activeFps = fps(state.updateIntervalCount, state.activeDurationNs)
                val drawFps = fps(state.drawUpdateIntervalCount, state.drawActiveDurationNs)
                val windowFrameFps = fps(state.windowFrameUpdateIntervalCount, state.windowFrameActiveDurationNs)
                val dragFps = fpsFromIntervals(dragIntervals)
                val postTouchFps = fpsFromIntervals(postTouchIntervals)
                val touchMoveFps = fpsFromIntervals(touchIntervals)
                val touchMoveDispatchFps = fpsFromIntervals(touchDispatchIntervals)
                val nativeScrollFps = fpsFromIntervals(nativeIntervals)
                val nativeDragScrollFps = fpsFromIntervals(nativeDragIntervals)
                val nativePostTouchScrollFps = fpsFromIntervals(nativePostTouchIntervals)
                val oneVsyncCadenceLimitNs = if (displayRefreshHz > 0f) {
                    // Allow 5% timestamp jitter around one display period; the old
                    // 1.25x window mislabeled intervals up to 10.4ms as "8ms" at 120Hz.
                    (1_000_000_000.0 / displayRefreshHz * 1.05).toLong()
                } else 8_750_000L
                result[prefix + "identityHash"] = System.identityHashCode(state.view)
                result[prefix + "nativeViewId"] = state.nativeViewId
                result[prefix + "scrollX"] = state.sampledX
                result[prefix + "scrollY"] = state.sampledY
                result[prefix + "viewportWidth"] = state.sampledWidth
                result[prefix + "viewportHeight"] = state.sampledHeight
                result[prefix + "vsyncSamples"] = state.activeVsyncSamples
                result[prefix + "recordedOffsetSamples"] = state.offsetSamples.size
                result[prefix + "effectiveContentFrames"] = state.changedVsyncSamples
                result[prefix + "duplicateContentFrames"] = state.repeatedVsyncSamples
                result[prefix + "effectiveScrollFps"] = activeFps
                result[prefix + "activeScrollDurationMs"] = state.activeDurationNs / 1_000_000.0
                result[prefix + "dragContentFps"] = dragFps
                result[prefix + "dragOffsetIntervalCount"] = dragIntervals.size
                result[prefix + "dragOffsetIntervalP50Ms"] = percentile(dragIntervals, 0.50) / 1_000_000.0
                result[prefix + "dragOffsetIntervalP95Ms"] = percentile(dragIntervals, 0.95) / 1_000_000.0
                result[prefix + "postTouchContentFps"] = postTouchFps
                result[prefix + "postTouchOffsetIntervalCount"] = postTouchIntervals.size
                result[prefix + "postTouchOffsetIntervalP50Ms"] = percentile(postTouchIntervals, 0.50) / 1_000_000.0
                result[prefix + "postTouchOffsetIntervalP95Ms"] = percentile(postTouchIntervals, 0.95) / 1_000_000.0
                result[prefix + "touchDownEventTimeNs"] = state.touchDownEventNs
                result[prefix + "touchUpEventTimeNs"] = state.touchUpEventNs
                result[prefix + "touchMoveEventCount"] = state.touchMoveEventCount
                result[prefix + "touchMoveEventFps"] = touchMoveFps
                result[prefix + "touchMoveDispatchCount"] = state.touchMoveDispatchCount
                result[prefix + "touchMoveDispatchFps"] = touchMoveDispatchFps
                result[prefix + "touchMoveDispatchIntervalP50Ms"] = percentile(touchDispatchIntervals, 0.50) / 1_000_000.0
                result[prefix + "touchMoveDispatchIntervalP95Ms"] = percentile(touchDispatchIntervals, 0.95) / 1_000_000.0
                result[prefix + "touchHistoricalSampleCount"] = state.touchHistoricalSampleCount
                result[prefix + "touchMoveIntervalCount"] = touchIntervals.size
                result[prefix + "touchMoveIntervalP50Ms"] = percentile(touchIntervals, 0.50) / 1_000_000.0
                result[prefix + "touchMoveIntervalP95Ms"] = percentile(touchIntervals, 0.95) / 1_000_000.0
                result[prefix + "touchMoveMaxIntervalMs"] = (touchIntervals.maxOrNull() ?: 0L) / 1_000_000.0
                result[prefix + "nativeScrollChangeCount"] = state.nativeScrollChangeCount
                result[prefix + "nativeScrollEventFps"] = nativeScrollFps
                result[prefix + "nativeScrollEventIntervalP50Ms"] = percentile(nativeIntervals, 0.50) / 1_000_000.0
                result[prefix + "nativeScrollEventIntervalP95Ms"] = percentile(nativeIntervals, 0.95) / 1_000_000.0
                result[prefix + "nativeDragScrollEventFps"] = nativeDragScrollFps
                result[prefix + "nativeDragScrollEventIntervalP50Ms"] = percentile(nativeDragIntervals, 0.50) / 1_000_000.0
                result[prefix + "nativeDragScrollEventIntervalP95Ms"] = percentile(nativeDragIntervals, 0.95) / 1_000_000.0
                result[prefix + "nativePostTouchScrollEventFps"] = nativePostTouchScrollFps
                result[prefix + "nativePostTouchScrollEventIntervalP50Ms"] = percentile(nativePostTouchIntervals, 0.50) / 1_000_000.0
                result[prefix + "nativePostTouchScrollEventIntervalP95Ms"] = percentile(nativePostTouchIntervals, 0.95) / 1_000_000.0
                result[prefix + "nativeScrollFirstEventTimeNs"] = state.firstNativeScrollChangedNs
                result[prefix + "nativeScrollLastEventTimeNs"] = state.lastNativeScrollEventNs
                result[prefix + "postUpScrollerCaptured"] = if (state.postUpScrollerCaptured) 1 else 0
                result[prefix + "postUpScrollerPresent"] = if (state.postUpScrollerPresent) 1 else 0
                result[prefix + "postUpScrollerFinished"] = if (state.postUpScrollerFinished) 1 else 0
                result[prefix + "postUpScrollerCurrentY"] = state.postUpScrollerCurrentY
                result[prefix + "postUpScrollerFinalY"] = state.postUpScrollerFinalY
                result[prefix + "postUpScrollerDistancePx"] = state.postUpScrollerFinalY - state.postUpScrollerCurrentY
                result[prefix + "postUpScrollerVelocityPxPerSec"] = state.postUpScrollerVelocityPxPerSec
                result[prefix + "postUpMaxScrollY"] = state.postUpMaxScrollY
                result[prefix + "postUpViewScrollY"] = state.postUpViewScrollY
                result[prefix + "postTouchScrollerFrameSamples"] = state.postTouchScrollerFrameSamples
                result[prefix + "postTouchScrollerActiveFrameSamples"] = state.postTouchScrollerActiveFrameSamples
                result[prefix + "postTouchScrollerFirstCurrentY"] = state.postTouchScrollerFirstCurrentY
                result[prefix + "postTouchScrollerLastCurrentY"] = state.postTouchScrollerLastCurrentY
                result[prefix + "postTouchScrollerLastFinalY"] = state.postTouchScrollerLastFinalY
                result[prefix + "postTouchScrollerMaxCurrentDeltaPx"] = state.postTouchScrollerMaxCurrentDeltaPx
                result[prefix + "postTouchViewFirstY"] = state.postTouchViewFirstY
                result[prefix + "postTouchViewLastY"] = state.postTouchViewLastY
                result[prefix + "contentIntervalCount"] = state.updateIntervalCount
                result[prefix + "contentIntervalWithinOneVsyncRatio"] = ratio(vsyncIntervals.count { it <= oneVsyncCadenceLimitNs }, vsyncIntervals.size)
                result[prefix + "interval16_67msPlusRatio"] = ratio(vsyncIntervals.count { it >= 16_670_000L }, vsyncIntervals.size)
                result[prefix + "interval25msPlusRatio"] = ratio(vsyncIntervals.count { it >= 25_000_000L }, vsyncIntervals.size)
                result[prefix + "interval33_3msPlusRatio"] = ratio(vsyncIntervals.count { it >= 33_300_000L }, vsyncIntervals.size)
                result[prefix + "interval50msPlusRatio"] = ratio(vsyncIntervals.count { it >= 50_000_000L }, vsyncIntervals.size)
                result[prefix + "interval100msPlusRatio"] = ratio(vsyncIntervals.count { it >= 100_000_000L }, vsyncIntervals.size)
                result[prefix + "contentIntervalP50Ms"] = percentile(vsyncIntervals, 0.50) / 1_000_000.0
                result[prefix + "contentIntervalP90Ms"] = percentile(vsyncIntervals, 0.90) / 1_000_000.0
                result[prefix + "contentIntervalP95Ms"] = percentile(vsyncIntervals, 0.95) / 1_000_000.0
                result[prefix + "contentIntervalP99Ms"] = percentile(vsyncIntervals, 0.99) / 1_000_000.0
                result[prefix + "maxContentStallMs"] = state.maxStallNs / 1_000_000.0
                result[prefix + "drawSamples"] = state.activeDrawSamples
                result[prefix + "drawChangedFrames"] = state.changedDrawSamples
                result[prefix + "drawRepeatedFrames"] = state.repeatedDrawSamples
                result[prefix + "drawEffectiveFps"] = drawFps
                result[prefix + "drawActiveScrollDurationMs"] = state.drawActiveDurationNs / 1_000_000.0
                result[prefix + "drawContentIntervalCount"] = state.drawUpdateIntervalCount
                result[prefix + "drawContentIntervalP50Ms"] = percentile(drawIntervals, 0.50) / 1_000_000.0
                result[prefix + "drawContentIntervalP95Ms"] = percentile(drawIntervals, 0.95) / 1_000_000.0
                result[prefix + "drawMaxContentStallMs"] = state.drawMaxStallNs / 1_000_000.0
                result[prefix + "windowFrameSamples"] = state.activeWindowFrameSamples
                result[prefix + "windowFrameChangedFrames"] = state.changedWindowFrameSamples
                result[prefix + "windowFrameDuplicateFrames"] = state.repeatedWindowFrameSamples
                result[prefix + "windowFrameEffectiveFps"] = windowFrameFps
                result[prefix + "windowFrameActiveDurationMs"] = state.windowFrameActiveDurationNs / 1_000_000.0
                result[prefix + "windowFrameIntervalCount"] = state.windowFrameUpdateIntervalCount
                result[prefix + "windowFrameContentIntervalP50Ms"] = percentile(state.windowFrameUpdateIntervalsNs, 0.50) / 1_000_000.0
                result[prefix + "windowFrameContentIntervalP95Ms"] = percentile(state.windowFrameUpdateIntervalsNs, 0.95) / 1_000_000.0
                result[prefix + "windowFrameMaxContentStallMs"] = state.windowFrameMaxStallNs / 1_000_000.0
                Log.i(TAG, "[EFFECTIVE_SCROLL_FPS] page=$pageLabel target=${state.identity} " +
                    "contentFPS=${activeFps.format1()} drawFPS=${drawFps.format1()} " +
                    "changed=${state.changedVsyncSamples} duplicate=${state.repeatedVsyncSamples} " +
                    "p95Ms=${(percentile(vsyncIntervals, 0.95) / 1_000_000.0).format1()} " +
                    "maxStallMs=${(state.maxStallNs / 1_000_000.0).format1()}")
                index += 1
            }
        result["effectiveScrollProbe.targetCount"] = index
        result
    }

    private fun beginSessionOnMain(page: String) {
        synchronized(states) {
            pageLabel = page.replace(Regex("[^A-Za-z0-9_. -]"), "_")
            states.clear()
            providerTargets.clear()
            frameTimesNs.clear()
            windowFrameTimesNs.clear()
            estimatedVsyncSlots = 0L
            missedVsyncSlots = 0L
            windowFrameDroppedCallbacks = 0L
            sessionStartNs = SystemClock.elapsedRealtimeNanos()
            lastFrameTimeNs = 0L
            lastDrawFrameNs = 0L
            touchActive = false
            touchTarget = null
            postTouchTarget = null
            touchUpEventNs = 0L
            lastFocusTarget = null
        }
        refreshTargets()
    }

    private fun refreshTargets() {
        val rootView = root ?: return
        activeTargets.clear()
        collectTargets(rootView)
        providerTargets.keys.forEach { view ->
            if (view.parent != null && view.isShown && !activeTargets.contains(view)) {
                activeTargets.add(view)
                synchronized(states) {
                    if (!states.containsKey(view)) states[view] = TargetState(view, identityFor(view))
                }
            }
        }
    }

    private fun collectTargets(view: View) {
        if (view !== root && isScrollContainer(view)) {
            if (view.isShown && view.windowVisibility == View.VISIBLE) {
                activeTargets.add(view)
                synchronized(states) {
                    if (!states.containsKey(view)) states[view] = TargetState(view, identityFor(view))
                }
            }
        }
        if (view is ViewGroup) {
            for (index in 0 until view.childCount) collectTargets(view.getChildAt(index))
        }
    }

    private fun sampleVsync(frameTimeNs: Long) {
        val visible = activeTargets
        val moved = ArrayList<View>()
        visible.forEach { view ->
            val state = synchronized(states) { states[view] } ?: return@forEach
            val x = view.scrollX
            val y = view.scrollY
            if (x != state.previousX || y != state.previousY) moved.add(view)
        }
        val focus = chooseFocusTarget(moved, frameTimeNs)
        synchronized(states) {
            if (frameTimesNs.size < MAX_SAMPLES) frameTimesNs.add(frameTimeNs)
            val frameDelta = if (lastFrameTimeNs > 0L) frameTimeNs - lastFrameTimeNs else 0L
            val displayPeriodNs = if (displayRefreshHz > 0f) 1_000_000_000.0 / displayRefreshHz else 0.0
            val frameSlots = if (frameDelta > 0L && displayPeriodNs > 0.0) {
                max(1, (frameDelta / displayPeriodNs).roundToInt())
            } else {
                1
            }
            estimatedVsyncSlots += frameSlots
            missedVsyncSlots += (frameSlots - 1).toLong()
            lastFrameTimeNs = frameTimeNs
            visible.forEach { view ->
                val state = states[view] ?: return@forEach
                val x = view.scrollX
                val y = view.scrollY
                val deltaX = x - state.previousX
                val deltaY = y - state.previousY
                val changed = deltaX != 0 || deltaY != 0
                val isDraggedTarget = touchActive && touchTarget === view
                val isPostTouchTarget = isPostTouchCaptureActive(view, frameTimeNs)
                if (isPostTouchTarget) {
                    samplePostTouchScroller(view, state, frameTimeNs)
                }
                state.sampledX = x
                state.sampledY = y
                state.sampledWidth = view.width
                state.sampledHeight = view.height
                if (changed) {
                    val previousChange = state.lastChangedNs
                    if (previousChange > 0L) {
                        val interval = frameTimeNs - previousChange
                        if (interval > 0L && (interval <= ACTIVE_TAIL_NS || isDraggedTarget || isPostTouchTarget)) {
                            addBounded(state.updateIntervalsNs, interval)
                            state.updateIntervalCount += 1L
                            state.activeDurationNs += interval
                            state.maxStallNs = max(state.maxStallNs, interval)
                        }
                    }
                    if (isDraggedTarget && state.lastDragChangedNs > 0L) {
                        addBounded(state.dragUpdateIntervalsNs, frameTimeNs - state.lastDragChangedNs)
                    } else if (isPostTouchTarget && state.lastPostTouchChangedNs > 0L) {
                        addBounded(state.postTouchUpdateIntervalsNs, frameTimeNs - state.lastPostTouchChangedNs)
                    }
                    if (isDraggedTarget) state.lastDragChangedNs = frameTimeNs
                    if (isPostTouchTarget) state.lastPostTouchChangedNs = frameTimeNs
                    state.lastChangedNs = frameTimeNs
                    state.previousX = x
                    state.previousY = y
                    lastFocusTarget = view
                }
                val withinActiveTail = state.lastChangedNs > 0L && frameTimeNs - state.lastChangedNs <= ACTIVE_TAIL_NS
                val active = isDraggedTarget || view === focus || withinActiveTail
                if (active) {
                    state.activeVsyncSamples += frameSlots.toLong()
                    if (changed) {
                        state.changedVsyncSamples += 1L
                        state.repeatedVsyncSamples += (frameSlots - 1).toLong()
                    } else {
                        state.repeatedVsyncSamples += frameSlots.toLong()
                    }
                    addBounded(state.offsetSamples, OffsetFrameSample(frameTimeNs, x, y, deltaX, deltaY, changed))
                    if (Build.VERSION.SDK_INT >= 29) {
                        val traceId = "${traceSafe(pageLabel)}.${traceSafe(state.identity)}"
                        Trace.setCounter("NewHu.EffectiveScroll.$traceId.offsetY", y.toLong())
                        Trace.setCounter("NewHu.EffectiveScroll.$traceId.deltaY", deltaY.toLong())
                        Trace.setCounter("NewHu.EffectiveScroll.$traceId.changed", if (changed) 1L else 0L)
                    }
                    if (isDraggedTarget && state.lastChangedNs > 0L) {
                        state.maxStallNs = max(state.maxStallNs, frameTimeNs - state.lastChangedNs)
                    }
                    if (state.lastActiveSampleNs > 0L && frameDelta > 0L && (frameDelta <= ACTIVE_TAIL_NS || isDraggedTarget)) {
                        // The sample cadence is also useful when a scroll is visibly stationary during a drag.
                        if (frameDelta > ACTIVE_TAIL_NS) state.maxStallNs = max(state.maxStallNs, frameDelta)
                    }
                    state.lastActiveSampleNs = frameTimeNs
                }
            }
        }
    }

    private fun sampleNativeScrollChanged(eventTimeNs: Long) {
        val visible = activeTargets
        synchronized(states) {
            visible.forEach { view ->
                val state = states[view] ?: return@forEach
                val x = view.scrollX
                val y = view.scrollY
                if (x == state.nativeX && y == state.nativeY) return@forEach
                state.nativeX = x
                state.nativeY = y
                state.nativeScrollChangeCount += 1L
                if (state.firstNativeScrollChangedNs == 0L) state.firstNativeScrollChangedNs = eventTimeNs
                state.lastNativeScrollEventNs = eventTimeNs
                val interval = if (state.lastNativeScrollChangedNs > 0L) eventTimeNs - state.lastNativeScrollChangedNs else 0L
                val dragged = touchActive && touchTarget === view
                val postTouch = isPostTouchCaptureActive(view, eventTimeNs)
                if (interval > 0L && (interval <= ACTIVE_TAIL_NS || dragged || postTouch)) {
                    addBounded(state.nativeScrollIntervalsNs, interval)
                    if (dragged && state.lastNativeDragScrollChangedNs > 0L) {
                        addBounded(state.nativeDragScrollIntervalsNs, eventTimeNs - state.lastNativeDragScrollChangedNs)
                    } else if (postTouch && state.lastNativePostTouchScrollChangedNs > 0L) {
                        addBounded(state.nativePostTouchScrollIntervalsNs, eventTimeNs - state.lastNativePostTouchScrollChangedNs)
                    }
                }
                if (dragged) state.lastNativeDragScrollChangedNs = eventTimeNs
                if (postTouch) state.lastNativePostTouchScrollChangedNs = eventTimeNs
                state.lastNativeScrollChangedNs = eventTimeNs
                if (Build.VERSION.SDK_INT >= 29) {
                    val traceId = "${traceSafe(pageLabel)}.${traceSafe(state.identity)}"
                    Trace.setCounter("NewHu.EffectiveScroll.$traceId.nativeOffsetY", y.toLong())
                    Trace.setCounter("NewHu.EffectiveScroll.$traceId.nativeScrollEventNs", eventTimeNs)
                }
            }
        }
    }

    private fun capturePostUpScroller(view: View) {
        val state = synchronized(states) { states[view] } ?: return
        val scroller = findScroller(view)
        val contentHeight = if (view is ViewGroup && view.childCount > 0) view.getChildAt(0).height else 0
        val maxScrollY = (contentHeight - view.height + view.paddingTop + view.paddingBottom).coerceAtLeast(0)
        synchronized(states) {
            state.postUpScrollerCaptured = true
            state.postUpScrollerPresent = scroller != null
            state.postUpScrollerFinished = scroller?.isFinished ?: true
            state.postUpScrollerCurrentY = scroller?.currY ?: view.scrollY
            state.postUpScrollerFinalY = scroller?.finalY ?: view.scrollY
            state.postUpScrollerVelocityPxPerSec = scroller?.currVelocity ?: 0f
            state.postUpMaxScrollY = maxScrollY
            state.postUpViewScrollY = view.scrollY
        }
    }

    private fun samplePostTouchScroller(view: View, state: TargetState, frameTimeNs: Long) {
        if (state.postTouchScrollerFrameSamples >= 60L || frameTimeNs - touchUpEventNs > 500_000_000L) return
        val scroller = findScroller(view) ?: return
        val currentY = scroller.currY
        val finished = scroller.isFinished
        synchronized(states) {
            if (state.postTouchScrollerFrameSamples == 0L) {
                state.postTouchScrollerFirstCurrentY = currentY
                state.postTouchViewFirstY = view.scrollY
            }
            state.postTouchScrollerFrameSamples += 1L
            if (!finished) state.postTouchScrollerActiveFrameSamples += 1L
            state.postTouchScrollerLastCurrentY = currentY
            state.postTouchScrollerLastFinalY = scroller.finalY
            state.postTouchScrollerMaxCurrentDeltaPx = max(
                state.postTouchScrollerMaxCurrentDeltaPx,
                kotlin.math.abs(currentY - state.postUpScrollerCurrentY),
            )
            state.postTouchViewLastY = view.scrollY
        }
        if (Build.VERSION.SDK_INT >= 29) {
            val traceId = "${traceSafe(pageLabel)}.${traceSafe(state.identity)}"
            Trace.setCounter("NewHu.EffectiveScroll.$traceId.scrollerCurrentY", currentY.toLong())
            Trace.setCounter("NewHu.EffectiveScroll.$traceId.scrollerFinalY", scroller.finalY.toLong())
            Trace.setCounter("NewHu.EffectiveScroll.$traceId.scrollerFinished", if (finished) 1L else 0L)
            Trace.setCounter("NewHu.EffectiveScroll.$traceId.viewScrollY", view.scrollY.toLong())
        }
    }

    private fun findScroller(view: View): OverScroller? {
        val field = synchronized(this) {
            if (!scrollerFieldLookupComplete) {
                var type: Class<*>? = view.javaClass
                while (type != null && scrollerField == null) {
                    val currentType = type
                    scrollerField = runCatching { currentType.getDeclaredField("mScroller").apply { isAccessible = true } }.getOrNull()
                    type = currentType.superclass
                }
                scrollerFieldLookupComplete = true
            }
            scrollerField
        } ?: return null
        return runCatching { field.get(view) as? OverScroller }.getOrNull()
    }

    private fun sampleRootDraw(frameTimeNsRaw: Long) {
        val frameTimeNs = frameTimeNsRaw.takeIf { it > 0L } ?: System.nanoTime()
        if (frameTimeNs == lastDrawFrameNs) return
        lastDrawFrameNs = frameTimeNs
        val visible = activeTargets
        synchronized(states) {
            visible.forEach { view ->
                val state = states[view] ?: return@forEach
                val x = view.scrollX
                val y = view.scrollY
                val deltaX = x - state.previousDrawX
                val deltaY = y - state.previousDrawY
                val changed = deltaX != 0 || deltaY != 0
                state.sampledX = x
                state.sampledY = y
                state.sampledWidth = view.width
                state.sampledHeight = view.height
                val isDraggedTarget = touchActive && touchTarget === view
                val isPostTouchTarget = isPostTouchCaptureActive(view, frameTimeNs)
                if (changed) {
                    val previousChange = state.drawLastChangedNs
                    if (previousChange > 0L) {
                        val interval = frameTimeNs - previousChange
                        if (interval > 0L && (interval <= ACTIVE_TAIL_NS || isDraggedTarget || isPostTouchTarget)) {
                            addBounded(state.drawUpdateIntervalsNs, interval)
                            state.drawUpdateIntervalCount += 1L
                            state.drawActiveDurationNs += interval
                            state.drawMaxStallNs = max(state.drawMaxStallNs, interval)
                        }
                    }
                    state.drawLastChangedNs = frameTimeNs
                    state.previousDrawX = x
                    state.previousDrawY = y
                    lastFocusTarget = view
                }
                val withinActiveTail = state.drawLastChangedNs > 0L && frameTimeNs - state.drawLastChangedNs <= ACTIVE_TAIL_NS
                val active = isDraggedTarget || view === lastFocusTarget || withinActiveTail
                if (active) {
                    state.activeDrawSamples += 1L
                    if (changed) state.changedDrawSamples += 1L else state.repeatedDrawSamples += 1L
                    if (isDraggedTarget && state.drawLastChangedNs > 0L) {
                        state.drawMaxStallNs = max(state.drawMaxStallNs, frameTimeNs - state.drawLastChangedNs)
                    }
                }
            }
        }
    }

    /** Samples the view offset only when Android reports a completed Window frame. */
    private fun sampleWindowFrame(metrics: FrameMetrics, droppedSinceLast: Int) {
        val intendedVsyncNs = metrics.getMetric(FrameMetrics.INTENDED_VSYNC_TIMESTAMP)
        val frameTimeNs = metrics.getMetric(FrameMetrics.VSYNC_TIMESTAMP).takeIf { it > 0L }
            ?: intendedVsyncNs.takeIf { it > 0L }
            ?: System.nanoTime()
        if (windowFrameTimesNs.size < MAX_SAMPLES) windowFrameTimesNs.add(frameTimeNs)
        if (droppedSinceLast > 0) windowFrameDroppedCallbacks += droppedSinceLast.toLong()

        val visible = activeTargets
        val moved = visible.filter { view ->
            val state = synchronized(states) { states[view] } ?: return@filter false
            view.scrollX != state.previousWindowFrameX || view.scrollY != state.previousWindowFrameY
        }
        val focus = chooseFocusTarget(moved, frameTimeNs)
        synchronized(states) {
            visible.forEach { view ->
                val state = states[view] ?: return@forEach
                val x = view.scrollX
                val y = view.scrollY
                val changed = x != state.previousWindowFrameX || y != state.previousWindowFrameY
                val dragged = touchActive && touchTarget === view
                val postTouch = isPostTouchCaptureActive(view, frameTimeNs)
                if (changed) {
                    val previousChange = state.windowFrameLastChangedNs
                    if (previousChange > 0L) {
                        val interval = frameTimeNs - previousChange
                        if (interval > 0L && (interval <= ACTIVE_TAIL_NS || dragged || postTouch)) {
                            addBounded(state.windowFrameUpdateIntervalsNs, interval)
                            state.windowFrameUpdateIntervalCount += 1L
                            state.windowFrameActiveDurationNs += interval
                            state.windowFrameMaxStallNs = max(state.windowFrameMaxStallNs, interval)
                        }
                    }
                    state.windowFrameLastChangedNs = frameTimeNs
                    state.previousWindowFrameX = x
                    state.previousWindowFrameY = y
                }
                val withinActiveTail = state.windowFrameLastChangedNs > 0L &&
                    frameTimeNs - state.windowFrameLastChangedNs <= ACTIVE_TAIL_NS
                if (dragged || view === focus || withinActiveTail) {
                    state.activeWindowFrameSamples += 1L
                    if (changed) state.changedWindowFrameSamples += 1L
                    else state.repeatedWindowFrameSamples += 1L
                }
            }
        }
    }

    private fun chooseFocusTarget(moved: List<View>, nowNs: Long): View? {
        val dragged = touchTarget?.takeIf { touchActive && activeTargets.contains(it) }
        if (dragged != null) return dragged
        if (moved.isNotEmpty()) return moved.maxByOrNull(::viewDepth)
        val previous = lastFocusTarget ?: return null
        val state = synchronized(states) { states[previous] }
        return previous.takeIf { state != null && state.lastChangedNs > 0L && nowNs - state.lastChangedNs <= ACTIVE_TAIL_NS }
    }

    private fun recordTouchMoveDispatch(state: TargetState, eventTimeNs: Long) {
        if (state.lastTouchMoveDispatchNs > 0L) {
            val interval = eventTimeNs - state.lastTouchMoveDispatchNs
            if (interval > 0L) addBounded(state.touchMoveDispatchIntervalsNs, interval)
        }
        state.lastTouchMoveDispatchNs = eventTimeNs
        state.touchMoveDispatchCount += 1L
    }

    private fun recordTouchMove(state: TargetState, eventTimeNs: Long, historical: Boolean) {
        if (state.lastTouchMoveEventNs > 0L) {
            val interval = eventTimeNs - state.lastTouchMoveEventNs
            if (interval > 0L) addBounded(state.touchMoveIntervalsNs, interval)
        }
        state.lastTouchMoveEventNs = eventTimeNs
        state.touchMoveEventCount += 1L
        if (historical) state.touchHistoricalSampleCount += 1L
    }

    private fun isPostTouchCaptureActive(view: View, frameTimeNs: Long): Boolean =
        postTouchTarget === view && touchUpEventNs > 0L &&
            frameTimeNs >= touchUpEventNs && frameTimeNs - touchUpEventNs <= POST_TOUCH_CAPTURE_WINDOW_NS

    private fun findTargetAt(rawX: Int, rawY: Int): View? {
        var best: View? = null
        var bestDepth = -1
        var bestArea = Long.MAX_VALUE
        val rect = android.graphics.Rect()
        for (view in activeTargets) {
            if (!view.isShown || !view.getGlobalVisibleRect(rect) || !rect.contains(rawX, rawY) || !canScroll(view)) continue
            val depth = viewDepth(view)
            val area = rect.width().toLong() * rect.height().toLong()
            if (depth > bestDepth || (depth == bestDepth && area < bestArea)) {
                best = view
                bestDepth = depth
                bestArea = area
            }
        }
        return best
    }

    private fun viewDepth(view: View): Int {
        var depth = 0
        var parent = view.parent
        while (parent is View && parent !== root) {
            depth += 1
            parent = parent.parent
        }
        return depth
    }

    private fun isScrollContainer(view: View): Boolean {
        if (view is ScrollView || view is HorizontalScrollView) return true
        var type: Class<*>? = view.javaClass
        while (type != null && type != Any::class.java) {
            val name = type.simpleName
            if (name.endsWith("ScrollView") || name == "RecyclerView") return true
            type = type.superclass
        }
        return false
    }

    private fun canScroll(view: View): Boolean =
        view.canScrollVertically(-1) || view.canScrollVertically(1) ||
            view.canScrollHorizontally(-1) || view.canScrollHorizontally(1)

    private fun identityFor(view: View): String =
        "${view.javaClass.simpleName.ifEmpty { "View" }}_id${view.id}_h${Integer.toHexString(System.identityHashCode(view))}"

    private fun findActivityWindow(context: Context): Window? {
        var current: Context? = context
        while (current != null) {
            if (current is Activity) return current.window
            val wrapper = current as? ContextWrapper ?: return null
            val next = wrapper.baseContext
            if (next === current) return null
            current = next
        }
        return null
    }

    private fun stopOnMain() {
        if (!running) return
        running = false
        Choreographer.getInstance().removeFrameCallback(frameCallback)
        frameMetricsWindow?.removeOnFrameMetricsAvailableListener(frameMetricsListener)
        frameMetricsWindow = null
        root?.removeOnAttachStateChangeListener(attachListener)
        root?.viewTreeObserver?.takeIf { it.isAlive }?.let {
            it.removeOnGlobalLayoutListener(globalLayoutListener)
            it.removeOnDrawListener(drawListener)
            it.removeOnScrollChangedListener(scrollChangedListener)
        }
        touchTarget = null
        touchActive = false
        activeTargets.clear()
        root = null
    }

    @JvmStatic
    public fun stop() { runOnMain(::stopOnMain) }

    private fun runOnMain(action: () -> Unit) {
        if (android.os.Looper.myLooper() == android.os.Looper.getMainLooper()) action()
        else mainHandler.post(action)
    }

    private fun frameIntervals(times: List<Long>): List<Long> =
        times.zipWithNext { first, second -> second - first }.filter { it > 0L }

    private fun addBounded(values: MutableList<Long>, value: Long) {
        if (values.size < MAX_SAMPLES) values.add(value)
    }

    private fun addBounded(values: MutableList<OffsetFrameSample>, value: OffsetFrameSample) {
        if (values.size < MAX_SAMPLES) values.add(value)
    }

    private fun traceSafe(value: String): String = value.replace(Regex("[^A-Za-z0-9_.-]"), "_")

    private fun percentile(values: List<Long>, p: Double): Double {
        if (values.isEmpty()) return 0.0
        val sorted = values.sorted()
        return sorted[((sorted.size - 1) * p).toInt()].toDouble()
    }

    private fun fps(intervalCount: Long, durationNs: Long): Double =
        if (intervalCount <= 0L || durationNs <= 0L) 0.0 else intervalCount * 1_000_000_000.0 / durationNs

    private fun fpsFromIntervals(intervals: List<Long>): Double {
        val durationNs = intervals.sum()
        return if (intervals.isEmpty() || durationNs <= 0L) 0.0
        else intervals.size * 1_000_000_000.0 / durationNs
    }

    private fun ratio(part: Int, total: Int): Double = if (total <= 0) 0.0 else part.toDouble() * 100.0 / total

    private fun Double.format1(): String = String.format(java.util.Locale.US, "%.1f", this)
}

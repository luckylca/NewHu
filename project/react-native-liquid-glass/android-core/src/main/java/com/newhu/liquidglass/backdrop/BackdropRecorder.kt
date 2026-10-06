package com.newhu.liquidglass.backdrop

import android.graphics.Canvas
import android.graphics.Rect
import android.graphics.RenderNode
import android.os.Build
import android.view.View
import androidx.annotation.RequiresApi
import com.newhu.liquidglass.telemetry.LiquidGlassPerfTelemetry
import java.util.IdentityHashMap
import java.util.concurrent.CopyOnWriteArrayList

/**
 * Anything that can serve as the backdrop behind [LiquidGlassView]s.
 *
 * Implemented by [LiquidGlassProviderLayout] for plain Android apps and by
 * host-specific containers (the React Native provider view, for example) that
 * cannot extend it. Implementations typically delegate the heavy lifting to a
 * [BackdropRecorder].
 */
public interface LiquidGlassBackdropSource {

    /** The view whose window coordinates anchor the backdrop. */
    public val sourceView: View

    /** The recorded backdrop; null below API 29 or before the first draw. */
    @get:RequiresApi(29)
    public val contentRenderNode: RenderNode?

    /** True once a hardware recording of the backdrop exists. */
    public val hasRecording: Boolean

    /** Crop origin of the current recording in source-view-local pixels. */
    public val recordedOriginX: Int
        get() = 0
    public val recordedOriginY: Int
        get() = 0

    public fun renderNodeFor(consumer: View): RenderNode? = contentRenderNode
    public fun recordedOriginXFor(consumer: View): Int = recordedOriginX
    public fun recordedOriginYFor(consumer: View): Int = recordedOriginY

    public fun registerConsumer(consumer: View)

    public fun unregisterConsumer(consumer: View)

    /** Ask the provider to refresh on the next display frame. */
    public fun requestCaptureFrame() {}

    /** Supplies native scroll metadata so implementations can cache a moving backdrop window. */
    public fun setScrollSource(source: GlassScrollSource?) {}

    /** Whether moving a glass consumer requires a new backdrop recording. */
    public val requiresCaptureOnConsumerMovement: Boolean
        get() = true

    /** Called when sampling geometry moves; full-scene providers can keep the current recording. */
    public fun onConsumerGeometryChanged(consumer: View) {
        if (requiresCaptureOnConsumerMovement) requestCaptureFrame()
    }
}

/**
 * The reusable backdrop capture engine: records a ViewGroup's children into a
 * [RenderNode] during its draw pass (API 29+, hardware canvas) and keeps every
 * registered [LiquidGlassView] refreshed.
 *
 * Call [drawRecorded] from the owner's `dispatchDraw` and [release] when the
 * owner detaches.
 */
public class BackdropRecorder {

    private val consumers = CopyOnWriteArrayList<View>()
    private val consumerRegionNodes = IdentityHashMap<View, RenderNode>()
    private val consumerRegionBounds = IdentityHashMap<View, Rect>()
    // Reused scratch objects: capture runs on the UI thread and may execute every
    // display frame, so avoid coordinate-array/Rect allocation per consumer.
    private val clampedCaptureBounds = Rect()
    public val hasConsumers: Boolean
        get() = consumers.isNotEmpty()

    public fun consumersSnapshot(): List<View> = consumers.toList()

    /** The live recording, exposed through [LiquidGlassBackdropSource]. */
    public var contentNode: RenderNode? = null
        private set

    public val hasRecording: Boolean
        get() = Build.VERSION.SDK_INT >= 29 && contentNode?.hasDisplayList() == true

    /** Crop origin of [contentNode] in provider-local pixels. */
    public var originX: Int = 0
        private set
    public var originY: Int = 0
        private set

    public fun register(consumer: View) { consumers.addIfAbsent(consumer) }

    public fun unregister(consumer: View) {
        consumers.remove(consumer)
        val node = consumerRegionNodes.remove(consumer)
        if (Build.VERSION.SDK_INT >= 29) node?.discardDisplayList()
        consumerRegionBounds.remove(consumer)
    }

    public fun clearConsumerRegions() {
        if (Build.VERSION.SDK_INT >= 29) {
            for (node in consumerRegionNodes.values) node.discardDisplayList()
        }
        consumerRegionNodes.clear()
        consumerRegionBounds.clear()
    }

    /** Build consumer slices from the shared route node without traversing the View tree again. */
    public fun updateConsumerRegions(
        regions: Map<View, Rect>,
        source: RenderNode,
        width: Int,
        height: Int,
    ): Long {
        if (Build.VERSION.SDK_INT < 29 || width <= 0 || height <= 0 || !source.hasDisplayList()) return 0L
        val removed = consumerRegionNodes.keys.filter { !regions.containsKey(it) }
        for (consumer in removed) {
            consumerRegionNodes.remove(consumer)?.discardDisplayList()
            consumerRegionBounds.remove(consumer)
        }

        var recordedPixels = 0L
        for (consumer in consumers) {
            val requested = regions[consumer] ?: continue
            clampedCaptureBounds.set(
                requested.left.coerceIn(0, width),
                requested.top.coerceIn(0, height),
                requested.right.coerceIn(0, width),
                requested.bottom.coerceIn(0, height),
            )
            if (clampedCaptureBounds.width() <= 0 || clampedCaptureBounds.height() <= 0) continue
            val existing = consumerRegionBounds[consumer]
            if (existing == clampedCaptureBounds) {
                LiquidGlassPerfTelemetry.regionRenderNodeReuse()
                continue
            }
            val bounds = Rect(clampedCaptureBounds)
            val node = consumerRegionNodes[consumer]
                ?: RenderNode("LiquidGlassRegion-${System.identityHashCode(consumer)}").also {
                    consumerRegionNodes[consumer] = it
                }
            node.setPosition(0, 0, bounds.width(), bounds.height())
            val recording = node.beginRecording(bounds.width(), bounds.height())
            try {
                recording.clipRect(0f, 0f, bounds.width().toFloat(), bounds.height().toFloat())
                recording.translate(-bounds.left.toFloat(), -bounds.top.toFloat())
                recording.drawRenderNode(source)
            } finally {
                node.endRecording()
            }
            consumerRegionBounds[consumer] = bounds
            val regionPixels = bounds.width().toLong() * bounds.height().toLong()
            recordedPixels += regionPixels
            LiquidGlassPerfTelemetry.regionRenderNodeRecord(bounds.width(), bounds.height())
        }
        return recordedPixels
    }

    public fun renderNodeFor(consumer: View): RenderNode? = consumerRegionNodes[consumer] ?: contentNode
    public fun regionNodeFor(consumer: View): RenderNode? = consumerRegionNodes[consumer]
    public fun recordedOriginXFor(consumer: View): Int = consumerRegionBounds[consumer]?.left ?: originX
    public fun recordedOriginYFor(consumer: View): Int = consumerRegionBounds[consumer]?.top ?: originY

    /** Re-draw consumers against nested RenderNodes without re-recording the route tree. */
    public fun invalidateConsumers() {
        for (consumer in consumers) consumer.postInvalidateOnAnimation()
    }

    /** Record the backdrop while leaving the owner's normal on-screen draw pass intact. */
    public fun recordOnly(
        width: Int,
        height: Int,
        captureBounds: Rect? = null,
        drawContent: (Canvas) -> Unit,
    ) {
        if (Build.VERSION.SDK_INT >= 29 && width > 0 && height > 0) {
            val node = contentNode
                ?: RenderNode("LiquidGlassBackdrop").also { contentNode = it }
            val bounds = captureBounds?.let {
                clampedCaptureBounds.set(
                    it.left.coerceIn(0, width),
                    it.top.coerceIn(0, height),
                    it.right.coerceIn(0, width),
                    it.bottom.coerceIn(0, height),
                )
                clampedCaptureBounds.takeIf { rect -> rect.width() > 0 && rect.height() > 0 }
            }
            val originX = bounds?.left ?: 0
            val originY = bounds?.top ?: 0
            val recordedWidth = bounds?.width() ?: width
            val recordedHeight = bounds?.height() ?: height
            node.setPosition(0, 0, recordedWidth, recordedHeight)
            val recording = node.beginRecording(recordedWidth, recordedHeight)
            try {
                if (bounds != null) {
                    recording.clipRect(0f, 0f, recordedWidth.toFloat(), recordedHeight.toFloat())
                    recording.translate(-originX.toFloat(), -originY.toFloat())
                }
                drawContent(recording)
            } finally {
                node.endRecording()
            }
            this.originX = originX
            this.originY = originY
            LiquidGlassPerfTelemetry.sourceRenderNodeRecorded(recordedWidth, recordedHeight)
        }
        for (consumer in consumers) consumer.postInvalidateOnAnimation()
    }

    /** Record only a source window; its owner remains responsible for normal screen drawing. */
    public fun recordWindow(
        width: Int,
        height: Int,
        captureBounds: Rect,
        drawContent: (Canvas) -> Unit,
    ): Boolean {
        if (Build.VERSION.SDK_INT < 29 || width <= 0 || height <= 0) return false
        clampedCaptureBounds.set(
            captureBounds.left.coerceIn(0, width),
            captureBounds.top.coerceIn(0, height),
            captureBounds.right.coerceIn(0, width),
            captureBounds.bottom.coerceIn(0, height),
        )
        if (clampedCaptureBounds.width() <= 0 || clampedCaptureBounds.height() <= 0) return false
        val bounds = Rect(clampedCaptureBounds)
        val node = contentNode
            ?: RenderNode("LiquidGlassScrollWindow").also { contentNode = it }
        node.setPosition(0, 0, bounds.width(), bounds.height())
        val recording = node.beginRecording(bounds.width(), bounds.height())
        try {
            recording.clipRect(0f, 0f, bounds.width().toFloat(), bounds.height().toFloat())
            recording.translate(-bounds.left.toFloat(), -bounds.top.toFloat())
            drawContent(recording)
        } finally {
            node.endRecording()
        }
        originX = bounds.left
        originY = bounds.top
        LiquidGlassPerfTelemetry.routeRenderNodeRecord()
        LiquidGlassPerfTelemetry.routeTreeTraversal()
        LiquidGlassPerfTelemetry.sourceRenderNodeRecorded(bounds.width(), bounds.height())
        LiquidGlassPerfTelemetry.sourceWindowRecorded(bounds.width(), bounds.height())
        return true
    }

    /**
     * Draw a provider's live child tree once into the shared RenderNode, then
     * composite that same display list to the screen. Consumers sample the
     * exact node that was just presented; no second ViewGroup traversal or
     * screen-sized bitmap is created.
     *
     * Returns true when the hardware RenderNode path was used.
     */
    public fun drawShared(
        canvas: Canvas,
        width: Int,
        height: Int,
        recordBackdrop: Boolean,
        drawContent: (Canvas) -> Unit,
    ): Boolean {
        if (Build.VERSION.SDK_INT < 29 || !canvas.isHardwareAccelerated || width <= 0 || height <= 0) {
            drawContent(canvas)
            return false
        }

        val node = contentNode
            ?: RenderNode("LiquidGlassRoute").also { contentNode = it }
        val shouldRecord = recordBackdrop || !node.hasDisplayList()
        if (shouldRecord) {
            node.setPosition(0, 0, width, height)
            val recording = node.beginRecording(width, height)
            try {
                drawContent(recording)
            } finally {
                node.endRecording()
            }
            originX = 0
            originY = 0
            LiquidGlassPerfTelemetry.routeRenderNodeRecord()
            LiquidGlassPerfTelemetry.routeTreeTraversal()
            LiquidGlassPerfTelemetry.sourceRenderNodeRecorded(width, height)
        } else {
            LiquidGlassPerfTelemetry.sourceRenderNodeReuse()
        }

        canvas.drawRenderNode(node)
        LiquidGlassPerfTelemetry.routeScreenComposite()
        if (shouldRecord) {
            for (consumer in consumers) consumer.postInvalidateOnAnimation()
        }
        return true
    }

    /**
     * Records [drawContent] into the backdrop node and replays it onto [canvas]
     * (or draws straight through when recording isn't possible), then invalidates
     * every registered consumer so their glass refreshes.
     */
    public fun drawRecorded(
        canvas: Canvas,
        width: Int,
        height: Int,
        recordBackdrop: Boolean = true,
        notifyConsumers: Boolean = true,
        captureBounds: Rect? = null,
        drawContent: (Canvas) -> Unit,
    ) {
        if (recordBackdrop && Build.VERSION.SDK_INT >= 29 && canvas.isHardwareAccelerated &&
            width > 0 && height > 0
        ) {
            val node = contentNode
                ?: RenderNode("LiquidGlassBackdrop").also { contentNode = it }
            val bounds = captureBounds?.let {
                clampedCaptureBounds.set(
                    it.left.coerceIn(0, width),
                    it.top.coerceIn(0, height),
                    it.right.coerceIn(0, width),
                    it.bottom.coerceIn(0, height),
                )
                clampedCaptureBounds.takeIf { rect -> rect.width() > 0 && rect.height() > 0 }
            }
            val originX = bounds?.left ?: 0
            val originY = bounds?.top ?: 0
            val recordedWidth = bounds?.width() ?: width
            val recordedHeight = bounds?.height() ?: height
            node.setPosition(0, 0, recordedWidth, recordedHeight)
            val recording = node.beginRecording(recordedWidth, recordedHeight)
            try {
                if (bounds != null) {
                    recording.clipRect(0f, 0f, recordedWidth.toFloat(), recordedHeight.toFloat())
                    recording.translate(-originX.toFloat(), -originY.toFloat())
                }
                drawContent(recording)
            } finally {
                node.endRecording()
            }
            LiquidGlassPerfTelemetry.routeRenderNodeRecord()
            LiquidGlassPerfTelemetry.routeTreeTraversal()
            LiquidGlassPerfTelemetry.sourceRenderNodeRecorded(recordedWidth, recordedHeight)
            LiquidGlassPerfTelemetry.backdropCapture(
                providerId = "android-core",
                width = width,
                height = height,
                capturedPixelArea = recordedWidth.toLong() * recordedHeight.toLong(),
                mode = if (bounds == null) "render-node-full" else "render-node-region",
            )
            this.originX = originX
            this.originY = originY
            if (bounds == null) {
                canvas.drawRenderNode(node)
            } else {
                // Keep normal page drawing intact outside the optical sampling
                // rect, then composite the cropped recording into that rect.
                canvas.save()
                canvas.clipOutRect(bounds)
                drawContent(canvas)
                canvas.restore()
                canvas.save()
                canvas.translate(originX.toFloat(), originY.toFloat())
                canvas.drawRenderNode(node)
                canvas.restore()
            }
            LiquidGlassPerfTelemetry.routeScreenComposite()
        } else {
            drawContent(canvas)
        }
        if (notifyConsumers) {
            for (consumer in consumers) {
                consumer.postInvalidateOnAnimation()
            }
        }
    }

    public fun release() {
        if (Build.VERSION.SDK_INT >= 29) {
            contentNode?.discardDisplayList()
        }
        contentNode = null
        originX = 0
        originY = 0
        if (Build.VERSION.SDK_INT >= 29) {
            for (node in consumerRegionNodes.values) node.discardDisplayList()
        }
        consumerRegionNodes.clear()
        consumerRegionBounds.clear()
    }
}

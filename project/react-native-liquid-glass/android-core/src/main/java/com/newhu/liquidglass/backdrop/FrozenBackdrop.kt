package com.newhu.liquidglass.backdrop

import android.graphics.RenderEffect
import android.graphics.RenderNode
import android.graphics.Shader
import android.os.Build
import android.view.View
import androidx.annotation.RequiresApi

@RequiresApi(31)
public class FrozenBackdrop(
    private val source: LiquidGlassBackdropSource,
    private val sourceId: String,
    blurRadiusDp: Float,
) : LiquidGlassBackdropSource {
    private val frozenNode: RenderNode = createFrozenNode(source, sourceId, blurRadiusDp)

    override val sourceView: View
        get() = source.sourceView

    override val contentRenderNode: RenderNode
        get() = frozenNode

    override val hasRecording: Boolean
        get() = frozenNode.hasDisplayList()

    override val requiresCaptureOnConsumerMovement: Boolean
        get() = false

    override val recordedOriginX: Int
        get() = source.recordedOriginX

    override val recordedOriginY: Int
        get() = source.recordedOriginY

    override fun registerConsumer(consumer: View) = Unit

    override fun unregisterConsumer(consumer: View) = Unit

    override fun requestCaptureFrame() = Unit

    public fun release() {
        frozenNode.discardDisplayList()
    }

    private companion object {
        fun createFrozenNode(source: LiquidGlassBackdropSource, sourceId: String, blurRadiusDp: Float): RenderNode {
            check(Build.VERSION.SDK_INT >= 31)
            val sourceNode = requireNotNull(source.contentRenderNode) { "Backdrop source has not recorded a frame" }
            val width = source.sourceView.width
            val height = source.sourceView.height
            require(width > 0 && height > 0) { "Backdrop source must have non-zero size" }
            val node = RenderNode("LiquidGlassFrozenBackdrop-$sourceId")
            node.setPosition(0, 0, width, height)
            val canvas = node.beginRecording(width, height)
            try {
                canvas.drawRenderNode(sourceNode)
            } finally {
                node.endRecording()
            }
            val blurPx = blurRadiusDp.coerceAtLeast(0f) * source.sourceView.resources.displayMetrics.density
            if (blurPx > 0f) node.setRenderEffect(RenderEffect.createBlurEffect(blurPx, blurPx, Shader.TileMode.CLAMP))
            return node
        }
    }
}

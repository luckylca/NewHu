package com.newhu.liquidglass.local

import android.content.Context
import android.util.AttributeSet
import android.view.View
import com.newhu.liquidglass.telemetry.LocalGlassTelemetry

public open class LocalGlassView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0,
) : View(context, attrs, defStyleAttr) {
    private val renderer = LocalGlassRenderer(this)

    init {
        setWillNotDraw(false)
    }

    public fun setMaterial(material: LocalGlassMaterial) {
        renderer.setMaterial(material)
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        renderer.onAttachedToWindow()
    }

    override fun onDetachedFromWindow() {
        renderer.onDetachedFromWindow()
        super.onDetachedFromWindow()
    }

    override fun onSizeChanged(width: Int, height: Int, oldWidth: Int, oldHeight: Int) {
        super.onSizeChanged(width, height, oldWidth, oldHeight)
        renderer.onSizeChanged()
    }

    override fun invalidate() {
        LocalGlassTelemetry.invalidated()
        super.invalidate()
    }

    override fun onDraw(canvas: android.graphics.Canvas) {
        super.onDraw(canvas)
        renderer.draw(canvas)
    }
}

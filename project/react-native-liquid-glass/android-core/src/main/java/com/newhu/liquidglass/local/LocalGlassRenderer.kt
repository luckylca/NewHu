package com.newhu.liquidglass.local

import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Shader
import android.os.Build
import android.view.View
import com.newhu.liquidglass.telemetry.LocalGlassTelemetry

class LocalGlassRenderer(private val host: View) {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
    private var runtimeShader: Shader? = null
    private var hasMaterial = false
    private var appliedWidth = -1
    private var appliedHeight = -1
    private var appliedBaseTint: FloatArray? = null
    private var appliedAccentTint: FloatArray? = null
    private var appliedHighlightTint: FloatArray? = null
    private var appliedInnerShade: FloatArray? = null
    private var appliedScalars: FloatArray? = null
    private var material = LocalGlassMaterial()

    fun setMaterial(value: LocalGlassMaterial) {
        material = value
        hasMaterial = true
        applyMaterial()
    }

    fun onAttachedToWindow() {
        LocalGlassTelemetry.viewMounted()
        applyMaterial()
    }

    fun onDetachedFromWindow() {
        runtimeShader?.let(LocalGlassRuntimeShaderPool::release)
        runtimeShader = null
        paint.shader = null
        appliedWidth = -1
        appliedHeight = -1
        appliedBaseTint = null
        appliedAccentTint = null
        appliedHighlightTint = null
        appliedInnerShade = null
        appliedScalars = null
        LocalGlassTelemetry.viewUnmounted()
    }

    fun onSizeChanged() {
        applyMaterial()
    }

    fun draw(canvas: Canvas) {
        LocalGlassTelemetry.nativeOnDraw()
        if (runtimeShader == null) {
            paint.shader = null
            paint.color = Color.argb(
                (material.baseTint[3] * 255f).toInt().coerceIn(0, 255),
                (material.baseTint[0] * 255f).toInt().coerceIn(0, 255),
                (material.baseTint[1] * 255f).toInt().coerceIn(0, 255),
                (material.baseTint[2] * 255f).toInt().coerceIn(0, 255),
            )
        }
        val density = host.resources.displayMetrics.density
        val save = canvas.save()
        canvas.scale(density, density)
        canvas.drawRect(0f, 0f, host.width / density, host.height / density, paint)
        canvas.restoreToCount(save)
    }

    private fun applyMaterial() {
        if (!hasMaterial || host.width <= 0 || host.height <= 0) return
        LocalGlassTelemetry.materialApplied()
        if (Build.VERSION.SDK_INT < 33) return
        val density = host.resources.displayMetrics.density.coerceAtLeast(1f)
        val resolution = floatArrayOf(host.width / density, host.height / density)
        var changed = false
        val shader = runtimeShader ?: LocalGlassRuntimeShaderPool.acquire()?.also {
            runtimeShader = it
            paint.shader = it
            changed = true
        } ?: return

        if (appliedWidth != host.width || appliedHeight != host.height) {
            RuntimeShaderBridge.setFloatUniform(shader, "resolution", resolution)
            appliedWidth = host.width
            appliedHeight = host.height
            LocalGlassTelemetry.sizeUniformUpdated()
            changed = true
        }

        val scalars = floatArrayOf(
            material.surfaceWarp,
            material.chromatic,
            material.highlightStrength,
            material.noiseStrength,
            material.materialOpacity,
            material.cornerRadiusPx,
        )
        if (!material.baseTint.contentEquals(appliedBaseTint) ||
            !material.accentTint.contentEquals(appliedAccentTint) ||
            !material.highlightTint.contentEquals(appliedHighlightTint) ||
            !material.innerShade.contentEquals(appliedInnerShade) ||
            !scalars.contentEquals(appliedScalars)
        ) {
            RuntimeShaderBridge.setFloatUniform(shader, "baseTint", material.baseTint)
            RuntimeShaderBridge.setFloatUniform(shader, "accentTint", material.accentTint)
            RuntimeShaderBridge.setFloatUniform(shader, "highlightTint", material.highlightTint)
            RuntimeShaderBridge.setFloatUniform(shader, "innerShade", material.innerShade)
            RuntimeShaderBridge.setFloatUniform(shader, "surfaceWarp", floatArrayOf(material.surfaceWarp))
            RuntimeShaderBridge.setFloatUniform(shader, "chromatic", floatArrayOf(material.chromatic))
            RuntimeShaderBridge.setFloatUniform(shader, "highlightStrength", floatArrayOf(material.highlightStrength))
            RuntimeShaderBridge.setFloatUniform(shader, "noiseStrength", floatArrayOf(material.noiseStrength))
            RuntimeShaderBridge.setFloatUniform(shader, "materialOpacity", floatArrayOf(material.materialOpacity))
            RuntimeShaderBridge.setFloatUniform(shader, "cornerRadiusPx", floatArrayOf(material.cornerRadiusPx))
            appliedBaseTint = material.baseTint.copyOf()
            appliedAccentTint = material.accentTint.copyOf()
            appliedHighlightTint = material.highlightTint.copyOf()
            appliedInnerShade = material.innerShade.copyOf()
            appliedScalars = scalars
            LocalGlassTelemetry.materialUniformsUpdated()
            changed = true
        }
        if (changed) host.invalidate()
    }
}

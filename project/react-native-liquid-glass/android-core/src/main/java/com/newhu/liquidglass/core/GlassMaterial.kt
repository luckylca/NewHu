package com.newhu.liquidglass.core

import android.graphics.Color

public data class GlassColor(
    val red: Float,
    val green: Float,
    val blue: Float,
    val alpha: Float = 1f,
) {
    public fun toColorInt(): Int = Color.argb(
        (alpha.coerceIn(0f, 1f) * 255f).toInt(),
        (red.coerceIn(0f, 1f) * 255f).toInt(),
        (green.coerceIn(0f, 1f) * 255f).toInt(),
        (blue.coerceIn(0f, 1f) * 255f).toInt(),
    )
}

public enum class GlassOpticsModel {
    HEIGHT_FIELD,
    SDF_SCALE_LENS,
}

public data class SdfScaleLensConfig(
    val contrast: Float = 1.2f,
    val brightness: Float = 1.05f,
    val saturation: Float = 1.1f,
    val outerShadowAlpha: Float = 0.25f,
    val outerShadowBlurRadiusDp: Float = 8f,
    val outerShadowOffsetYDp: Float = 4f,
    val innerShadowAlpha: Float = 0.15f,
    val innerShadowExtentDp: Float = 25f,
)

public data class GlassMaterial(
    val blurRadiusDp: Float = 20f,
    val refractionAmount: Float = 12f,
    val refractionHeight: Float = 10f,
    val bodyRefractionAmount: Float = 2.5f,
    val chromaticAberration: Float = 0f,
    val saturation: Float = 1.5f,
    val tint: GlassColor = GlassColor(0f, 0f, 0f, 0f),
    val accentTint: GlassColor = GlassColor(1f, 1f, 1f, 0f),
    val highlightStrength: Float = 0.45f,
    val fresnelStrength: Float = 0.85f,
    val innerShadowStrength: Float = 0.18f,
    val cornerRadius: Float = -1f,
    val noiseStrength: Float = 0.015f,
    val highlightWidth: Float = 2f,
    val lightAngleDegrees: Float = 245f,
    val tintAlpha: Float = 1f,
    val specularStrength: Float = 1f,
    val opticsModel: GlassOpticsModel = GlassOpticsModel.HEIGHT_FIELD,
    val sdfScaleLens: SdfScaleLensConfig = SdfScaleLensConfig(),
)

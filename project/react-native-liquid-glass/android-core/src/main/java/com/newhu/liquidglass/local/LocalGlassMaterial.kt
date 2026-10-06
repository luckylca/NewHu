package com.newhu.liquidglass.local

public data class LocalGlassMaterial(
    val baseTint: FloatArray = floatArrayOf(1f, 1f, 1f, 0.2f),
    val accentTint: FloatArray = floatArrayOf(1f, 1f, 1f, 0.2f),
    val highlightTint: FloatArray = floatArrayOf(1f, 1f, 1f, 1f),
    val innerShade: FloatArray = floatArrayOf(0f, 0f, 0f, 1f),
    val surfaceWarp: Float = 0f,
    val chromatic: Float = 0f,
    val highlightStrength: Float = 0f,
    val noiseStrength: Float = 0f,
    val materialOpacity: Float = 1f,
    val cornerRadiusPx: Float = 0f,
)

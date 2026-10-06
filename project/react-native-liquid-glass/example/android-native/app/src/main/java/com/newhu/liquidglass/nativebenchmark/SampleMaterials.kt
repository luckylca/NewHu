package com.newhu.liquidglass.nativebenchmark

import com.newhu.liquidglass.core.GlassColor
import com.newhu.liquidglass.core.GlassMaterial
import com.newhu.liquidglass.local.LocalGlassMaterial

internal object SampleMaterials {
    val comment = LocalGlassMaterial(
        baseTint = floatArrayOf(247f / 255f, 251f / 255f, 1f, 0.28f),
        accentTint = floatArrayOf(156f / 255f, 193f / 255f, 249f / 255f, 0.26f),
        highlightTint = floatArrayOf(1f, 1f, 1f, 0.94f),
        innerShade = floatArrayOf(33f / 255f, 62f / 255f, 101f / 255f, 0.19f),
        surfaceWarp = 8f,
        chromatic = 0.06f,
        highlightStrength = 0.72f,
        noiseStrength = 0.014f,
        materialOpacity = 1f,
        cornerRadiusPx = 22f,
    )

    val topBar = GlassMaterial(
        blurRadiusDp = 2f,
        refractionAmount = 12f,
        refractionHeight = 8f,
        bodyRefractionAmount = 2.5f,
        chromaticAberration = 0f,
        saturation = 1.08f,
        tint = GlassColor(238f / 255f, 246f / 255f, 1f, 0.12f),
        highlightStrength = 0.72f,
        fresnelStrength = 0.85f,
        innerShadowStrength = 0.18f,
        cornerRadius = 0f,
        noiseStrength = 0.015f,
        highlightWidth = 2f,
        lightAngleDegrees = 245f,
        specularStrength = 1f,
    )
}

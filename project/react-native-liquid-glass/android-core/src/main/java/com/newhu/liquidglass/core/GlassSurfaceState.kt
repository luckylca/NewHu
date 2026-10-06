package com.newhu.liquidglass.core

public data class GlassSurfaceState(
    val material: GlassMaterial,
    val interactive: Boolean = false,
    val continuousBackdrop: Boolean = false,
    val motionX: Float? = null,
    val motionY: Float? = null,
    val displacementOnlyDebug: Boolean = false,
    val sdfDisplacementMapDebug: Boolean = false,
)

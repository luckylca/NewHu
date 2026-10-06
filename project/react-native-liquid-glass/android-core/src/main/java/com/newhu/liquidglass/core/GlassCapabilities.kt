package com.newhu.liquidglass.core

import android.os.Build

public data class GlassCapabilities(
    val renderNodeRecording: Boolean,
    val renderEffectBlur: Boolean,
    val runtimeShader: Boolean,
) {
    public companion object {
        @JvmStatic
        public fun current(): GlassCapabilities = forApi(Build.VERSION.SDK_INT)

        @JvmStatic
        public fun forApi(apiLevel: Int): GlassCapabilities = GlassCapabilities(
            renderNodeRecording = apiLevel >= 29,
            renderEffectBlur = apiLevel >= 31,
            runtimeShader = apiLevel >= 33,
        )
    }
}

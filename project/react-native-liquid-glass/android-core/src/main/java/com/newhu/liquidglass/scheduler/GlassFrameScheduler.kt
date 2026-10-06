package com.newhu.liquidglass.scheduler

import android.view.Choreographer
import com.newhu.liquidglass.telemetry.LiquidGlassPerfTelemetry

public class GlassFrameScheduler(private val onFrame: () -> Unit) {
    private var frameScheduled = false
    private val frameCallback = Choreographer.FrameCallback {
        frameScheduled = false
        LiquidGlassPerfTelemetry.glassFrameExecuted()
        onFrame()
    }

    public fun schedule(): Boolean {
        if (frameScheduled) return false
        frameScheduled = true
        LiquidGlassPerfTelemetry.glassFrameScheduled()
        Choreographer.getInstance().postFrameCallback(frameCallback)
        return true
    }

    public fun cancel() {
        if (!frameScheduled) return
        Choreographer.getInstance().removeFrameCallback(frameCallback)
        frameScheduled = false
    }
}

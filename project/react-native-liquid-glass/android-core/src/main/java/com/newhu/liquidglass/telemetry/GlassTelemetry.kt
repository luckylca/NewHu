package com.newhu.liquidglass.telemetry

public object GlassTelemetry {
    public fun setEnabled(enabled: Boolean) {
        LiquidGlassPerfTelemetry.setEnabled(enabled)
        LocalGlassTelemetry.setEnabled(enabled)
    }

    public fun setDisplayRefreshRate(refreshRate: Float) {
        LiquidGlassPerfTelemetry.displayRefreshRate(refreshRate)
    }

    public fun performanceStats(): Map<String, Number> = LiquidGlassPerfTelemetry.snapshot()

    public fun localGlassStats(): Map<String, Number> = LocalGlassTelemetry.snapshot()
}

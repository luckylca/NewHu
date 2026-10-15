package com.newhu.liquidglass.telemetry

import android.os.Build
import android.os.Trace

/** Perfetto-only diagnostics. Calls are inert while Android tracing is disabled. */
public object LiquidGlassTrace {
    public fun isEnabled(): Boolean = Build.VERSION.SDK_INT >= 29 && Trace.isEnabled()

    public fun beginSection(name: String) {
        Trace.beginSection("NewHuGlass#$name")
    }

    public fun endSection() {
        Trace.endSection()
    }

    public fun counter(name: String, value: Long) {
        if (isEnabled()) Trace.setCounter("NewHuGlass.$name", value)
    }

    public fun safe(value: String): String = value.replace(Regex("[^A-Za-z0-9_.-]"), "_")
}

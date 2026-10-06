package com.newhu.liquidglass.telemetry

import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicLong

object LocalGlassTelemetry {
    @Volatile
    private var enabled = false
    private val attachedViews = AtomicInteger()
    private val nativeOnDraws = AtomicLong()
    private val invalidates = AtomicLong()
    private val uniformUpdates = AtomicLong()
    private val sizeUniformUpdates = AtomicLong()
    private val materialUniformUpdates = AtomicLong()
    private val materialApplies = AtomicLong()
    private val shaderCreates = AtomicLong()
    private val shaderReuses = AtomicLong()

    fun setEnabled(value: Boolean) {
        enabled = value
        if (value) {
            nativeOnDraws.set(0L)
            invalidates.set(0L)
            uniformUpdates.set(0L)
            sizeUniformUpdates.set(0L)
            materialUniformUpdates.set(0L)
            materialApplies.set(0L)
            shaderCreates.set(0L)
            shaderReuses.set(0L)
        }
    }

    fun viewMounted() { attachedViews.incrementAndGet() }
    fun viewUnmounted() { attachedViews.updateAndGet { (it - 1).coerceAtLeast(0) } }
    fun invalidated() { if (enabled) invalidates.incrementAndGet() }
    fun nativeOnDraw() { if (enabled) nativeOnDraws.incrementAndGet() }
    fun materialApplied() { if (enabled) materialApplies.incrementAndGet() }
    fun runtimeShaderCreated() { if (enabled) shaderCreates.incrementAndGet() }
    fun runtimeShaderReused() { if (enabled) shaderReuses.incrementAndGet() }
    fun uniformUpdated() { if (enabled) uniformUpdates.incrementAndGet() }
    fun sizeUniformUpdated() { if (enabled) sizeUniformUpdates.incrementAndGet() }
    fun materialUniformsUpdated() { if (enabled) materialUniformUpdates.incrementAndGet() }

    fun snapshot(): Map<String, Long> = mapOf(
        "mountedNativeViewCount" to attachedViews.get().toLong(),
        "nativeOnDrawCount" to nativeOnDraws.get(),
        "nativeInvalidateCount" to invalidates.get(),
        "materialApplyCount" to materialApplies.get(),
        "runtimeShaderCreateCount" to shaderCreates.get(),
        "runtimeShaderReuseCount" to shaderReuses.get(),
        "uniformUpdateCount" to uniformUpdates.get(),
        "sizeUniformUpdateCount" to sizeUniformUpdates.get(),
        "materialUniformUpdateCount" to materialUniformUpdates.get(),
    )
}

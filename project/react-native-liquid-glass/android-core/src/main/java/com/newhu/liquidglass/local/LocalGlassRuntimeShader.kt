package com.newhu.liquidglass.local

import android.graphics.Shader
import android.os.Build
import com.newhu.liquidglass.telemetry.LocalGlassTelemetry

internal object LocalGlassRuntimeShaderPool {
    private const val MAX_POOLED_SHADERS = 32
    private val shaders = ArrayDeque<Shader>()

    fun acquire(): Shader? {
        val pooled = synchronized(shaders) { if (shaders.isEmpty()) null else shaders.removeLast() }
        if (pooled != null) {
            LocalGlassTelemetry.runtimeShaderReused()
            return pooled
        }
        return RuntimeShaderBridge.create(LocalGlassShader.SOURCE)?.also {
            LocalGlassTelemetry.runtimeShaderCreated()
        }
    }

    fun release(shader: Shader) {
        synchronized(shaders) {
            if (shaders.size < MAX_POOLED_SHADERS) shaders.addLast(shader)
        }
    }
}

internal object RuntimeShaderBridge {
    private val shaderType: Class<*>? by lazy(LazyThreadSafetyMode.PUBLICATION) {
        runCatching { Class.forName("android.graphics.RuntimeShader") }.getOrNull()
    }
    private val constructor by lazy(LazyThreadSafetyMode.PUBLICATION) {
        shaderType?.getConstructor(String::class.java)
    }
    private val setFloatUniform by lazy(LazyThreadSafetyMode.PUBLICATION) {
        shaderType?.getMethod("setFloatUniform", String::class.java, FloatArray::class.java)
    }

    fun create(source: String): Shader? {
        if (Build.VERSION.SDK_INT < 33) return null
        return constructor?.newInstance(source) as? Shader
    }

    fun setFloatUniform(shader: Shader, name: String, values: FloatArray) {
        val setter = setFloatUniform ?: return
        setter.invoke(shader, name, values)
        LocalGlassTelemetry.uniformUpdated()
    }
}

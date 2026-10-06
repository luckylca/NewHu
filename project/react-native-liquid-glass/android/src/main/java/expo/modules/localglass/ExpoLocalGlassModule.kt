package expo.modules.localglass

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Shader
import android.os.Build
import android.util.Log
import android.view.View
import android.content.pm.ApplicationInfo
import java.util.WeakHashMap
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicLong
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.views.ExpoView

class ExpoLocalGlassModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("ExpoLocalGlass")

        AsyncFunction("setPerformanceTelemetryEnabled") { enabled: Boolean ->
            val isDebuggable = appContext.currentActivity?.applicationInfo?.let {
                it.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0
            } ?: false
            LocalGlassPerformanceTelemetry.setEnabled(enabled && isDebuggable)
        }
        AsyncFunction("getPerformanceTelemetry") {
            LocalGlassPerformanceTelemetry.snapshot()
        }
        AsyncFunction("setHardwareLayerExperimentEnabled") { enabled: Boolean ->
            val isDebuggable = appContext.currentActivity?.applicationInfo?.let {
                it.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0
            } ?: false
            if (isDebuggable) LocalGlassHardwareLayerExperiment.setEnabled(enabled)
        }
        View(LocalGlassMaterialExpoView::class) {
            Name("LocalGlassMaterial")
            Prop("baseTint") { view: LocalGlassMaterialExpoView, value: List<Double>? ->
                view.baseTint = value.toFloatArrayOr(view.baseTint)
            }
            Prop("accentTint") { view: LocalGlassMaterialExpoView, value: List<Double>? ->
                view.accentTint = value.toFloatArrayOr(view.accentTint)
            }
            Prop("highlightTint") { view: LocalGlassMaterialExpoView, value: List<Double>? ->
                view.highlightTint = value.toFloatArrayOr(view.highlightTint)
            }
            Prop("innerShade") { view: LocalGlassMaterialExpoView, value: List<Double>? ->
                view.innerShade = value.toFloatArrayOr(view.innerShade)
            }
            Prop("surfaceWarp") { view: LocalGlassMaterialExpoView, value: Float? ->
                view.surfaceWarp = value ?: 0f
            }
            Prop("chromatic") { view: LocalGlassMaterialExpoView, value: Float? ->
                view.chromatic = value ?: 0f
            }
            Prop("highlightStrength") { view: LocalGlassMaterialExpoView, value: Float? ->
                view.highlightStrength = value ?: 0f
            }
            Prop("noiseStrength") { view: LocalGlassMaterialExpoView, value: Float? ->
                view.noiseStrength = value ?: 0f
            }
            Prop("materialOpacity") { view: LocalGlassMaterialExpoView, value: Float? ->
                view.materialOpacity = value ?: 1f
            }
            Prop("cornerRadiusPx") { view: LocalGlassMaterialExpoView, value: Float? ->
                view.cornerRadiusPx = value ?: 0f
            }
            OnViewDidUpdateProps { view: LocalGlassMaterialExpoView -> view.onMaterialPropsUpdated() }
        }
    }
}

private fun List<Double>?.toFloatArrayOr(previous: FloatArray): FloatArray {
    if (this == null || size < 4) return previous
    return floatArrayOf(this[0].toFloat(), this[1].toFloat(), this[2].toFloat(), this[3].toFloat())
}

class LocalGlassMaterialExpoView(
    context: Context,
    appContext: AppContext,
) : ExpoView(context, appContext) {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
    private var runtimeShader: Shader? = null
    private var hasMaterialProps = false
    private var appliedWidth = -1
    private var appliedHeight = -1
    private var appliedBaseTint: FloatArray? = null
    private var appliedAccentTint: FloatArray? = null
    private var appliedHighlightTint: FloatArray? = null
    private var appliedInnerShade: FloatArray? = null
    private var appliedScalars: FloatArray? = null

    var baseTint = floatArrayOf(1f, 1f, 1f, 0.2f)
    var accentTint = floatArrayOf(1f, 1f, 1f, 0.2f)
    var highlightTint = floatArrayOf(1f, 1f, 1f, 1f)
    var innerShade = floatArrayOf(0f, 0f, 0f, 1f)
    var surfaceWarp = 0f
    var chromatic = 0f
    var highlightStrength = 0f
    var noiseStrength = 0f
    var materialOpacity = 1f
    var cornerRadiusPx = 0f

    init {
        setWillNotDraw(false)
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        LocalGlassPerformanceTelemetry.viewMounted()
        LocalGlassHardwareLayerExperiment.register(this)
        applyMaterial()
    }

    override fun onDetachedFromWindow() {
        LocalGlassHardwareLayerExperiment.unregister(this)
        runtimeShader?.let(LocalGlassRuntimeShaderPool::release)
        runtimeShader = null
        paint.shader = null
        appliedWidth = -1
        appliedHeight = -1
        appliedBaseTint = null
        appliedAccentTint = null
        appliedHighlightTint = null
        appliedInnerShade = null
        appliedScalars = null
        LocalGlassPerformanceTelemetry.viewUnmounted()
        super.onDetachedFromWindow()
    }

    override fun invalidate() {
        LocalGlassPerformanceTelemetry.invalidated()
        super.invalidate()
    }

    fun applyMaterial() {
        if (!hasMaterialProps || width <= 0 || height <= 0) return
        LocalGlassPerformanceTelemetry.materialApplied()
        if (Build.VERSION.SDK_INT < 33) return
        val density = resources.displayMetrics.density.coerceAtLeast(1f)
        val resolution = floatArrayOf(width / density, height / density)
        var changed = false
        val existingShader = runtimeShader
        val shader = existingShader ?: LocalGlassRuntimeShaderPool.acquire()?.also {
            runtimeShader = it
            paint.shader = it
            changed = true
        } ?: return

        if (appliedWidth != width || appliedHeight != height) {
            RuntimeShaderBridge.setFloatUniform(shader, "resolution", resolution)
            appliedWidth = width
            appliedHeight = height
            LocalGlassPerformanceTelemetry.sizeUniformUpdated()
            changed = true
        }

        val scalars = floatArrayOf(surfaceWarp, chromatic, highlightStrength, noiseStrength, materialOpacity, cornerRadiusPx)
        if (!baseTint.contentEquals(appliedBaseTint) || !accentTint.contentEquals(appliedAccentTint) ||
            !highlightTint.contentEquals(appliedHighlightTint) || !innerShade.contentEquals(appliedInnerShade) ||
            !scalars.contentEquals(appliedScalars)
        ) {
            RuntimeShaderBridge.setFloatUniform(shader, "baseTint", baseTint)
            RuntimeShaderBridge.setFloatUniform(shader, "accentTint", accentTint)
            RuntimeShaderBridge.setFloatUniform(shader, "highlightTint", highlightTint)
            RuntimeShaderBridge.setFloatUniform(shader, "innerShade", innerShade)
            RuntimeShaderBridge.setFloatUniform(shader, "surfaceWarp", floatArrayOf(surfaceWarp))
            RuntimeShaderBridge.setFloatUniform(shader, "chromatic", floatArrayOf(chromatic))
            RuntimeShaderBridge.setFloatUniform(shader, "highlightStrength", floatArrayOf(highlightStrength))
            RuntimeShaderBridge.setFloatUniform(shader, "noiseStrength", floatArrayOf(noiseStrength))
            RuntimeShaderBridge.setFloatUniform(shader, "materialOpacity", floatArrayOf(materialOpacity))
            RuntimeShaderBridge.setFloatUniform(shader, "cornerRadiusPx", floatArrayOf(cornerRadiusPx))
            appliedBaseTint = baseTint.copyOf()
            appliedAccentTint = accentTint.copyOf()
            appliedHighlightTint = highlightTint.copyOf()
            appliedInnerShade = innerShade.copyOf()
            appliedScalars = scalars
            LocalGlassPerformanceTelemetry.materialUniformsUpdated()
            changed = true
        }
        if (changed) invalidate()
    }

    override fun onSizeChanged(width: Int, height: Int, oldWidth: Int, oldHeight: Int) {
        super.onSizeChanged(width, height, oldWidth, oldHeight)
        applyMaterial()
    }

    fun onMaterialPropsUpdated() {
        hasMaterialProps = true
        applyMaterial()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        LocalGlassPerformanceTelemetry.nativeOnDraw()
        if (runtimeShader == null) {
            paint.shader = null
            paint.color = Color.argb(
                (baseTint[3] * 255f).toInt().coerceIn(0, 255),
                (baseTint[0] * 255f).toInt().coerceIn(0, 255),
                (baseTint[1] * 255f).toInt().coerceIn(0, 255),
                (baseTint[2] * 255f).toInt().coerceIn(0, 255),
            )
        }
        val scale = resources.displayMetrics.density
        val save = canvas.save()
        canvas.scale(scale, scale)
        canvas.drawRect(0f, 0f, width / scale, height / scale, paint)
        canvas.restoreToCount(save)
    }

}

/** Debug-only A/B switch for this View alone; production defaults to no extra layer. */
private object LocalGlassHardwareLayerExperiment {
    @Volatile private var enabled = false
    private val views = WeakHashMap<LocalGlassMaterialExpoView, Unit>()

    fun register(view: LocalGlassMaterialExpoView) {
        synchronized(views) { views[view] = Unit }
        view.setLayerType(if (enabled) View.LAYER_TYPE_HARDWARE else View.LAYER_TYPE_NONE, null)
    }

    fun unregister(view: LocalGlassMaterialExpoView) {
        synchronized(views) { views.remove(view) }
    }

    fun setEnabled(value: Boolean) {
        enabled = value
        val attached = synchronized(views) { views.keys.toList() }
        attached.forEach { view ->
            view.post {
                view.setLayerType(if (value) View.LAYER_TYPE_HARDWARE else View.LAYER_TYPE_NONE, null)
            }
        }
    }
}

/** Detached per-view shaders are pooled because RuntimeShader instances carry mutable uniforms. */
private object LocalGlassRuntimeShaderPool {
    private const val MAX_POOLED_SHADERS = 32
    private val shaders = ArrayDeque<Shader>()

    fun acquire(): Shader? {
        val pooled = synchronized(shaders) { if (shaders.isEmpty()) null else shaders.removeLast() }
        if (pooled != null) {
            LocalGlassPerformanceTelemetry.runtimeShaderReused()
            return pooled
        }
        return RuntimeShaderBridge.create(LocalGlassShader.SOURCE)?.also {
            LocalGlassPerformanceTelemetry.runtimeShaderCreated()
        }
    }

    fun release(shader: Shader) {
        synchronized(shaders) {
            if (shaders.size < MAX_POOLED_SHADERS) shaders.addLast(shader)
        }
    }
}

/** Debug-only counters. The default release and app rendering path remain inactive. */
private object LocalGlassPerformanceTelemetry {
    @Volatile private var enabled = false
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

/** Resolve RuntimeShader reflectively so API 24–32 can load the module and keep using Skia. */
private object RuntimeShaderBridge {
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
        LocalGlassPerformanceTelemetry.uniformUpdated()
    }
}

private const val TAG = "NewHuLocalGlass"

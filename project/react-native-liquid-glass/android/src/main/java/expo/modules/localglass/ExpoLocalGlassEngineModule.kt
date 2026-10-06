package expo.modules.localglass

import android.content.Context
import android.content.pm.ApplicationInfo
import android.graphics.Canvas
import android.view.View
import com.newhu.liquidglass.local.LocalGlassHardwareLayerExperiment
import com.newhu.liquidglass.local.LocalGlassMaterial
import com.newhu.liquidglass.local.LocalGlassRenderer
import com.newhu.liquidglass.telemetry.LocalGlassTelemetry
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.views.ExpoView

class ExpoLocalGlassEngineModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("ExpoLocalGlassEngine")

        AsyncFunction("setPerformanceTelemetryEnabled") { enabled: Boolean ->
            val isDebuggable = appContext.currentActivity?.applicationInfo?.let {
                it.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0
            } ?: false
            LocalGlassTelemetry.setEnabled(enabled && isDebuggable)
        }
        AsyncFunction("getPerformanceTelemetry") {
            LocalGlassTelemetry.snapshot()
        }
        AsyncFunction("setHardwareLayerExperimentEnabled") { enabled: Boolean ->
            val isDebuggable = appContext.currentActivity?.applicationInfo?.let {
                it.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0
            } ?: false
            if (isDebuggable) LocalGlassHardwareLayerExperiment.setEnabled(enabled)
        }

        View(LocalGlassEngineExpoView::class) {
            Name("LocalGlassMaterial")
            Prop("baseTint") { view: LocalGlassEngineExpoView, value: List<Double>? ->
                view.baseTint = value.toFloatArrayOr(view.baseTint)
            }
            Prop("accentTint") { view: LocalGlassEngineExpoView, value: List<Double>? ->
                view.accentTint = value.toFloatArrayOr(view.accentTint)
            }
            Prop("highlightTint") { view: LocalGlassEngineExpoView, value: List<Double>? ->
                view.highlightTint = value.toFloatArrayOr(view.highlightTint)
            }
            Prop("innerShade") { view: LocalGlassEngineExpoView, value: List<Double>? ->
                view.innerShade = value.toFloatArrayOr(view.innerShade)
            }
            Prop("surfaceWarp") { view: LocalGlassEngineExpoView, value: Float? ->
                view.surfaceWarp = value ?: 0f
            }
            Prop("chromatic") { view: LocalGlassEngineExpoView, value: Float? ->
                view.chromatic = value ?: 0f
            }
            Prop("highlightStrength") { view: LocalGlassEngineExpoView, value: Float? ->
                view.highlightStrength = value ?: 0f
            }
            Prop("noiseStrength") { view: LocalGlassEngineExpoView, value: Float? ->
                view.noiseStrength = value ?: 0f
            }
            Prop("materialOpacity") { view: LocalGlassEngineExpoView, value: Float? ->
                view.materialOpacity = value ?: 1f
            }
            Prop("cornerRadiusPx") { view: LocalGlassEngineExpoView, value: Float? ->
                view.cornerRadiusPx = value ?: 0f
            }
            OnViewDidUpdateProps { view: LocalGlassEngineExpoView -> view.onMaterialPropsUpdated() }
        }
    }
}

private fun List<Double>?.toFloatArrayOr(previous: FloatArray): FloatArray {
    if (this == null || size < 4) return previous
    return floatArrayOf(this[0].toFloat(), this[1].toFloat(), this[2].toFloat(), this[3].toFloat())
}

class LocalGlassEngineExpoView(
    context: Context,
    appContext: AppContext,
) : ExpoView(context, appContext) {
    private val renderer = LocalGlassRenderer(this)
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
        LocalGlassHardwareLayerExperiment.register(this)
        renderer.onAttachedToWindow()
    }

    override fun onDetachedFromWindow() {
        LocalGlassHardwareLayerExperiment.unregister(this)
        renderer.onDetachedFromWindow()
        super.onDetachedFromWindow()
    }

    override fun onSizeChanged(width: Int, height: Int, oldWidth: Int, oldHeight: Int) {
        super.onSizeChanged(width, height, oldWidth, oldHeight)
        renderer.onSizeChanged()
    }

    override fun invalidate() {
        LocalGlassTelemetry.invalidated()
        super.invalidate()
    }

    fun onMaterialPropsUpdated() {
        renderer.setMaterial(
            LocalGlassMaterial(
                baseTint = baseTint,
                accentTint = accentTint,
                highlightTint = highlightTint,
                innerShade = innerShade,
                surfaceWarp = surfaceWarp,
                chromatic = chromatic,
                highlightStrength = highlightStrength,
                noiseStrength = noiseStrength,
                materialOpacity = materialOpacity,
                cornerRadiusPx = cornerRadiusPx,
            ),
        )
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        renderer.draw(canvas)
    }
}

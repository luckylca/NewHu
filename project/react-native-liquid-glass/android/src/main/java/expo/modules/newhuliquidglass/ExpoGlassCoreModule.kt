package expo.modules.newhuliquidglass

import android.content.Context
import android.content.pm.ApplicationInfo
import com.newhu.liquidglass.backdrop.CORNER_RADIUS_CAPSULE
import com.newhu.liquidglass.telemetry.LiquidGlassPerfTelemetry
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.views.ExpoView

internal class ExpoGlassCoreModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("NewHuLiquidGlassCore")

        View(ExpoGlassProviderCoreView::class) {
            Name("GlassCaptureSource")
            Prop("providerId") { view: ExpoGlassProviderCoreView, id: String -> view.providerId = id }
            Prop("underlayProviderId") { view: ExpoGlassProviderCoreView, id: String? -> view.underlayProviderId = id }
            Prop("captureMode") { view: ExpoGlassProviderCoreView, mode: String? -> view.captureMode = mode ?: "live" }
            Prop("snapshotBlurRadiusDp") { view: ExpoGlassProviderCoreView, radius: Float? -> view.snapshotBlurRadiusDp = radius ?: 0f }
            Prop("sourceRevision") { view: ExpoGlassProviderCoreView, revision: String? -> view.sourceRevision = revision }
        }

        View(ExpoGlassSurfaceCoreView::class) {
            Name("GlassSurface")
            Prop("providerId") { view: ExpoGlassSurfaceCoreView, id: String -> view.providerId = id }
            Prop("cornerRadius") { view: ExpoGlassSurfaceCoreView, value: Float? -> view.setCornerRadius(value) }
            Prop("opticsModel") { view: ExpoGlassSurfaceCoreView, value: String? -> view.setOpticsModel(value) }
            Prop("sdfContrast") { view: ExpoGlassSurfaceCoreView, value: Float? -> view.setSdfContrast(value) }
            Prop("sdfBrightness") { view: ExpoGlassSurfaceCoreView, value: Float? -> view.setSdfBrightness(value) }
            Prop("sdfSaturation") { view: ExpoGlassSurfaceCoreView, value: Float? -> view.setSdfSaturation(value) }
            Prop("sdfOuterShadowAlpha") { view: ExpoGlassSurfaceCoreView, value: Float? -> view.setSdfOuterShadowAlpha(value) }
            Prop("sdfOuterShadowBlurRadius") { view: ExpoGlassSurfaceCoreView, value: Float? -> view.setSdfOuterShadowBlurRadius(value) }
            Prop("sdfOuterShadowOffsetY") { view: ExpoGlassSurfaceCoreView, value: Float? -> view.setSdfOuterShadowOffsetY(value) }
            Prop("sdfInnerShadowAlpha") { view: ExpoGlassSurfaceCoreView, value: Float? -> view.setSdfInnerShadowAlpha(value) }
            Prop("sdfInnerShadowExtent") { view: ExpoGlassSurfaceCoreView, value: Float? -> view.setSdfInnerShadowExtent(value) }
            Prop("blurRadius") { view: ExpoGlassSurfaceCoreView, value: Float? -> view.setBlurRadius(value) }
            Prop("refractionHeight") { view: ExpoGlassSurfaceCoreView, value: Float? -> view.setRefractionHeight(value) }
            Prop("refractionAmount") { view: ExpoGlassSurfaceCoreView, value: Float? -> view.setRefractionAmount(value) }
            Prop("bodyRefractionAmount") { view: ExpoGlassSurfaceCoreView, value: Float? -> view.setBodyRefractionAmount(value) }
            Prop("interactionProgress") { view: ExpoGlassSurfaceCoreView, value: Float? -> view.setInteractionProgress(value) }
            Prop("saturation") { view: ExpoGlassSurfaceCoreView, value: Float? -> view.setSaturation(value) }
            Prop("tint") { view: ExpoGlassSurfaceCoreView, value: Int? -> view.setTint(value) }
            Prop("tintAlpha") { view: ExpoGlassSurfaceCoreView, value: Float? -> view.setTintAlpha(value) }
            Prop("chromaticAberration") { view: ExpoGlassSurfaceCoreView, value: Float? -> view.setChromaticAberration(value) }
            Prop("noiseAlpha") { view: ExpoGlassSurfaceCoreView, value: Float? -> view.setNoiseAlpha(value) }
            Prop("highlightAlpha") { view: ExpoGlassSurfaceCoreView, value: Float? -> view.setHighlightAlpha(value) }
            Prop("specularStrength") { view: ExpoGlassSurfaceCoreView, value: Float? -> view.setSpecularStrength(value) }
            Prop("fresnelStrength") { view: ExpoGlassSurfaceCoreView, value: Float? -> view.setFresnelStrength(value) }
            Prop("innerShadowStrength") { view: ExpoGlassSurfaceCoreView, value: Float? -> view.setInnerShadowStrength(value) }
            Prop("highlightWidth") { view: ExpoGlassSurfaceCoreView, value: Float? -> view.setHighlightWidth(value) }
            Prop("lightAngle") { view: ExpoGlassSurfaceCoreView, value: Float? -> view.setLightAngle(value) }
            Prop("interactive") { view: ExpoGlassSurfaceCoreView, value: Boolean? -> view.setInteractive(value) }
            Prop("motionX") { view: ExpoGlassSurfaceCoreView, value: Float? -> view.setMotionX(value) }
            Prop("motionY") { view: ExpoGlassSurfaceCoreView, value: Float? -> view.setMotionY(value) }
            Prop("displacementOnlyDebug") { view: ExpoGlassSurfaceCoreView, value: Boolean? -> view.setDisplacementOnlyDebug(value) }
            Prop("sdfDisplacementMapDebug") { view: ExpoGlassSurfaceCoreView, value: Boolean? -> view.setSdfDisplacementMapDebug(value) }
            Prop("continuous") { view: ExpoGlassSurfaceCoreView, value: Boolean? -> view.setContinuous(value) }
        }

        Function("setPerformanceTelemetryEnabled") { enabled: Boolean ->
            val isDebuggable = appContext.currentActivity?.applicationInfo?.let {
                it.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0
            } ?: false
            LiquidGlassPerfTelemetry.setEnabled(enabled && isDebuggable)
            if (enabled && isDebuggable) {
                LiquidGlassPerfTelemetry.displayRefreshRate(
                    appContext.currentActivity?.window?.decorView?.display?.refreshRate ?: 0f,
                )
            }
        }
        AsyncFunction("getPerformanceStats") { LiquidGlassPerfTelemetry.snapshot() }
        Function("setCaptureMode") { providerId: String, mode: String ->
            CoreLiquidGlassRegistry.setCaptureMode(providerId, mode)
        }
        Function("prepareFrozenBackdrop") { providerId: String, blurRadiusDp: Float ->
            CoreLiquidGlassRegistry.prepareFrozenBackdrop(providerId, blurRadiusDp)
        }
    }
}

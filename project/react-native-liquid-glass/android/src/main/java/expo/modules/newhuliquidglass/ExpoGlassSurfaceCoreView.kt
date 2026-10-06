package expo.modules.newhuliquidglass

import android.content.Context
import android.graphics.Canvas
import android.view.MotionEvent
import com.newhu.liquidglass.backdrop.CORNER_RADIUS_CAPSULE
import com.newhu.liquidglass.backdrop.GlassViewController
import com.newhu.liquidglass.core.GlassOpticsModel
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView

internal class ExpoGlassSurfaceCoreView(
    context: Context,
    appContext: AppContext,
) : ExpoView(context, appContext) {
    val glass = GlassViewController(this)
    var providerId: String = "default"
        set(value) {
            if (field == value && glass.provider != null) return
            field = value
            if (isAttachedToWindow) CoreLiquidGlassRegistry.resolve(value, glass)
        }

    init {
        setWillNotDraw(false)
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        CoreLiquidGlassRegistry.resolve(providerId, glass)
        glass.onHostAttached()
    }

    override fun onDetachedFromWindow() {
        CoreLiquidGlassRegistry.cancelWaiting(glass)
        glass.onHostDetached()
        super.onDetachedFromWindow()
    }

    override fun dispatchTouchEvent(event: MotionEvent): Boolean {
        glass.handleTouch(event)
        return super.dispatchTouchEvent(event)
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        glass.draw(canvas)
    }

    fun setCornerRadius(radius: Float?) { glass.cornerRadiusDp = radius ?: CORNER_RADIUS_CAPSULE }
    fun setBlurRadius(radius: Float?) { glass.blurRadiusDp = radius ?: 20f }
    fun setRefractionHeight(value: Float?) { glass.refractionHeightDp = value ?: 10f }
    fun setRefractionAmount(value: Float?) { glass.refractionAmountDp = value ?: 12f }
    fun setBodyRefractionAmount(value: Float?) { glass.bodyRefractionAmountDp = value ?: 2.5f }
    fun setInteractionProgress(value: Float?) { glass.interactionProgress = value ?: 0f }
    fun setSaturation(value: Float?) { glass.saturation = value ?: 1.5f }
    fun setTint(value: Int?) { glass.glassTintColor = value ?: 0 }
    fun setTintAlpha(value: Float?) { glass.tintAlpha = value ?: 1f }
    fun setChromaticAberration(value: Float?) { glass.chromaticAberration = (value ?: 0f).coerceIn(0f, 1f) }
    fun setNoiseAlpha(value: Float?) { glass.noiseAlpha = (value ?: 0.015f).coerceIn(0f, 1f) }
    fun setHighlightAlpha(value: Float?) { glass.highlightAlpha = (value ?: 0.45f).coerceIn(0f, 1f) }
    fun setSpecularStrength(value: Float?) { glass.specularStrength = (value ?: 1f).coerceIn(0f, 2f) }
    fun setFresnelStrength(value: Float?) { glass.fresnelStrength = (value ?: 0.85f).coerceIn(0f, 2f) }
    fun setInnerShadowStrength(value: Float?) { glass.innerShadowStrength = (value ?: 0.18f).coerceIn(0f, 1f) }
    fun setHighlightWidth(value: Float?) { glass.highlightWidthDp = value ?: 2f }
    fun setLightAngle(value: Float?) { glass.lightAngleDegrees = value ?: 245f }
    fun setInteractive(value: Boolean?) { glass.isGlassInteractive = value ?: false }
    fun setMotionX(value: Float?) { glass.motionX = value }
    fun setMotionY(value: Float?) { glass.motionY = value }
    fun setDisplacementOnlyDebug(value: Boolean?) { glass.displacementOnlyDebug = value ?: false }
    fun setSdfDisplacementMapDebug(value: Boolean?) { glass.sdfDisplacementMapDebug = value ?: false }
    fun setOpticsModel(value: String?) {
        glass.opticsModel = when (value?.lowercase()) {
            "sdfscalelens" -> GlassOpticsModel.SDF_SCALE_LENS
            else -> GlassOpticsModel.HEIGHT_FIELD
        }
    }
    fun setSdfContrast(value: Float?) { glass.sdfScaleLens = glass.sdfScaleLens.copy(contrast = value ?: 1.2f) }
    fun setSdfBrightness(value: Float?) { glass.sdfScaleLens = glass.sdfScaleLens.copy(brightness = value ?: 1.05f) }
    fun setSdfSaturation(value: Float?) { glass.sdfScaleLens = glass.sdfScaleLens.copy(saturation = value ?: 1.1f) }
    fun setSdfOuterShadowAlpha(value: Float?) { glass.sdfScaleLens = glass.sdfScaleLens.copy(outerShadowAlpha = value ?: 0.25f) }
    fun setSdfOuterShadowBlurRadius(value: Float?) { glass.sdfScaleLens = glass.sdfScaleLens.copy(outerShadowBlurRadiusDp = value ?: 8f) }
    fun setSdfOuterShadowOffsetY(value: Float?) { glass.sdfScaleLens = glass.sdfScaleLens.copy(outerShadowOffsetYDp = value ?: 4f) }
    fun setSdfInnerShadowAlpha(value: Float?) { glass.sdfScaleLens = glass.sdfScaleLens.copy(innerShadowAlpha = value ?: 0.15f) }
    fun setSdfInnerShadowExtent(value: Float?) { glass.sdfScaleLens = glass.sdfScaleLens.copy(innerShadowExtentDp = value ?: 25f) }
    fun setContinuous(value: Boolean?) { glass.continuousBackdrop = value ?: false }
}

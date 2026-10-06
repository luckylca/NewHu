package com.newhu.liquidglass.backdrop

import android.animation.ValueAnimator
import android.graphics.Canvas
import android.graphics.Color
import android.os.Build
import android.view.MotionEvent
import android.view.View
import android.view.animation.DecelerateInterpolator
import android.view.animation.Interpolator
import android.view.animation.OvershootInterpolator
import androidx.annotation.ColorInt
import com.newhu.liquidglass.core.GlassRenderTier
import com.newhu.liquidglass.core.GlassOpticsModel
import com.newhu.liquidglass.core.SdfScaleLensConfig
import com.newhu.liquidglass.backdrop.internal.GlassFrame
import com.newhu.liquidglass.backdrop.internal.GlassViewRenderer
import com.newhu.liquidglass.telemetry.LiquidGlassPerfTelemetry
import kotlin.math.abs
import kotlin.math.min

internal enum class GlassDirtyKind {
    SOURCE_CONTENT_DIRTY,
    CONSUMER_GEOMETRY_DIRTY,
    OPTICS_DIRTY,
    MATERIAL_DIRTY,
}

/** Sentinel corner radius: fully rounded capsule/circle. */
public const val CORNER_RADIUS_CAPSULE: Float = -1f

private const val DEFAULT_SCRIM_COLOR = 0x59FFFFFF.toInt() // white @ 35%

/**
 * The embeddable Liquid Glass engine for the View system.
 *
 * [LiquidGlassView] is a ready-made host, but any custom view (a React Native
 * view, a launcher widget host, ...) gains glass by owning a controller and
 * forwarding four calls:
 *
 * ```
 * private val glass = GlassViewController(this)   // setWillNotDraw(false)!
 * override fun onDraw(canvas: Canvas)      { super.onDraw(canvas); glass.draw(canvas) }
 * override fun onAttachedToWindow()        { super.onAttachedToWindow(); glass.onHostAttached() }
 * override fun onDetachedFromWindow()      { glass.onHostDetached(); super.onDetachedFromWindow() }
 * override fun dispatchTouchEvent(e: MotionEvent): Boolean { glass.handleTouch(e); return super.dispatchTouchEvent(e) }
 * ```
 *
 * All dimension properties are in dp; every property change invalidates the
 * host automatically. Rendering degrades through the same tiers as the Compose
 * artifact: full AGSL refraction on API 33+, frosted blur on 31–32, clipped
 * backdrop + scrim on 29–30, plain scrim + rim everywhere else.
 */
public class GlassViewController(private val host: View) {

    private val renderer = GlassViewRenderer()
    private val locationSelf = IntArray(2)
    private val locationProvider = IntArray(2)
    private val relativePosition = FloatArray(2)
    private val frame = GlassFrame()
    private var pressAmount = 0f
    private var pressX = 0f
    private var pressY = 0f
    private var pressAnimator: ValueAnimator? = null
    private var previousRelativeX: Float? = null
    private var previousRelativeY: Float? = null
    private var previousMotionAtNanos = 0L
    private var derivedMotionX = 0f
    private var derivedMotionY = 0f
    private var explicitMotionX: Float? = null
    private var explicitMotionY: Float? = null
    /** The backdrop this glass refracts. Must be drawn below the host. */
    public var provider: LiquidGlassBackdropSource? = null
        set(value) {
            if (field === value) return
            field?.unregisterConsumer(host)
            field = value
            if (host.isAttachedToWindow) value?.registerConsumer(host)
            host.invalidate()
        }

    /** Corner radius in dp, or [CORNER_RADIUS_CAPSULE] for a capsule/circle. */
    public var cornerRadiusDp: Float = CORNER_RADIUS_CAPSULE
        set(value) = invalidating(field, value) { field = it }

    public var opticsModel: GlassOpticsModel = GlassOpticsModel.HEIGHT_FIELD
        set(value) = invalidating(field, value, GlassDirtyKind.OPTICS_DIRTY) { field = it }

    public var sdfScaleLens: SdfScaleLensConfig = SdfScaleLensConfig()
        set(value) = invalidating(field, value, GlassDirtyKind.MATERIAL_DIRTY) { field = it }

    /** Backdrop blur radius in dp — the frostiness of the glass. */
    public var blurRadiusDp: Float = 20f
        set(value) = invalidating(field, value) { field = it }

    /** Width of the refracting band along the rim, in dp. */
    public var refractionHeightDp: Float = 10f
        set(value) = invalidating(field, value) { field = it }

    /** Peak refraction displacement in dp (negative bends outward). */
    public var refractionAmountDp: Float = 12f
        set(value) = invalidating(field, value) { field = it }

    /** Full-body rounded-rect coordinate remapping in dp, separate from the rim bend. */
    public var bodyRefractionAmountDp: Float = 2.5f
        set(value) = invalidating(field, value) { field = it }

    /** 0..1 animated material morph from idle to pressed/dragged optics. */
    public var interactionProgress: Float = 0f
        set(value) = invalidating(field, value.coerceIn(0f, 1f), GlassDirtyKind.OPTICS_DIRTY) { field = it }

    /** Backdrop saturation boost; 1 leaves color untouched. */
    public var saturation: Float = 1.5f
        set(value) = invalidating(field, value) { field = it }

    /** Surface tint; the alpha channel is the blend strength. */
    @setparam:ColorInt
    public var glassTintColor: Int = Color.TRANSPARENT
        set(value) = invalidating(field, value) { field = it }

    /** Material-specific multiplier applied to the RGBA tint alpha. */
    public var tintAlpha: Float = 1f
        set(value) = invalidating(field, value.coerceIn(0f, 1f)) { field = it }

    /** 0..1 RGB dispersion along the lens edge. */
    public var chromaticAberration: Float = 0f
        set(value) = invalidating(field, value) { field = it }

    /** Strength of the anti-banding grain. */
    public var noiseAlpha: Float = 0.015f
        set(value) = invalidating(field, value) { field = it }

    /** 0..1 intensity of the specular rim highlight. */
    public var highlightAlpha: Float = 0.45f
        set(value) = invalidating(field, value) { field = it }

    /** Gain for the half-vector specular lobe. */
    public var specularStrength: Float = 1f
        set(value) = invalidating(field, value) { field = it }

    /** Gain for the height-field Fresnel edge response. */
    public var fresnelStrength: Float = 0.85f
        set(value) = invalidating(field, value) { field = it }

    /** Gain for the thin inner compression shadow near the rounded edge. */
    public var innerShadowStrength: Float = 0.18f
        set(value) = invalidating(field, value) { field = it }

    /** Thickness of the specular rim in dp. */
    public var highlightWidthDp: Float = 2f
        set(value) = invalidating(field, value) { field = it }

    /** Screen-space angle the rim light comes from, in degrees. */
    public var lightAngleDegrees: Float = 245f
        set(value) = invalidating(field, value) { field = it }

    /** Scrim color used by the lowest tiers. */
    @setparam:ColorInt
    public var fallbackScrimColor: Int = DEFAULT_SCRIM_COLOR
        set(value) = invalidating(field, value) { field = it }

    /** When true the glass answers touch with the gel press response. */
    public var isGlassInteractive: Boolean = false

    /** Keep a cropped backdrop region current while an interactive lens is mounted. */
    public var continuousBackdrop: Boolean = false
        set(value) {
            if (field == value) return
            field = value
            host.invalidate()
            if (value) provider?.requestCaptureFrame()
        }

    /** Optional UI-thread velocity overrides, normalized to -1..1. */
    public var motionX: Float? = null
        set(value) = invalidating(field, value?.coerceIn(-1f, 1f), GlassDirtyKind.OPTICS_DIRTY) { field = it }
    public var motionY: Float? = null
        set(value) = invalidating(field, value?.coerceIn(-1f, 1f), GlassDirtyKind.OPTICS_DIRTY) { field = it }

    /** Development-only view of the displaced backdrop without material lighting. */
    public var displacementOnlyDebug: Boolean = false
        set(value) = invalidating(field, value, GlassDirtyKind.OPTICS_DIRTY) { field = it }

    public var sdfDisplacementMapDebug: Boolean = false
        set(value) = invalidating(field, value, GlassDirtyKind.OPTICS_DIRTY) { field = it }

    /** Optional fidelity cap (accessibility, battery, tests). */
    public var tierOverride: GlassRenderTier? = null
        set(value) = invalidating(field, value) { field = it }

    public fun onHostAttached() {
        provider?.registerConsumer(host)
    }

    public fun onHostDetached() {
        provider?.unregisterConsumer(host)
        pressAnimator?.cancel()
        renderer.release()
    }

    /** Observes (never consumes) touch for the gel press response. */
    public fun handleTouch(event: MotionEvent) {
        if (!isGlassInteractive) return
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                pressX = event.x
                pressY = event.y
                animatePress(target = 1f, durationMs = 140L, interpolator = DecelerateInterpolator())
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL ->
                animatePress(target = 0f, durationMs = 420L, interpolator = OvershootInterpolator(2.2f))
        }
    }

    /** Draws the glass into [canvas]; call before the host's children draw. */
    public fun draw(canvas: Canvas) {
        if (host.width < 1 || host.height < 1) return
        LiquidGlassPerfTelemetry.consumerDraw()
        if (continuousBackdrop) provider?.requestCaptureFrame()
        val frame = buildFrame()
        val backdrop = provider
        val providerNode =
            if (Build.VERSION.SDK_INT >= 29) backdrop?.renderNodeFor(host) else null

        val tier = GlassRenderTier.select(Build.VERSION.SDK_INT, tierOverride)
        val canSample = canvas.isHardwareAccelerated &&
            backdrop?.hasRecording == true && providerNode != null
        if (canSample) LiquidGlassPerfTelemetry.backdropSample()

        when {
            canSample && tier == GlassRenderTier.SHADER && Build.VERSION.SDK_INT >= 33 ->
                renderer.drawEffectGlass(canvas, providerNode!!, frame, useShader = true)
            canSample && tier != GlassRenderTier.SCRIM && Build.VERSION.SDK_INT >= 31 ->
                renderer.drawEffectGlass(canvas, providerNode!!, frame, useShader = false)
            canSample && Build.VERSION.SDK_INT >= 29 ->
                renderer.drawBackdropScrim(canvas, providerNode!!, frame, resolveScrimColor())
            else ->
                renderer.drawPlainScrim(canvas, frame, resolveScrimColor())
        }
    }

    private fun buildFrame(): GlassFrame {
        val density = host.resources.displayMetrics.density
        val width = host.width.toFloat()
        val height = host.height.toFloat()
        val maxRadius = min(width, height) / 2f
        val cornerRadiusPx = if (cornerRadiusDp < 0f) {
            maxRadius
        } else {
            min(cornerRadiusDp * density, maxRadius)
        }
        val relative = relativeToProvider()
        updateMotion(relative)
        val backdrop = provider
        val recordedOriginX = backdrop?.recordedOriginXFor(host) ?: 0
        val recordedOriginY = backdrop?.recordedOriginYFor(host) ?: 0
        frame.widthPx = width
        frame.heightPx = height
        frame.cornerRadiusPx = cornerRadiusPx
        frame.densityScale = density
        frame.opticsModel = opticsModel
        frame.sdfScaleLens = sdfScaleLens
        frame.blurRadiusPx = blurRadiusDp * density
        frame.refractionHeightPx = refractionHeightDp * density
        frame.refractionAmountPx = refractionAmountDp * density
        frame.bodyRefractionAmountPx = bodyRefractionAmountDp * density
        frame.interactionProgress = interactionProgress
        frame.saturation = saturation
        frame.tintColor = glassTintColor
        frame.tintAlpha = tintAlpha
        frame.chromaticAberration = chromaticAberration
        frame.noiseAlpha = noiseAlpha
        frame.highlightAlpha = highlightAlpha * (1f + pressAmount * 0.4f)
        frame.specularStrength = specularStrength
        frame.fresnelStrength = fresnelStrength
        frame.innerShadowStrength = innerShadowStrength
        frame.highlightWidthPx = highlightWidthDp * density
        frame.displacementOnlyDebug = displacementOnlyDebug
        frame.sdfDisplacementMapDebug = sdfDisplacementMapDebug
        frame.lightAngleDegrees = lightAngleDegrees
        frame.pressAmount = pressAmount
        frame.pressX = pressX
        frame.pressY = pressY
        frame.relativeX = relative[0] - recordedOriginX
        frame.relativeY = relative[1] - recordedOriginY
        frame.motionX = motionX ?: derivedMotionX
        frame.motionY = motionY ?: derivedMotionY
        return frame
    }

    private fun updateMotion(relative: FloatArray) {
        val now = System.nanoTime()
        val previousX = previousRelativeX
        val previousY = previousRelativeY
        val elapsedSeconds = (now - previousMotionAtNanos) / 1_000_000_000f
        if (previousX != null && previousY != null &&
            (abs(relative[0] - previousX) > 0.5f || abs(relative[1] - previousY) > 0.5f)
        ) {
            // Cropped providers need a new recording when the consumer moves.
            // Full-scene providers (the Expo/RN host) only need new sampling
            // coordinates, so avoid an otherwise redundant full-page re-record.
            val backdrop = provider
            if (!continuousBackdrop && backdrop?.requiresCaptureOnConsumerMovement == true) {
                backdrop.requestCaptureFrame()
            }
        }
        if (previousX != null && previousY != null && elapsedSeconds in 0.004f..0.12f) {
            val density = host.resources.displayMetrics.density.coerceAtLeast(1f)
            val targetX = (((relative[0] - previousX) / density) / elapsedSeconds / 1800f).coerceIn(-1f, 1f)
            val targetY = (((relative[1] - previousY) / density) / elapsedSeconds / 1800f).coerceIn(-1f, 1f)
            derivedMotionX = derivedMotionX * 0.62f + targetX * 0.38f
            derivedMotionY = derivedMotionY * 0.62f + targetY * 0.38f
        } else if (elapsedSeconds > 0.12f || previousX == null) {
            derivedMotionX = 0f
            derivedMotionY = 0f
        }
        previousRelativeX = relative[0]
        previousRelativeY = relative[1]
        previousMotionAtNanos = now
    }

    private fun relativeToProvider(): FloatArray {
        val backdrop = provider
        if (backdrop == null) {
            relativePosition[0] = 0f
            relativePosition[1] = 0f
            return relativePosition
        }
        val previousX = relativePosition[0]
        val previousY = relativePosition[1]
        LiquidGlassPerfTelemetry.geometryLookup()
        host.getLocationInWindow(locationSelf)
        LiquidGlassPerfTelemetry.geometryLookup()
        backdrop.sourceView.getLocationInWindow(locationProvider)
        relativePosition[0] = (locationSelf[0] - locationProvider[0]).toFloat()
        relativePosition[1] = (locationSelf[1] - locationProvider[1]).toFloat()
        if (previousX != relativePosition[0] || previousY != relativePosition[1]) {
            LiquidGlassPerfTelemetry.consumerGeometryDirty()
            if (!continuousBackdrop) backdrop.onConsumerGeometryChanged(host)
        }
        return relativePosition
    }

    private fun resolveScrimColor(): Int =
        if (Color.alpha(glassTintColor) > 0) glassTintColor else fallbackScrimColor

    private fun animatePress(target: Float, durationMs: Long, interpolator: Interpolator) {
        pressAnimator?.cancel()
        pressAnimator = ValueAnimator.ofFloat(pressAmount, target).apply {
            duration = durationMs
            this.interpolator = interpolator
            addUpdateListener {
                pressAmount = it.animatedValue as Float
                LiquidGlassPerfTelemetry.opticsDirty()
                val scale = 1f + 0.025f * pressAmount
                host.scaleX = scale
                host.scaleY = scale
                host.invalidate()
            }
            start()
        }
    }

    private inline fun <T> invalidating(
        old: T,
        new: T,
        kind: GlassDirtyKind = GlassDirtyKind.MATERIAL_DIRTY,
        assign: (T) -> Unit,
    ) {
        if (old != new) {
            assign(new)
            when (kind) {
                GlassDirtyKind.SOURCE_CONTENT_DIRTY -> Unit
                GlassDirtyKind.CONSUMER_GEOMETRY_DIRTY -> LiquidGlassPerfTelemetry.consumerGeometryDirty()
                GlassDirtyKind.OPTICS_DIRTY -> LiquidGlassPerfTelemetry.opticsDirty()
                GlassDirtyKind.MATERIAL_DIRTY -> LiquidGlassPerfTelemetry.materialDirty()
            }
            host.invalidate()
        }
    }
}

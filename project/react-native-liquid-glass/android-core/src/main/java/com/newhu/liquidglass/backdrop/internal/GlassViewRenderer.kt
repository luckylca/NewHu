package com.newhu.liquidglass.backdrop.internal

import android.graphics.Canvas
import android.graphics.Color
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.RenderEffect
import android.graphics.RenderNode
import android.graphics.RuntimeShader
import android.graphics.Shader
import androidx.annotation.RequiresApi
import com.newhu.liquidglass.core.GlassUniforms
import com.newhu.liquidglass.core.GlassOpticsModel
import com.newhu.liquidglass.core.GlassOpticalInsets
import com.newhu.liquidglass.core.SdfScaleLensConfig
import com.newhu.liquidglass.core.shader.HeightFieldGlassShader
import com.newhu.liquidglass.core.shader.SdfScaleLensShader
import com.newhu.liquidglass.telemetry.LiquidGlassPerfTelemetry
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

private const val MIN_BLUR_RADIUS_PX = 0.05f
private const val SATURATION_EPSILON = 0.01f

/** Everything the renderer needs for one frame, resolved to pixels. */
internal class GlassFrame(
    var widthPx: Float = 0f,
    var heightPx: Float = 0f,
    var cornerRadiusPx: Float = 0f,
    var opticsModel: GlassOpticsModel = GlassOpticsModel.HEIGHT_FIELD,
    var sdfScaleLens: SdfScaleLensConfig = SdfScaleLensConfig(),
    var densityScale: Float = 1f,
    var blurRadiusPx: Float = 0f,
    var refractionHeightPx: Float = 0f,
    var refractionAmountPx: Float = 0f,
    var bodyRefractionAmountPx: Float = 0f,
    var interactionProgress: Float = 0f,
    var saturation: Float = 1f,
    var tintColor: Int = Color.TRANSPARENT,
    var tintAlpha: Float = 1f,
    var chromaticAberration: Float = 0f,
    var noiseAlpha: Float = 0f,
    var highlightAlpha: Float = 0f,
    var specularStrength: Float = 1f,
    var fresnelStrength: Float = 0.85f,
    var innerShadowStrength: Float = 0.18f,
    var highlightWidthPx: Float = 0f,
    var displacementOnlyDebug: Boolean = false,
    var sdfDisplacementMapDebug: Boolean = false,
    var lightAngleDegrees: Float = 245f,
    var pressAmount: Float = 0f,
    var pressX: Float = 0f,
    var pressY: Float = 0f,
    var relativeX: Float = 0f,
    var relativeY: Float = 0f,
    var motionX: Float = 0f,
    var motionY: Float = 0f,
)

/**
 * Per-view drawing engine for the View system, mirroring the Compose
 * `GlassPainter` tier behavior with [RenderNode]/[RenderEffect] primitives and
 * the shared AGSL program from `liquidglass-core`.
 */
internal class GlassViewRenderer {

    private var glassNode: RenderNode? = null
    private var runtimeShader: RuntimeShader? = null
    private var sdfScaleLensShader: RuntimeShader? = null
    private val clipPath = Path()
    private val scrimPaint = Paint()
    private val rimPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }
    private val rectF = RectF()
    private val packedShapes = FloatArray(GlassUniforms.MAX_SHAPES * GlassUniforms.SHAPE_FLOATS).apply {
        for (i in 0 until GlassUniforms.MAX_SHAPES) {
            val base = i * GlassUniforms.SHAPE_FLOATS
            this[base] = GlassUniforms.SENTINEL_CENTER
            this[base + 1] = GlassUniforms.SENTINEL_CENTER
            this[base + 2] = 1f
            this[base + 3] = 1f
        }
    }
    private val packedRadii = FloatArray(GlassUniforms.MAX_SHAPES)
    private var shaderEffect: RenderEffect? = null
    private var sdfScaleLensEffect: RenderEffect? = null
    private var cachedPrepEffect: RenderEffect? = null
    private var cachedPrepBlur = Float.NaN
    private var cachedPrepSaturation = Float.NaN
    private var cachedPrepValid = false
    private var cachedChainEffect: RenderEffect? = null
    private var cachedChainPrep: RenderEffect? = null
    private var cachedChainRuntimeEffect: RenderEffect? = null
    private var appliedRenderEffect: RenderEffect? = null
    private var cachedLightAngle = Float.NaN
    private var cachedLightDirX = 0f
    private var cachedLightDirY = 0f
    private var recordedProviderNode: RenderNode? = null
    private var recordedLayerWidth = -1
    private var recordedLayerHeight = -1
    private var recordedTranslateX = Float.NaN
    private var recordedTranslateY = Float.NaN
    private var cachedSdfWidth = Float.NaN
    private var cachedSdfHeight = Float.NaN
    private var cachedSdfMaxRawDisplacement = 0f
    private var cachedSdfMaxSampleDisplacementX = 0f
    private var cachedSdfMaxSampleDisplacementY = 0f

    fun release() {
        if (android.os.Build.VERSION.SDK_INT >= 29) {
            glassNode?.discardDisplayList()
        }
        glassNode = null
        runtimeShader = null
        sdfScaleLensShader = null
        shaderEffect = null
        sdfScaleLensEffect = null
        cachedPrepEffect = null
        cachedPrepBlur = Float.NaN
        cachedPrepSaturation = Float.NaN
        cachedPrepValid = false
        cachedChainEffect = null
        cachedChainPrep = null
        cachedChainRuntimeEffect = null
        appliedRenderEffect = null
        cachedLightAngle = Float.NaN
        recordedProviderNode = null
        recordedLayerWidth = -1
        recordedLayerHeight = -1
        recordedTranslateX = Float.NaN
        recordedTranslateY = Float.NaN
        cachedSdfWidth = Float.NaN
        cachedSdfHeight = Float.NaN
        cachedSdfMaxRawDisplacement = 0f
        cachedSdfMaxSampleDisplacementX = 0f
        cachedSdfMaxSampleDisplacementY = 0f
    }

    /** SHADER (33+) and BLUR (31+) tiers: backdrop slice + RenderEffect. */
    @RequiresApi(31)
    fun drawEffectGlass(
        canvas: Canvas,
        providerNode: RenderNode,
        frame: GlassFrame,
        useShader: Boolean,
    ) {
        val insets = opticalInsets(frame)
        val layerWidth = kotlin.math.ceil(frame.widthPx + insets.left + insets.right).toInt()
        val layerHeight = kotlin.math.ceil(frame.heightPx + insets.top + insets.bottom).toInt()
        if (layerWidth <= 0 || layerHeight <= 0) return

        val node = glassNode ?: RenderNode("LiquidGlass").also { glassNode = it }
        val translateX = insets.left - frame.relativeX
        val translateY = insets.top - frame.relativeY
        val mustRecord = !node.hasDisplayList() ||
            recordedProviderNode !== providerNode ||
            recordedLayerWidth != layerWidth ||
            recordedLayerHeight != layerHeight ||
            recordedTranslateX != translateX ||
            recordedTranslateY != translateY
        if (mustRecord) {
            node.setPosition(0, 0, layerWidth, layerHeight)
            val recording = node.beginRecording(layerWidth, layerHeight)
            try {
                recording.translate(translateX, translateY)
                recording.drawRenderNode(providerNode)
            } finally {
                node.endRecording()
            }
            recordedProviderNode = providerNode
            recordedLayerWidth = layerWidth
            recordedLayerHeight = layerHeight
            recordedTranslateX = translateX
            recordedTranslateY = translateY
        }
        val effect = if (useShader && android.os.Build.VERSION.SDK_INT >= 33) {
            buildShaderEffect(frame, insets)
        } else {
            buildBackdropPrepEffect(frame.blurRadiusPx, frame.saturation)
        }
        if (appliedRenderEffect !== effect) {
            node.setRenderEffect(effect)
            appliedRenderEffect = effect
        }

        canvas.save()
        if (!useShader) {
            canvas.clipPath(shapePath(frame))
        }
        canvas.translate(-insets.left, -insets.top)
        canvas.drawRenderNode(node)
        canvas.restore()

        if (!useShader) {
            if (Color.alpha(frame.tintColor) > 0) {
                drawFill(canvas, frame, frame.tintColor)
            }
            drawRim(canvas, frame)
        }
    }

    /** API 29–30: real backdrop, clipped, with a scrim — no RenderEffect. */
    @RequiresApi(29)
    fun drawBackdropScrim(
        canvas: Canvas,
        providerNode: RenderNode,
        frame: GlassFrame,
        scrimColor: Int,
    ) {
        canvas.save()
        canvas.clipPath(shapePath(frame))
        canvas.translate(-frame.relativeX, -frame.relativeY)
        canvas.drawRenderNode(providerNode)
        canvas.restore()
        drawFill(canvas, frame, scrimColor)
        drawRim(canvas, frame)
    }

    /** Last resort everywhere: translucent scrim + rim, no backdrop sample. */
    fun drawPlainScrim(canvas: Canvas, frame: GlassFrame, scrimColor: Int) {
        drawFill(canvas, frame, scrimColor)
        drawRim(canvas, frame)
    }

    @RequiresApi(33)
    private fun buildShaderEffect(frame: GlassFrame, insets: GlassOpticalInsets): RenderEffect {
        if (frame.opticsModel == GlassOpticsModel.SDF_SCALE_LENS) {
            return buildSdfScaleLensEffect(frame, insets)
        }
        val shader = runtimeShader
            ?: RuntimeShader(HeightFieldGlassShader.SOURCE).also {
                runtimeShader = it
                LiquidGlassPerfTelemetry.effectBuild()
            }
        val halfWidth = frame.widthPx / 2f
        val halfHeight = frame.heightPx / 2f
        packedShapes[0] = halfWidth + insets.left
        packedShapes[1] = halfHeight + insets.top
        packedShapes[2] = halfWidth
        packedShapes[3] = halfHeight
        packedRadii[0] = min(frame.cornerRadiusPx, max(min(halfWidth, halfHeight), 0f))
        if (cachedLightAngle != frame.lightAngleDegrees) {
            val angleRadians = Math.toRadians(frame.lightAngleDegrees.toDouble())
            cachedLightDirX = cos(angleRadians).toFloat()
            cachedLightDirY = sin(angleRadians).toFloat()
            cachedLightAngle = frame.lightAngleDegrees
        }
        with(shader) {
            setFloatUniform(GlassUniforms.SHAPES, packedShapes)
            setFloatUniform(GlassUniforms.SHAPE_RADII, packedRadii)
            setFloatUniform(GlassUniforms.MERGE_SMOOTHING, 0f)
            setFloatUniform(GlassUniforms.REFRACTION_HEIGHT, frame.refractionHeightPx)
            setFloatUniform(GlassUniforms.REFRACTION_AMOUNT, frame.refractionAmountPx)
            setFloatUniform(GlassUniforms.BODY_REFRACTION_AMOUNT, frame.bodyRefractionAmountPx)
            setFloatUniform(GlassUniforms.INTERACTION_PROGRESS, frame.interactionProgress)
            setFloatUniform(GlassUniforms.CHROMATIC_ABERRATION, frame.chromaticAberration)
            setFloatUniform(
                GlassUniforms.TINT,
                Color.red(frame.tintColor) / 255f,
                Color.green(frame.tintColor) / 255f,
                Color.blue(frame.tintColor) / 255f,
                Color.alpha(frame.tintColor) / 255f,
            )
            setFloatUniform(GlassUniforms.TINT_ALPHA, frame.tintAlpha)
            setFloatUniform(GlassUniforms.NOISE_ALPHA, frame.noiseAlpha)
            setFloatUniform(
                GlassUniforms.LIGHT_DIRECTION,
                cachedLightDirX,
                cachedLightDirY,
            )
            setFloatUniform(GlassUniforms.HIGHLIGHT_ALPHA, frame.highlightAlpha)
            setFloatUniform(GlassUniforms.SPECULAR_STRENGTH, frame.specularStrength)
            setFloatUniform(GlassUniforms.FRESNEL_STRENGTH, frame.fresnelStrength)
            setFloatUniform(GlassUniforms.INNER_SHADOW_STRENGTH, frame.innerShadowStrength)
            setFloatUniform(GlassUniforms.HIGHLIGHT_WIDTH, frame.highlightWidthPx)
            setFloatUniform(GlassUniforms.PRESS_AMOUNT, max(frame.pressAmount, 0f))
            setFloatUniform(GlassUniforms.MOTION, frame.motionX, frame.motionY)
            setFloatUniform(GlassUniforms.DISPLACEMENT_ONLY, if (frame.displacementOnlyDebug) 1f else 0f)
            setFloatUniform(
                GlassUniforms.PRESS_POINT,
                frame.pressX + insets.left,
                frame.pressY + insets.top,
            )
        }
        val runtimeEffect = shaderEffect
            ?: RenderEffect.createRuntimeShaderEffect(shader, GlassUniforms.CONTENT).also {
                shaderEffect = it
                LiquidGlassPerfTelemetry.effectBuild()
            }
        val prep = if (frame.displacementOnlyDebug) {
            null
        } else {
            buildBackdropPrepEffect(frame.blurRadiusPx, frame.saturation)
        } ?: return runtimeEffect
        if (cachedChainEffect == null || cachedChainRuntimeEffect !== runtimeEffect || cachedChainPrep !== prep) {
            cachedChainRuntimeEffect = runtimeEffect
            cachedChainPrep = prep
            cachedChainEffect = RenderEffect.createChainEffect(runtimeEffect, prep).also {
                LiquidGlassPerfTelemetry.effectBuild()
            }
        }
        return cachedChainEffect!!
    }

    @RequiresApi(33)
    private fun buildSdfScaleLensEffect(frame: GlassFrame, insets: GlassOpticalInsets): RenderEffect {
        val shader = sdfScaleLensShader
            ?: RuntimeShader(SdfScaleLensShader.SOURCE).also {
                sdfScaleLensShader = it
                LiquidGlassPerfTelemetry.effectBuild()
            }
        ensureSdfDisplacementBounds(frame)
        with(shader) {
            setFloatUniform(SdfScaleLensShader.GLASS_ORIGIN, insets.left, insets.top)
            setFloatUniform(SdfScaleLensShader.GLASS_SIZE, frame.widthPx, frame.heightPx)
            setFloatUniform(SdfScaleLensShader.GLASS_RADIUS, frame.cornerRadiusPx)
            setFloatUniform(SdfScaleLensShader.MAX_RAW_DISPLACEMENT, cachedSdfMaxRawDisplacement)
            setFloatUniform(SdfScaleLensShader.CONTRAST, frame.sdfScaleLens.contrast)
            setFloatUniform(SdfScaleLensShader.BRIGHTNESS, frame.sdfScaleLens.brightness)
            setFloatUniform(SdfScaleLensShader.SATURATION, frame.sdfScaleLens.saturation)
            setFloatUniform(SdfScaleLensShader.OUTER_SHADOW_ALPHA, frame.sdfScaleLens.outerShadowAlpha)
            setFloatUniform(
                SdfScaleLensShader.OUTER_SHADOW_BLUR,
                frame.sdfScaleLens.outerShadowBlurRadiusDp * frame.densityScale,
            )
            setFloatUniform(
                SdfScaleLensShader.OUTER_SHADOW_OFFSET_Y,
                frame.sdfScaleLens.outerShadowOffsetYDp * frame.densityScale,
            )
            setFloatUniform(SdfScaleLensShader.INNER_SHADOW_ALPHA, frame.sdfScaleLens.innerShadowAlpha)
            setFloatUniform(
                SdfScaleLensShader.INNER_SHADOW_EXTENT,
                frame.sdfScaleLens.innerShadowExtentDp * frame.densityScale,
            )
            setFloatUniform(
                SdfScaleLensShader.DISPLACEMENT_MAP_DEBUG,
                if (frame.sdfDisplacementMapDebug) 1f else 0f,
            )
            setFloatUniform(
                SdfScaleLensShader.DISPLACEMENT_ONLY_DEBUG,
                if (frame.displacementOnlyDebug) 1f else 0f,
            )
        }
        val runtimeEffect = sdfScaleLensEffect
            ?: RenderEffect.createRuntimeShaderEffect(shader, GlassUniforms.CONTENT).also {
                sdfScaleLensEffect = it
                LiquidGlassPerfTelemetry.effectBuild()
            }
        val prep = if (frame.displacementOnlyDebug || frame.sdfDisplacementMapDebug) {
            null
        } else {
            buildBackdropPrepEffect(frame.blurRadiusPx, 1f)
        } ?: return runtimeEffect
        if (cachedChainEffect == null || cachedChainRuntimeEffect !== runtimeEffect || cachedChainPrep !== prep) {
            cachedChainRuntimeEffect = runtimeEffect
            cachedChainPrep = prep
            cachedChainEffect = RenderEffect.createChainEffect(runtimeEffect, prep).also {
                LiquidGlassPerfTelemetry.effectBuild()
            }
        }
        return cachedChainEffect!!
    }

    @RequiresApi(31)
    private fun buildBackdropPrepEffect(blurRadiusPx: Float, saturation: Float): RenderEffect? {
        if (cachedPrepValid && cachedPrepBlur == blurRadiusPx && cachedPrepSaturation == saturation) {
            return cachedPrepEffect
        }
        val blur = if (blurRadiusPx > MIN_BLUR_RADIUS_PX) {
            RenderEffect.createBlurEffect(blurRadiusPx, blurRadiusPx, Shader.TileMode.CLAMP).also {
                LiquidGlassPerfTelemetry.effectBuild()
            }
        } else {
            null
        }
        val effect = if (abs(saturation - 1f) < SATURATION_EPSILON) {
            blur
        } else {
            val filter = ColorMatrixColorFilter(ColorMatrix().apply { setSaturation(saturation) })
            if (blur != null) {
                RenderEffect.createColorFilterEffect(filter, blur).also { LiquidGlassPerfTelemetry.effectBuild() }
            } else {
                RenderEffect.createColorFilterEffect(filter).also { LiquidGlassPerfTelemetry.effectBuild() }
            }
        }
        cachedPrepBlur = blurRadiusPx
        cachedPrepSaturation = saturation
        cachedPrepEffect = effect
        cachedPrepValid = true
        return effect
    }

    private fun opticalInsets(frame: GlassFrame): GlassOpticalInsets {
        if (frame.opticsModel != GlassOpticsModel.SDF_SCALE_LENS) {
            val margin = frame.blurRadiusPx * 2f + abs(frame.refractionAmountPx) +
                abs(frame.bodyRefractionAmountPx) + 4f
            return GlassOpticalInsets(margin, margin, margin, margin)
        }
        ensureSdfDisplacementBounds(frame)
        val shadowExtent = frame.sdfScaleLens.outerShadowBlurRadiusDp * frame.densityScale * 3f
        val shadowOffset = frame.sdfScaleLens.outerShadowOffsetYDp * frame.densityScale
        val prepBlurExtent = frame.blurRadiusPx * 3f
        val safety = 1f
        return GlassOpticalInsets(
            left = cachedSdfMaxSampleDisplacementX + shadowExtent + prepBlurExtent + safety,
            top = cachedSdfMaxSampleDisplacementY + max(shadowExtent - shadowOffset, 0f) + prepBlurExtent + safety,
            right = cachedSdfMaxSampleDisplacementX + shadowExtent + prepBlurExtent + safety,
            bottom = cachedSdfMaxSampleDisplacementY + shadowExtent + shadowOffset + prepBlurExtent + safety,
        )
    }

    private fun ensureSdfDisplacementBounds(frame: GlassFrame) {
        if (cachedSdfWidth == frame.widthPx && cachedSdfHeight == frame.heightPx) return
        cachedSdfWidth = frame.widthPx
        cachedSdfHeight = frame.heightPx
        cachedSdfMaxRawDisplacement = SdfScaleLensShader.maxRawDisplacementPx(frame.widthPx, frame.heightPx)
        val (maxX, maxY) = SdfScaleLensShader.maxSampleDisplacementAxesPx(frame.widthPx, frame.heightPx)
        cachedSdfMaxSampleDisplacementX = maxX
        cachedSdfMaxSampleDisplacementY = maxY
    }

    private fun shapePath(frame: GlassFrame): Path {
        clipPath.rewind()
        rectF.set(0f, 0f, frame.widthPx, frame.heightPx)
        clipPath.addRoundRect(rectF, frame.cornerRadiusPx, frame.cornerRadiusPx, Path.Direction.CW)
        return clipPath
    }

    private fun drawFill(canvas: Canvas, frame: GlassFrame, color: Int) {
        scrimPaint.shader = null
        scrimPaint.color = color
        rectF.set(0f, 0f, frame.widthPx, frame.heightPx)
        canvas.drawRoundRect(rectF, frame.cornerRadiusPx, frame.cornerRadiusPx, scrimPaint)
    }

    private fun drawRim(canvas: Canvas, frame: GlassFrame) {
        if (frame.highlightAlpha <= 0f || frame.highlightWidthPx <= 0f) return
        val angleRadians = Math.toRadians(frame.lightAngleDegrees.toDouble())
        val dirX = cos(angleRadians).toFloat()
        val dirY = sin(angleRadians).toFloat()
        val cx = frame.widthPx / 2f
        val cy = frame.heightPx / 2f
        val reach = max(frame.widthPx, frame.heightPx) / 2f
        val alpha = (frame.highlightAlpha * 255).toInt().coerceIn(0, 255)
        rimPaint.strokeWidth = frame.highlightWidthPx
        rimPaint.shader = LinearGradient(
            cx + dirX * reach, cy + dirY * reach,
            cx - dirX * reach, cy - dirY * reach,
            intArrayOf(
                Color.argb(alpha, 255, 255, 255),
                Color.argb((alpha * 0.08f).toInt(), 255, 255, 255),
                Color.argb((alpha * 0.55f).toInt(), 255, 255, 255),
            ),
            floatArrayOf(0f, 0.5f, 1f),
            Shader.TileMode.CLAMP,
        )
        rectF.set(0f, 0f, frame.widthPx, frame.heightPx)
        canvas.drawRoundRect(rectF, frame.cornerRadiusPx, frame.cornerRadiusPx, rimPaint)
    }
}

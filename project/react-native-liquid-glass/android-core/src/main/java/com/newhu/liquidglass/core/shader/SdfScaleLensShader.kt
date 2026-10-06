package com.newhu.liquidglass.core.shader

import kotlin.math.abs
import kotlin.math.hypot

public object SdfScaleLensShader {
    public const val GLASS_ORIGIN: String = "glassOrigin"
    public const val GLASS_SIZE: String = "glassSize"
    public const val GLASS_RADIUS: String = "glassRadius"
    public const val MAX_RAW_DISPLACEMENT: String = "maxRawDisplacement"
    public const val CONTRAST: String = "contrast"
    public const val BRIGHTNESS: String = "brightness"
    public const val SATURATION: String = "saturation"
    public const val OUTER_SHADOW_ALPHA: String = "outerShadowAlpha"
    public const val OUTER_SHADOW_BLUR: String = "outerShadowBlur"
    public const val OUTER_SHADOW_OFFSET_Y: String = "outerShadowOffsetY"
    public const val INNER_SHADOW_ALPHA: String = "innerShadowAlpha"
    public const val INNER_SHADOW_EXTENT: String = "innerShadowExtent"
    public const val DISPLACEMENT_MAP_DEBUG: String = "displacementMapDebug"
    public const val DISPLACEMENT_ONLY_DEBUG: String = "displacementOnlyDebug"

    public val SOURCE: String = """
uniform shader content;
uniform float2 $GLASS_ORIGIN;
uniform float2 $GLASS_SIZE;
uniform float $GLASS_RADIUS;
uniform float $MAX_RAW_DISPLACEMENT;
uniform float $CONTRAST;
uniform float $BRIGHTNESS;
uniform float $SATURATION;
uniform float $OUTER_SHADOW_ALPHA;
uniform float $OUTER_SHADOW_BLUR;
uniform float $OUTER_SHADOW_OFFSET_Y;
uniform float $INNER_SHADOW_ALPHA;
uniform float $INNER_SHADOW_EXTENT;
uniform float $DISPLACEMENT_MAP_DEBUG;
uniform float $DISPLACEMENT_ONLY_DEBUG;

float referenceSmoothStep(float edge0, float edge1, float value) {
    float t = clamp((value - edge0) / (edge1 - edge0), 0.0, 1.0);
    return t * t * (3.0 - 2.0 * t);
}

float referenceRoundedRectSdf(float2 p) {
    float qx = abs(p.x) - 0.3 + 0.6;
    float qy = abs(p.y) - 0.2 + 0.6;
    return min(max(qx, qy), 0.0) + length(max(float2(qx, qy), float2(0.0))) - 0.6;
}

float roundedBoxSdf(float2 p, float2 halfSize, float radius) {
    float2 q = abs(p) - halfSize + radius;
    return min(max(q.x, q.y), 0.0) + length(max(q, float2(0.0))) - radius;
}

half4 main(float2 fragCoord) {
    float2 size = max($GLASS_SIZE, float2(1.0));
    float2 uv = (fragCoord - $GLASS_ORIGIN) / size;
    float2 center = $GLASS_ORIGIN + size * 0.5;
    float2 shapeHalfSize = size * 0.5;
    float2 shapePoint = fragCoord - center;
    float shapeDistance = roundedBoxSdf(shapePoint, shapeHalfSize, $GLASS_RADIUS);
    float mask = 1.0 - smoothstep(-0.5, 0.5, shapeDistance);

    if ($DISPLACEMENT_MAP_DEBUG > 0.5) {
        if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) {
            return half4(0.0);
        }
    } else if (shapeDistance > 0.5) {
        float2 outerShadowPoint = shapePoint - float2(0.0, $OUTER_SHADOW_OFFSET_Y);
        float shadowDistance = max(roundedBoxSdf(outerShadowPoint, shapeHalfSize, $GLASS_RADIUS), 0.0);
        float shadowExtent = $OUTER_SHADOW_BLUR * 3.0;
        if (shadowDistance > shadowExtent) {
            return half4(0.0);
        }
        float shadowAlpha = $OUTER_SHADOW_ALPHA * exp(
            -0.5 * pow(shadowDistance / max($OUTER_SHADOW_BLUR, 0.5), 2.0)
        );
        return half4(0.0, 0.0, 0.0, shadowAlpha);
    }

    if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) {
        return half4(0.0);
    }
    float2 local = uv - 0.5;
    float distance = referenceRoundedRectSdf(local);
    float displacement = referenceSmoothStep(0.8, 0.0, distance - 0.15);
    float scale = referenceSmoothStep(0.0, 1.0, displacement);
    float2 rawDisplacement = local * size * (scale - 1.0);
    float mapScale = max($MAX_RAW_DISPLACEMENT * 0.5, 0.0001);
    float2 encodedMap = clamp(rawDisplacement / mapScale + 0.5, 0.0, 1.0);
    encodedMap = floor(encodedMap * 255.0 + 0.5) / 255.0;
    float2 sampleDisplacement = (encodedMap - 0.5) * mapScale;

    if ($DISPLACEMENT_MAP_DEBUG > 0.5) {
        return half4(encodedMap.x, encodedMap.y, 0.0, 1.0);
    }

    float2 sampleCoord = fragCoord + sampleDisplacement;
    float4 backdrop = float4(content.eval(sampleCoord));

    if ($DISPLACEMENT_ONLY_DEBUG > 0.5) {
        return half4(backdrop.rgb * mask, backdrop.a * mask);
    }

    float3 color = (backdrop.rgb - 0.5) * $CONTRAST + 0.5;
    color *= $BRIGHTNESS;
    float luminance = dot(color, float3(0.2126, 0.7152, 0.0722));
    color = mix(float3(luminance), color, $SATURATION);

    float insideDepth = max(-shapeDistance, 0.0);
    float lowerBias = smoothstep(-0.15, 0.8, shapePoint.y / max(shapeHalfSize.y, 1.0));
    float insetShadow = $INNER_SHADOW_ALPHA * exp(-insideDepth / max($INNER_SHADOW_EXTENT, 1.0)) * lowerBias;
    color *= 1.0 - insetShadow;

    return half4(color * mask, backdrop.a * mask);
}
""".trimIndent()

    public fun maxRawDisplacementPx(widthPx: Float, heightPx: Float): Float {
        val (x, y) = maxRawDisplacementAxesPx(widthPx, heightPx)
        return maxOf(x, y)
    }

    public fun maxRawDisplacementAxesPx(widthPx: Float, heightPx: Float): Pair<Float, Float> {
        val x = 0.5f
        val y = 0.5f
        val qx = kotlin.math.abs(x) - 0.3f + 0.6f
        val qy = kotlin.math.abs(y) - 0.2f + 0.6f
        val distance = kotlin.math.min(kotlin.math.max(qx, qy), 0f) +
            hypot(kotlin.math.max(qx, 0f), kotlin.math.max(qy, 0f)) - 0.6f
        val edgeT = ((distance - 0.15f - 0.8f) / (0f - 0.8f)).coerceIn(0f, 1f)
        val displacement = edgeT * edgeT * (3f - 2f * edgeT)
        val scaleT = displacement.coerceIn(0f, 1f)
        val scale = scaleT * scaleT * (3f - 2f * scaleT)
        return Pair(abs(x * widthPx * (scale - 1f)), abs(y * heightPx * (scale - 1f)))
    }

    public fun maxSampleDisplacementAxesPx(widthPx: Float, heightPx: Float): Pair<Float, Float> {
        val (rawX, rawY) = maxRawDisplacementAxesPx(widthPx, heightPx)
        val mapScale = maxOf(rawX, rawY) * 0.5f
        val encodedLimit = mapScale * 0.5f
        return Pair(minOf(rawX, encodedLimit), minOf(rawY, encodedLimit))
    }
}

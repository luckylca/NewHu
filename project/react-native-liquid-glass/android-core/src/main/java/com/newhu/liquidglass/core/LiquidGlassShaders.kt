package com.newhu.liquidglass.core

/**
 * AGSL source for the Liquid Glass shader.
 *
 * The shader receives the already blurred and saturated backdrop as the
 * [GlassUniforms.CONTENT] input and performs, per pixel:
 *
 *  1. **Scene SDF** — smooth union (polynomial smooth-min) of up to
 *     [GlassUniforms.MAX_SHAPES] rounded rectangles, which is what lets nearby
 *     glass elements melt into one liquid form.
 *  2. **Optical height profile** — derives a continuous convex profile from the
 *     rounded-rectangle SDF, then estimates its surface normal.
 *  3. **Backdrop remapping** — bends source coordinates across the body and
 *     strengthens the displacement toward the rim (SDF -> field -> resampling).
 *  4. **Chromatic aberration** — separate backdrop samples for R, G and B.
 *  5. **Fresnel/specular/inner rim** — lighting is secondary to the sampled image.
 *
 * Every formula has a Kotlin twin in [GlassMath]; keep them in lockstep.
 *
 * AGSL constraints honored here: SkSL types only (`float2`/`half4`, never GLSL
 * `vec*`), constant loop bounds, no derivative intrinsics (normals use central
 * differences), and a single `half4 main(float2)` entry point.
 */
public object LiquidGlassShaders {

    private const val MAX_SHAPES: Int = GlassUniforms.MAX_SHAPES

    /** The complete AGSL program for the [GlassRenderTier.SHADER] tier. */
    public val LIQUID_GLASS: String = """
uniform shader ${GlassUniforms.CONTENT};
uniform float4 ${GlassUniforms.SHAPES}[$MAX_SHAPES];
uniform float ${GlassUniforms.SHAPE_RADII}[$MAX_SHAPES];
uniform float ${GlassUniforms.MERGE_SMOOTHING};
uniform float ${GlassUniforms.REFRACTION_HEIGHT};
uniform float ${GlassUniforms.REFRACTION_AMOUNT};
uniform float ${GlassUniforms.BODY_REFRACTION_AMOUNT};
uniform float ${GlassUniforms.INTERACTION_PROGRESS};
uniform float ${GlassUniforms.CHROMATIC_ABERRATION};
uniform float4 ${GlassUniforms.TINT};
uniform float ${GlassUniforms.TINT_ALPHA};
uniform float ${GlassUniforms.NOISE_ALPHA};
uniform float2 ${GlassUniforms.LIGHT_DIRECTION};
uniform float ${GlassUniforms.HIGHLIGHT_ALPHA};
uniform float ${GlassUniforms.SPECULAR_STRENGTH};
uniform float ${GlassUniforms.FRESNEL_STRENGTH};
uniform float ${GlassUniforms.INNER_SHADOW_STRENGTH};
uniform float ${GlassUniforms.HIGHLIGHT_WIDTH};
uniform float ${GlassUniforms.PRESS_AMOUNT};
uniform float2 ${GlassUniforms.PRESS_POINT};
uniform float2 ${GlassUniforms.MOTION};
uniform float ${GlassUniforms.DISPLACEMENT_ONLY};

float sdRoundedBox(float2 p, float2 halfSize, float radius) {
    float2 q = abs(p) - halfSize + radius;
    return min(max(q.x, q.y), 0.0) + length(max(q, float2(0.0))) - radius;
}

float2 roundedBoxNormal(float2 p, float2 halfSize, float radius) {
    float2 q = abs(p) - halfSize + radius;
    float2 outside = max(q, float2(0.0));
    float2 gradient = length(outside) > 0.0001
        ? normalize(outside)
        : (q.x > q.y ? float2(1.0, 0.0) : float2(0.0, 1.0));
    return sign(p) * gradient;
}

float smin(float a, float b, float k) {
    float kk = max(k, 0.0001);
    float h = clamp(0.5 + 0.5 * (b - a) / kk, 0.0, 1.0);
    return mix(b, a, h) - kk * h * (1.0 - h);
}

float sceneSd(float2 p) {
    float d = 1000000.0;
    for (int i = 0; i < $MAX_SHAPES; i++) {
        float4 s = ${GlassUniforms.SHAPES}[i];
        d = smin(d, sdRoundedBox(p - s.xy, s.zw, ${GlassUniforms.SHAPE_RADII}[i]), ${GlassUniforms.MERGE_SMOOTHING});
    }
    return d;
}

float2 sceneNormal(float2 p) {
    float d = 1000000.0;
    float2 gradient = float2(0.0);
    for (int i = 0; i < $MAX_SHAPES; i++) {
        float4 s = ${GlassUniforms.SHAPES}[i];
        float shapeDistance = sdRoundedBox(p - s.xy, s.zw, ${GlassUniforms.SHAPE_RADII}[i]);
        float2 shapeGradient = roundedBoxNormal(p - s.xy, s.zw, ${GlassUniforms.SHAPE_RADII}[i]);
        float k = max(${GlassUniforms.MERGE_SMOOTHING}, 0.0001);
        float h = clamp(0.5 + 0.5 * (shapeDistance - d) / k, 0.0, 1.0);
        gradient = mix(shapeGradient, gradient, h);
        d = mix(shapeDistance, d, h) - k * h * (1.0 - h);
    }
    float len = length(gradient);
    if (len < 0.0001) {
        return float2(0.0);
    }
    return gradient / len;
}

// Convex lens height field derived from the rounded-rect SDF. The center is
// nearly flat; the slope increases toward the rim, creating a continuous
// surface normal across the glass body rather than a detached edge ring.
float3 lensSurfaceNormal(float sdf, float2 sdfNormal, float2 halfSize) {
    float depthRange = max(min(halfSize.x, halfSize.y), 1.0);
    float edgeDepth = clamp(-sdf, 0.0, depthRange);
    float inward = 1.0 - edgeDepth / depthRange;
    float height = sqrt(max(1.0 - inward * inward, 0.0025));
    float slope = clamp(inward / height, 0.0, 3.4);
    return normalize(float3(sdfNormal * slope, 1.0));
}

half4 main(float2 fragCoord) {
    float2 p = fragCoord;
    float sd = sceneSd(p);
    float mask = 1.0 - smoothstep(-1.0, 1.0, sd);
    if (mask <= 0.001) {
        return half4(0.0);
    }

    // The first packed shape is the lens. The tab lens is a single rounded
    // rectangle, while the scene SDF still supports merged shapes elsewhere.
    float4 lensShape = ${GlassUniforms.SHAPES}[0];
    float2 lensCenter = lensShape.xy;
    float2 lensHalfSize = max(lensShape.zw, float2(1.0));
    float2 sdfNormal = sceneNormal(p);
    float3 surfaceNormal = lensSurfaceNormal(sd, sdfNormal, lensHalfSize);
    float edgeDist = max(-sd, 0.0);

    // Full-body nonlinear remapping: the local coordinates expand gently
    // through the lens, then the SDF height-field normal adds stronger
    // displacement toward the rounded edge (SDF -> profile -> resampling).
    float2 local = p - lensCenter;
    float2 normalizedLocal = local / lensHalfSize;
    float radial = clamp(max(abs(normalizedLocal.x), abs(normalizedLocal.y)), 0.0, 1.0);
    float bodyProfile = 0.28 + 0.72 * pow(radial, 0.72);
    float progress = clamp(${GlassUniforms.INTERACTION_PROGRESS}, 0.0, 1.0);
    float motionSpeed = min(length(${GlassUniforms.MOTION}), 1.0);
    float bodyAmount = ${GlassUniforms.BODY_REFRACTION_AMOUNT} * (1.0 + progress * 0.35);
    float edgeReach = clamp(
        ${GlassUniforms.REFRACTION_HEIGHT},
        2.0,
        min(lensHalfSize.x, lensHalfSize.y) * 0.72
    );
    // Make the remap meet the untouched scene at the silhouette, rise through
    // the first few pixels, and fade before the flat center. The old step was
    // full-strength at sdf=0, so the backdrop jumped by a whole offset exactly
    // where the mask ended (most visible as torn corner wedges on checker grids).
    float edgeEntry = max(min(edgeReach * 0.16, 4.0), 1.0);
    float edgeField = smoothstep(0.0, edgeEntry, edgeDist)
        * (1.0 - smoothstep(edgeReach * 0.82, edgeReach * 1.42, edgeDist));
    float bodyBoundaryFade = smoothstep(0.0, max(bodyAmount * 0.8, 2.0), edgeDist);
    float dynamicEdgeAmount = ${GlassUniforms.REFRACTION_AMOUNT} * (1.0 + progress * 0.3 + motionSpeed * progress * 0.08);
    float2 bodyWarp = normalizedLocal * (bodyAmount * bodyProfile * bodyBoundaryFade);
    float2 edgeWarp = surfaceNormal.xy * (dynamicEdgeAmount * edgeField);
    float2 motionShear = float2(-${GlassUniforms.MOTION}.x, ${GlassUniforms.MOTION}.y)
        * (bodyAmount * (0.18 + edgeField * 0.24) * progress * bodyBoundaryFade);
    float2 displacement = bodyWarp + edgeWarp - motionShear;
    float2 sampleCoord = p - displacement;

    if (${GlassUniforms.PRESS_AMOUNT} > 0.001) {
        float2 toPress = p - ${GlassUniforms.PRESS_POINT};
        float falloff = exp(-dot(toPress, toPress) / 8000.0);
        sampleCoord -= toPress * (${GlassUniforms.PRESS_AMOUNT} * 0.08 * falloff);
    }

    // Debug mode shows only one un-tinted backdrop sample. It intentionally
    // skips chromatic separation too, so this view isolates displacement alone.
    if (${GlassUniforms.DISPLACEMENT_ONLY} > 0.5) {
        float4 displacedBackdrop = float4(${GlassUniforms.CONTENT}.eval(sampleCoord));
        return half4(displacedBackdrop.rgb * mask, displacedBackdrop.a * mask);
    }

    float curvature = clamp(1.0 - surfaceNormal.z, 0.0, 1.0);
    float dispersionField = clamp(edgeField * 0.72 + curvature * 0.28, 0.0, 1.0);
    float caShift = ${GlassUniforms.CHROMATIC_ABERRATION}
        * (1.0 + progress * 0.65 + motionSpeed * progress * 0.2)
        * dispersionField
        * (${GlassUniforms.REFRACTION_HEIGHT} * 0.12 + ${GlassUniforms.BODY_REFRACTION_AMOUNT} * 0.08);
    float4 color;
    if (caShift > 0.001) {
        float2 caDirection = length(displacement) > 0.001
            ? normalize(displacement)
            : sdfNormal;
        float2 caOffset = caDirection * caShift;
        float cr = float4(${GlassUniforms.CONTENT}.eval(sampleCoord - caOffset)).r;
        float4 cg = float4(${GlassUniforms.CONTENT}.eval(sampleCoord));
        float cb = float4(${GlassUniforms.CONTENT}.eval(sampleCoord + caOffset)).b;
        color = float4(cr, cg.g, cb, cg.a);
    } else {
        color = float4(${GlassUniforms.CONTENT}.eval(sampleCoord));
    }

    float tintAmount = clamp(${GlassUniforms.TINT}.a * ${GlassUniforms.TINT_ALPHA}, 0.0, 1.0);
    color.rgb = mix(color.rgb, ${GlassUniforms.TINT}.rgb, tintAmount);

    float rim = 1.0 - smoothstep(0.0, max(${GlassUniforms.HIGHLIGHT_WIDTH}, 0.0001), edgeDist);
    float2 reflectedLight = normalize(${GlassUniforms.LIGHT_DIRECTION} - ${GlassUniforms.MOTION} * 0.12);
    float3 lightDirection = normalize(float3(reflectedLight, 0.82));
    float3 viewDirection = float3(0.0, 0.0, 1.0);
    float3 halfDirection = normalize(lightDirection + viewDirection);
    float cornerRadius = ${GlassUniforms.SHAPE_RADII}[0];
    float2 cornerCoordinates = abs(local) - (lensHalfSize - cornerRadius);
    float cornerArc = smoothstep(0.0, max(cornerRadius * 0.35, 1.0), min(cornerCoordinates.x, cornerCoordinates.y));
    // Rounded corners catch a point-like glint; flat edges keep only a faint
    // Fresnel rim so the specular lobe cannot become a full-width white bar.
    float specularEdgeMask = mix(0.05, 1.0, cornerArc);
    float specularPower = mix(48.0, 28.0, progress);
    float specular = pow(max(dot(surfaceNormal, halfDirection), 0.0), specularPower)
        * ${GlassUniforms.HIGHLIGHT_ALPHA}
        * ${GlassUniforms.SPECULAR_STRENGTH}
        * (1.0 + ${GlassUniforms.PRESS_AMOUNT} * 0.35)
        * specularEdgeMask;
    float fresnel = pow(clamp(1.0 - surfaceNormal.z, 0.0, 1.0), 5.0)
        * ${GlassUniforms.FRESNEL_STRENGTH}
        * (1.0 + progress * 0.28);
    float innerBandCenter = max(${GlassUniforms.HIGHLIGHT_WIDTH} * 1.65, 2.0);
    float innerBand = exp(-pow((edgeDist - innerBandCenter) / max(${GlassUniforms.HIGHLIGHT_WIDTH} * 1.25, 1.0), 2.0))
        * ${GlassUniforms.INNER_SHADOW_STRENGTH};
    float pressBoost = 1.0 + ${GlassUniforms.PRESS_AMOUNT} * 0.35;
    color.rgb += float3(specular + rim * fresnel * 0.22 * pressBoost);
    color.rgb += float3(fresnel * 0.12);
    color.rgb *= 1.0 - innerBand * (0.28 + progress * 0.08);

    float noise = fract(sin(dot(p, float2(12.9898, 78.233))) * 43758.5453) - 0.5;
    color.rgb += float3(noise * ${GlassUniforms.NOISE_ALPHA});

    color.rgb = clamp(color.rgb, 0.0, 1.0);
    return half4(color * mask);
}
""".trimIndent()
}


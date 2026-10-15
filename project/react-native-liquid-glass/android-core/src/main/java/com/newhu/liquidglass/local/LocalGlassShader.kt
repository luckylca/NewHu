package com.newhu.liquidglass.local

public object LocalGlassShader {
    const val SOURCE = """
uniform float2 resolution;
uniform float4 baseTint;
uniform float4 accentTint;
uniform float4 highlightTint;
uniform float4 innerShade;
uniform float surfaceWarp;
uniform float chromatic;
uniform float highlightStrength;
uniform float noiseStrength;
uniform float materialOpacity;
uniform float cornerRadiusPx;

half4 main(float2 position) {
    float2 size = max(resolution, float2(1.0));
    float2 uv = clamp(position / size, float2(0.0), float2(1.0));

    // Keep the local material's optical field identical to the Skia fallback.
    float bend = sin((uv.x * 1.35 + uv.y * 0.72) * 6.28318) * surfaceWarp * 0.0018;
    float2 lightUv = clamp(uv + float2(bend, -bend * 0.55), float2(0.0), float2(1.0));
    float vertical = 1.0 - smoothstep(0.0, 1.0, lightUv.y);
    float radius = clamp(cornerRadiusPx / min(size.x, size.y), 0.0, 0.5);
    float2 p = uv - float2(0.5);
    float2 q = abs(p) - float2(0.5 - radius);
    float signedEdgeDistance = length(max(q, float2(0.0))) + min(max(q.x, q.y), 0.0) - radius;
    float edgeDepth = max(-signedEdgeDistance, 0.0);

    float2 outside = max(q, float2(0.0));
    float2 edgeNormal = length(outside) > 0.0001
        ? normalize(outside) * sign(p)
        : (q.x > q.y ? float2(sign(p.x), 0.0) : float2(0.0, sign(p.y)));
    float2 lightDirection = normalize(float2(-0.52, -0.85));
    float edgeFacing = max(dot(edgeNormal, lightDirection), 0.0);
    float edgeLight = 0.2 + 0.8 * pow(edgeFacing, 1.35);
    float fresnel = (1.0 - smoothstep(0.0, 0.105, edgeDepth)) * edgeLight;
    float innerShadow = smoothstep(0.005, 0.045, edgeDepth) * (1.0 - smoothstep(0.045, 0.14, edgeDepth));
    float sideReflection = exp(-pow((uv.x - 0.025) * 24.0, 2.0)) + exp(-pow((uv.x - 0.975) * 24.0, 2.0));

    float3 body = mix(baseTint.rgb, accentTint.rgb, 0.12 + vertical * 0.18);
    float3 color = body;
    color += highlightTint.rgb * sideReflection * 0.035 * highlightStrength;
    color += highlightTint.rgb * fresnel * (0.055 + highlightStrength * 0.11);
    color -= innerShade.rgb * innerShadow * 0.16;

    float dispersion = fresnel * chromatic * 0.055;
    color += float3(dispersion * 0.82, dispersion * 0.12, -dispersion * 0.48);

    float grain = fract(sin(dot(floor(position), float2(12.9898, 78.233))) * 43758.5453) - 0.5;
    color += grain * noiseStrength;
    color = clamp(color, float3(0.0), float3(1.0));

    float alpha = clamp((baseTint.a + accentTint.a * (0.22 + vertical * 0.08)) * materialOpacity, 0.0, 0.72);
    return half4(color * alpha, alpha);
}
"""
}

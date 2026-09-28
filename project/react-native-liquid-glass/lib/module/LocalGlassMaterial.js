import { jsx as _jsx } from "react/jsx-runtime";
import { Canvas, Fill, Shader, Skia } from '@shopify/react-native-skia';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
const GLASS_SHADER = `
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

    // Local surfaces only warp their procedural lighting field. This is a
    // low-cost shell material, not backdrop refraction; the tab selection lens
    // uses the native sampled AGSL path instead.
    float bend = sin((uv.x * 1.35 + uv.y * 0.72) * 6.28318) * surfaceWarp * 0.0018;
    float2 lightUv = clamp(uv + float2(bend, -bend * 0.55), float2(0.0), float2(1.0));
    float vertical = 1.0 - smoothstep(0.0, 1.0, lightUv.y);
    float radius = clamp(cornerRadiusPx / min(size.x, size.y), 0.0, 0.5);
    float2 p = uv - float2(0.5);
    float2 q = abs(p) - float2(0.5 - radius);
    float signedEdgeDistance = length(max(q, float2(0.0))) + min(max(q.x, q.y), 0.0) - radius;
    float edgeDepth = max(-signedEdgeDistance, 0.0);

    float fresnel = 1.0 - smoothstep(0.0, 0.105, edgeDepth);
    float innerShadow = smoothstep(0.005, 0.045, edgeDepth) * (1.0 - smoothstep(0.045, 0.14, edgeDepth));
    float topArc = 0.045 + 0.12 * pow(abs(uv.x - 0.5) * 2.0, 1.8);
    float topSpecular = exp(-pow((uv.y - topArc) * 26.0, 2.0)) * (0.25 + 0.75 * (1.0 - abs(uv.x - 0.5)));
    float lowerArc = 0.91 - 0.045 * pow(abs(uv.x - 0.5) * 2.0, 1.5);
    float lowerReflection = exp(-pow((uv.y - lowerArc) * 33.0, 2.0)) * (1.0 - smoothstep(0.22, 0.52, abs(uv.x - 0.5)));
    float sideReflection = exp(-pow((uv.x - 0.025) * 24.0, 2.0)) + exp(-pow((uv.x - 0.975) * 24.0, 2.0));

    float3 body = mix(baseTint.rgb, accentTint.rgb, 0.12 + vertical * 0.18);
    float3 color = body;
    color += highlightTint.rgb * (topSpecular * 0.23 + lowerReflection * 0.055 + sideReflection * 0.035) * highlightStrength;
    color += highlightTint.rgb * fresnel * (0.055 + highlightStrength * 0.11);
    color -= innerShade.rgb * innerShadow * 0.16;

    // A restrained RGB fringe suggests a thick polished edge without a blur
    // pass or a sample of the changing page behind the control.
    float dispersion = fresnel * chromatic * 0.055;
    color += float3(dispersion * 0.82, dispersion * 0.12, -dispersion * 0.48);

    float grain = fract(sin(dot(floor(position), float2(12.9898, 78.233))) * 43758.5453) - 0.5;
    color += grain * noiseStrength;
    color = clamp(color, float3(0.0), float3(1.0));

    float alpha = clamp((baseTint.a + accentTint.a * (0.22 + vertical * 0.08) + topSpecular * 0.05) * materialOpacity, 0.0, 0.72);
    // Skia shader colors are premultiplied before source-over compositing.
    // Leaving RGB unscaled makes translucent light tints look almost opaque.
    return half4(color * alpha, alpha);
}
`;
let sharedShader;
function getSharedShader() {
    if (sharedShader !== undefined)
        return sharedShader;
    try {
        sharedShader = Skia.RuntimeEffect.Make(GLASS_SHADER);
    }
    catch (error) {
        console.warn('[LiquidGlass] Local SkSL shader unavailable; using the material fallback.', error);
        sharedShader = null;
    }
    return sharedShader;
}
function rgba(value) {
    const functional = value.match(/rgba?\(([^)]+)\)/i);
    if (functional) {
        const parts = functional[1].split(',').map((part) => Number.parseFloat(part.trim()));
        if (parts.length >= 3 && parts.slice(0, 3).every(Number.isFinite)) {
            return [parts[0] / 255, parts[1] / 255, parts[2] / 255, parts[3] ?? 1];
        }
    }
    const hex = value.replace('#', '').trim();
    if (/^[0-9a-f]{3}$/i.test(hex)) {
        return [...hex].map((digit) => Number.parseInt(`${digit}${digit}`, 16) / 255).concat(1);
    }
    if (/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(hex)) {
        return [
            Number.parseInt(hex.slice(0, 2), 16) / 255,
            Number.parseInt(hex.slice(2, 4), 16) / 255,
            Number.parseInt(hex.slice(4, 6), 16) / 255,
            hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1,
        ];
    }
    return [1, 1, 1, 0.2];
}
export function LocalGlassMaterial({ tokens, material, dark, }) {
    const [size, setSize] = useState({ width: 0, height: 0 });
    const source = useMemo(getSharedShader, []);
    const uniforms = useMemo(() => ({
        resolution: [size.width, size.height],
        baseTint: rgba(tokens.procedural.baseTint[dark ? 'dark' : 'light']),
        accentTint: rgba((material.accentTint ?? tokens.procedural.accentTint)[dark ? 'dark' : 'light']),
        highlightTint: rgba(tokens.procedural.highlightTint[dark ? 'dark' : 'light']),
        innerShade: rgba(tokens.procedural.innerShade[dark ? 'dark' : 'light']),
        surfaceWarp: material.refractionAmount,
        chromatic: material.chromaticAberration,
        highlightStrength: material.highlightAlpha,
        noiseStrength: tokens.procedural.noiseStrength,
        materialOpacity: material.opacity ?? 1,
        cornerRadiusPx: material.radius,
    }), [dark, material.accentTint, material.chromaticAberration, material.highlightAlpha, material.opacity, material.radius, material.refractionAmount, size, tokens]);
    const handleLayout = (event) => {
        const next = { width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height };
        setSize((current) => current.width === next.width && current.height === next.height ? current : next);
    };
    if (!source) {
        return (_jsx(View, { pointerEvents: "none", onLayout: handleLayout, style: [StyleSheet.absoluteFill, { backgroundColor: dark ? tokens.fallbackTint.dark : tokens.fallbackTint.light }] }));
    }
    return (_jsx(View, { pointerEvents: "none", onLayout: handleLayout, style: StyleSheet.absoluteFill, children: _jsx(Canvas, { pointerEvents: "none", style: StyleSheet.absoluteFill, children: _jsx(Fill, { children: _jsx(Shader, { source: source, uniforms: uniforms }) }) }) }));
}
//# sourceMappingURL=LocalGlassMaterial.js.map
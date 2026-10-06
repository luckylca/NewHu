"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalGlassMaterial = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_native_skia_1 = require("@shopify/react-native-skia");
const expo_modules_core_1 = require("expo-modules-core");
const react_1 = require("react");
const react_native_1 = require("react-native");
const localGlassTelemetry_1 = require("./localGlassTelemetry");
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

    // A restrained RGB fringe suggests a thick polished edge without a blur
    // pass or a sample of the changing page behind the control.
    float dispersion = fresnel * chromatic * 0.055;
    color += float3(dispersion * 0.82, dispersion * 0.12, -dispersion * 0.48);

    float grain = fract(sin(dot(floor(position), float2(12.9898, 78.233))) * 43758.5453) - 0.5;
    color += grain * noiseStrength;
    color = clamp(color, float3(0.0), float3(1.0));

    float alpha = clamp((baseTint.a + accentTint.a * (0.22 + vertical * 0.08)) * materialOpacity, 0.0, 0.72);
    // Skia shader colors are premultiplied before source-over compositing.
    // Leaving RGB unscaled makes translucent light tints look almost opaque.
    return half4(color * alpha, alpha);
}
`;
const NativeLocalGlassView = react_native_1.Platform.OS === 'android'
    ? (0, expo_modules_core_1.requireNativeViewManager)('ExpoLocalGlass', 'LocalGlassMaterial')
    : null;
const NativeLocalGlassEngineView = react_native_1.Platform.OS === 'android'
    ? (0, expo_modules_core_1.requireNativeViewManager)('ExpoLocalGlassEngine', 'LocalGlassMaterial')
    : null;
const resolvedMaterialCache = new Map();
const MAX_RESOLVED_MATERIALS = 48;
let sharedShader;
function getSharedShader() {
    if (sharedShader !== undefined)
        return sharedShader;
    try {
        sharedShader = react_native_skia_1.Skia.RuntimeEffect.Make(GLASS_SHADER);
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
function resolveMaterial(tokens, material, dark) {
    const mode = dark ? 'dark' : 'light';
    const colorValues = [
        tokens.procedural.baseTint[mode],
        (material.accentTint ?? tokens.procedural.accentTint)[mode],
        tokens.procedural.highlightTint[mode],
        tokens.procedural.innerShade[mode],
    ];
    const scalarValues = [
        material.refractionAmount,
        material.chromaticAberration,
        material.highlightAlpha,
        tokens.procedural.noiseStrength,
        material.opacity ?? 1,
        material.radius,
    ];
    const key = JSON.stringify([colorValues, scalarValues]);
    const cached = resolvedMaterialCache.get(key);
    if (cached)
        return cached;
    const resolved = {
        baseTint: rgba(colorValues[0]),
        accentTint: rgba(colorValues[1]),
        highlightTint: rgba(colorValues[2]),
        innerShade: rgba(colorValues[3]),
        surfaceWarp: scalarValues[0],
        chromatic: scalarValues[1],
        highlightStrength: scalarValues[2],
        noiseStrength: scalarValues[3],
        materialOpacity: scalarValues[4],
        cornerRadiusPx: scalarValues[5],
    };
    if (resolvedMaterialCache.size >= MAX_RESOLVED_MATERIALS) {
        const oldest = resolvedMaterialCache.keys().next().value;
        if (oldest !== undefined)
            resolvedMaterialCache.delete(oldest);
    }
    resolvedMaterialCache.set(key, resolved);
    return resolved;
}
function NativeLocalGlassRenderer({ tokens, material, dark, resolved, }) {
    const engine = (0, react_1.useSyncExternalStore)(localGlassTelemetry_1.subscribeLocalGlassNativeEngine, localGlassTelemetry_1.getLocalGlassNativeEngine, localGlassTelemetry_1.getLocalGlassNativeEngine);
    const NativeView = engine === 'core'
        ? NativeLocalGlassEngineView ?? NativeLocalGlassView
        : NativeLocalGlassView;
    (0, react_1.useEffect)(() => NativeView ? (0, localGlassTelemetry_1.registerLocalGlassMaterial)('native') : undefined, [NativeView]);
    if (!NativeView) {
        return (0, jsx_runtime_1.jsx)(SkiaLocalGlassRenderer, { tokens: tokens, material: material, dark: dark, resolved: resolved });
    }
    return (0, jsx_runtime_1.jsx)(NativeView, { ...resolved, pointerEvents: "none", style: react_native_1.StyleSheet.absoluteFill });
}
function SkiaLocalGlassRenderer({ tokens, material, dark, resolved, }) {
    const [size, setSize] = (0, react_1.useState)({ width: 0, height: 0 });
    const source = (0, react_1.useMemo)(getSharedShader, []);
    const uniforms = (0, react_1.useMemo)(() => ({
        resolution: [size.width, size.height],
        ...resolved,
    }), [resolved, size]);
    (0, react_1.useEffect)(() => (0, localGlassTelemetry_1.registerLocalGlassMaterial)(source ? 'skia' : 'fallback'), [source]);
    const handleLayout = (event) => {
        const next = { width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height };
        setSize((current) => current.width === next.width && current.height === next.height ? current : next);
    };
    if (!source) {
        return ((0, jsx_runtime_1.jsx)(react_native_1.View, { pointerEvents: "none", style: [react_native_1.StyleSheet.absoluteFill, { backgroundColor: dark ? tokens.fallbackTint.dark : tokens.fallbackTint.light }] }));
    }
    return ((0, jsx_runtime_1.jsx)(react_native_1.View, { pointerEvents: "none", onLayout: handleLayout, style: react_native_1.StyleSheet.absoluteFill, children: (0, jsx_runtime_1.jsx)(react_native_skia_1.Canvas, { pointerEvents: "none", style: react_native_1.StyleSheet.absoluteFill, children: (0, jsx_runtime_1.jsx)(react_native_skia_1.Fill, { children: (0, jsx_runtime_1.jsx)(react_native_skia_1.Shader, { source: source, uniforms: uniforms }) }) }) }));
}
exports.LocalGlassMaterial = (0, react_1.memo)(function LocalGlassMaterial({ tokens, material, dark, }) {
    const resolved = (0, react_1.useMemo)(() => resolveMaterial(tokens, material, dark), [dark, material, tokens]);
    const supportsNativeRenderer = react_native_1.Platform.OS === 'android'
        && Number(react_native_1.Platform.Version) >= 33
        && (NativeLocalGlassView !== null || NativeLocalGlassEngineView !== null);
    if (supportsNativeRenderer) {
        return (0, jsx_runtime_1.jsx)(NativeLocalGlassRenderer, { tokens: tokens, material: material, dark: dark, resolved: resolved });
    }
    return (0, jsx_runtime_1.jsx)(SkiaLocalGlassRenderer, { tokens: tokens, material: material, dark: dark, resolved: resolved });
});
//# sourceMappingURL=LocalGlassMaterial.js.map
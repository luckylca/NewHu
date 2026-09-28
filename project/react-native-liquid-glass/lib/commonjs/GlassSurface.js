"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlassSurface = void 0;
exports.useGlassReducedMotion = useGlassReducedMotion;
exports.useGlassAppearance = useGlassAppearance;
exports.GlassMaterialProvider = GlassMaterialProvider;
exports.GlassOverlay = GlassOverlay;
const jsx_runtime_1 = require("react/jsx-runtime");
const liquid_glass_kit_1 = require("liquid-glass-kit");
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
const react_native_reanimated_1 = __importStar(require("react-native-reanimated"));
const LocalGlassMaterial_1 = require("./LocalGlassMaterial");
const AnimatedLiquidGlassView = react_native_reanimated_1.default.createAnimatedComponent(liquid_glass_kit_1.LiquidGlassView);
const GlassRuntimeContext = (0, react_1.createContext)(null);
function useGlassReducedMotion() {
    return (0, react_1.useContext)(GlassRuntimeContext)?.reducedMotion ?? false;
}
function useGlassAppearance() {
    return (0, react_1.useContext)(GlassRuntimeContext);
}
function entryZIndex(entry) {
    return entry.value.zIndex;
}
function selectBalancedShaderSurfaces(entries) {
    // Backdrop glass is the default on Android 13+. Balanced limits refresh
    // cadence at the provider, rather than silently turning all but one
    // visible glass surface back into a tint overlay.
    return new Set(Object.entries(entries)
        .filter((entry) => entry[1].kind === 'surface')
        .map(([id]) => id));
}
const GlassHostContext = (0, react_1.createContext)(null);
function GlassMaterialProvider({ children, style, tokens, dark, reducedMotion = false }) {
    const hostRef = (0, react_1.useRef)(null);
    const providerId = (0, react_1.useId)();
    const [entries, setEntries] = (0, react_1.useState)({});
    const balancedShaderSurfaces = (0, react_1.useMemo)(() => selectBalancedShaderSurfaces(entries), [entries]);
    const runtime = (0, react_1.useMemo)(() => ({ tokens, dark, reducedMotion }), [tokens, dark, reducedMotion]);
    const updateSurface = (0, react_1.useCallback)((id, entry) => {
        setEntries((current) => {
            const previous = current[id]?.kind === 'surface' ? current[id].value : undefined;
            if (previous && previous.frame.x === entry.frame.x && previous.frame.y === entry.frame.y &&
                previous.frame.width === entry.frame.width && previous.frame.height === entry.frame.height &&
                previous.children === entry.children && previous.variant === entry.variant && previous.interactive === entry.interactive && previous.continuous === entry.continuous &&
                previous.opticalProgress === entry.opticalProgress && previous.opticalMotionX === entry.opticalMotionX && previous.opticalMotionY === entry.opticalMotionY &&
                previous.materialOverrides === entry.materialOverrides && previous.displacementOnlyDebug === entry.displacementOnlyDebug &&
                previous.contentStyle === entry.contentStyle && previous.animatedStyle === entry.animatedStyle &&
                previous.placement === entry.placement && previous.bottomInset === entry.bottomInset && previous.zIndex === entry.zIndex) {
                return current;
            }
            return { ...current, [id]: { kind: 'surface', value: entry } };
        });
    }, []);
    const updateOverlay = (0, react_1.useCallback)((id, entry) => {
        setEntries((current) => {
            const previous = current[id]?.kind === 'overlay' ? current[id].value : undefined;
            if (previous && previous.children === entry.children && previous.style === entry.style && previous.zIndex === entry.zIndex)
                return current;
            return { ...current, [id]: { kind: 'overlay', value: entry } };
        });
    }, []);
    const remove = (0, react_1.useCallback)((id) => {
        setEntries((current) => {
            if (!(id in current))
                return current;
            const next = { ...current };
            delete next[id];
            return next;
        });
    }, []);
    const context = (0, react_1.useMemo)(() => ({ providerId, hostRef, updateSurface, updateOverlay, remove }), [providerId, updateSurface, updateOverlay, remove]);
    if (!tokens.enabled) {
        return (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [styles.root, style], children: children });
    }
    return ((0, jsx_runtime_1.jsx)(GlassRuntimeContext.Provider, { value: runtime, children: (0, jsx_runtime_1.jsx)(GlassHostContext.Provider, { value: context, children: (0, jsx_runtime_1.jsxs)(react_native_1.View, { ref: hostRef, collapsable: false, style: [styles.root, style], children: [(0, jsx_runtime_1.jsx)(liquid_glass_kit_1.LiquidGlassProvider, { providerId: providerId, maxCaptureRateHz: tokens.quality === 'high' ? 120 : 60, style: react_native_1.StyleSheet.absoluteFill, children: children }), (0, jsx_runtime_1.jsx)(react_native_1.View, { pointerEvents: "box-none", style: react_native_1.StyleSheet.absoluteFill, children: Object.entries(entries).sort((left, right) => entryZIndex(left[1]) - entryZIndex(right[1])).map(([id, entry]) => (entry.kind === 'surface'
                            ? (0, jsx_runtime_1.jsx)(PortalGlassSurface, { providerId: providerId, entry: entry.value, shaderEnabled: tokens.quality === 'high' || (tokens.quality === 'balanced' && balancedShaderSurfaces.has(id)) }, id)
                            : (0, jsx_runtime_1.jsx)(PortalOverlay, { entry: entry.value }, id))) })] }) }) }));
}
function PortalOverlay({ entry }) {
    return ((0, jsx_runtime_1.jsx)(react_native_reanimated_1.default.View, { pointerEvents: "box-none", style: [react_native_1.StyleSheet.absoluteFill, entry.style, { zIndex: entry.zIndex }], children: entry.children }));
}
function PortalGlassSurface({ providerId, entry, shaderEnabled }) {
    const runtime = (0, react_1.useContext)(GlassRuntimeContext);
    const opticalProgress = entry.opticalProgress;
    const opticalMotionX = entry.opticalMotionX;
    const opticalMotionY = entry.opticalMotionY;
    const animatedOptics = (0, react_native_reanimated_1.useAnimatedProps)(() => ({
        interactionProgress: opticalProgress?.value ?? 0,
        motionX: opticalMotionX ? Math.max(-1, Math.min(1, opticalMotionX.value / 1800)) : undefined,
        motionY: opticalMotionY ? Math.max(-1, Math.min(1, opticalMotionY.value / 1800)) : undefined,
    }), [opticalProgress, opticalMotionX, opticalMotionY]);
    if (!runtime)
        return null;
    const { tokens, dark, reducedMotion } = runtime;
    const material = entry.materialOverrides
        ? { ...tokens.materials[entry.variant], ...entry.materialOverrides }
        : tokens.materials[entry.variant];
    const qualityScale = tokens.quality === 'high' ? 1.2 : tokens.quality === 'fallback' ? 0.45 : 1;
    if (!shaderEnabled)
        return (0, jsx_runtime_1.jsx)(PortalFallbackSurface, { entry: entry });
    const nativeSurface = ((0, jsx_runtime_1.jsx)(AnimatedLiquidGlassView, { providerId: providerId, cornerRadius: material.radius, blurRadius: material.blurRadius * qualityScale, refractionHeight: material.refractionHeight * qualityScale, refractionAmount: material.refractionAmount * qualityScale, bodyRefractionAmount: (material.refractionBodyAmount ?? 2.5) * qualityScale, interactionProgress: 0, saturation: material.saturation, chromaticAberration: tokens.quality === 'high' || entry.variant === 'tabSelectionLens'
            ? material.chromaticAberration
            : 0, highlightAlpha: material.highlightAlpha, highlightWidth: material.highlightWidth, tintAlpha: material.tintAlpha ?? 1, specularStrength: material.specularStrength ?? 1, fresnelStrength: material.fresnelStrength ?? 0.85, innerShadowStrength: material.innerShadowStrength ?? 0.18, tint: dark ? tokens.tint.dark : tokens.tint.light, interactive: entry.interactive && tokens.interaction.enabled && !reducedMotion, continuous: entry.continuous, motionX: undefined, motionY: undefined, displacementOnlyDebug: entry.displacementOnlyDebug, animatedProps: animatedOptics, style: [
            styles.nativeSurface,
            entry.placement === 'layout'
                ? react_native_1.StyleSheet.absoluteFillObject
                : { width: entry.frame.width > 0 ? entry.frame.width : undefined },
            { borderRadius: material.radius },
        ], children: (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [
                entry.placement === 'layout' ? styles.portalContentLayout : styles.portalContentWrap,
                entry.contentStyle,
                { borderRadius: material.radius },
            ], children: entry.children }) }));
    if (entry.placement === 'bottom' || entry.placement === 'center') {
        return ((0, jsx_runtime_1.jsx)(react_native_reanimated_1.default.View, { pointerEvents: "box-none", style: [
                react_native_1.StyleSheet.absoluteFill,
                entry.placement === 'center' ? styles.centerPlacement : styles.bottomPlacement,
                entry.placement === 'bottom' && entry.bottomInset != null ? { paddingBottom: entry.bottomInset } : undefined,
                entry.animatedStyle,
                { zIndex: entry.zIndex },
            ], children: nativeSurface }));
    }
    return ((0, jsx_runtime_1.jsx)(react_native_reanimated_1.default.View, { pointerEvents: "box-none", style: [
            styles.portalSurface,
            { left: entry.frame.x, top: entry.frame.y, width: entry.frame.width, height: entry.frame.height },
            entry.animatedStyle,
            { zIndex: entry.zIndex },
        ], children: nativeSurface }));
}
function PortalFallbackSurface({ entry }) {
    const runtime = (0, react_1.useContext)(GlassRuntimeContext);
    if (!runtime)
        return null;
    const { tokens, dark } = runtime;
    const material = tokens.materials[entry.variant];
    const fallbackSurface = ((0, jsx_runtime_1.jsx)(react_native_1.View, { style: [
            styles.fallbackSurface,
            entry.placement === 'layout'
                ? react_native_1.StyleSheet.absoluteFillObject
                : { width: entry.frame.width > 0 ? entry.frame.width : undefined },
            {
                backgroundColor: dark ? tokens.fallbackTint.dark : tokens.fallbackTint.light,
                borderColor: dark ? tokens.fallbackBorder.dark : tokens.fallbackBorder.light,
                borderRadius: material.radius,
            },
        ], children: (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [
                entry.placement === 'layout' ? styles.portalContentLayout : styles.portalContentWrap,
                entry.contentStyle,
                { borderRadius: material.radius },
            ], children: entry.children }) }));
    if (entry.placement === 'bottom' || entry.placement === 'center') {
        return ((0, jsx_runtime_1.jsx)(react_native_reanimated_1.default.View, { pointerEvents: "box-none", style: [
                react_native_1.StyleSheet.absoluteFill,
                entry.placement === 'center' ? styles.centerPlacement : styles.bottomPlacement,
                entry.placement === 'bottom' && entry.bottomInset != null ? { paddingBottom: entry.bottomInset } : undefined,
                entry.animatedStyle,
                { zIndex: entry.zIndex },
            ], children: fallbackSurface }));
    }
    return ((0, jsx_runtime_1.jsx)(react_native_reanimated_1.default.View, { pointerEvents: "box-none", style: [
            styles.portalSurface,
            { left: entry.frame.x, top: entry.frame.y, width: entry.frame.width, height: entry.frame.height },
            entry.animatedStyle,
            { zIndex: entry.zIndex },
        ], children: fallbackSurface }));
}
/** Theme-driven glass material. Callers select a role; all optical settings live in AppTheme. */
exports.GlassSurface = react_1.default.memo(function GlassSurface({ variant = 'surface', renderMode, pointerEvents, interactive = false, continuous = false, opticalProgress, opticalMotionX, opticalMotionY, materialOverrides, displacementOnlyDebug = false, style, contentStyle, animatedStyle, placement = 'layout', bottomInset, zIndex = 1, children, placeholderChildren = children, }) {
    const runtime = (0, react_1.useContext)(GlassRuntimeContext);
    const host = (0, react_1.useContext)(GlassHostContext);
    const resolvedRenderMode = renderMode ?? (react_native_1.Platform.OS === 'android' && host && runtime?.tokens.quality !== 'fallback'
        ? 'backdrop'
        : 'local');
    const id = (0, react_1.useId)();
    const viewRef = (0, react_1.useRef)(null);
    const [frame, setFrame] = (0, react_1.useState)(null);
    const measure = (0, react_1.useCallback)(() => {
        const view = viewRef.current;
        const hostNode = host?.hostRef.current;
        if (!view || !hostNode)
            return;
        if ((0, react_native_1.findNodeHandle)(view) == null || (0, react_native_1.findNodeHandle)(hostNode) == null)
            return;
        // Native-stack/Fabric can place a route view in a different native
        // branch from the app-level glass host. measureLayout requires a true
        // native ancestor and silently loses the surface when that is false.
        // Same-window coordinates work across those branches and map directly
        // to the full-screen sibling overlay.
        view.measureInWindow((viewX, viewY, width, height) => {
            hostNode.measureInWindow((hostX, hostY) => {
                const next = { x: viewX - hostX, y: viewY - hostY, width, height };
                setFrame((current) => current && current.x === next.x && current.y === next.y && current.width === width && current.height === height
                    ? current
                    : next);
            });
        });
    }, [host]);
    const onLayout = (0, react_1.useCallback)((_event) => measure(), [measure]);
    (0, react_1.useEffect)(() => () => host?.remove(id), [host, id]);
    (0, react_1.useEffect)(() => {
        if (!host)
            return;
        if (resolvedRenderMode !== 'backdrop' || !frame || frame.width <= 0 || frame.height <= 0) {
            host.remove(id);
            return;
        }
        host.updateSurface(id, {
            frame,
            children,
            variant,
            interactive,
            continuous,
            opticalProgress,
            opticalMotionX,
            opticalMotionY,
            materialOverrides,
            displacementOnlyDebug,
            contentStyle,
            animatedStyle,
            placement,
            bottomInset,
            zIndex,
        });
    }, [resolvedRenderMode, host, id, frame, children, variant, interactive, continuous, opticalProgress, opticalMotionX, opticalMotionY, materialOverrides, displacementOnlyDebug, contentStyle, animatedStyle, placement, bottomInset, zIndex]);
    if (!runtime?.tokens.enabled) {
        return (0, jsx_runtime_1.jsx)(react_native_reanimated_1.default.View, { style: [style, animatedStyle], children: (0, jsx_runtime_1.jsx)(react_native_1.View, { style: contentStyle, children: children }) });
    }
    if (resolvedRenderMode === 'local' || !host) {
        return ((0, jsx_runtime_1.jsx)(LocalGlassSurface, { variant: variant, style: style, contentStyle: contentStyle, animatedStyle: animatedStyle, pointerEvents: pointerEvents, children: children }));
    }
    return ((0, jsx_runtime_1.jsx)(react_native_1.View, { ref: viewRef, collapsable: false, accessible: false, importantForAccessibility: "no-hide-descendants", pointerEvents: "none", onLayout: onLayout, style: [style, styles.measureOnly], children: (0, jsx_runtime_1.jsx)(react_native_1.View, { style: contentStyle, children: placeholderChildren }) }));
});
function LocalGlassSurface({ variant, style, contentStyle, animatedStyle, pointerEvents, children, }) {
    const runtime = (0, react_1.useContext)(GlassRuntimeContext);
    if (!runtime?.tokens.enabled)
        return (0, jsx_runtime_1.jsx)(react_native_reanimated_1.default.View, { style: [style, animatedStyle], children: (0, jsx_runtime_1.jsx)(react_native_1.View, { style: contentStyle, children: children }) });
    const { tokens, dark } = runtime;
    const material = tokens.materials[variant ?? 'surface'];
    const fallback = tokens.quality === 'fallback';
    return ((0, jsx_runtime_1.jsxs)(react_native_reanimated_1.default.View, { pointerEvents: pointerEvents, style: [styles.localSurface, { borderRadius: material.radius, backgroundColor: 'transparent' }, style, animatedStyle], children: [fallback ? ((0, jsx_runtime_1.jsx)(react_native_1.View, { pointerEvents: "none", style: [
                    react_native_1.StyleSheet.absoluteFill,
                    {
                        backgroundColor: dark ? tokens.fallbackTint.dark : tokens.fallbackTint.light,
                        borderColor: dark ? tokens.fallbackBorder.dark : tokens.fallbackBorder.light,
                        borderWidth: react_native_1.StyleSheet.hairlineWidth,
                        borderRadius: material.radius,
                    },
                ] })) : ((0, jsx_runtime_1.jsx)(LocalGlassMaterial_1.LocalGlassMaterial, { tokens: tokens, material: material, dark: dark })), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [styles.localContent, contentStyle], children: children })] }));
}
/** Full-screen overlay portal, used by sheets/dialogs so they sample the live app backdrop. */
function GlassOverlay({ children, zIndex = 100 }) {
    const runtime = (0, react_1.useContext)(GlassRuntimeContext);
    const host = (0, react_1.useContext)(GlassHostContext);
    const id = (0, react_1.useId)();
    (0, react_1.useEffect)(() => () => host?.remove(id), [host, id]);
    (0, react_1.useEffect)(() => {
        if (runtime?.tokens.enabled && host)
            host.updateOverlay(id, { children, zIndex });
    }, [runtime?.tokens.enabled, host, id, children, zIndex]);
    if (!runtime?.tokens.enabled || !host)
        return (0, jsx_runtime_1.jsx)(jsx_runtime_1.Fragment, { children: children });
    return null;
}
const styles = react_native_1.StyleSheet.create({
    root: { flex: 1 },
    measureOnly: { opacity: 0 },
    localSurface: { position: 'relative', overflow: 'hidden' },
    localContent: { flex: 1, overflow: 'hidden' },
    portalSurface: { position: 'absolute' },
    nativeSurface: { backgroundColor: 'transparent', overflow: 'hidden' },
    fallbackSurface: { backgroundColor: 'transparent', borderWidth: react_native_1.StyleSheet.hairlineWidth, overflow: 'hidden' },
    portalContentLayout: { flex: 1, overflow: 'hidden' },
    portalContentWrap: { flexGrow: 1, flexShrink: 1, overflow: 'hidden' },
    bottomPlacement: { alignItems: 'center', justifyContent: 'flex-end' },
    centerPlacement: { alignItems: 'center', justifyContent: 'center' },
});
//# sourceMappingURL=GlassSurface.js.map
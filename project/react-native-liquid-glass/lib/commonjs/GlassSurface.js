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
exports.RouteGlassCaptureScope = RouteGlassCaptureScope;
exports.RouteGlassCaptureSource = RouteGlassCaptureSource;
exports.GlassAppearanceProvider = GlassAppearanceProvider;
exports.GlassMaterialProvider = GlassMaterialProvider;
exports.useGlassProviderId = useGlassProviderId;
exports.GlassOverlay = GlassOverlay;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
const react_native_reanimated_1 = __importStar(require("react-native-reanimated"));
const LocalGlassMaterial_1 = require("./LocalGlassMaterial");
const glassNativeEngine_1 = require("./glassNativeEngine");
const nativeGlassViews_1 = require("./nativeGlassViews");
const AnimatedLegacyGlassSurfaceView = react_native_reanimated_1.default.createAnimatedComponent(nativeGlassViews_1.LegacyGlassSurfaceView);
const AnimatedCoreGlassSurfaceView = nativeGlassViews_1.CoreGlassSurfaceView
    ? react_native_reanimated_1.default.createAnimatedComponent(nativeGlassViews_1.CoreGlassSurfaceView)
    : null;
const GlassRuntimeContext = (0, react_1.createContext)(null);
const GlassCaptureSourceContext = (0, react_1.createContext)(null);
const GlassNativeEngineContext = (0, react_1.createContext)('legacy');
function useGlassReducedMotion() {
    return (0, react_1.useContext)(GlassRuntimeContext)?.reducedMotion ?? false;
}
function useGlassAppearance() {
    return (0, react_1.useContext)(GlassRuntimeContext);
}
function createEntryRegistry() {
    const entries = new Map();
    const listeners = new Set();
    let snapshot = [];
    const publish = () => {
        snapshot = Array.from(entries.entries());
        for (const listener of listeners)
            listener();
    };
    return {
        getSnapshot: () => snapshot,
        subscribe: (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        update: (id, entry, equals) => {
            const previous = entries.get(id);
            if (previous !== undefined && equals(previous, entry))
                return;
            entries.set(id, entry);
            publish();
        },
        remove: (id) => {
            if (!entries.delete(id))
                return;
            publish();
        },
    };
}
function useRegistrySnapshot(registry) {
    return react_1.default.useSyncExternalStore(registry.subscribe, registry.getSnapshot, registry.getSnapshot);
}
function sameSurface(previous, next) {
    return previous.frame.x === next.frame.x && previous.frame.y === next.frame.y &&
        previous.frame.width === next.frame.width && previous.frame.height === next.frame.height &&
        previous.positioning === next.positioning && previous.samplingSource === next.samplingSource &&
        previous.variant === next.variant && previous.interactive === next.interactive && previous.continuous === next.continuous &&
        previous.opticalProgress === next.opticalProgress && previous.opticalMotionX === next.opticalMotionX && previous.opticalMotionY === next.opticalMotionY &&
        previous.materialOverrides === next.materialOverrides && previous.displacementOnlyDebug === next.displacementOnlyDebug &&
        previous.animatedStyle === next.animatedStyle && previous.placement === next.placement &&
        previous.bottomInset === next.bottomInset && previous.zIndex === next.zIndex;
}
function sameOverlay(previous, next) {
    return previous.children === next.children && previous.style === next.style && previous.zIndex === next.zIndex;
}
function selectBalancedShaderSurfaces(entries) {
    // Every mounted backdrop surface keeps the same renderer regardless of
    // quality preset; display cadence is selected by the native provider.
    return new Set(entries.map(([id]) => id));
}
const GlassHostContext = (0, react_1.createContext)(null);
function RouteGlassCaptureScope({ children }) {
    const host = (0, react_1.useContext)(GlassHostContext);
    const providerId = host ? `${host.providerId}:page-content` : null;
    return (0, jsx_runtime_1.jsx)(GlassCaptureSourceContext.Provider, { value: providerId, children: children });
}
function RouteGlassCaptureSource({ children }) {
    const host = (0, react_1.useContext)(GlassHostContext);
    const runtime = (0, react_1.useContext)(GlassRuntimeContext);
    const providerId = (0, react_1.useContext)(GlassCaptureSourceContext);
    if (!host || !providerId || !runtime?.tokens.enabled)
        return (0, jsx_runtime_1.jsx)(jsx_runtime_1.Fragment, { children: children });
    return ((0, jsx_runtime_1.jsx)(GlassCaptureSourceView, { providerId: providerId, underlayProviderId: host.themeBackdropProviderId, captureMode: "live", pointerEvents: "box-none", style: styles.captureSource, children: children }));
}
function NativeBackdropSurface({ opticsModel, sdfDisplacementMapDebug, sdfContrast, sdfBrightness, sdfSaturation, sdfOuterShadowAlpha, sdfOuterShadowBlurRadius, sdfOuterShadowOffsetY, sdfInnerShadowAlpha, sdfInnerShadowExtent, ...props }) {
    const nativeEngine = (0, react_1.useContext)(GlassNativeEngineContext);
    if (nativeEngine === 'core' && AnimatedCoreGlassSurfaceView) {
        return ((0, jsx_runtime_1.jsx)(AnimatedCoreGlassSurfaceView, { ...props, opticsModel: opticsModel, sdfDisplacementMapDebug: sdfDisplacementMapDebug, sdfContrast: sdfContrast, sdfBrightness: sdfBrightness, sdfSaturation: sdfSaturation, sdfOuterShadowAlpha: sdfOuterShadowAlpha, sdfOuterShadowBlurRadius: sdfOuterShadowBlurRadius, sdfOuterShadowOffsetY: sdfOuterShadowOffsetY, sdfInnerShadowAlpha: sdfInnerShadowAlpha, sdfInnerShadowExtent: sdfInnerShadowExtent }));
    }
    return (0, jsx_runtime_1.jsx)(AnimatedLegacyGlassSurfaceView, { ...props });
}
function GlassCaptureSourceView({ children, ...props }) {
    const nativeEngine = (0, react_1.useContext)(GlassNativeEngineContext);
    if (nativeEngine === 'core' && nativeGlassViews_1.CoreGlassCaptureSource) {
        return (0, jsx_runtime_1.jsx)(nativeGlassViews_1.CoreGlassCaptureSource, { ...props, children: children });
    }
    return (0, jsx_runtime_1.jsx)(nativeGlassViews_1.LegacyGlassCaptureSource, { ...props, children: children });
}
const GlassOverlayHostContext = (0, react_1.createContext)(null);
function GlassAppearanceProvider({ children, tokens, dark, reducedMotion = false }) {
    const runtime = (0, react_1.useMemo)(() => ({ tokens, dark, reducedMotion }), [tokens, dark, reducedMotion]);
    return (0, jsx_runtime_1.jsx)(GlassRuntimeContext.Provider, { value: runtime, children: children });
}
function GlassMaterialProvider({ children, backdrop, themeBackdrop, themeBackdropRevision, providerId: providerIdProp, style, tokens, dark, reducedMotion = false }) {
    const hostRef = (0, react_1.useRef)(null);
    const generatedProviderId = (0, react_1.useId)();
    const providerId = providerIdProp ?? generatedProviderId;
    const themeBackdropProviderId = (0, react_1.useId)();
    const surfaceRegistryRef = (0, react_1.useRef)(null);
    const overlayRegistryRef = (0, react_1.useRef)(null);
    if (!surfaceRegistryRef.current)
        surfaceRegistryRef.current = createEntryRegistry();
    if (!overlayRegistryRef.current)
        overlayRegistryRef.current = createEntryRegistry();
    const surfaceRegistry = surfaceRegistryRef.current;
    const overlayRegistry = overlayRegistryRef.current;
    const runtime = (0, react_1.useMemo)(() => ({ tokens, dark, reducedMotion }), [tokens, dark, reducedMotion]);
    const nativeEngine = (0, react_1.useSyncExternalStore)(glassNativeEngine_1.subscribeGlassNativeEngine, glassNativeEngine_1.getGlassNativeEngine, glassNativeEngine_1.getGlassNativeEngine);
    const updateSurface = (0, react_1.useCallback)((id, entry) => {
        surfaceRegistry.update(id, entry, sameSurface);
    }, [surfaceRegistry]);
    const updateOverlay = (0, react_1.useCallback)((id, entry) => {
        overlayRegistry.update(id, entry, sameOverlay);
    }, [overlayRegistry]);
    const remove = (0, react_1.useCallback)((id) => {
        surfaceRegistry.remove(id);
        overlayRegistry.remove(id);
    }, [surfaceRegistry, overlayRegistry]);
    const context = (0, react_1.useMemo)(() => ({ providerId, themeBackdropProviderId, hostRef, updateSurface, remove }), [providerId, themeBackdropProviderId, updateSurface, remove]);
    const overlayContext = (0, react_1.useMemo)(() => ({ providerId, updateOverlay, remove }), [providerId, updateOverlay, remove]);
    const hasSeparateBackdrop = backdrop !== undefined;
    return ((0, jsx_runtime_1.jsx)(GlassNativeEngineContext.Provider, { value: nativeEngine, children: (0, jsx_runtime_1.jsx)(GlassRuntimeContext.Provider, { value: runtime, children: (0, jsx_runtime_1.jsx)(GlassHostContext.Provider, { value: context, children: (0, jsx_runtime_1.jsx)(GlassOverlayHostContext.Provider, { value: overlayContext, children: (0, jsx_runtime_1.jsxs)(react_native_1.View, { ref: hostRef, collapsable: false, style: [styles.root, style], children: [themeBackdrop !== undefined ? ((0, jsx_runtime_1.jsx)(GlassCaptureSourceView, { providerId: themeBackdropProviderId, captureMode: "static", sourceRevision: themeBackdropRevision, pointerEvents: "none", style: react_native_1.StyleSheet.absoluteFill, children: themeBackdrop })) : null, (0, jsx_runtime_1.jsx)(GlassCaptureSourceView, { providerId: providerId, underlayProviderId: themeBackdrop !== undefined ? themeBackdropProviderId : undefined, captureMode: tokens.enabled ? 'live' : 'frozen', style: react_native_1.StyleSheet.absoluteFill, children: hasSeparateBackdrop ? backdrop : children }), hasSeparateBackdrop ? ((0, jsx_runtime_1.jsx)(react_native_1.View, { pointerEvents: "box-none", style: react_native_1.StyleSheet.absoluteFill, children: children })) : null, (0, jsx_runtime_1.jsx)(GlassSurfacePortalLayer, { registry: surfaceRegistry, providerId: providerId, themeBackdropProviderId: themeBackdropProviderId, tokens: tokens }), (0, jsx_runtime_1.jsx)(GlassRouteOverlayLayer, { registry: overlayRegistry, enabled: tokens.enabled })] }) }) }) }) }));
}
function GlassSurfacePortalLayer({ registry, providerId, themeBackdropProviderId, tokens }) {
    const entries = useRegistrySnapshot(registry);
    const balancedShaderSurfaces = (0, react_1.useMemo)(() => selectBalancedShaderSurfaces(entries), [entries]);
    if (!tokens.enabled)
        return null;
    return ((0, jsx_runtime_1.jsx)(react_native_1.View, { pointerEvents: "box-none", style: react_native_1.StyleSheet.absoluteFill, children: entries.map(([id, entry]) => ((0, jsx_runtime_1.jsx)(PortalGlassSurface, { providerId: entry.samplingSource === 'themeBackdrop' ? themeBackdropProviderId : providerId, entry: entry, shaderEnabled: tokens.quality === 'high' || (tokens.quality === 'balanced' && balancedShaderSurfaces.has(id)) }, id))) }));
}
function GlassRouteOverlayLayer({ registry, enabled }) {
    const entries = useRegistrySnapshot(registry);
    if (!enabled)
        return null;
    return ((0, jsx_runtime_1.jsx)(react_native_1.View, { pointerEvents: "box-none", style: react_native_1.StyleSheet.absoluteFill, children: entries.map(([id, entry]) => (0, jsx_runtime_1.jsx)(RouteOverlayView, { entry: entry }, id)) }));
}
const RouteOverlayView = react_1.default.memo(function RouteOverlayView({ entry }) {
    return ((0, jsx_runtime_1.jsx)(react_native_reanimated_1.default.View, { pointerEvents: "box-none", style: [react_native_1.StyleSheet.absoluteFill, entry.style, { zIndex: entry.zIndex }], children: entry.children }));
});
const PortalGlassSurface = react_1.default.memo(function PortalGlassSurface({ providerId, entry, shaderEnabled }) {
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
    const nativeSurface = ((0, jsx_runtime_1.jsx)(NativeBackdropSurface, { providerId: providerId, opticsModel: material.opticsModel, sdfContrast: material.sdfScaleLens?.contrast, sdfBrightness: material.sdfScaleLens?.brightness, sdfSaturation: material.sdfScaleLens?.saturation, sdfOuterShadowAlpha: material.sdfScaleLens?.outerShadowAlpha, sdfOuterShadowBlurRadius: material.sdfScaleLens?.outerShadowBlurRadius, sdfOuterShadowOffsetY: material.sdfScaleLens?.outerShadowOffsetY, sdfInnerShadowAlpha: material.sdfScaleLens?.innerShadowAlpha, sdfInnerShadowExtent: material.sdfScaleLens?.innerShadowExtent, cornerRadius: material.radius, blurRadius: material.blurRadius * qualityScale, refractionHeight: material.refractionHeight * qualityScale, refractionAmount: material.refractionAmount * qualityScale, bodyRefractionAmount: (material.refractionBodyAmount ?? 2.5) * qualityScale, interactionProgress: 0, saturation: material.saturation, chromaticAberration: tokens.quality === 'high' || entry.variant === 'tabSelectionLens'
            ? material.chromaticAberration
            : 0, highlightAlpha: material.highlightAlpha, highlightWidth: material.highlightWidth, tintAlpha: material.tintAlpha ?? 1, specularStrength: material.specularStrength ?? 1, fresnelStrength: material.fresnelStrength ?? 0.85, innerShadowStrength: material.innerShadowStrength ?? 0.18, tint: dark ? tokens.tint.dark : tokens.tint.light, interactive: entry.interactive && tokens.interaction.enabled && !reducedMotion, continuous: entry.continuous, motionX: undefined, motionY: undefined, displacementOnlyDebug: entry.displacementOnlyDebug, animatedProps: animatedOptics, style: [
            styles.nativeSurface,
            entry.placement === 'layout'
                ? react_native_1.StyleSheet.absoluteFillObject
                : { width: entry.frame.width > 0 ? entry.frame.width : undefined },
            { borderRadius: material.radius },
        ] }));
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
            entry.positioning === 'floating' ? entry.animatedStyle : undefined,
            { zIndex: entry.zIndex },
        ], children: nativeSurface }));
});
const PortalFallbackSurface = react_1.default.memo(function PortalFallbackSurface({ entry }) {
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
        ] }));
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
});
/** Theme-driven glass material. Callers select a role; all optical settings live in AppTheme. */
exports.GlassSurface = react_1.default.memo(function GlassSurface({ variant = 'surface', positioning, sampling, samplingSource = 'routeScene', inlineBackdrop = false, renderMode, pointerEvents, interactive = false, continuous = false, opticalProgress, opticalMotionX, opticalMotionY, materialOverrides, displacementOnlyDebug = false, style, contentStyle, animatedStyle, placement = 'layout', bottomInset, zIndex = 1, children, }) {
    const runtime = (0, react_1.useContext)(GlassRuntimeContext);
    const host = (0, react_1.useContext)(GlassHostContext);
    const captureSourceProviderId = (0, react_1.useContext)(GlassCaptureSourceContext);
    const resolvedPositioning = positioning ?? (renderMode === 'backdrop' ? 'floating' : 'inFlow');
    const resolvedSampling = sampling ?? renderMode ?? (resolvedPositioning === 'floating' ? 'backdrop' : 'local');
    const resolvedRenderMode = runtime?.tokens.enabled && resolvedSampling === 'backdrop' && react_native_1.Platform.OS === 'android' && host && runtime.tokens.quality !== 'fallback'
        ? 'backdrop'
        : 'local';
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
        if (!runtime?.tokens.enabled || resolvedRenderMode !== 'backdrop' || inlineBackdrop || !frame || frame.width <= 0 || frame.height <= 0) {
            host.remove(id);
            return;
        }
        host.updateSurface(id, {
            frame,
            positioning: resolvedPositioning,
            samplingSource,
            variant,
            interactive,
            continuous,
            opticalProgress,
            opticalMotionX,
            opticalMotionY,
            materialOverrides,
            displacementOnlyDebug,
            animatedStyle,
            placement,
            bottomInset,
            zIndex,
        });
    }, [runtime?.tokens.enabled, resolvedRenderMode, inlineBackdrop, host, id, frame, resolvedPositioning, samplingSource, variant, interactive, continuous, opticalProgress, opticalMotionX, opticalMotionY, materialOverrides, displacementOnlyDebug, animatedStyle, placement, bottomInset, zIndex]);
    if (!runtime?.tokens.enabled) {
        return (0, jsx_runtime_1.jsx)(react_native_reanimated_1.default.View, { style: [style, animatedStyle], children: (0, jsx_runtime_1.jsx)(react_native_1.View, { style: contentStyle, children: children }) });
    }
    if (resolvedRenderMode === 'local' || !host) {
        return ((0, jsx_runtime_1.jsx)(LocalGlassSurface, { variant: variant, style: style, contentStyle: contentStyle, animatedStyle: animatedStyle, pointerEvents: pointerEvents, children: children }));
    }
    if (inlineBackdrop) {
        return ((0, jsx_runtime_1.jsx)(react_native_reanimated_1.default.View, { pointerEvents: pointerEvents, style: [style, animatedStyle], children: (0, jsx_runtime_1.jsx)(InlineBackdropSurface, { providerId: samplingSource === 'themeBackdrop' ? host.themeBackdropProviderId : captureSourceProviderId ?? host.themeBackdropProviderId, variant: variant, interactive: interactive, continuous: continuous, opticalProgress: opticalProgress, opticalMotionX: opticalMotionX, opticalMotionY: opticalMotionY, materialOverrides: materialOverrides, displacementOnlyDebug: displacementOnlyDebug, contentStyle: contentStyle, placement: placement, children: children }) }));
    }
    return ((0, jsx_runtime_1.jsx)(react_native_reanimated_1.default.View, { ref: viewRef, collapsable: false, pointerEvents: pointerEvents, onLayout: onLayout, style: [style, animatedStyle, styles.measureOnly], children: (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [placement === 'layout' ? styles.portalContentLayout : styles.portalContentWrap, contentStyle], children: children }) }));
});
const InlineBackdropSurface = react_1.default.memo(function InlineBackdropSurface({ providerId, variant, interactive, continuous, opticalProgress, opticalMotionX, opticalMotionY, materialOverrides, displacementOnlyDebug, contentStyle, placement, children, }) {
    const runtime = (0, react_1.useContext)(GlassRuntimeContext);
    const animatedOptics = (0, react_native_reanimated_1.useAnimatedProps)(() => ({
        interactionProgress: opticalProgress?.value ?? 0,
        motionX: opticalMotionX ? Math.max(-1, Math.min(1, opticalMotionX.value / 1800)) : undefined,
        motionY: opticalMotionY ? Math.max(-1, Math.min(1, opticalMotionY.value / 1800)) : undefined,
    }), [opticalProgress, opticalMotionX, opticalMotionY]);
    if (!runtime)
        return (0, jsx_runtime_1.jsx)(jsx_runtime_1.Fragment, { children: children });
    const { tokens, dark, reducedMotion } = runtime;
    const material = materialOverrides
        ? { ...tokens.materials[variant], ...materialOverrides }
        : tokens.materials[variant];
    const qualityScale = tokens.quality === 'high' ? 1.2 : tokens.quality === 'fallback' ? 0.45 : 1;
    return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.inlineBackdropSurface, children: [(0, jsx_runtime_1.jsx)(NativeBackdropSurface, { providerId: providerId, opticsModel: material.opticsModel, sdfContrast: material.sdfScaleLens?.contrast, sdfBrightness: material.sdfScaleLens?.brightness, sdfSaturation: material.sdfScaleLens?.saturation, sdfOuterShadowAlpha: material.sdfScaleLens?.outerShadowAlpha, sdfOuterShadowBlurRadius: material.sdfScaleLens?.outerShadowBlurRadius, sdfOuterShadowOffsetY: material.sdfScaleLens?.outerShadowOffsetY, sdfInnerShadowAlpha: material.sdfScaleLens?.innerShadowAlpha, sdfInnerShadowExtent: material.sdfScaleLens?.innerShadowExtent, cornerRadius: material.radius, blurRadius: material.blurRadius * qualityScale, refractionHeight: material.refractionHeight * qualityScale, refractionAmount: material.refractionAmount * qualityScale, bodyRefractionAmount: (material.refractionBodyAmount ?? 2.5) * qualityScale, interactionProgress: 0, saturation: material.saturation, chromaticAberration: tokens.quality === 'high' || variant === 'tabSelectionLens' ? material.chromaticAberration : 0, highlightAlpha: material.highlightAlpha, highlightWidth: material.highlightWidth, tintAlpha: material.tintAlpha ?? 1, specularStrength: material.specularStrength ?? 1, fresnelStrength: material.fresnelStrength ?? 0.85, innerShadowStrength: material.innerShadowStrength ?? 0.18, tint: dark ? tokens.tint.dark : tokens.tint.light, interactive: interactive && tokens.interaction.enabled && !reducedMotion, continuous: continuous, displacementOnlyDebug: displacementOnlyDebug, animatedProps: animatedOptics, pointerEvents: interactive ? undefined : 'none', style: [react_native_1.StyleSheet.absoluteFillObject, { borderRadius: material.radius }] }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [placement === 'layout' ? styles.portalContentLayout : styles.portalContentWrap, contentStyle], children: children })] }));
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
function useGlassProviderId() {
    return (0, react_1.useContext)(GlassHostContext)?.providerId ?? null;
}
/** Route-level view overlay for sheets/dialogs; its children remain ordinary native views. */
function GlassOverlay({ children, zIndex = 100 }) {
    const runtime = (0, react_1.useContext)(GlassRuntimeContext);
    const host = (0, react_1.useContext)(GlassOverlayHostContext);
    const id = (0, react_1.useId)();
    (0, react_1.useEffect)(() => () => host?.remove(id), [host, id]);
    (0, react_1.useEffect)(() => {
        if (!host)
            return;
        if (runtime?.tokens.enabled)
            host.updateOverlay(id, { children, zIndex });
        else
            host.remove(id);
    }, [runtime?.tokens.enabled, host, id, children, zIndex]);
    if (!runtime?.tokens.enabled || !host)
        return (0, jsx_runtime_1.jsx)(jsx_runtime_1.Fragment, { children: children });
    return null;
}
const styles = react_native_1.StyleSheet.create({
    root: { flex: 1 },
    routeContent: { ...react_native_1.StyleSheet.absoluteFillObject },
    measureOnly: {},
    localSurface: { position: 'relative', overflow: 'hidden' },
    localContent: { flex: 1, overflow: 'hidden' },
    portalSurface: { position: 'absolute', overflow: 'visible' },
    nativeSurface: { backgroundColor: 'transparent', overflow: 'hidden' },
    fallbackSurface: { backgroundColor: 'transparent', borderWidth: react_native_1.StyleSheet.hairlineWidth, overflow: 'hidden' },
    portalContentLayout: { flex: 1, overflow: 'hidden' },
    portalContentWrap: { flexGrow: 1, flexShrink: 1, overflow: 'hidden' },
    captureSource: { flex: 1 },
    inlineBackdropSurface: { flex: 1 },
    bottomPlacement: { alignItems: 'center', justifyContent: 'flex-end' },
    centerPlacement: { alignItems: 'center', justifyContent: 'center' },
});
//# sourceMappingURL=GlassSurface.js.map
import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import React, { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { findNodeHandle, Platform, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import { LocalGlassMaterial } from './LocalGlassMaterial';
import { getGlassNativeEngine, subscribeGlassNativeEngine } from './glassNativeEngine';
import { CoreGlassCaptureSource, CoreGlassSurfaceView, LegacyGlassCaptureSource, LegacyGlassSurfaceView } from './nativeGlassViews';
const AnimatedLegacyGlassSurfaceView = Animated.createAnimatedComponent(LegacyGlassSurfaceView);
const AnimatedCoreGlassSurfaceView = CoreGlassSurfaceView
    ? Animated.createAnimatedComponent(CoreGlassSurfaceView)
    : null;
const GlassRuntimeContext = createContext(null);
const GlassCaptureSourceContext = createContext(null);
const GlassNativeEngineContext = createContext('legacy');
export function useGlassReducedMotion() {
    return useContext(GlassRuntimeContext)?.reducedMotion ?? false;
}
export function useGlassAppearance() {
    return useContext(GlassRuntimeContext);
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
    return React.useSyncExternalStore(registry.subscribe, registry.getSnapshot, registry.getSnapshot);
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
const GlassHostContext = createContext(null);
export function RouteGlassCaptureScope({ children }) {
    const host = useContext(GlassHostContext);
    const providerId = host ? `${host.providerId}:page-content` : null;
    return _jsx(GlassCaptureSourceContext.Provider, { value: providerId, children: children });
}
export function RouteGlassCaptureSource({ children }) {
    const host = useContext(GlassHostContext);
    const runtime = useContext(GlassRuntimeContext);
    const providerId = useContext(GlassCaptureSourceContext);
    if (!host || !providerId || !runtime?.tokens.enabled)
        return _jsx(_Fragment, { children: children });
    return (_jsx(GlassCaptureSourceView, { providerId: providerId, underlayProviderId: host.themeBackdropProviderId, captureMode: "live", pointerEvents: "box-none", style: styles.captureSource, children: children }));
}
function NativeBackdropSurface({ opticsModel, sdfDisplacementMapDebug, sdfContrast, sdfBrightness, sdfSaturation, sdfOuterShadowAlpha, sdfOuterShadowBlurRadius, sdfOuterShadowOffsetY, sdfInnerShadowAlpha, sdfInnerShadowExtent, ...props }) {
    const nativeEngine = useContext(GlassNativeEngineContext);
    if (nativeEngine === 'core' && AnimatedCoreGlassSurfaceView) {
        return (_jsx(AnimatedCoreGlassSurfaceView, { ...props, opticsModel: opticsModel, sdfDisplacementMapDebug: sdfDisplacementMapDebug, sdfContrast: sdfContrast, sdfBrightness: sdfBrightness, sdfSaturation: sdfSaturation, sdfOuterShadowAlpha: sdfOuterShadowAlpha, sdfOuterShadowBlurRadius: sdfOuterShadowBlurRadius, sdfOuterShadowOffsetY: sdfOuterShadowOffsetY, sdfInnerShadowAlpha: sdfInnerShadowAlpha, sdfInnerShadowExtent: sdfInnerShadowExtent }));
    }
    return _jsx(AnimatedLegacyGlassSurfaceView, { ...props });
}
function GlassCaptureSourceView({ children, ...props }) {
    const nativeEngine = useContext(GlassNativeEngineContext);
    if (nativeEngine === 'core' && CoreGlassCaptureSource) {
        return _jsx(CoreGlassCaptureSource, { ...props, children: children });
    }
    return _jsx(LegacyGlassCaptureSource, { ...props, children: children });
}
const GlassOverlayHostContext = createContext(null);
export function GlassAppearanceProvider({ children, tokens, dark, reducedMotion = false }) {
    const runtime = useMemo(() => ({ tokens, dark, reducedMotion }), [tokens, dark, reducedMotion]);
    return _jsx(GlassRuntimeContext.Provider, { value: runtime, children: children });
}
export function GlassMaterialProvider({ children, backdrop, themeBackdrop, themeBackdropRevision, providerId: providerIdProp, style, tokens, dark, reducedMotion = false }) {
    const hostRef = useRef(null);
    const generatedProviderId = useId();
    const providerId = providerIdProp ?? generatedProviderId;
    const themeBackdropProviderId = useId();
    const surfaceRegistryRef = useRef(null);
    const overlayRegistryRef = useRef(null);
    if (!surfaceRegistryRef.current)
        surfaceRegistryRef.current = createEntryRegistry();
    if (!overlayRegistryRef.current)
        overlayRegistryRef.current = createEntryRegistry();
    const surfaceRegistry = surfaceRegistryRef.current;
    const overlayRegistry = overlayRegistryRef.current;
    const runtime = useMemo(() => ({ tokens, dark, reducedMotion }), [tokens, dark, reducedMotion]);
    const nativeEngine = useSyncExternalStore(subscribeGlassNativeEngine, getGlassNativeEngine, getGlassNativeEngine);
    const updateSurface = useCallback((id, entry) => {
        surfaceRegistry.update(id, entry, sameSurface);
    }, [surfaceRegistry]);
    const updateOverlay = useCallback((id, entry) => {
        overlayRegistry.update(id, entry, sameOverlay);
    }, [overlayRegistry]);
    const remove = useCallback((id) => {
        surfaceRegistry.remove(id);
        overlayRegistry.remove(id);
    }, [surfaceRegistry, overlayRegistry]);
    const context = useMemo(() => ({ providerId, themeBackdropProviderId, hostRef, updateSurface, remove }), [providerId, themeBackdropProviderId, updateSurface, remove]);
    const overlayContext = useMemo(() => ({ providerId, updateOverlay, remove }), [providerId, updateOverlay, remove]);
    const hasSeparateBackdrop = backdrop !== undefined;
    return (_jsx(GlassNativeEngineContext.Provider, { value: nativeEngine, children: _jsx(GlassRuntimeContext.Provider, { value: runtime, children: _jsx(GlassHostContext.Provider, { value: context, children: _jsx(GlassOverlayHostContext.Provider, { value: overlayContext, children: _jsxs(View, { ref: hostRef, collapsable: false, style: [styles.root, style], children: [themeBackdrop !== undefined ? (_jsx(GlassCaptureSourceView, { providerId: themeBackdropProviderId, captureMode: "static", sourceRevision: themeBackdropRevision, pointerEvents: "none", style: StyleSheet.absoluteFill, children: themeBackdrop })) : null, _jsx(GlassCaptureSourceView, { providerId: providerId, underlayProviderId: themeBackdrop !== undefined ? themeBackdropProviderId : undefined, captureMode: tokens.enabled ? 'live' : 'frozen', style: StyleSheet.absoluteFill, children: hasSeparateBackdrop ? backdrop : children }), hasSeparateBackdrop ? (_jsx(View, { pointerEvents: "box-none", style: StyleSheet.absoluteFill, children: children })) : null, _jsx(GlassSurfacePortalLayer, { registry: surfaceRegistry, providerId: providerId, themeBackdropProviderId: themeBackdropProviderId, tokens: tokens }), _jsx(GlassRouteOverlayLayer, { registry: overlayRegistry, enabled: tokens.enabled })] }) }) }) }) }));
}
function GlassSurfacePortalLayer({ registry, providerId, themeBackdropProviderId, tokens }) {
    const entries = useRegistrySnapshot(registry);
    const balancedShaderSurfaces = useMemo(() => selectBalancedShaderSurfaces(entries), [entries]);
    if (!tokens.enabled)
        return null;
    return (_jsx(View, { pointerEvents: "box-none", style: StyleSheet.absoluteFill, children: entries.map(([id, entry]) => (_jsx(PortalGlassSurface, { providerId: entry.samplingSource === 'themeBackdrop' ? themeBackdropProviderId : providerId, entry: entry, shaderEnabled: tokens.quality === 'high' || (tokens.quality === 'balanced' && balancedShaderSurfaces.has(id)) }, id))) }));
}
function GlassRouteOverlayLayer({ registry, enabled }) {
    const entries = useRegistrySnapshot(registry);
    if (!enabled)
        return null;
    return (_jsx(View, { pointerEvents: "box-none", style: StyleSheet.absoluteFill, children: entries.map(([id, entry]) => _jsx(RouteOverlayView, { entry: entry }, id)) }));
}
const RouteOverlayView = React.memo(function RouteOverlayView({ entry }) {
    return (_jsx(Animated.View, { pointerEvents: "box-none", style: [StyleSheet.absoluteFill, entry.style, { zIndex: entry.zIndex }], children: entry.children }));
});
const PortalGlassSurface = React.memo(function PortalGlassSurface({ providerId, entry, shaderEnabled }) {
    const runtime = useContext(GlassRuntimeContext);
    const opticalProgress = entry.opticalProgress;
    const opticalMotionX = entry.opticalMotionX;
    const opticalMotionY = entry.opticalMotionY;
    const animatedOptics = useAnimatedProps(() => ({
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
        return _jsx(PortalFallbackSurface, { entry: entry });
    const nativeSurface = (_jsx(NativeBackdropSurface, { providerId: providerId, opticsModel: material.opticsModel, sdfContrast: material.sdfScaleLens?.contrast, sdfBrightness: material.sdfScaleLens?.brightness, sdfSaturation: material.sdfScaleLens?.saturation, sdfOuterShadowAlpha: material.sdfScaleLens?.outerShadowAlpha, sdfOuterShadowBlurRadius: material.sdfScaleLens?.outerShadowBlurRadius, sdfOuterShadowOffsetY: material.sdfScaleLens?.outerShadowOffsetY, sdfInnerShadowAlpha: material.sdfScaleLens?.innerShadowAlpha, sdfInnerShadowExtent: material.sdfScaleLens?.innerShadowExtent, cornerRadius: material.radius, blurRadius: material.blurRadius * qualityScale, refractionHeight: material.refractionHeight * qualityScale, refractionAmount: material.refractionAmount * qualityScale, bodyRefractionAmount: (material.refractionBodyAmount ?? 2.5) * qualityScale, interactionProgress: 0, saturation: material.saturation, chromaticAberration: tokens.quality === 'high' || entry.variant === 'tabSelectionLens'
            ? material.chromaticAberration
            : 0, highlightAlpha: material.highlightAlpha, highlightWidth: material.highlightWidth, tintAlpha: material.tintAlpha ?? 1, specularStrength: material.specularStrength ?? 1, fresnelStrength: material.fresnelStrength ?? 0.85, innerShadowStrength: material.innerShadowStrength ?? 0.18, tint: dark ? tokens.tint.dark : tokens.tint.light, interactive: entry.interactive && tokens.interaction.enabled && !reducedMotion, continuous: entry.continuous, motionX: undefined, motionY: undefined, displacementOnlyDebug: entry.displacementOnlyDebug, animatedProps: animatedOptics, style: [
            styles.nativeSurface,
            entry.placement === 'layout'
                ? StyleSheet.absoluteFillObject
                : { width: entry.frame.width > 0 ? entry.frame.width : undefined },
            { borderRadius: material.radius },
        ] }));
    if (entry.placement === 'bottom' || entry.placement === 'center') {
        return (_jsx(Animated.View, { pointerEvents: "box-none", style: [
                StyleSheet.absoluteFill,
                entry.placement === 'center' ? styles.centerPlacement : styles.bottomPlacement,
                entry.placement === 'bottom' && entry.bottomInset != null ? { paddingBottom: entry.bottomInset } : undefined,
                entry.animatedStyle,
                { zIndex: entry.zIndex },
            ], children: nativeSurface }));
    }
    return (_jsx(Animated.View, { pointerEvents: "box-none", style: [
            styles.portalSurface,
            { left: entry.frame.x, top: entry.frame.y, width: entry.frame.width, height: entry.frame.height },
            entry.positioning === 'floating' ? entry.animatedStyle : undefined,
            { zIndex: entry.zIndex },
        ], children: nativeSurface }));
});
const PortalFallbackSurface = React.memo(function PortalFallbackSurface({ entry }) {
    const runtime = useContext(GlassRuntimeContext);
    if (!runtime)
        return null;
    const { tokens, dark } = runtime;
    const material = tokens.materials[entry.variant];
    const fallbackSurface = (_jsx(View, { style: [
            styles.fallbackSurface,
            entry.placement === 'layout'
                ? StyleSheet.absoluteFillObject
                : { width: entry.frame.width > 0 ? entry.frame.width : undefined },
            {
                backgroundColor: dark ? tokens.fallbackTint.dark : tokens.fallbackTint.light,
                borderColor: dark ? tokens.fallbackBorder.dark : tokens.fallbackBorder.light,
                borderRadius: material.radius,
            },
        ] }));
    if (entry.placement === 'bottom' || entry.placement === 'center') {
        return (_jsx(Animated.View, { pointerEvents: "box-none", style: [
                StyleSheet.absoluteFill,
                entry.placement === 'center' ? styles.centerPlacement : styles.bottomPlacement,
                entry.placement === 'bottom' && entry.bottomInset != null ? { paddingBottom: entry.bottomInset } : undefined,
                entry.animatedStyle,
                { zIndex: entry.zIndex },
            ], children: fallbackSurface }));
    }
    return (_jsx(Animated.View, { pointerEvents: "box-none", style: [
            styles.portalSurface,
            { left: entry.frame.x, top: entry.frame.y, width: entry.frame.width, height: entry.frame.height },
            entry.animatedStyle,
            { zIndex: entry.zIndex },
        ], children: fallbackSurface }));
});
/** Theme-driven glass material. Callers select a role; all optical settings live in AppTheme. */
export const GlassSurface = React.memo(function GlassSurface({ variant = 'surface', positioning, sampling, samplingSource = 'routeScene', inlineBackdrop = false, renderMode, pointerEvents, interactive = false, continuous = false, opticalProgress, opticalMotionX, opticalMotionY, materialOverrides, displacementOnlyDebug = false, style, contentStyle, animatedStyle, placement = 'layout', bottomInset, zIndex = 1, children, }) {
    const runtime = useContext(GlassRuntimeContext);
    const host = useContext(GlassHostContext);
    const captureSourceProviderId = useContext(GlassCaptureSourceContext);
    const resolvedPositioning = positioning ?? (renderMode === 'backdrop' ? 'floating' : 'inFlow');
    const resolvedSampling = sampling ?? renderMode ?? (resolvedPositioning === 'floating' ? 'backdrop' : 'local');
    const resolvedRenderMode = runtime?.tokens.enabled && resolvedSampling === 'backdrop' && Platform.OS === 'android' && host && runtime.tokens.quality !== 'fallback'
        ? 'backdrop'
        : 'local';
    const id = useId();
    const viewRef = useRef(null);
    const [frame, setFrame] = useState(null);
    const measure = useCallback(() => {
        const view = viewRef.current;
        const hostNode = host?.hostRef.current;
        if (!view || !hostNode)
            return;
        if (findNodeHandle(view) == null || findNodeHandle(hostNode) == null)
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
    const onLayout = useCallback((_event) => measure(), [measure]);
    useEffect(() => () => host?.remove(id), [host, id]);
    useEffect(() => {
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
        return _jsx(Animated.View, { style: [style, animatedStyle], children: _jsx(View, { style: contentStyle, children: children }) });
    }
    if (resolvedRenderMode === 'local' || !host) {
        return (_jsx(LocalGlassSurface, { variant: variant, style: style, contentStyle: contentStyle, animatedStyle: animatedStyle, pointerEvents: pointerEvents, children: children }));
    }
    if (inlineBackdrop) {
        return (_jsx(Animated.View, { pointerEvents: pointerEvents, style: [style, animatedStyle], children: _jsx(InlineBackdropSurface, { providerId: samplingSource === 'themeBackdrop' ? host.themeBackdropProviderId : captureSourceProviderId ?? host.themeBackdropProviderId, variant: variant, interactive: interactive, continuous: continuous, opticalProgress: opticalProgress, opticalMotionX: opticalMotionX, opticalMotionY: opticalMotionY, materialOverrides: materialOverrides, displacementOnlyDebug: displacementOnlyDebug, contentStyle: contentStyle, placement: placement, children: children }) }));
    }
    return (_jsx(Animated.View, { ref: viewRef, collapsable: false, pointerEvents: pointerEvents, onLayout: onLayout, style: [style, animatedStyle, styles.measureOnly], children: _jsx(View, { style: [placement === 'layout' ? styles.portalContentLayout : styles.portalContentWrap, contentStyle], children: children }) }));
});
const InlineBackdropSurface = React.memo(function InlineBackdropSurface({ providerId, variant, interactive, continuous, opticalProgress, opticalMotionX, opticalMotionY, materialOverrides, displacementOnlyDebug, contentStyle, placement, children, }) {
    const runtime = useContext(GlassRuntimeContext);
    const animatedOptics = useAnimatedProps(() => ({
        interactionProgress: opticalProgress?.value ?? 0,
        motionX: opticalMotionX ? Math.max(-1, Math.min(1, opticalMotionX.value / 1800)) : undefined,
        motionY: opticalMotionY ? Math.max(-1, Math.min(1, opticalMotionY.value / 1800)) : undefined,
    }), [opticalProgress, opticalMotionX, opticalMotionY]);
    if (!runtime)
        return _jsx(_Fragment, { children: children });
    const { tokens, dark, reducedMotion } = runtime;
    const material = materialOverrides
        ? { ...tokens.materials[variant], ...materialOverrides }
        : tokens.materials[variant];
    const qualityScale = tokens.quality === 'high' ? 1.2 : tokens.quality === 'fallback' ? 0.45 : 1;
    return (_jsxs(View, { style: styles.inlineBackdropSurface, children: [_jsx(NativeBackdropSurface, { providerId: providerId, opticsModel: material.opticsModel, sdfContrast: material.sdfScaleLens?.contrast, sdfBrightness: material.sdfScaleLens?.brightness, sdfSaturation: material.sdfScaleLens?.saturation, sdfOuterShadowAlpha: material.sdfScaleLens?.outerShadowAlpha, sdfOuterShadowBlurRadius: material.sdfScaleLens?.outerShadowBlurRadius, sdfOuterShadowOffsetY: material.sdfScaleLens?.outerShadowOffsetY, sdfInnerShadowAlpha: material.sdfScaleLens?.innerShadowAlpha, sdfInnerShadowExtent: material.sdfScaleLens?.innerShadowExtent, cornerRadius: material.radius, blurRadius: material.blurRadius * qualityScale, refractionHeight: material.refractionHeight * qualityScale, refractionAmount: material.refractionAmount * qualityScale, bodyRefractionAmount: (material.refractionBodyAmount ?? 2.5) * qualityScale, interactionProgress: 0, saturation: material.saturation, chromaticAberration: tokens.quality === 'high' || variant === 'tabSelectionLens' ? material.chromaticAberration : 0, highlightAlpha: material.highlightAlpha, highlightWidth: material.highlightWidth, tintAlpha: material.tintAlpha ?? 1, specularStrength: material.specularStrength ?? 1, fresnelStrength: material.fresnelStrength ?? 0.85, innerShadowStrength: material.innerShadowStrength ?? 0.18, tint: dark ? tokens.tint.dark : tokens.tint.light, interactive: interactive && tokens.interaction.enabled && !reducedMotion, continuous: continuous, displacementOnlyDebug: displacementOnlyDebug, animatedProps: animatedOptics, pointerEvents: interactive ? undefined : 'none', style: [StyleSheet.absoluteFillObject, { borderRadius: material.radius }] }), _jsx(View, { style: [placement === 'layout' ? styles.portalContentLayout : styles.portalContentWrap, contentStyle], children: children })] }));
});
function LocalGlassSurface({ variant, style, contentStyle, animatedStyle, pointerEvents, children, }) {
    const runtime = useContext(GlassRuntimeContext);
    if (!runtime?.tokens.enabled)
        return _jsx(Animated.View, { style: [style, animatedStyle], children: _jsx(View, { style: contentStyle, children: children }) });
    const { tokens, dark } = runtime;
    const material = tokens.materials[variant ?? 'surface'];
    const fallback = tokens.quality === 'fallback';
    return (_jsxs(Animated.View, { pointerEvents: pointerEvents, style: [styles.localSurface, { borderRadius: material.radius, backgroundColor: 'transparent' }, style, animatedStyle], children: [fallback ? (_jsx(View, { pointerEvents: "none", style: [
                    StyleSheet.absoluteFill,
                    {
                        backgroundColor: dark ? tokens.fallbackTint.dark : tokens.fallbackTint.light,
                        borderColor: dark ? tokens.fallbackBorder.dark : tokens.fallbackBorder.light,
                        borderWidth: StyleSheet.hairlineWidth,
                        borderRadius: material.radius,
                    },
                ] })) : (_jsx(LocalGlassMaterial, { tokens: tokens, material: material, dark: dark })), _jsx(View, { style: [styles.localContent, contentStyle], children: children })] }));
}
export function useGlassProviderId() {
    return useContext(GlassHostContext)?.providerId ?? null;
}
/** Route-level view overlay for sheets/dialogs; its children remain ordinary native views. */
export function GlassOverlay({ children, zIndex = 100 }) {
    const runtime = useContext(GlassRuntimeContext);
    const host = useContext(GlassOverlayHostContext);
    const id = useId();
    useEffect(() => () => host?.remove(id), [host, id]);
    useEffect(() => {
        if (!host)
            return;
        if (runtime?.tokens.enabled)
            host.updateOverlay(id, { children, zIndex });
        else
            host.remove(id);
    }, [runtime?.tokens.enabled, host, id, children, zIndex]);
    if (!runtime?.tokens.enabled || !host)
        return _jsx(_Fragment, { children: children });
    return null;
}
const styles = StyleSheet.create({
    root: { flex: 1 },
    routeContent: { ...StyleSheet.absoluteFillObject },
    measureOnly: {},
    localSurface: { position: 'relative', overflow: 'hidden' },
    localContent: { flex: 1, overflow: 'hidden' },
    portalSurface: { position: 'absolute', overflow: 'visible' },
    nativeSurface: { backgroundColor: 'transparent', overflow: 'hidden' },
    fallbackSurface: { backgroundColor: 'transparent', borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
    portalContentLayout: { flex: 1, overflow: 'hidden' },
    portalContentWrap: { flexGrow: 1, flexShrink: 1, overflow: 'hidden' },
    captureSource: { flex: 1 },
    inlineBackdropSurface: { flex: 1 },
    bottomPlacement: { alignItems: 'center', justifyContent: 'flex-end' },
    centerPlacement: { alignItems: 'center', justifyContent: 'center' },
});
//# sourceMappingURL=GlassSurface.js.map
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { LiquidGlassProvider, LiquidGlassView } from 'liquid-glass-kit';
import React, { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { findNodeHandle, Platform, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import { LocalGlassMaterial } from './LocalGlassMaterial';
const AnimatedLiquidGlassView = Animated.createAnimatedComponent(LiquidGlassView);
const GlassRuntimeContext = createContext(null);
export function useGlassReducedMotion() {
    return useContext(GlassRuntimeContext)?.reducedMotion ?? false;
}
export function useGlassAppearance() {
    return useContext(GlassRuntimeContext);
}
function entryZIndex(entry) {
    return entry.value.zIndex;
}
function selectBalancedShaderSurfaces(entries) {
    // Every mounted backdrop surface keeps the same renderer regardless of
    // quality preset; display cadence is selected by the native provider.
    return new Set(Object.entries(entries)
        .filter((entry) => entry[1].kind === 'surface')
        .map(([id]) => id));
}
const GlassHostContext = createContext(null);
export function GlassMaterialProvider({ children, style, tokens, dark, reducedMotion = false }) {
    const hostRef = useRef(null);
    const providerId = useId();
    const [entries, setEntries] = useState({});
    const balancedShaderSurfaces = useMemo(() => selectBalancedShaderSurfaces(entries), [entries]);
    const orderedEntries = useMemo(() => Object.entries(entries).sort((left, right) => entryZIndex(left[1]) - entryZIndex(right[1])), [entries]);
    const runtime = useMemo(() => ({ tokens, dark, reducedMotion }), [tokens, dark, reducedMotion]);
    const updateSurface = useCallback((id, entry) => {
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
    const updateOverlay = useCallback((id, entry) => {
        setEntries((current) => {
            const previous = current[id]?.kind === 'overlay' ? current[id].value : undefined;
            if (previous && previous.children === entry.children && previous.style === entry.style && previous.zIndex === entry.zIndex)
                return current;
            return { ...current, [id]: { kind: 'overlay', value: entry } };
        });
    }, []);
    const remove = useCallback((id) => {
        setEntries((current) => {
            if (!(id in current))
                return current;
            const next = { ...current };
            delete next[id];
            return next;
        });
    }, []);
    const context = useMemo(() => ({ providerId, hostRef, updateSurface, updateOverlay, remove }), [providerId, updateSurface, updateOverlay, remove]);
    if (!tokens.enabled) {
        return _jsx(View, { style: [styles.root, style], children: children });
    }
    return (_jsx(GlassRuntimeContext.Provider, { value: runtime, children: _jsx(GlassHostContext.Provider, { value: context, children: _jsxs(View, { ref: hostRef, collapsable: false, style: [styles.root, style], children: [_jsx(LiquidGlassProvider, { providerId: providerId, maxCaptureRateHz: 120, style: StyleSheet.absoluteFill, children: children }), _jsx(View, { pointerEvents: "box-none", style: StyleSheet.absoluteFill, children: orderedEntries.map(([id, entry]) => (entry.kind === 'surface'
                            ? _jsx(PortalGlassSurface, { providerId: providerId, entry: entry.value, shaderEnabled: tokens.quality === 'high' || (tokens.quality === 'balanced' && balancedShaderSurfaces.has(id)) }, id)
                            : _jsx(PortalOverlay, { entry: entry.value }, id))) })] }) }) }));
}
const PortalOverlay = React.memo(function PortalOverlay({ entry }) {
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
    const nativeSurface = (_jsx(AnimatedLiquidGlassView, { providerId: providerId, cornerRadius: material.radius, blurRadius: material.blurRadius * qualityScale, refractionHeight: material.refractionHeight * qualityScale, refractionAmount: material.refractionAmount * qualityScale, bodyRefractionAmount: (material.refractionBodyAmount ?? 2.5) * qualityScale, interactionProgress: 0, saturation: material.saturation, chromaticAberration: tokens.quality === 'high' || entry.variant === 'tabSelectionLens'
            ? material.chromaticAberration
            : 0, highlightAlpha: material.highlightAlpha, highlightWidth: material.highlightWidth, tintAlpha: material.tintAlpha ?? 1, specularStrength: material.specularStrength ?? 1, fresnelStrength: material.fresnelStrength ?? 0.85, innerShadowStrength: material.innerShadowStrength ?? 0.18, tint: dark ? tokens.tint.dark : tokens.tint.light, interactive: entry.interactive && tokens.interaction.enabled && !reducedMotion, continuous: entry.continuous, motionX: undefined, motionY: undefined, displacementOnlyDebug: entry.displacementOnlyDebug, animatedProps: animatedOptics, style: [
            styles.nativeSurface,
            entry.placement === 'layout'
                ? StyleSheet.absoluteFillObject
                : { width: entry.frame.width > 0 ? entry.frame.width : undefined },
            { borderRadius: material.radius },
        ], children: _jsx(View, { style: [
                entry.placement === 'layout' ? styles.portalContentLayout : styles.portalContentWrap,
                entry.contentStyle,
                { borderRadius: material.radius },
            ], children: entry.children }) }));
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
            entry.animatedStyle,
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
        ], children: _jsx(View, { style: [
                entry.placement === 'layout' ? styles.portalContentLayout : styles.portalContentWrap,
                entry.contentStyle,
                { borderRadius: material.radius },
            ], children: entry.children }) }));
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
export const GlassSurface = React.memo(function GlassSurface({ variant = 'surface', renderMode, pointerEvents, interactive = false, continuous = false, opticalProgress, opticalMotionX, opticalMotionY, materialOverrides, displacementOnlyDebug = false, style, contentStyle, animatedStyle, placement = 'layout', bottomInset, zIndex = 1, children, placeholderChildren = children, }) {
    const runtime = useContext(GlassRuntimeContext);
    const host = useContext(GlassHostContext);
    const resolvedRenderMode = renderMode ?? (Platform.OS === 'android' && host && runtime?.tokens.quality !== 'fallback'
        ? 'backdrop'
        : 'local');
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
        return _jsx(Animated.View, { style: [style, animatedStyle], children: _jsx(View, { style: contentStyle, children: children }) });
    }
    if (resolvedRenderMode === 'local' || !host) {
        return (_jsx(LocalGlassSurface, { variant: variant, style: style, contentStyle: contentStyle, animatedStyle: animatedStyle, pointerEvents: pointerEvents, children: children }));
    }
    return (_jsx(View, { ref: viewRef, collapsable: false, accessible: false, importantForAccessibility: "no-hide-descendants", pointerEvents: "none", onLayout: onLayout, style: [style, styles.measureOnly], children: _jsx(View, { style: contentStyle, children: placeholderChildren }) }));
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
/** Full-screen overlay portal, used by sheets/dialogs so they sample the live app backdrop. */
export function GlassOverlay({ children, zIndex = 100 }) {
    const runtime = useContext(GlassRuntimeContext);
    const host = useContext(GlassHostContext);
    const id = useId();
    useEffect(() => () => host?.remove(id), [host, id]);
    useEffect(() => {
        if (runtime?.tokens.enabled && host)
            host.updateOverlay(id, { children, zIndex });
    }, [runtime?.tokens.enabled, host, id, children, zIndex]);
    if (!runtime?.tokens.enabled || !host)
        return _jsx(_Fragment, { children: children });
    return null;
}
const styles = StyleSheet.create({
    root: { flex: 1 },
    measureOnly: { opacity: 0 },
    localSurface: { position: 'relative', overflow: 'hidden' },
    localContent: { flex: 1, overflow: 'hidden' },
    portalSurface: { position: 'absolute' },
    nativeSurface: { backgroundColor: 'transparent', overflow: 'hidden' },
    fallbackSurface: { backgroundColor: 'transparent', borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
    portalContentLayout: { flex: 1, overflow: 'hidden' },
    portalContentWrap: { flexGrow: 1, flexShrink: 1, overflow: 'hidden' },
    bottomPlacement: { alignItems: 'center', justifyContent: 'flex-end' },
    centerPlacement: { alignItems: 'center', justifyContent: 'center' },
});
//# sourceMappingURL=GlassSurface.js.map
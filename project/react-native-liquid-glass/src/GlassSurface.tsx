import { LiquidGlassProvider, LiquidGlassView } from 'liquid-glass-kit';
import React, { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { findNodeHandle, Platform, StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent, StyleProp, ViewProps, ViewStyle } from 'react-native';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import type { AnimatedStyle, SharedValue } from 'react-native-reanimated';
import { LocalGlassMaterial } from './LocalGlassMaterial';
import type { GlassMaterialTokens, GlassTokens, GlassVariant } from './types';

const AnimatedLiquidGlassView = Animated.createAnimatedComponent(LiquidGlassView);

export interface GlassRuntime {
    tokens: GlassTokens;
    dark: boolean;
    reducedMotion: boolean;
}

const GlassRuntimeContext = createContext<GlassRuntime | null>(null);

export function useGlassReducedMotion() {
    return useContext(GlassRuntimeContext)?.reducedMotion ?? false;
}

export function useGlassAppearance() {
    return useContext(GlassRuntimeContext);
}

interface SurfaceFrame {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface SurfaceEntry {
    frame: SurfaceFrame;
    children: React.ReactNode;
    variant: GlassVariant;
    interactive: boolean;
    continuous: boolean;
    opticalProgress?: SharedValue<number>;
    opticalMotionX?: SharedValue<number>;
    opticalMotionY?: SharedValue<number>;
    materialOverrides?: Partial<GlassMaterialTokens>;
    displacementOnlyDebug: boolean;
    contentStyle?: StyleProp<ViewStyle>;
    animatedStyle?: AnimatedStyle<ViewStyle>;
    placement?: 'layout' | 'bottom' | 'center';
    bottomInset?: number;
    zIndex: number;
}

interface OverlayEntry {
    children: React.ReactNode;
    style?: AnimatedStyle<ViewStyle>;
    zIndex: number;
}

type HostEntry =
    | { kind: 'surface'; value: SurfaceEntry }
    | { kind: 'overlay'; value: OverlayEntry };

function entryZIndex(entry: HostEntry) {
    return entry.value.zIndex;
}

function selectBalancedShaderSurfaces(entries: Record<string, HostEntry>) {
    // Every mounted backdrop surface keeps the same renderer regardless of
    // quality preset; display cadence is selected by the native provider.
    return new Set(Object.entries(entries)
        .filter((entry) => entry[1].kind === 'surface')
        .map(([id]) => id));
}

interface GlassHostContextValue {
    providerId: string;
    hostRef: React.RefObject<View | null>;
    updateSurface: (id: string, entry: SurfaceEntry) => void;
    updateOverlay: (id: string, entry: OverlayEntry) => void;
    remove: (id: string) => void;
}

const GlassHostContext = createContext<GlassHostContextValue | null>(null);

/**
 * A route-scoped host for backdrop-mode surfaces. All mounted glass surfaces
 * use the active display cadence, up to the native renderer's 120 Hz ceiling.
 */
export interface GlassMaterialProviderProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    tokens: GlassTokens;
    dark: boolean;
    reducedMotion?: boolean;
}

export function GlassMaterialProvider({ children, style, tokens, dark, reducedMotion = false }: GlassMaterialProviderProps) {
    const hostRef = useRef<View>(null);
    const providerId = useId();
    const [entries, setEntries] = useState<Record<string, HostEntry>>({});
    const balancedShaderSurfaces = useMemo(() => selectBalancedShaderSurfaces(entries), [entries]);
    const orderedEntries = useMemo(
        () => Object.entries(entries).sort((left, right) => entryZIndex(left[1]) - entryZIndex(right[1])),
        [entries],
    );
    const runtime = useMemo(() => ({ tokens, dark, reducedMotion }), [tokens, dark, reducedMotion]);

    const updateSurface = useCallback((id: string, entry: SurfaceEntry) => {
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

    const updateOverlay = useCallback((id: string, entry: OverlayEntry) => {
        setEntries((current) => {
            const previous = current[id]?.kind === 'overlay' ? current[id].value : undefined;
            if (previous && previous.children === entry.children && previous.style === entry.style && previous.zIndex === entry.zIndex) return current;
            return { ...current, [id]: { kind: 'overlay', value: entry } };
        });
    }, []);

    const remove = useCallback((id: string) => {
        setEntries((current) => {
            if (!(id in current)) return current;
            const next = { ...current };
            delete next[id];
            return next;
        });
    }, []);

    const context = useMemo(() => ({ providerId, hostRef, updateSurface, updateOverlay, remove }), [providerId, updateSurface, updateOverlay, remove]);

    if (!tokens.enabled) {
        return <View style={[styles.root, style]}>{children}</View>;
    }

    return (
        <GlassRuntimeContext.Provider value={runtime}>
            <GlassHostContext.Provider value={context}>
                <View ref={hostRef} collapsable={false} style={[styles.root, style]}>
                    <LiquidGlassProvider
                        providerId={providerId}
                        maxCaptureRateHz={120}
                        style={StyleSheet.absoluteFill}
                    >
                        {children}
                    </LiquidGlassProvider>
                    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
                        {orderedEntries.map(([id, entry]) => (
                            entry.kind === 'surface'
                                ? <PortalGlassSurface
                                    key={id}
                                    providerId={providerId}
                                    entry={entry.value}
                                    shaderEnabled={tokens.quality === 'high' || (tokens.quality === 'balanced' && balancedShaderSurfaces.has(id))}
                                />
                                : <PortalOverlay key={id} entry={entry.value} />
                        ))}
                    </View>
                </View>
            </GlassHostContext.Provider>
        </GlassRuntimeContext.Provider>
    );
}

const PortalOverlay = React.memo(function PortalOverlay({ entry }: { entry: OverlayEntry }) {
    return (
        <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, entry.style, { zIndex: entry.zIndex }]}>
            {entry.children}
        </Animated.View>
    );
});

const PortalGlassSurface = React.memo(function PortalGlassSurface({ providerId, entry, shaderEnabled }: { providerId: string; entry: SurfaceEntry; shaderEnabled: boolean }) {
    const runtime = useContext(GlassRuntimeContext);
    const opticalProgress = entry.opticalProgress;
    const opticalMotionX = entry.opticalMotionX;
    const opticalMotionY = entry.opticalMotionY;
    const animatedOptics = useAnimatedProps(() => ({
        interactionProgress: opticalProgress?.value ?? 0,
        motionX: opticalMotionX ? Math.max(-1, Math.min(1, opticalMotionX.value / 1800)) : undefined,
        motionY: opticalMotionY ? Math.max(-1, Math.min(1, opticalMotionY.value / 1800)) : undefined,
    }), [opticalProgress, opticalMotionX, opticalMotionY]);
    if (!runtime) return null;
    const { tokens, dark, reducedMotion } = runtime;
    const material = entry.materialOverrides
        ? { ...tokens.materials[entry.variant], ...entry.materialOverrides }
        : tokens.materials[entry.variant];
    const qualityScale = tokens.quality === 'high' ? 1.2 : tokens.quality === 'fallback' ? 0.45 : 1;

    if (!shaderEnabled) return <PortalFallbackSurface entry={entry} />;

    const nativeSurface = (
        <AnimatedLiquidGlassView
            providerId={providerId}
            cornerRadius={material.radius}
            blurRadius={material.blurRadius * qualityScale}
            refractionHeight={material.refractionHeight * qualityScale}
            refractionAmount={material.refractionAmount * qualityScale}
            bodyRefractionAmount={(material.refractionBodyAmount ?? 2.5) * qualityScale}
            interactionProgress={0}
            saturation={material.saturation}
            chromaticAberration={tokens.quality === 'high' || entry.variant === 'tabSelectionLens'
                ? material.chromaticAberration
                : 0}
            highlightAlpha={material.highlightAlpha}
            highlightWidth={material.highlightWidth}
            tintAlpha={material.tintAlpha ?? 1}
            specularStrength={material.specularStrength ?? 1}
            fresnelStrength={material.fresnelStrength ?? 0.85}
            innerShadowStrength={material.innerShadowStrength ?? 0.18}
            tint={dark ? tokens.tint.dark : tokens.tint.light}
            interactive={entry.interactive && tokens.interaction.enabled && !reducedMotion}
            continuous={entry.continuous}
            motionX={undefined}
            motionY={undefined}
            displacementOnlyDebug={entry.displacementOnlyDebug}
            animatedProps={animatedOptics}
            style={[
                styles.nativeSurface,
                entry.placement === 'layout'
                    ? StyleSheet.absoluteFillObject
                    : { width: entry.frame.width > 0 ? entry.frame.width : undefined },
                { borderRadius: material.radius },
            ]}
        >
            <View
                style={[
                    entry.placement === 'layout' ? styles.portalContentLayout : styles.portalContentWrap,
                    entry.contentStyle,
                    { borderRadius: material.radius },
                ]}
            >
                {entry.children}
            </View>
        </AnimatedLiquidGlassView>
    );

    if (entry.placement === 'bottom' || entry.placement === 'center') {
        return (
            <Animated.View
                pointerEvents="box-none"
                style={[
                    StyleSheet.absoluteFill,
                    entry.placement === 'center' ? styles.centerPlacement : styles.bottomPlacement,
                    entry.placement === 'bottom' && entry.bottomInset != null ? { paddingBottom: entry.bottomInset } : undefined,
                    entry.animatedStyle,
                    { zIndex: entry.zIndex },
                ]}
            >
                {nativeSurface}
            </Animated.View>
        );
    }

    return (
        <Animated.View
            pointerEvents="box-none"
            style={[
                styles.portalSurface,
                { left: entry.frame.x, top: entry.frame.y, width: entry.frame.width, height: entry.frame.height },
                entry.animatedStyle,
                { zIndex: entry.zIndex },
            ]}
        >
            {nativeSurface}
        </Animated.View>
    );
});

const PortalFallbackSurface = React.memo(function PortalFallbackSurface({ entry }: { entry: SurfaceEntry }) {
    const runtime = useContext(GlassRuntimeContext);
    if (!runtime) return null;
    const { tokens, dark } = runtime;
    const material = tokens.materials[entry.variant];
    const fallbackSurface = (
        <View
            style={[
                styles.fallbackSurface,
                entry.placement === 'layout'
                    ? StyleSheet.absoluteFillObject
                    : { width: entry.frame.width > 0 ? entry.frame.width : undefined },
                {
                    backgroundColor: dark ? tokens.fallbackTint.dark : tokens.fallbackTint.light,
                    borderColor: dark ? tokens.fallbackBorder.dark : tokens.fallbackBorder.light,
                    borderRadius: material.radius,
                },
            ]}
        >
            <View
                style={[
                    entry.placement === 'layout' ? styles.portalContentLayout : styles.portalContentWrap,
                    entry.contentStyle,
                    { borderRadius: material.radius },
                ]}
            >
                {entry.children}
            </View>
        </View>
    );

    if (entry.placement === 'bottom' || entry.placement === 'center') {
        return (
            <Animated.View
                pointerEvents="box-none"
                style={[
                    StyleSheet.absoluteFill,
                    entry.placement === 'center' ? styles.centerPlacement : styles.bottomPlacement,
                    entry.placement === 'bottom' && entry.bottomInset != null ? { paddingBottom: entry.bottomInset } : undefined,
                    entry.animatedStyle,
                    { zIndex: entry.zIndex },
                ]}
            >
                {fallbackSurface}
            </Animated.View>
        );
    }

    return (
        <Animated.View
            pointerEvents="box-none"
            style={[
                styles.portalSurface,
                { left: entry.frame.x, top: entry.frame.y, width: entry.frame.width, height: entry.frame.height },
                entry.animatedStyle,
                { zIndex: entry.zIndex },
            ]}
        >
            {fallbackSurface}
        </Animated.View>
    );
});

export interface GlassSurfaceProps {
    variant?: GlassVariant;
    /** Local stays in-tree; backdrop portals a live Android surface. Android defaults to backdrop. */
    renderMode?: 'local' | 'backdrop';
    pointerEvents?: ViewProps['pointerEvents'];
    interactive?: boolean;
    /** Request fresh backdrop frames while this surface is mounted. */
    continuous?: boolean;
    /** UI-thread optical morph shared with native AGSL uniforms. */
    opticalProgress?: SharedValue<number>;
    /** UI-thread horizontal velocity in dp/s, forwarded without React renders. */
    opticalMotionX?: SharedValue<number>;
    /** UI-thread vertical velocity in dp/s, forwarded without React renders. */
    opticalMotionY?: SharedValue<number>;
    /** Native material overrides, primarily used by the optical debug screen. */
    materialOverrides?: Partial<GlassMaterialTokens>;
    /** Show only the re-sampled backdrop, with tint and lighting removed. */
    displacementOnlyDebug?: boolean;
    style?: StyleProp<ViewStyle>;
    contentStyle?: StyleProp<ViewStyle>;
    animatedStyle?: AnimatedStyle<ViewStyle>;
    placement?: 'layout' | 'bottom' | 'center';
    bottomInset?: number;
    zIndex?: number;
    placeholderChildren?: React.ReactNode;
    children?: React.ReactNode;
}

/** Theme-driven glass material. Callers select a role; all optical settings live in AppTheme. */
export const GlassSurface = React.memo(function GlassSurface({
    variant = 'surface',
    renderMode,
    pointerEvents,
    interactive = false,
    continuous = false,
    opticalProgress,
    opticalMotionX,
    opticalMotionY,
    materialOverrides,
    displacementOnlyDebug = false,
    style,
    contentStyle,
    animatedStyle,
    placement = 'layout',
    bottomInset,
    zIndex = 1,
    children,
    placeholderChildren = children,
}: GlassSurfaceProps) {
    const runtime = useContext(GlassRuntimeContext);
    const host = useContext(GlassHostContext);
    const resolvedRenderMode = renderMode ?? (
        Platform.OS === 'android' && host && runtime?.tokens.quality !== 'fallback'
            ? 'backdrop'
            : 'local'
    );
    const id = useId();
    const viewRef = useRef<View>(null);
    const [frame, setFrame] = useState<SurfaceFrame | null>(null);

    const measure = useCallback(() => {
        const view = viewRef.current;
        const hostNode = host?.hostRef.current;
        if (!view || !hostNode) return;
        if (findNodeHandle(view) == null || findNodeHandle(hostNode) == null) return;

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

    const onLayout = useCallback((_event: LayoutChangeEvent) => measure(), [measure]);

    useEffect(() => () => host?.remove(id), [host, id]);

    useEffect(() => {
        if (!host) return;
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
        return <Animated.View style={[style, animatedStyle]}><View style={contentStyle}>{children}</View></Animated.View>;
    }

    if (resolvedRenderMode === 'local' || !host) {
        return (
            <LocalGlassSurface
                variant={variant}
                style={style}
                contentStyle={contentStyle}
                animatedStyle={animatedStyle}
                pointerEvents={pointerEvents}
            >
                {children}
            </LocalGlassSurface>
        );
    }

    return (
        <View
            ref={viewRef}
            collapsable={false}
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
            onLayout={onLayout}
            style={[style, styles.measureOnly]}
        >
            <View style={contentStyle}>{placeholderChildren}</View>
        </View>
    );
});

function LocalGlassSurface({
    variant,
    style,
    contentStyle,
    animatedStyle,
    pointerEvents,
    children,
}: Pick<GlassSurfaceProps, 'variant' | 'style' | 'contentStyle' | 'animatedStyle' | 'pointerEvents' | 'children'>) {
    const runtime = useContext(GlassRuntimeContext);
    if (!runtime?.tokens.enabled) return <Animated.View style={[style, animatedStyle]}><View style={contentStyle}>{children}</View></Animated.View>;
    const { tokens, dark } = runtime;
    const material: GlassMaterialTokens = tokens.materials[variant ?? 'surface'];
    const fallback = tokens.quality === 'fallback';
    return (
        <Animated.View
            pointerEvents={pointerEvents}
            style={[styles.localSurface, { borderRadius: material.radius, backgroundColor: 'transparent' }, style, animatedStyle]}
        >
            {fallback ? (
                <View
                    pointerEvents="none"
                    style={[
                        StyleSheet.absoluteFill,
                        {
                            backgroundColor: dark ? tokens.fallbackTint.dark : tokens.fallbackTint.light,
                            borderColor: dark ? tokens.fallbackBorder.dark : tokens.fallbackBorder.light,
                            borderWidth: StyleSheet.hairlineWidth,
                            borderRadius: material.radius,
                        },
                    ]}
                />
            ) : (
                <LocalGlassMaterial tokens={tokens} material={material} dark={dark} />
            )}
            <View style={[styles.localContent, contentStyle]}>{children}</View>
        </Animated.View>
    );
}

/** Full-screen overlay portal, used by sheets/dialogs so they sample the live app backdrop. */
export function GlassOverlay({ children, zIndex = 100 }: { children: React.ReactNode; zIndex?: number }) {
    const runtime = useContext(GlassRuntimeContext);
    const host = useContext(GlassHostContext);
    const id = useId();

    useEffect(() => () => host?.remove(id), [host, id]);
    useEffect(() => {
        if (runtime?.tokens.enabled && host) host.updateOverlay(id, { children, zIndex });
    }, [runtime?.tokens.enabled, host, id, children, zIndex]);

    if (!runtime?.tokens.enabled || !host) return <>{children}</>;
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

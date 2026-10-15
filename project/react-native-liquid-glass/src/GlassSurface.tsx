import React, { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { findNodeHandle, Platform, StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent, StyleProp, ViewProps, ViewStyle } from 'react-native';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import type { AnimatedStyle, SharedValue } from 'react-native-reanimated';
import { LocalGlassMaterial } from './LocalGlassMaterial';
import type { GlassSurfaceRole } from './surfaceRendererPolicy';
import { getGlassNativeEngine, subscribeGlassNativeEngine } from './glassNativeEngine';
import type { GlassNativeEngine } from './glassNativeEngine';
import { CoreGlassCaptureSource, CoreGlassSurfaceView, LegacyGlassCaptureSource, LegacyGlassSurfaceView } from './nativeGlassViews';
import type { GlassCaptureSourceProps, NativeGlassSurfaceProps } from './nativeGlassViews';
import type { GlassMaterialTokens, GlassTokens, GlassVariant } from './types';

type NativeBackdropSurfaceProps = NativeGlassSurfaceProps & {
    animatedProps?: Partial<Pick<NativeGlassSurfaceProps, 'interactionProgress' | 'motionX' | 'motionY'>>;
};

const AnimatedLegacyGlassSurfaceView = Animated.createAnimatedComponent(LegacyGlassSurfaceView) as unknown as React.ComponentType<NativeBackdropSurfaceProps>;
const AnimatedCoreGlassSurfaceView = CoreGlassSurfaceView
    ? Animated.createAnimatedComponent(CoreGlassSurfaceView) as unknown as React.ComponentType<NativeBackdropSurfaceProps>
    : null;

export interface GlassRuntime {
    tokens: GlassTokens;
    dark: boolean;
    reducedMotion: boolean;
}

const GlassRuntimeContext = createContext<GlassRuntime | null>(null);
const GlassCaptureSourceContext = createContext<string | null>(null);
const GlassNativeEngineContext = createContext<GlassNativeEngine>('legacy');

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

export type GlassSamplingSource = 'routeScene' | 'themeBackdrop';

interface SurfaceEntry {
    frame: SurfaceFrame;
    positioning: 'inFlow' | 'floating';
    variant: GlassVariant;
    samplingSource: GlassSamplingSource;
    interactive: boolean;
    continuous: boolean;
    opticalProgress?: SharedValue<number>;
    opticalMotionX?: SharedValue<number>;
    opticalMotionY?: SharedValue<number>;
    materialOverrides?: Partial<GlassMaterialTokens>;
    displacementOnlyDebug: boolean;
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

interface EntryRegistry<Entry> {
    getSnapshot: () => [string, Entry][];
    subscribe: (listener: () => void) => () => void;
    update: (id: string, entry: Entry, equals: (previous: Entry, next: Entry) => boolean) => void;
    remove: (id: string) => void;
}

function createEntryRegistry<Entry>(): EntryRegistry<Entry> {
    const entries = new Map<string, Entry>();
    const listeners = new Set<() => void>();
    let snapshot: [string, Entry][] = [];
    const publish = () => {
        snapshot = Array.from(entries.entries());
        for (const listener of listeners) listener();
    };
    return {
        getSnapshot: () => snapshot,
        subscribe: (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        update: (id, entry, equals) => {
            const previous = entries.get(id);
            if (previous !== undefined && equals(previous, entry)) return;
            entries.set(id, entry);
            publish();
        },
        remove: (id) => {
            if (!entries.delete(id)) return;
            publish();
        },
    };
}

function useRegistrySnapshot<Entry>(registry: EntryRegistry<Entry>) {
    return React.useSyncExternalStore(registry.subscribe, registry.getSnapshot, registry.getSnapshot);
}

function sameSurface(previous: SurfaceEntry, next: SurfaceEntry) {
    return previous.frame.x === next.frame.x && previous.frame.y === next.frame.y &&
        previous.frame.width === next.frame.width && previous.frame.height === next.frame.height &&
        previous.positioning === next.positioning && previous.samplingSource === next.samplingSource &&
        previous.variant === next.variant && previous.interactive === next.interactive && previous.continuous === next.continuous &&
        previous.opticalProgress === next.opticalProgress && previous.opticalMotionX === next.opticalMotionX && previous.opticalMotionY === next.opticalMotionY &&
        previous.materialOverrides === next.materialOverrides && previous.displacementOnlyDebug === next.displacementOnlyDebug &&
        previous.animatedStyle === next.animatedStyle && previous.placement === next.placement &&
        previous.bottomInset === next.bottomInset && previous.zIndex === next.zIndex;
}

function sameOverlay(previous: OverlayEntry, next: OverlayEntry) {
    return previous.children === next.children && previous.style === next.style && previous.zIndex === next.zIndex;
}

function selectBalancedShaderSurfaces(entries: [string, SurfaceEntry][]) {
    // Every mounted backdrop surface keeps the same renderer regardless of
    // quality preset; display cadence is selected by the native provider.
    return new Set(entries.map(([id]) => id));
}

interface GlassHostContextValue {
    providerId: string;
    themeBackdropProviderId: string;
    hostRef: React.RefObject<View | null>;
    updateSurface: (id: string, entry: SurfaceEntry) => void;
    remove: (id: string) => void;
}

const GlassHostContext = createContext<GlassHostContextValue | null>(null);

export function RouteGlassCaptureScope({ children }: { children: React.ReactNode }) {
    const host = useContext(GlassHostContext);
    const providerId = host ? `${host.providerId}:page-content` : null;
    return <GlassCaptureSourceContext.Provider value={providerId}>{children}</GlassCaptureSourceContext.Provider>;
}

export function RouteGlassCaptureSource({ children }: { children: React.ReactNode }) {
    const host = useContext(GlassHostContext);
    const runtime = useContext(GlassRuntimeContext);
    const providerId = useContext(GlassCaptureSourceContext);
    if (!host || !providerId || !runtime?.tokens.enabled) return <>{children}</>;
    return (
        <GlassCaptureSourceView
            providerId={providerId}
            underlayProviderId={host.themeBackdropProviderId}
            captureMode={Platform.OS === 'android' && getGlassNativeEngine() === 'core' ? 'oneShotPassThrough' : 'live'}
            pointerEvents="box-none"
            style={styles.captureSource}
        >
            {children}
        </GlassCaptureSourceView>
    );
}

function NativeBackdropSurface({
    opticsModel,
    sdfDisplacementMapDebug,
    sdfContrast,
    sdfBrightness,
    sdfSaturation,
    sdfOuterShadowAlpha,
    sdfOuterShadowBlurRadius,
    sdfOuterShadowOffsetY,
    sdfInnerShadowAlpha,
    sdfInnerShadowExtent,
    ...props
}: NativeBackdropSurfaceProps) {
    const nativeEngine = useContext(GlassNativeEngineContext);
    if (nativeEngine === 'core' && AnimatedCoreGlassSurfaceView) {
        return (
            <AnimatedCoreGlassSurfaceView
                {...props}
                opticsModel={opticsModel}
                sdfDisplacementMapDebug={sdfDisplacementMapDebug}
                sdfContrast={sdfContrast}
                sdfBrightness={sdfBrightness}
                sdfSaturation={sdfSaturation}
                sdfOuterShadowAlpha={sdfOuterShadowAlpha}
                sdfOuterShadowBlurRadius={sdfOuterShadowBlurRadius}
                sdfOuterShadowOffsetY={sdfOuterShadowOffsetY}
                sdfInnerShadowAlpha={sdfInnerShadowAlpha}
                sdfInnerShadowExtent={sdfInnerShadowExtent}
            />
        );
    }
    return <AnimatedLegacyGlassSurfaceView {...props} />;
}

function GlassCaptureSourceView({ children, ...props }: GlassCaptureSourceProps) {
    const nativeEngine = useContext(GlassNativeEngineContext);
    if (nativeEngine === 'core' && CoreGlassCaptureSource) {
        return <CoreGlassCaptureSource {...props}>{children}</CoreGlassCaptureSource>;
    }
    return <LegacyGlassCaptureSource {...props}>{children}</LegacyGlassCaptureSource>;
}

interface GlassOverlayHostContextValue {
    providerId: string;
    updateOverlay: (id: string, entry: OverlayEntry) => void;
    remove: (id: string) => void;
}

const GlassOverlayHostContext = createContext<GlassOverlayHostContextValue | null>(null);

/**
 * A route-scoped host for backdrop-mode surfaces. Theme capability controls
 * whether Glass surfaces exist; capture mode is controlled imperatively by
 * the native provider without changing the React surface tree.
 */
export interface GlassMaterialProviderProps {
    children: React.ReactNode;
    /** Scene layer recorded behind route content. When supplied, route views render as normal siblings. */
    backdrop?: React.ReactNode;
    /** Separate visible backdrop/source used by sheets and other stable overlays. */
    themeBackdrop?: React.ReactNode;
    /** Changes only when the theme backdrop image or palette itself changes. */
    themeBackdropRevision?: string;
    providerId?: string;
    style?: StyleProp<ViewStyle>;
    tokens: GlassTokens;
    dark: boolean;
    reducedMotion?: boolean;
}

/** Supplies preview optics without mounting another native backdrop recorder. */
export interface GlassAppearanceProviderProps {
    children: React.ReactNode;
    tokens: GlassTokens;
    dark: boolean;
    reducedMotion?: boolean;
}

export function GlassAppearanceProvider({ children, tokens, dark, reducedMotion = false }: GlassAppearanceProviderProps) {
    const runtime = useMemo(() => ({ tokens, dark, reducedMotion }), [tokens, dark, reducedMotion]);
    return <GlassRuntimeContext.Provider value={runtime}>{children}</GlassRuntimeContext.Provider>;
}

export function GlassMaterialProvider({ children, backdrop, themeBackdrop, themeBackdropRevision, providerId: providerIdProp, style, tokens, dark, reducedMotion = false }: GlassMaterialProviderProps) {
    const hostRef = useRef<View>(null);
    const generatedProviderId = useId();
    const providerId = providerIdProp ?? generatedProviderId;
    const themeBackdropProviderId = useId();
    const surfaceRegistryRef = useRef<EntryRegistry<SurfaceEntry> | null>(null);
    const overlayRegistryRef = useRef<EntryRegistry<OverlayEntry> | null>(null);
    if (!surfaceRegistryRef.current) surfaceRegistryRef.current = createEntryRegistry();
    if (!overlayRegistryRef.current) overlayRegistryRef.current = createEntryRegistry();
    const surfaceRegistry = surfaceRegistryRef.current;
    const overlayRegistry = overlayRegistryRef.current;
    const runtime = useMemo(() => ({ tokens, dark, reducedMotion }), [tokens, dark, reducedMotion]);
    const nativeEngine = useSyncExternalStore(subscribeGlassNativeEngine, getGlassNativeEngine, getGlassNativeEngine);

    const updateSurface = useCallback((id: string, entry: SurfaceEntry) => {
        surfaceRegistry.update(id, entry, sameSurface);
    }, [surfaceRegistry]);

    const updateOverlay = useCallback((id: string, entry: OverlayEntry) => {
        overlayRegistry.update(id, entry, sameOverlay);
    }, [overlayRegistry]);

    const remove = useCallback((id: string) => {
        surfaceRegistry.remove(id);
        overlayRegistry.remove(id);
    }, [surfaceRegistry, overlayRegistry]);

    const context = useMemo(() => ({ providerId, themeBackdropProviderId, hostRef, updateSurface, remove }), [providerId, themeBackdropProviderId, updateSurface, remove]);
    const overlayContext = useMemo(() => ({ providerId, updateOverlay, remove }), [providerId, updateOverlay, remove]);
    const hasSeparateBackdrop = backdrop !== undefined;

    return (
        <GlassNativeEngineContext.Provider value={nativeEngine}>
        <GlassRuntimeContext.Provider value={runtime}>
            <GlassHostContext.Provider value={context}>
            <GlassOverlayHostContext.Provider value={overlayContext}>
                <View ref={hostRef} collapsable={false} style={[styles.root, style]}>
                    {themeBackdrop !== undefined ? (
                        <GlassCaptureSourceView
                            providerId={themeBackdropProviderId}
                            captureMode="static"
                            sourceRevision={themeBackdropRevision}
                            pointerEvents="none"
                            style={StyleSheet.absoluteFill}
                        >
                            {themeBackdrop}
                        </GlassCaptureSourceView>
                    ) : null}
                    <GlassCaptureSourceView
                        providerId={providerId}
                        underlayProviderId={themeBackdrop !== undefined ? themeBackdropProviderId : undefined}
                        captureMode={tokens.enabled ? 'live' : 'frozen'}
                        style={StyleSheet.absoluteFill}
                    >
                        {hasSeparateBackdrop ? backdrop : children}
                    </GlassCaptureSourceView>
                    {hasSeparateBackdrop ? (
                        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
                            {children}
                        </View>
                    ) : null}
                    <GlassSurfacePortalLayer registry={surfaceRegistry} providerId={providerId} themeBackdropProviderId={themeBackdropProviderId} tokens={tokens} />
                    <GlassRouteOverlayLayer registry={overlayRegistry} enabled={tokens.enabled} />
                </View>
            </GlassOverlayHostContext.Provider>
            </GlassHostContext.Provider>
        </GlassRuntimeContext.Provider>
        </GlassNativeEngineContext.Provider>
    );
}

function GlassSurfacePortalLayer({ registry, providerId, themeBackdropProviderId, tokens }: { registry: EntryRegistry<SurfaceEntry>; providerId: string; themeBackdropProviderId: string; tokens: GlassTokens }) {
    const entries = useRegistrySnapshot(registry);
    const balancedShaderSurfaces = useMemo(() => selectBalancedShaderSurfaces(entries), [entries]);
    if (!tokens.enabled) return null;
    return (
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            {entries.map(([id, entry]) => (
                <PortalGlassSurface
                    key={id}
                    providerId={entry.samplingSource === 'themeBackdrop' ? themeBackdropProviderId : providerId}
                    entry={entry}
                    shaderEnabled={tokens.quality === 'high' || (tokens.quality === 'balanced' && balancedShaderSurfaces.has(id))}
                />
            ))}
        </View>
    );
}

function GlassRouteOverlayLayer({ registry, enabled }: { registry: EntryRegistry<OverlayEntry>; enabled: boolean }) {
    const entries = useRegistrySnapshot(registry);
    if (!enabled) return null;
    return (
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            {entries.map(([id, entry]) => <RouteOverlayView key={id} entry={entry} />)}
        </View>
    );
}

const RouteOverlayView = React.memo(function RouteOverlayView({ entry }: { entry: OverlayEntry }) {
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
        <NativeBackdropSurface
            providerId={providerId}
            opticsModel={material.opticsModel}
            sdfContrast={material.sdfScaleLens?.contrast}
            sdfBrightness={material.sdfScaleLens?.brightness}
            sdfSaturation={material.sdfScaleLens?.saturation}
            sdfOuterShadowAlpha={material.sdfScaleLens?.outerShadowAlpha}
            sdfOuterShadowBlurRadius={material.sdfScaleLens?.outerShadowBlurRadius}
            sdfOuterShadowOffsetY={material.sdfScaleLens?.outerShadowOffsetY}
            sdfInnerShadowAlpha={material.sdfScaleLens?.innerShadowAlpha}
            sdfInnerShadowExtent={material.sdfScaleLens?.innerShadowExtent}
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
        />
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
                entry.positioning === 'floating' ? entry.animatedStyle : undefined,
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
    /** Surface purpose used by the shared local renderer policy. */
    surfaceRole?: GlassSurfaceRole;
    /** Semantic placement role. The parent owns actual layout and coordinates. */
    positioning?: 'inFlow' | 'floating';
    /** Optical sampling source. Backdrop sampling is explicitly opt-in. */
    sampling?: 'local' | 'backdrop';
    /** Select live route content for bars or the stable ThemeBackdrop for sheets. */
    samplingSource?: GlassSamplingSource;
    /** Draw the optical backing in place beneath its ordinary route children. */
    inlineBackdrop?: boolean;
    /** Keep intrinsic content height for inline backdrops with no fixed parent height. */
    intrinsicInlineBackdrop?: boolean;
    /** @deprecated Use sampling; kept for source compatibility. */
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
    surfaceRole = 'staticGroup',
    positioning,
    sampling,
    samplingSource = 'routeScene',
    inlineBackdrop = false,
    intrinsicInlineBackdrop = false,
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
}: GlassSurfaceProps) {
    const runtime = useContext(GlassRuntimeContext);
    const host = useContext(GlassHostContext);
    const captureSourceProviderId = useContext(GlassCaptureSourceContext);
    const resolvedPositioning = positioning ?? (renderMode === 'backdrop' ? 'floating' : 'inFlow');
    const resolvedSampling = sampling ?? renderMode ?? (resolvedPositioning === 'floating' ? 'backdrop' : 'local');
    const resolvedRenderMode = runtime?.tokens.enabled && resolvedSampling === 'backdrop' && Platform.OS === 'android' && host && runtime.tokens.quality !== 'fallback'
        ? 'backdrop'
        : 'local';
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
        return <Animated.View style={[style, animatedStyle]}><View style={contentStyle}>{children}</View></Animated.View>;
    }

    if (resolvedRenderMode === 'local' || !host) {
        return (
            <LocalGlassSurface
                variant={variant}
                surfaceRole={surfaceRole}
                style={style}
                contentStyle={contentStyle}
                animatedStyle={animatedStyle}
                pointerEvents={pointerEvents}
            >
                {children}
            </LocalGlassSurface>
        );
    }

    if (inlineBackdrop) {
        return (
            <Animated.View pointerEvents={pointerEvents} style={[style, animatedStyle]}>
                <InlineBackdropSurface
                    providerId={samplingSource === 'themeBackdrop' ? host.themeBackdropProviderId : captureSourceProviderId ?? host.themeBackdropProviderId}
                    variant={variant}
                    interactive={interactive}
                    continuous={continuous}
                    opticalProgress={opticalProgress}
                    opticalMotionX={opticalMotionX}
                    opticalMotionY={opticalMotionY}
                    materialOverrides={materialOverrides}
                    displacementOnlyDebug={displacementOnlyDebug}
                    intrinsicLayout={intrinsicInlineBackdrop}
                    contentStyle={contentStyle}
                    placement={placement}
                >
                    {children}
                </InlineBackdropSurface>
            </Animated.View>
        );
    }

    return (
        <Animated.View
            ref={viewRef}
            collapsable={false}
            pointerEvents={pointerEvents}
            onLayout={onLayout}
            style={[style, animatedStyle, styles.measureOnly]}
        >
            <View style={[placement === 'layout' ? styles.portalContentLayout : styles.portalContentWrap, contentStyle]}>
                {children}
            </View>
        </Animated.View>
    );
});

const InlineBackdropSurface = React.memo(function InlineBackdropSurface({
    providerId,
    variant,
    interactive,
    continuous,
    opticalProgress,
    opticalMotionX,
    opticalMotionY,
    materialOverrides,
    displacementOnlyDebug,
    intrinsicLayout,
    contentStyle,
    placement,
    children,
}: {
    providerId: string;
    variant: GlassVariant;
    interactive: boolean;
    continuous: boolean;
    opticalProgress?: SharedValue<number>;
    opticalMotionX?: SharedValue<number>;
    opticalMotionY?: SharedValue<number>;
    materialOverrides?: Partial<GlassMaterialTokens>;
    displacementOnlyDebug: boolean;
    intrinsicLayout: boolean;
    contentStyle?: StyleProp<ViewStyle>;
    placement: 'layout' | 'bottom' | 'center';
    children?: React.ReactNode;
}) {
    const runtime = useContext(GlassRuntimeContext);
    const animatedOptics = useAnimatedProps(() => ({
        interactionProgress: opticalProgress?.value ?? 0,
        motionX: opticalMotionX ? Math.max(-1, Math.min(1, opticalMotionX.value / 1800)) : undefined,
        motionY: opticalMotionY ? Math.max(-1, Math.min(1, opticalMotionY.value / 1800)) : undefined,
    }), [opticalProgress, opticalMotionX, opticalMotionY]);
    if (!runtime) return <>{children}</>;
    const { tokens, dark, reducedMotion } = runtime;
    const material = materialOverrides
        ? { ...tokens.materials[variant], ...materialOverrides }
        : tokens.materials[variant];
    const qualityScale = tokens.quality === 'high' ? 1.2 : tokens.quality === 'fallback' ? 0.45 : 1;
    return (
        <View style={intrinsicLayout ? styles.inlineBackdropIntrinsicSurface : styles.inlineBackdropSurface}>
            <NativeBackdropSurface
                providerId={providerId}
                opticsModel={material.opticsModel}
                sdfContrast={material.sdfScaleLens?.contrast}
                sdfBrightness={material.sdfScaleLens?.brightness}
                sdfSaturation={material.sdfScaleLens?.saturation}
                sdfOuterShadowAlpha={material.sdfScaleLens?.outerShadowAlpha}
                sdfOuterShadowBlurRadius={material.sdfScaleLens?.outerShadowBlurRadius}
                sdfOuterShadowOffsetY={material.sdfScaleLens?.outerShadowOffsetY}
                sdfInnerShadowAlpha={material.sdfScaleLens?.innerShadowAlpha}
                sdfInnerShadowExtent={material.sdfScaleLens?.innerShadowExtent}
                cornerRadius={material.radius}
                blurRadius={material.blurRadius * qualityScale}
                refractionHeight={material.refractionHeight * qualityScale}
                refractionAmount={material.refractionAmount * qualityScale}
                bodyRefractionAmount={(material.refractionBodyAmount ?? 2.5) * qualityScale}
                interactionProgress={0}
                saturation={material.saturation}
                chromaticAberration={tokens.quality === 'high' || variant === 'tabSelectionLens' ? material.chromaticAberration : 0}
                highlightAlpha={material.highlightAlpha}
                highlightWidth={material.highlightWidth}
                tintAlpha={material.tintAlpha ?? 1}
                specularStrength={material.specularStrength ?? 1}
                fresnelStrength={material.fresnelStrength ?? 0.85}
                innerShadowStrength={material.innerShadowStrength ?? 0.18}
                tint={dark ? tokens.tint.dark : tokens.tint.light}
                interactive={interactive && tokens.interaction.enabled && !reducedMotion}
                continuous={continuous}
                displacementOnlyDebug={displacementOnlyDebug}
                animatedProps={animatedOptics}
                pointerEvents={interactive ? undefined : 'none'}
                style={[StyleSheet.absoluteFillObject, { borderRadius: material.radius }]}
            />
            <View style={[placement === 'layout' ? styles.portalContentLayout : styles.portalContentWrap, contentStyle]}>
                {children}
            </View>
        </View>
    );
});

function LocalGlassSurface({
    variant,
    surfaceRole,
    style,
    contentStyle,
    animatedStyle,
    pointerEvents,
    children,
}: Pick<GlassSurfaceProps, 'variant' | 'surfaceRole' | 'style' | 'contentStyle' | 'animatedStyle' | 'pointerEvents' | 'children'>) {
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
                <LocalGlassMaterial tokens={tokens} material={material} dark={dark} surfaceRole={surfaceRole} />
            )}
            <View style={[styles.localContent, contentStyle]}>{children}</View>
        </Animated.View>
    );
}

export function useGlassProviderId() {
    return useContext(GlassHostContext)?.providerId ?? null;
}

/** Route-level view overlay for sheets/dialogs; its children remain ordinary native views. */
export function GlassOverlay({ children, zIndex = 100 }: { children: React.ReactNode; zIndex?: number }) {
    const runtime = useContext(GlassRuntimeContext);
    const host = useContext(GlassOverlayHostContext);
    const id = useId();

    useEffect(() => () => host?.remove(id), [host, id]);
    useEffect(() => {
        if (!host) return;
        if (runtime?.tokens.enabled) host.updateOverlay(id, { children, zIndex });
        else host.remove(id);
    }, [runtime?.tokens.enabled, host, id, children, zIndex]);

    if (!runtime?.tokens.enabled || !host) return <>{children}</>;
    return null;
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    routeContent: { ...StyleSheet.absoluteFillObject },
    measureOnly: {},
    localSurface: { position: 'relative', overflow: 'hidden' },
    // In-flow local surfaces wrap their content by default. A default flex:1
    // makes controls inside a virtualized list header consume the viewport,
    // pushing the actual feed cells below the visible area. Callers that need
    // a filling surface opt into flex through contentStyle.
    localContent: { overflow: 'hidden' },
    portalSurface: { position: 'absolute', overflow: 'visible' },
    nativeSurface: { backgroundColor: 'transparent', overflow: 'hidden' },
    fallbackSurface: { backgroundColor: 'transparent', borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
    portalContentLayout: { flex: 1, overflow: 'hidden' },
    portalContentWrap: { flexGrow: 1, flexShrink: 1, overflow: 'hidden' },
    captureSource: { flex: 1 },
    inlineBackdropSurface: { flex: 1 },
    inlineBackdropIntrinsicSurface: { flexGrow: 1 },
    bottomPlacement: { alignItems: 'center', justifyContent: 'flex-end' },
    centerPlacement: { alignItems: 'center', justifyContent: 'center' },
});

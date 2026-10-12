import React from 'react';
import type { StyleProp, ViewProps, ViewStyle } from 'react-native';
import type { AnimatedStyle, SharedValue } from 'react-native-reanimated';
import type { GlassMaterialTokens, GlassTokens, GlassVariant } from './types';
export interface GlassRuntime {
    tokens: GlassTokens;
    dark: boolean;
    reducedMotion: boolean;
}
export declare function useGlassReducedMotion(): boolean;
export declare function useGlassAppearance(): GlassRuntime | null;
export type GlassSamplingSource = 'routeScene' | 'themeBackdrop';
export declare function RouteGlassCaptureScope({ children }: {
    children: React.ReactNode;
}): import("react/jsx-runtime").JSX.Element;
export declare function RouteGlassCaptureSource({ children }: {
    children: React.ReactNode;
}): import("react/jsx-runtime").JSX.Element;
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
export declare function GlassAppearanceProvider({ children, tokens, dark, reducedMotion }: GlassAppearanceProviderProps): import("react/jsx-runtime").JSX.Element;
export declare function GlassMaterialProvider({ children, backdrop, themeBackdrop, themeBackdropRevision, providerId: providerIdProp, style, tokens, dark, reducedMotion }: GlassMaterialProviderProps): import("react/jsx-runtime").JSX.Element;
export interface GlassSurfaceProps {
    variant?: GlassVariant;
    /** Surface purpose used by the shared local renderer policy. */
    surfaceRole?: import('./surfaceRendererPolicy').GlassSurfaceRole;
    /** Semantic placement role. The parent owns actual layout and coordinates. */
    positioning?: 'inFlow' | 'floating';
    /** Optical sampling source. Backdrop sampling is explicitly opt-in. */
    sampling?: 'local' | 'backdrop';
    /** Select live route content for bars or the stable ThemeBackdrop for sheets. */
    samplingSource?: GlassSamplingSource;
    /** Draw the optical backing in place beneath its ordinary route children. */
    inlineBackdrop?: boolean;
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
export declare const GlassSurface: React.NamedExoticComponent<GlassSurfaceProps>;
export declare function useGlassProviderId(): string | null;
/** Route-level view overlay for sheets/dialogs; its children remain ordinary native views. */
export declare function GlassOverlay({ children, zIndex }: {
    children: React.ReactNode;
    zIndex?: number;
}): import("react/jsx-runtime").JSX.Element | null;

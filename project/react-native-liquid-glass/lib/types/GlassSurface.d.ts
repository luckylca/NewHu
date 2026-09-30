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
/**
 * A route-scoped host for backdrop-mode surfaces. Keep this boundary mounted
 * while the route is alive: disabling the theme turns off Glass consumers but
 * preserves the React parent path for navigation screens and scroll state.
 * With no consumers, the native provider remains idle. Active surfaces use
 * display cadence up to the renderer's 120 Hz ceiling.
 */
export interface GlassMaterialProviderProps {
    children: React.ReactNode;
    /** Scene layer recorded behind route content. When supplied, route views render as normal siblings. */
    backdrop?: React.ReactNode;
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
export declare function GlassMaterialProvider({ children, backdrop, style, tokens, dark, reducedMotion }: GlassMaterialProviderProps): import("react/jsx-runtime").JSX.Element;
export interface GlassSurfaceProps {
    variant?: GlassVariant;
    /** Semantic placement role. The parent owns actual layout and coordinates. */
    positioning?: 'inFlow' | 'floating';
    /** Optical sampling source. Backdrop sampling is explicitly opt-in. */
    sampling?: 'local' | 'backdrop';
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
    /** Lightweight layout-only anchor for backdrop placement; never pass business children here. */
    placeholderChildren?: React.ReactNode;
    children?: React.ReactNode;
}
/** Theme-driven glass material. Callers select a role; all optical settings live in AppTheme. */
export declare const GlassSurface: React.NamedExoticComponent<GlassSurfaceProps>;
/** Full-screen overlay portal, used by sheets/dialogs so they sample the live app backdrop. */
export declare function GlassOverlay({ children, zIndex }: {
    children: React.ReactNode;
    zIndex?: number;
}): import("react/jsx-runtime").JSX.Element | null;

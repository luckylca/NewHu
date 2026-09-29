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
export declare function GlassMaterialProvider({ children, style, tokens, dark, reducedMotion }: GlassMaterialProviderProps): import("react/jsx-runtime").JSX.Element;
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
export declare const GlassSurface: React.NamedExoticComponent<GlassSurfaceProps>;
/** Full-screen overlay portal, used by sheets/dialogs so they sample the live app backdrop. */
export declare function GlassOverlay({ children, zIndex }: {
    children: React.ReactNode;
    zIndex?: number;
}): import("react/jsx-runtime").JSX.Element | null;

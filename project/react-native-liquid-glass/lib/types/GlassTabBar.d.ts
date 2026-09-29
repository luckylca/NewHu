import type { ReactNode } from 'react';
/** Extra scroll room below content: bar height + bottom gap + visual clearance. */
export declare const GLASS_TAB_BAR_CONTENT_INSET: number;
export interface GlassTabBarItem {
    label: string;
}
export interface GlassTabBarProps {
    items: GlassTabBarItem[];
    selected: number;
    bottomInset?: number;
    /** Render as a normal in-flow segmented selector instead of a screen overlay. */
    presentation?: 'floating' | 'inline';
    /** Geometry overrides used by inline selectors; omitted values keep the bottom bar defaults. */
    height?: number;
    width?: number | '100%';
    horizontalPadding?: number;
    shellRadius?: number;
    lensMaxWidth?: number;
    /** Optional per-instance optical rim width. Smaller values keep center content flatter. */
    lensRefractionHeight?: number;
    accessibilityHint?: string;
    /** Fully opaque fill behind the tab icons; the selected lens samples this local scene. */
    shellBackgroundColor?: string;
    onSelect: (index: number) => void;
    /** Drag selection commits at finger-up without entering the tap/double-tap path. */
    onSelectFromDrag?: (index: number) => void;
    renderIcon?: (item: GlassTabBarItem, index: number, selected: boolean) => ReactNode;
    /** Custom cell content; receives base/active states for continuous lens blending. */
    renderItem?: (item: GlassTabBarItem, index: number, selected: boolean) => ReactNode;
}
/**
 * One persistent cropped backdrop lens handles idle selection, long-press
 * inflation, drag deformation and snap. It is cached while still and requests
 * continuous cropped captures only during the active drag/settle phase.
 */
export declare function GlassTabBar({ items, selected, bottomInset, shellBackgroundColor, onSelect, onSelectFromDrag, renderIcon, renderItem, presentation, height, width: requestedWidth, horizontalPadding, shellRadius, lensMaxWidth, lensRefractionHeight, accessibilityHint, }: GlassTabBarProps): import("react/jsx-runtime").JSX.Element;

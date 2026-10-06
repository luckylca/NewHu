import { requireNativeViewManager } from 'expo-modules-core';
import React from 'react';
import { Platform, processColor } from 'react-native';
import { LiquidGlassProvider, LiquidGlassView } from 'liquid-glass-kit';
export const LegacyGlassSurfaceView = LiquidGlassView;
export const LegacyGlassCaptureSource = LiquidGlassProvider;
export const CoreGlassCaptureSource = Platform.OS === 'android'
    ? requireNativeViewManager('NewHuLiquidGlassCore', 'GlassCaptureSource')
    : null;
const CoreGlassSurfaceManager = Platform.OS === 'android'
    ? requireNativeViewManager('NewHuLiquidGlassCore', 'GlassSurface')
    : null;
export const CoreGlassSurfaceView = CoreGlassSurfaceManager
    ? React.forwardRef(function CoreGlassSurfaceView({ tint, ...props }, ref) {
        return React.createElement(CoreGlassSurfaceManager, {
            ref,
            ...props,
            tint: tint != null ? processColor(tint) ?? undefined : undefined,
        });
    })
    : null;
//# sourceMappingURL=nativeGlassViews.js.map
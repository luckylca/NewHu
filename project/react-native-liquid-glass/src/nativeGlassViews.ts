import { requireNativeViewManager } from 'expo-modules-core';
import React from 'react';
import { Platform, processColor } from 'react-native';
import type { ColorValue, View, ViewProps } from 'react-native';
import { LiquidGlassProvider, LiquidGlassView } from 'liquid-glass-kit';
import type { GlassOpticsModel } from './types';

export interface GlassCaptureSourceProps extends ViewProps {
    providerId: string;
    underlayProviderId?: string;
    captureMode?: 'live' | 'static' | 'oneShot' | 'oneShotPassThrough' | 'frozen';
    snapshotBlurRadiusDp?: number;
    sourceRevision?: string;
    children?: React.ReactNode;
}

export interface NativeGlassSurfaceProps extends ViewProps {
    providerId: string;
    opticsModel?: GlassOpticsModel;
    sdfContrast?: number;
    sdfBrightness?: number;
    sdfSaturation?: number;
    sdfOuterShadowAlpha?: number;
    sdfOuterShadowBlurRadius?: number;
    sdfOuterShadowOffsetY?: number;
    sdfInnerShadowAlpha?: number;
    sdfInnerShadowExtent?: number;
    cornerRadius?: number;
    blurRadius?: number;
    refractionHeight?: number;
    refractionAmount?: number;
    bodyRefractionAmount?: number;
    interactionProgress?: number;
    saturation?: number;
    tint?: ColorValue;
    tintAlpha?: number;
    chromaticAberration?: number;
    noiseAlpha?: number;
    highlightAlpha?: number;
    specularStrength?: number;
    fresnelStrength?: number;
    innerShadowStrength?: number;
    highlightWidth?: number;
    lightAngle?: number;
    interactive?: boolean;
    motionX?: number;
    motionY?: number;
    displacementOnlyDebug?: boolean;
    sdfDisplacementMapDebug?: boolean;
    continuous?: boolean;
}

type NativeGlassManagerProps = Omit<NativeGlassSurfaceProps, 'tint'> & {
    tint?: ReturnType<typeof processColor>;
};

export const LegacyGlassSurfaceView = LiquidGlassView as React.ComponentType<NativeGlassSurfaceProps>;
export const LegacyGlassCaptureSource = LiquidGlassProvider as React.ComponentType<GlassCaptureSourceProps>;
export const CoreGlassCaptureSource: React.ComponentType<GlassCaptureSourceProps> | null = Platform.OS === 'android'
    ? requireNativeViewManager<GlassCaptureSourceProps>('NewHuLiquidGlassCore', 'GlassCaptureSource')
    : null;
const CoreGlassSurfaceManager: React.ComponentType<NativeGlassManagerProps & React.RefAttributes<View>> | null = Platform.OS === 'android'
    ? requireNativeViewManager<NativeGlassManagerProps & React.RefAttributes<View>>('NewHuLiquidGlassCore', 'GlassSurface')
    : null;
export const CoreGlassSurfaceView = CoreGlassSurfaceManager
    ? React.forwardRef<View, NativeGlassSurfaceProps>(function CoreGlassSurfaceView({ tint, ...props }, ref) {
        return React.createElement(CoreGlassSurfaceManager, {
            ref,
            ...props,
            tint: tint != null ? processColor(tint) ?? undefined : undefined,
        });
    })
    : null;

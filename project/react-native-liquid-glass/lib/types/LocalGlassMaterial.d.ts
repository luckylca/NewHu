import React from 'react';
import type { GlassMaterialTokens, GlassTokens } from './types';
export type ResolvedLocalGlassMaterial = {
    baseTint: number[];
    accentTint: number[];
    highlightTint: number[];
    innerShade: number[];
    surfaceWarp: number;
    chromatic: number;
    highlightStrength: number;
    noiseStrength: number;
    materialOpacity: number;
    cornerRadiusPx: number;
};
export declare const LocalGlassMaterial: React.NamedExoticComponent<{
    tokens: GlassTokens;
    material: GlassMaterialTokens;
    dark: boolean;
}>;

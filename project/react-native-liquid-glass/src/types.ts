export type GlassVariant =
    | 'surface' | 'card' | 'bar' | 'tabBar' | 'tabBarShell'
    | 'tabSelectionIdle' | 'tabSelectionInteractive' | 'tabSelectionLens' | 'tabPreview'
    | 'floating' | 'sheet' | 'dialog' | 'control' | 'lens';
export type GlassQuality = 'high' | 'balanced' | 'fallback';

export interface GlassMaterialTokens {
    radius: number;
    /** Multiplies the local procedural material alpha; higher values make a lens denser than its shell. */
    opacity?: number;
    /** Optional role-specific accent hue for local glass, such as a selected lens. */
    accentTint?: { light: string; dark: string };
    blurRadius: number;
    refractionHeight: number;
    refractionAmount: number;
    /** Broad full-body SDF coordinate remapping in dp. */
    refractionBodyAmount?: number;
    saturation: number;
    chromaticAberration: number;
    highlightAlpha: number;
    highlightWidth: number;
    /** Multiplier for tint alpha on native backdrop materials. */
    tintAlpha?: number;
    /** Gain for the shader-computed specular and Fresnel responses. */
    specularStrength?: number;
    fresnelStrength?: number;
    /** Gain for the dark compression band immediately inside the rim. */
    innerShadowStrength?: number;
    shadowOpacity?: number;
    shadowRadius?: number;
    shadowOffsetY?: number;
    elevation?: number;
}

/** Runtime material configuration, supplied by the app's selected theme. */
export interface GlassTokens {
    enabled: boolean;
    quality: GlassQuality;
    wallpaperScrim: { light: string; dark: string };
    tint: { light: string; dark: string };
    fallbackTint: { light: string; dark: string };
    fallbackBorder: { light: string; dark: string };
    procedural: {
        baseTint: { light: string; dark: string };
        accentTint: { light: string; dark: string };
        highlightTint: { light: string; dark: string };
        innerShade: { light: string; dark: string };
        outerShadow: { light: string; dark: string };
        noiseStrength: number;
    };
    materials: Record<GlassVariant, GlassMaterialTokens>;
    interaction: { enabled: boolean };
}

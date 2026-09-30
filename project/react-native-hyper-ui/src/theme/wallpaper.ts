import type { AppTheme, ThemeWallpaperTokens } from './types';

export type WallpaperBlurLevel = 'off' | 'low' | 'medium' | 'high';

export const wallpaperConfig = {
    opacity: 0.75,
    base: {
        light: '#FAFAFC',
        dark: '#0A0A0C',
    },
    blurRadius: {
        off: 0,
        low: 10,
        medium: 25,
        high: 45,
    } satisfies Record<WallpaperBlurLevel, number>,
    scrim: {
        light: 'rgba(250,250,252,0.55)',
        dark: 'rgba(10,10,12,0.55)',
    },
} as const;

const base = { light: wallpaperConfig.base.light, dark: wallpaperConfig.base.dark };

const hyperosColors = {
    light: {
        background: 'transparent',
        surface: 'transparent',
        surfaceVariant: 'rgba(242,247,253,0.76)',
        surfaceContainer: 'rgba(248,251,255,0.88)',
        surfaceContainerHigh: 'rgba(234,241,249,0.84)',
        surfaceContainerHighest: 'rgba(221,232,243,0.92)',
        dividerLine: 'rgba(20,40,65,0.12)',
        outline: 'rgba(20,40,65,0.16)',
        card: 'rgba(248,251,255,0.88)',
        border: 'rgba(20,40,65,0.16)',
    },
    dark: {
        background: 'transparent',
        surface: 'transparent',
        surfaceVariant: 'rgba(29,38,53,0.78)',
        surfaceContainer: 'rgba(31,42,58,0.88)',
        surfaceContainerHigh: 'rgba(39,52,70,0.84)',
        surfaceContainerHighest: 'rgba(52,67,88,0.9)',
        dividerLine: 'rgba(255,255,255,0.14)',
        outline: 'rgba(255,255,255,0.2)',
        card: 'rgba(31,42,58,0.88)',
        border: 'rgba(255,255,255,0.2)',
    },
} satisfies ThemeWallpaperTokens['colors'];

export const hyperosWallpaperTokens: ThemeWallpaperTokens = {
    base,
    scrim: wallpaperConfig.scrim,
    defaultBackdrop: 'none',
    colors: hyperosColors,
};

/** Compatibility ColorOS values are kept explicit so this family can evolve independently. */
export const colorosWallpaperTokens: ThemeWallpaperTokens = {
    ...hyperosWallpaperTokens,
    colors: {
        light: { ...hyperosColors.light },
        dark: { ...hyperosColors.dark },
    },
};

export const liquidGlassWallpaperTokens: ThemeWallpaperTokens = {
    base,
    scrim: {
        light: 'rgba(235,242,251,0.28)',
        dark: 'rgba(16,23,34,0.32)',
    },
    defaultBackdrop: 'ambient',
    colors: {
        light: {
            ...hyperosColors.light,
            surfaceVariant: 'rgba(242,247,253,0.76)',
            surfaceContainer: 'rgba(248,251,255,0.88)',
            surfaceContainerHigh: 'rgba(234,241,249,0.84)',
            surfaceContainerHighest: 'rgba(221,232,243,0.92)',
        },
        dark: {
            ...hyperosColors.dark,
            surfaceVariant: 'rgba(29,38,53,0.78)',
            surfaceContainer: 'rgba(31,42,58,0.88)',
            surfaceContainerHigh: 'rgba(39,52,70,0.84)',
            surfaceContainerHighest: 'rgba(52,67,88,0.9)',
        },
    },
};

export function applyBackdropPresentation(theme: AppTheme, enabled: boolean): AppTheme {
    if (!enabled) return theme;
    const palette = theme.dark ? theme.wallpaper.colors.dark : theme.wallpaper.colors.light;
    return {
        ...theme,
        colors: { ...theme.colors, ...palette },
    };
}

export type BackdropSource = 'userWallpaper' | 'ambient' | 'themeColor';

/** User wallpaper takes precedence over a family's built-in theme backdrop. */
export function resolveBackdropSource(theme: AppTheme, hasUserWallpaper: boolean): BackdropSource {
    if (hasUserWallpaper) return 'userWallpaper';
    return theme.wallpaper.defaultBackdrop === 'ambient' ? 'ambient' : 'themeColor';
}

export function getWallpaperBlurRadius(level: WallpaperBlurLevel) {
    return wallpaperConfig.blurRadius[level];
}

export function getWallpaperScrim(dark: boolean) {
    return dark ? wallpaperConfig.scrim.dark : wallpaperConfig.scrim.light;
}

export function getWallpaperBase(dark: boolean) {
    return dark ? wallpaperConfig.base.dark : wallpaperConfig.base.light;
}

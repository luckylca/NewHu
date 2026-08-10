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

export function getWallpaperBlurRadius(level: WallpaperBlurLevel) {
    return wallpaperConfig.blurRadius[level];
}

export function getWallpaperScrim(dark: boolean) {
    return dark ? wallpaperConfig.scrim.dark : wallpaperConfig.scrim.light;
}

export function getWallpaperBase(dark: boolean) {
    return dark ? wallpaperConfig.base.dark : wallpaperConfig.base.light;
}

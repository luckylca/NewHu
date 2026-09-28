import {
    colorosDarkTheme,
    colorosLightTheme,
    hyperosDarkTheme,
    hyperosLightTheme,
    liquidGlassDarkTheme,
    liquidGlassLightTheme,
    type AppTheme,
} from '@/src/ui/theme';
import { useSettingStore } from '@/src/stores/useSettingStore';
import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

/** Resolve theme family, appearance, and wallpaper presentation independently. */
export const useAppTheme = (): AppTheme => {
    const systemColorScheme = useColorScheme();
    const themeName = useSettingStore((state) => state.themeName);
    const followSystemTheme = useSettingStore((state) => state.followSystemTheme);
    const isDarkMode = useSettingStore((state) => state.isDarkMode);
    const wallpaperUri = useSettingStore((state) => state.wallpaperUri);

    return useMemo(() => {
        const dark = followSystemTheme ? systemColorScheme === 'dark' : isDarkMode;
        const baseTheme = themeName === 'liquidGlass'
            ? dark ? liquidGlassDarkTheme : liquidGlassLightTheme
            : themeName === 'coloros'
                ? dark ? colorosDarkTheme : colorosLightTheme
                : dark ? hyperosDarkTheme : hyperosLightTheme;

        if (!wallpaperUri) return baseTheme;

        const translucentSurfaces = dark
            ? {
                surface: 'transparent',
                surfaceVariant: 'rgba(29,38,53,0.78)',
                surfaceContainer: 'rgba(31,42,58,0.88)',
                surfaceContainerHigh: 'rgba(39,52,70,0.84)',
                surfaceContainerHighest: 'rgba(52,67,88,0.9)',
                dividerLine: 'rgba(255,255,255,0.14)',
                outline: 'rgba(255,255,255,0.2)',
            }
            : {
                surface: 'transparent',
                surfaceVariant: 'rgba(242,247,253,0.76)',
                surfaceContainer: 'rgba(248,251,255,0.88)',
                surfaceContainerHigh: 'rgba(234,241,249,0.84)',
                surfaceContainerHighest: 'rgba(221,232,243,0.92)',
                dividerLine: 'rgba(20,40,65,0.12)',
                outline: 'rgba(20,40,65,0.16)',
            };

        return {
            ...baseTheme,
            colors: {
                ...baseTheme.colors,
                ...translucentSurfaces,
                background: 'transparent',
                card: translucentSurfaces.surfaceContainer,
                border: translucentSurfaces.outline,
            },
        };
    }, [themeName, followSystemTheme, systemColorScheme, isDarkMode, wallpaperUri]);
};

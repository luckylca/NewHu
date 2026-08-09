import { hyperosDarkTheme, hyperosLightTheme, type AppTheme } from '@/src/ui/theme';
import { useSettingStore } from '@/src/stores/useSettingStore';
import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

/**
 * Resolve the current Design System (HyperOS) theme from the settings store
 * (followSystemTheme / isDarkMode) + OS scheme, returning the miuix AppTheme
 * consumed by the Design System provider (`@/src/ui/theme`).
 *
 * Should be called once in _layout as the value of the Design System provider.
 */
export const useHyperosTheme = (): AppTheme => {
    const systemColorScheme = useColorScheme();
    const followSystemTheme = useSettingStore((state) => state.followSystemTheme);
    const isDarkMode = useSettingStore((state) => state.isDarkMode);
    const wallpaperUri = useSettingStore((state) => state.wallpaperUri);

    return useMemo(() => {
        const shouldUseDarkMode = followSystemTheme ? systemColorScheme === 'dark' : isDarkMode;
        const baseTheme = shouldUseDarkMode ? hyperosDarkTheme : hyperosLightTheme;

        if (!wallpaperUri) return baseTheme;

        const translucentSurfaces = shouldUseDarkMode
            ? {
                surface: 'rgba(0,0,0,0.64)',
                surfaceVariant: 'rgba(30,30,30,0.72)',
                surfaceContainer: 'rgba(28,28,28,0.82)',
                surfaceContainerHigh: 'rgba(36,36,36,0.78)',
                surfaceContainerHighest: 'rgba(45,45,45,0.88)',
                dividerLine: 'rgba(255,255,255,0.13)',
                outline: 'rgba(255,255,255,0.18)',
            }
            : {
                surface: 'rgba(247,247,247,0.68)',
                surfaceVariant: 'rgba(255,255,255,0.72)',
                surfaceContainer: 'rgba(255,255,255,0.84)',
                surfaceContainerHigh: 'rgba(238,238,238,0.78)',
                surfaceContainerHighest: 'rgba(245,245,245,0.90)',
                dividerLine: 'rgba(0,0,0,0.10)',
                outline: 'rgba(0,0,0,0.14)',
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
    }, [followSystemTheme, systemColorScheme, isDarkMode, wallpaperUri]);
};

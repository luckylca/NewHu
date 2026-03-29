import { AppDarkTheme, AppLightTheme } from '@/src/constants/theme';
import { useSettingStore } from '@/src/stores/useSettingStore';
import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

export const useAppTheme = () => {
    const systemColorScheme = useColorScheme();
    const followSystemTheme = useSettingStore(state => state.followSystemTheme);
    const isDarkMode = useSettingStore(state => state.isDarkMode);
    const themeColor = useSettingStore(state => state.themeColor);

    return useMemo(() => {
        const shouldUseDarkMode = followSystemTheme ? systemColorScheme === 'dark' : isDarkMode;
        const baseTheme = shouldUseDarkMode ? AppDarkTheme : AppLightTheme;

        // 1. 处理颜色适配
        const adaptedColors = {
            ...baseTheme.colors,
            primary: themeColor,
            card: baseTheme.colors.surface,
            text: baseTheme.colors.onSurface,
            border: baseTheme.colors.outline,
            notification: baseTheme.colors.error,
            background: baseTheme.colors.background,
        };

        // 2. 处理字体适配 (关键修复)
        // 映射 Paper 的字体到 Navigation 所需的简单格式
        const adaptedFonts = {
            ...baseTheme.fonts, // 保留 MD3 的字体
            regular: baseTheme.fonts.bodyMedium,
            medium: baseTheme.fonts.labelLarge,
            bold: baseTheme.fonts.titleMedium,
            heavy: baseTheme.fonts.headlineSmall,
        };

        return {
            ...baseTheme,
            colors: adaptedColors,
            fonts: adaptedFonts,
            animation: {
                ...baseTheme.animation,
                scale: 1.0, // 确保动画比例为 1，找回 Menu 的淡入淡出
            },
        };
    }, [followSystemTheme, systemColorScheme, isDarkMode, themeColor]);
};
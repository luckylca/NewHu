import { useMemo } from 'react';
import { useSettingStore } from '@/src/stores/useSettingStore';
import { AppLightTheme, AppDarkTheme } from '@/src/constants/theme';
import { Theme } from '@react-navigation/native';

export const useAppTheme = () => {
    const isDarkMode = useSettingStore(state => state.isDarkMode);
    const themeColor = useSettingStore(state => state.themeColor);
    const backgroundImage = useSettingStore(state => state.backgroundImage);

    return useMemo(() => {
        const baseTheme = isDarkMode ? AppDarkTheme : AppLightTheme;

        // 1. 处理颜色适配
        const adaptedColors = {
            ...baseTheme.colors,
            primary: themeColor,
            card: baseTheme.colors.surface,
            text: baseTheme.colors.onSurface,
            border: baseTheme.colors.outline,
            notification: baseTheme.colors.error,
            background: backgroundImage ? 'transparent' : baseTheme.colors.background,
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
        };
    }, [isDarkMode, themeColor, backgroundImage]);
};
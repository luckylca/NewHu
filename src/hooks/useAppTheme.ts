import { darkTheme, lightTheme, type AppTheme } from '@/src/constants/theme';
import { useSettingStore } from '@/src/stores/useSettingStore';
import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

/**
 * 计算当前应用主题（亮/暗）。
 * 色板里已包含 React Navigation 需要的 card/text/border/notification，
 * 可直接作为导航主题使用。
 * 只应在 _layout 里调用一次作为 ThemeProvider 的 value；
 * 组件统一通过 useTheme()（@/src/theme/ThemeProvider）读取。
 */
export const useAppTheme = (): AppTheme => {
    const systemColorScheme = useColorScheme();
    const followSystemTheme = useSettingStore((state) => state.followSystemTheme);
    const isDarkMode = useSettingStore((state) => state.isDarkMode);

    return useMemo(() => {
        const shouldUseDarkMode = followSystemTheme ? systemColorScheme === 'dark' : isDarkMode;
        return shouldUseDarkMode ? darkTheme : lightTheme;
    }, [followSystemTheme, systemColorScheme, isDarkMode]);
};

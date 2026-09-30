import { applyBackdropPresentation, resolveBackdropSource, resolveBaseTheme, type AppTheme } from '../../project/react-native-hyper-ui/src/theme';
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
        const baseTheme = resolveBaseTheme(themeName, dark);
        const backdropSource = resolveBackdropSource(baseTheme, Boolean(wallpaperUri));
        const hasBackdrop = backdropSource === 'userWallpaper' || backdropSource === 'ambient';
        return applyBackdropPresentation(baseTheme, hasBackdrop);
    }, [themeName, followSystemTheme, systemColorScheme, isDarkMode, wallpaperUri]);
};

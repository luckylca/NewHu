import { useSettingStore } from '@/src/stores/useSettingStore';
import { resolveBackdropSource, useTheme } from '@/src/ui/theme';
import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { DefaultAmbientBackdrop } from './DefaultAmbientBackdrop';
import { WallpaperLayer } from './WallpaperLayer';

/** The single route-level owner for user wallpaper, Liquid Glass ambient, and theme color. */
export const ThemeBackdrop = memo(function ThemeBackdrop({ simpleBackground = false }: { simpleBackground?: boolean }) {
    const theme = useTheme();
    const hasWallpaper = useSettingStore((state) => Boolean(state.wallpaperUri));
    const source = resolveBackdropSource(theme, hasWallpaper);

    if (simpleBackground) {
        return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.background }]} />;
    }

    if (source === 'userWallpaper') {
        return (
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                <WallpaperLayer />
                <View
                    style={[
                        StyleSheet.absoluteFill,
                        { backgroundColor: theme.dark ? theme.wallpaper.scrim.dark : theme.wallpaper.scrim.light },
                    ]}
                />
            </View>
        );
    }

    if (source === 'ambient') return <DefaultAmbientBackdrop dark={theme.dark} />;

    return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.background }]} />;
});

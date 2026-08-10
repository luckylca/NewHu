import { useSettingStore } from '@/src/stores/useSettingStore';
import { getWallpaperBase, getWallpaperScrim } from '@/src/ui/theme/wallpaper';
import { useTheme } from '@/src/ui/theme';
import React, { memo } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { WallpaperLayer } from './WallpaperLayer';

const ThemeScrim = memo(function ThemeScrim() {
    const theme = useTheme();
    const hasWallpaper = useSettingStore((state) => Boolean(state.wallpaperUri));

    if (!hasWallpaper) return null;

    return (
        <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: getWallpaperScrim(theme.dark) }]}
        />
    );
});

export function AppBackground({ children }: { children: ReactNode }) {
    const theme = useTheme();

    return (
        <View style={[styles.root, { backgroundColor: getWallpaperBase(theme.dark) }]}>
            <WallpaperLayer />
            <ThemeScrim />
            <View style={styles.content}>{children}</View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    content: {
        flex: 1,
    },
});

import { useSettingStore } from '@/src/stores/useSettingStore';
import { getWallpaperBase, getWallpaperScrim } from '@/src/ui/theme/wallpaper';
import { GlassMaterialProvider } from '@newhu/react-native-liquid-glass';
import { useTheme } from '@/src/ui/theme';
import { useReducedMotionPreference } from '@/src/ui/motion';
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
            style={[StyleSheet.absoluteFill, { backgroundColor: theme.glass.enabled
                ? theme.dark ? theme.glass.wallpaperScrim.dark : theme.glass.wallpaperScrim.light
                : getWallpaperScrim(theme.dark) }]}
        />
    );
});

export function AppBackground({ children, glassBackdrop = false }: { children: ReactNode; glassBackdrop?: boolean }) {
    const theme = useTheme();
    const reducedMotion = useReducedMotionPreference();
    const hasWallpaper = useSettingStore((state) => Boolean(state.wallpaperUri));
    const baseColor = theme.glass.enabled
        ? hasWallpaper ? getWallpaperBase(theme.dark) : theme.colors.background
        : getWallpaperBase(theme.dark);

    const scene = (
        <>
            <WallpaperLayer />
            <ThemeScrim />
            <View style={styles.content}>{children}</View>
        </>
    );

    return (
        <View style={[styles.root, { backgroundColor: baseColor }]}>
            {glassBackdrop && theme.glass.enabled
                ? <GlassMaterialProvider tokens={theme.glass} dark={theme.dark} reducedMotion={reducedMotion}>{scene}</GlassMaterialProvider>
                : scene}
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

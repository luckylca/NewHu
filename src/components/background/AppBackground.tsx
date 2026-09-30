import { useSettingStore } from '@/src/stores/useSettingStore';
import { GlassMaterialProvider } from '@newhu/react-native-liquid-glass';
import { resolveBackdropSource, useTheme } from '@/src/ui/theme';
import { useReducedMotionPreference } from '@/src/ui/motion';
import React, { memo } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { DefaultAmbientBackdrop } from './DefaultAmbientBackdrop';
import { WallpaperLayer } from './WallpaperLayer';

const ThemeScrim = memo(function ThemeScrim() {
    const theme = useTheme();
    const hasWallpaper = useSettingStore((state) => Boolean(state.wallpaperUri));

    if (!hasWallpaper) return null;

    return (
        <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: theme.dark ? theme.wallpaper.scrim.dark : theme.wallpaper.scrim.light }]}
        />
    );
});

export function AppBackground({ children, glassBackdrop = false }: { children: ReactNode; glassBackdrop?: boolean }) {
    const theme = useTheme();
    const reducedMotion = useReducedMotionPreference();
    // Keep the provider in the same place in the route tree while a Stack
    // screen loses focus. Removing it re-parents every screen child and resets
    // PagerView state (including the selected main tab) on Back.
    const routeGlassTokens = React.useMemo(
        () => ({ ...theme.glass, enabled: theme.glass.enabled && glassBackdrop }),
        [theme.glass, glassBackdrop],
    );
    const hasWallpaper = useSettingStore((state) => Boolean(state.wallpaperUri));
    const showAmbientBackdrop = resolveBackdropSource(theme, hasWallpaper) === 'ambient';
    const baseColor = hasWallpaper
        ? (theme.dark ? theme.wallpaper.base.dark : theme.wallpaper.base.light)
        : theme.colors.background;

    const backdrop = (
        <>
            <WallpaperLayer />
            {showAmbientBackdrop ? <DefaultAmbientBackdrop dark={theme.dark} /> : null}
            <ThemeScrim />
        </>
    );
    // Keep the route's backdrop and its business content in one capture source.
    // GlassMaterialProvider still portals functional glass surfaces above this
    // scene, while its native source remains scoped to this route only.
    const scene = (
        <View style={styles.scene}>
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>{backdrop}</View>
            <View style={styles.content}>{children}</View>
        </View>
    );

    return (
        <View style={[styles.root, { backgroundColor: baseColor }]}>
            <GlassMaterialProvider tokens={routeGlassTokens} dark={theme.dark} reducedMotion={reducedMotion}>
                {scene}
            </GlassMaterialProvider>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    scene: {
        flex: 1,
    },
    content: {
        flex: 1,
    },
});

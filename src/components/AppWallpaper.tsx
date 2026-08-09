import { useSettingStore } from '@/src/stores/useSettingStore';
import { useTheme } from '@/src/ui/theme';
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

/** App-wide wallpaper layer. Pages and navigation scenes render above it. */
export function AppWallpaper() {
    const theme = useTheme();
    const uri = useSettingStore((state) => state.wallpaperUri);
    const opacity = useSettingStore((state) => state.wallpaperOpacity);
    const blurRadius = useSettingStore((state) => state.wallpaperBlur);

    return (
        <View
            pointerEvents="none"
            style={[
                StyleSheet.absoluteFill,
                { backgroundColor: theme.dark ? '#242424' : '#FFFFFF' },
            ]}
        >
            {uri ? (
                <>
                    <Image
                        source={{ uri }}
                        resizeMode="cover"
                        blurRadius={blurRadius}
                        style={[StyleSheet.absoluteFill, { opacity }]}
                    />
                    <View
                        style={[
                            StyleSheet.absoluteFill,
                            {
                                backgroundColor: theme.dark
                                    ? 'rgba(0,0,0,0.26)'
                                    : 'rgba(255,255,255,0.12)',
                            },
                        ]}
                    />
                </>
            ) : null}
        </View>
    );
}

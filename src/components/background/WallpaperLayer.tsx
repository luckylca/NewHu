import { useSettingStore } from '@/src/stores/useSettingStore';
import { getWallpaperBlurRadius, wallpaperConfig } from '@/src/ui/theme/wallpaper';
import React, { memo } from 'react';
import { Image, StyleSheet, View } from 'react-native';

export const WallpaperLayer = memo(function WallpaperLayer() {
    const uri = useSettingStore((state) => state.wallpaperUri);
    const blurLevel = useSettingStore((state) => state.wallpaperBlurLevel);

    if (!uri) return null;

    return (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Image
                source={{ uri }}
                resizeMode="cover"
                blurRadius={getWallpaperBlurRadius(blurLevel)}
                style={[StyleSheet.absoluteFill, { opacity: wallpaperConfig.opacity }]}
            />
        </View>
    );
});

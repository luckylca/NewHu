import { GlassMaterialProvider } from '@newhu/react-native-liquid-glass';
import { useTheme } from '@/src/ui/theme';
import { useReducedMotionPreference } from '@/src/ui/motion';
import { useSettingStore } from '@/src/stores/useSettingStore';
import React from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemeBackdrop } from './ThemeBackdrop';

export function AppBackground({ children, providerId, settingsBenchCase }: { children: ReactNode; providerId: string; settingsBenchCase?: string }) {
    const theme = useTheme();
    const reducedMotion = useReducedMotionPreference();
    const wallpaperUri = useSettingStore((state) => state.wallpaperUri);
    const themeBackdropRevision = JSON.stringify([theme.name, theme.dark, wallpaperUri]);
    return (
        <View style={[styles.root, { backgroundColor: 'transparent' }]}>
            <GlassMaterialProvider
                tokens={theme.glass}
                dark={theme.dark}
                reducedMotion={reducedMotion}
                providerId={providerId}
                themeBackdrop={<ThemeBackdrop simpleBackground={settingsBenchCase === 'D'} />}
                themeBackdropRevision={themeBackdropRevision}
            >
                {children}
            </GlassMaterialProvider>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
});

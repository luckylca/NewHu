import React, { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import type { StyleProp, ViewStyle } from 'react-native';
import { GlassSurface, useGlassReducedMotion } from './GlassSurface';

export interface GlassTabLensProps {
    visible: boolean;
    label: string;
    icon: ReactNode;
    labelColor: string;
    style?: StyleProp<ViewStyle>;
}

const ENTER_SPRING = { damping: 19, stiffness: 340, mass: 0.62 };

/** Standalone preview surface for callers that need one; GlassTabBar uses its selection lens instead. */
export function GlassTabLens({ visible, label, icon, labelColor, style }: GlassTabLensProps) {
    const reducedMotion = useGlassReducedMotion();
    const [mounted, setMounted] = useState(visible);
    const opacity = useSharedValue(visible ? 1 : 0);
    const scale = useSharedValue(visible ? 1 : 0.78);

    useEffect(() => {
        if (visible) {
            setMounted(true);
            if (reducedMotion) {
                opacity.value = 1;
                scale.value = 1;
            } else {
                opacity.value = withTiming(1, { duration: 110 });
                scale.value = withSpring(1, ENTER_SPRING);
            }
            return;
        }

        if (!mounted) return;
        if (reducedMotion) {
            opacity.value = 0;
            scale.value = 0.84;
            setMounted(false);
            return;
        }
        opacity.value = withTiming(0, { duration: 130 });
        scale.value = withTiming(0.84, { duration: 130 }, (finished) => {
            if (finished) runOnJS(setMounted)(false);
        });
    }, [mounted, opacity, reducedMotion, scale, visible]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ scale: scale.value }, { translateY: (1 - scale.value) * 8 }],
    }), []);

    if (!mounted) return null;

    return (
        <GlassSurface
            variant="lens"
            positioning="floating"
            sampling="backdrop"
            interactive
            style={[styles.surface, style]}
            animatedStyle={animatedStyle}
            placeholderChildren={<View style={styles.placeholder} />}
            zIndex={320}
        >
            <View style={styles.content}>
                <View style={styles.icon}>{icon}</View>
                <Text numberOfLines={1} style={[styles.label, { color: labelColor }]}>{label}</Text>
            </View>
        </GlassSurface>
    );
}

const styles = StyleSheet.create({
    surface: {
        width: 82,
        height: 82,
    },
    placeholder: { width: 82, height: 82 },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 8,
        gap: 4,
    },
    icon: { alignItems: 'center', justifyContent: 'center', height: 34 },
    label: { maxWidth: 66, fontSize: 11, fontWeight: '600', includeFontPadding: false },
});

import React from 'react';
import { StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { pressIndication } from '../motion';

export interface PressIndicationProps {
    /** 1 while pressed, 0 otherwise. */
    pressed: SharedValue<number>;
    /** Overlay color; use theme.colors.onBackground. */
    color: string;
    /** Corner radius — defaults to the parent's own radius (set explicitly when
     *  the overlay is inside a rounded parent, since it is absolute-filled). */
    radius?: number;
    style?: StyleProp<ViewStyle>;
}

/**
 * MiuixIndication alpha overlay — the standard press feedback.
 *
 * Visual reference:
 *   miuix-vue/src/components/basic-component/BasicComponent.vue (::after overlay)
 *
 * Mobile behavior (task §23): normal 0, pressed 0.10, animated 120ms linear.
 * Web adds hover 0.06 / focus 0.08 additively — mobile keeps press only.
 *
 * Implemented as an absolute-filled overlay View (RN has no ::after).
 */
export function PressIndication({ pressed, color, radius, style }: PressIndicationProps) {
    const animatedStyle = useAnimatedStyle(() => ({
        opacity: withTiming(pressed.value * 0.1, { duration: pressIndication.duration, easing: pressIndication.easing }),
    }));

    return (
        <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: color }, radius != null ? { borderRadius: radius } : undefined, animatedStyle, style]}
        />
    );
}

import React from 'react';
import type { ReactNode } from 'react';
import { Pressable } from 'react-native';
import type { PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import type { WithSpringConfig } from 'react-native-reanimated';
import { cardSink } from '../motion';

export interface PressableScaleProps extends PressableProps {
    /** Scale while pressed. */
    scale?: number;
    /** Spring config; defaults to Card sink folmeSpring(0.8, 600). */
    springConfig?: WithSpringConfig;
    children?: ReactNode;
    style?: StyleProp<ViewStyle>;
}

/**
 * Pressable that scales down while pressed with a folme spring.
 *
 * ⚠️ Use ONLY where the Miuix reference specifies a scale press feedback
 * (Card sink, Switch / Slider thumb). Do not wire this globally — Miuix
 * buttons and list rows use the alpha overlay (PressIndication), not scale.
 */
export function PressableScale({ scale = 0.94, springConfig = cardSink, onPressIn, onPressOut, disabled, style, children, ...rest }: PressableScaleProps) {
    const pressed = useSharedValue(0);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: withSpring(pressed.value === 1 ? scale : 1, springConfig) }],
    }));

    return (
        <Pressable
            {...rest}
            disabled={disabled}
            onPressIn={(e) => {
                if (!disabled) pressed.value = 1;
                onPressIn?.(e);
            }}
            onPressOut={(e) => {
                pressed.value = 0;
                onPressOut?.(e);
            }}
        >
            <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
        </Pressable>
    );
}

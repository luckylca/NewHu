import { PressIndication } from '@/src/ui/primitives';
import { cardSink, cardTilt } from '@/src/ui/motion';
import { useReducedMotionPreference } from '@/src/ui/motion/MotionProvider';
import { useTheme } from '@/src/ui/theme';
import React, { useCallback, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable } from 'react-native';
import type { GestureResponderEvent, LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, useSharedValue, withSpring } from 'react-native-reanimated';

/**
 * Design System Card.
 *
 * Visual reference:
 *   miuix-vue/src/components/card/Card.vue (Card.kt + PressFeedback.kt)
 *
 * radius 16, bg surfaceContainer, content onSurfaceContainer, overflow hidden.
 * Feedback:
 *   none — inert container.
 *   sink — scale 1.0 → 0.94, folmeSpring(0.8, 600).
 *   tilt — rotateX/Y ±5.3°, folmeSpring(0.6, 400), pivot follows the touch
 *          quadrant (perspective ≈ width × 1.6).
 * Long-press after 500ms emits onLongPress and swallows the following click.
 * No default heavy shadow.
 */

export type CardFeedback = 'none' | 'sink' | 'tilt';

export interface AppCardProps {
    feedback?: CardFeedback;
    /** Draw the MiuixIndication alpha overlay on press. */
    showIndication?: boolean;
    /** Latch the press feedback on (e.g. while a long-press dialog is open). */
    holdDown?: boolean;
    onPress?: () => void;
    onPressIn?: () => void;
    onLongPress?: (event: GestureResponderEvent) => void;
    style?: StyleProp<ViewStyle>;
    contentStyle?: StyleProp<ViewStyle>;
    children?: ReactNode;
}

const SINK_AMOUNT = 0.94;
const TILT_AMOUNT = 5.3;
const TILT_PERSPECTIVE_FACTOR = 1.6;

export function Card({ feedback = 'sink', showIndication, holdDown, onPress, onPressIn, onLongPress, style, contentStyle, children }: AppCardProps) {
    const theme = useTheme();
    const reducedMotion = useReducedMotionPreference();
    const radius = theme.components.card.radius;
    const pressed = useSharedValue(0);
    const tiltX = useSharedValue(0);
    const tiltY = useSharedValue(0);

    const cardSize = useRef({ width: 0, height: 0 });
    const [tiltOrigin, setTiltOrigin] = useState('50% 50%');

    const longPressFired = useRef(false);

    const interactive = feedback === 'tilt' || !!onPress || !!onLongPress;

    const engaged = useDerivedValue(() => (pressed.value === 1 || holdDown ? 1 : 0));

    const animatedStyle = useAnimatedStyle(() => {
        if (feedback === 'sink') {
            return {
                transform: [{ scale: reducedMotion ? 1 : withSpring(engaged.value === 1 ? SINK_AMOUNT : 1, cardSink) }],
            };
        }
        if (feedback === 'tilt') {
            return {
                transform: [
                    { perspective: Math.max(cardSize.current.width * TILT_PERSPECTIVE_FACTOR, 1) },
                    { rotateX: reducedMotion ? '0deg' : withSpring(`${tiltX.value}deg`, cardTilt) },
                    { rotateY: reducedMotion ? '0deg' : withSpring(`${tiltY.value}deg`, cardTilt) },
                ],
            };
        }
        return {};
    }, [feedback, reducedMotion]);

    const onLayout = useCallback((e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;
        cardSize.current = { width, height };
    }, []);

    const handlePressIn = useCallback(
        (e: GestureResponderEvent) => {
            longPressFired.current = false;
            if (feedback === 'tilt') {
                const { locationX, locationY } = e.nativeEvent;
                const halfW = (cardSize.current.width || 1) / 2;
                const halfH = (cardSize.current.height || 1) / 2;
                const originX = locationX < halfW ? '100%' : '0%';
                const originY = locationY < halfH ? '100%' : '0%';
                setTiltOrigin(`${originX} ${originY}`);
                tiltX.value = locationY < halfH ? TILT_AMOUNT : -TILT_AMOUNT;
                tiltY.value = locationX < halfW ? -TILT_AMOUNT : TILT_AMOUNT;
            }
            pressed.value = 1;
            onPressIn?.();
        },
        [feedback, onPressIn, tiltX, tiltY, pressed],
    );

    const handlePressOut = useCallback(() => {
        pressed.value = 0;
        tiltX.value = 0;
        tiltY.value = 0;
    }, [tiltX, tiltY, pressed]);

    const handleLongPress = useCallback((event: GestureResponderEvent) => {
        longPressFired.current = true;
        onLongPress?.(event);
    }, [onLongPress]);

    const handlePress = useCallback(() => {
        // A completed long-press swallows the click (combinedClickable parity).
        if (longPressFired.current) {
            longPressFired.current = false;
            return;
        }
        onPress?.();
    }, [onPress]);

    return (
        <Pressable
            accessibilityRole={interactive ? 'button' : undefined}
            onPress={interactive ? handlePress : undefined}
            onPressIn={interactive ? handlePressIn : undefined}
            onPressOut={interactive ? handlePressOut : undefined}
            onLongPress={interactive && !!onLongPress ? handleLongPress : undefined}
            style={style}
        >
            <Animated.View
                onLayout={feedback === 'tilt' ? onLayout : undefined}
                style={[
                    {
                        backgroundColor: theme.colors.surfaceContainer,
                        borderRadius: radius,
                        overflow: 'hidden',
                        flexDirection: 'column',
                    },
                    feedback === 'tilt' ? { transformOrigin: tiltOrigin } : undefined,
                    contentStyle,
                    animatedStyle,
                ]}
            >
                {children}
                {showIndication && <PressIndication pressed={pressed} color={theme.colors.onBackground} radius={radius} />}
            </Animated.View>
        </Pressable>
    );
}

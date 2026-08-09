import {
    sliderDragOverlay,
    sliderProgressDrag,
    sliderProgressIdle,
    sliderThumbScale,
} from '@/src/ui/motion';
import { useTheme } from '@/src/ui/theme';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { AccessibilityActionEvent, LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

/**
 * Miuix / HyperOS Slider.
 *
 * Geometry and motion are ported from Slider.kt via the local miuix-vue
 * reference: 28dp pill track, knobR = thumbR × 0.72, active scale 1.127.
 */
export interface AppSliderProps {
    value?: number;
    minimumValue?: number;
    maximumValue?: number;
    step?: number;
    disabled?: boolean;
    showKeyPoints?: boolean;
    keyPoints?: number[];
    magnetThreshold?: number;
    onValueChange?: (value: number) => void;
    onSlidingComplete?: (value: number) => void;
    accessibilityLabel?: string;
    style?: StyleProp<ViewStyle>;
}

const ACTIVE_SCALE = 1.127;

export function Slider({
    value = 0,
    minimumValue = 0,
    maximumValue = 100,
    step = 0,
    disabled = false,
    showKeyPoints = false,
    keyPoints = [],
    magnetThreshold = 0.02,
    onValueChange,
    onSlidingComplete,
    accessibilityLabel,
    style,
}: AppSliderProps) {
    const theme = useTheme();
    const tokens = theme.components.slider;
    const range = Math.max(maximumValue - minimumValue, 0);
    const clampedValue = clamp(value, minimumValue, maximumValue);
    const initialFraction = range > 0 ? (clampedValue - minimumValue) / range : 0;

    const [trackWidth, setTrackWidth] = useState(0);
    const width = useSharedValue(0);
    const progress = useSharedValue(initialFraction);
    const currentValue = useSharedValue(clampedValue);
    const active = useSharedValue(0);
    const startX = useSharedValue(0);
    const startY = useSharedValue(0);
    const activated = useSharedValue(0);
    const lastEmitted = useRef(clampedValue);

    const emitChange = useCallback((next: number) => {
        lastEmitted.current = next;
        onValueChange?.(next);
    }, [onValueChange]);

    const emitComplete = useCallback((next: number) => {
        onSlidingComplete?.(next);
    }, [onSlidingComplete]);

    useEffect(() => {
        currentValue.value = clampedValue;
        if (Math.abs(clampedValue - lastEmitted.current) < 0.000001) return;
        progress.value = withSpring(
            range > 0 ? (clampedValue - minimumValue) / range : 0,
            sliderProgressIdle,
        );
    }, [clampedValue, currentValue, minimumValue, progress, range]);

    const setValueFromPosition = (position: number) => {
        'worklet';
        const thumbRadius = tokens.height / 2;
        const available = Math.max(width.value - tokens.height, 0);
        const fraction = available > 0
            ? Math.max(0, Math.min(1, (position - thumbRadius) / available))
            : 0;

        let next = minimumValue + fraction * range;
        if (step > 0) {
            next = minimumValue + Math.round((next - minimumValue) / step) * step;
        } else if (keyPoints.length > 0 && range > 0) {
            let nearest = keyPoints[0] ?? next;
            let distance = Math.abs((nearest - minimumValue) / range - fraction);
            for (let i = 1; i < keyPoints.length; i += 1) {
                const point = keyPoints[i] ?? next;
                const nextDistance = Math.abs((point - minimumValue) / range - fraction);
                if (nextDistance < distance) {
                    nearest = point;
                    distance = nextDistance;
                }
            }
            if (distance < magnetThreshold) next = nearest;
        }

        next = Math.max(minimumValue, Math.min(maximumValue, next));
        const nextFraction = range > 0 ? (next - minimumValue) / range : 0;
        progress.value = withSpring(nextFraction, sliderProgressDrag);

        if (Math.abs(next - currentValue.value) > 0.000001) {
            currentValue.value = next;
            runOnJS(emitChange)(next);
        }
    };

    const finishInteraction = () => {
        'worklet';
        active.value = 0;
        const settledFraction = range > 0
            ? (currentValue.value - minimumValue) / range
            : 0;
        progress.value = withSpring(settledFraction, sliderProgressIdle);
        runOnJS(emitComplete)(currentValue.value);
    };

    const gesture = Gesture.Pan()
        .enabled(!disabled)
        .manualActivation(true)
        .onTouchesDown((event) => {
            const touch = event.changedTouches[0];
            if (!touch) return;
            startX.value = touch.x;
            startY.value = touch.y;
            activated.value = 0;
            active.value = 1;
        })
        .onTouchesMove((event, state) => {
            const touch = event.changedTouches[0];
            if (!touch) return;
            const dx = touch.x - startX.value;
            const dy = touch.y - startY.value;

            if (Math.abs(dy) > 6 && Math.abs(dy) > Math.abs(dx)) {
                active.value = 0;
                state.fail();
                return;
            }
            if (Math.abs(dx) > 3) {
                activated.value = 1;
                state.activate();
                setValueFromPosition(touch.x);
            }
        })
        .onUpdate((event) => {
            setValueFromPosition(event.x);
        })
        .onTouchesUp((event, state) => {
            const touch = event.changedTouches[0];
            if (!touch || activated.value === 1) return;
            setValueFromPosition(touch.x);
            state.activate();
            state.end();
        })
        .onEnd(finishInteraction)
        .onFinalize(() => {
            active.value = 0;
            activated.value = 0;
        })
        .onTouchesCancelled(() => {
            active.value = 0;
            activated.value = 0;
        });

    const fillStyle = useAnimatedStyle(() => {
        const thumbRadius = tokens.height / 2;
        const available = Math.max(width.value - tokens.height, 0);
        return { width: thumbRadius + progress.value * available + thumbRadius };
    });

    const knobRadius = tokens.height / 2 * tokens.knobRatio;
    const knobStyle = useAnimatedStyle(() => {
        const thumbRadius = tokens.height / 2;
        const available = Math.max(width.value - tokens.height, 0);
        const center = thumbRadius + progress.value * available;
        return {
            transform: [
                { translateX: center - knobRadius },
                { scale: withSpring(active.value ? ACTIVE_SCALE : 1, sliderThumbScale) },
            ],
        };
    });

    const overlayStyle = useAnimatedStyle(() => ({
        opacity: withTiming(active.value ? 0.044 : 0, sliderDragOverlay),
    }));

    const visiblePoints = keyPoints.length > 0
        ? keyPoints
        : showKeyPoints && step > 0
            ? createStepPoints(minimumValue, maximumValue, step)
            : [];
    const valueFraction = range > 0 ? (clampedValue - minimumValue) / range : 0;

    const onLayout = (event: LayoutChangeEvent) => {
        const nextWidth = event.nativeEvent.layout.width;
        setTrackWidth(nextWidth);
        width.value = nextWidth;
    };

    const onAccessibilityAction = (event: AccessibilityActionEvent) => {
        if (disabled || range <= 0) return;
        const amount = step > 0 ? step : range / 20;
        const direction = event.nativeEvent.actionName === 'increment' ? 1 : -1;
        const next = clamp(clampedValue + amount * direction, minimumValue, maximumValue);
        emitChange(next);
        emitComplete(next);
    };

    return (
        <GestureDetector gesture={gesture}>
            <Animated.View
                accessibilityRole="adjustable"
                accessibilityLabel={accessibilityLabel}
                accessibilityState={{ disabled }}
                accessibilityValue={{ min: minimumValue, max: maximumValue, now: clampedValue }}
                accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
                onAccessibilityAction={onAccessibilityAction}
                onLayout={onLayout}
                style={[
                    styles.track,
                    {
                        height: tokens.height,
                        borderRadius: theme.radius.full,
                        backgroundColor: disabled
                            ? theme.colors.disabledSecondary
                            : theme.colors.sliderBackground,
                    },
                    style,
                ]}
            >
                <Animated.View
                    style={[
                        StyleSheet.absoluteFill,
                        {
                            right: undefined,
                            borderRadius: theme.radius.full,
                            backgroundColor: disabled
                                ? theme.colors.disabledPrimarySlider
                                : theme.colors.primary,
                        },
                        fillStyle,
                    ]}
                />
                <Animated.View
                    pointerEvents="none"
                    style={[StyleSheet.absoluteFill, styles.dragOverlay, overlayStyle]}
                />
                {visiblePoints.map((point, index) => {
                    const fraction = range > 0
                        ? clamp((point - minimumValue) / range, 0, 1)
                        : 0;
                    const radius = tokens.height / tokens.keyPointDivisor;
                    const left = tokens.height / 2 + fraction * Math.max(trackWidth - tokens.height, 0) - radius;
                    return (
                        <View
                            key={`${point}-${index}`}
                            pointerEvents="none"
                            style={{
                                position: 'absolute',
                                left,
                                top: tokens.height / 2 - radius,
                                width: radius * 2,
                                height: radius * 2,
                                borderRadius: radius,
                                backgroundColor: fraction <= valueFraction
                                    ? theme.colors.sliderKeyPointForeground
                                    : theme.colors.sliderKeyPoint,
                            }}
                        />
                    );
                })}
                <Animated.View
                    pointerEvents="none"
                    style={[
                        styles.knob,
                        {
                            top: tokens.height / 2 - knobRadius,
                            width: knobRadius * 2,
                            height: knobRadius * 2,
                            borderRadius: knobRadius,
                            backgroundColor: disabled
                                ? theme.colors.disabledOnPrimary
                                : theme.colors.onPrimary,
                        },
                        knobStyle,
                    ]}
                />
            </Animated.View>
        </GestureDetector>
    );
}

function clamp(value: number, minimum: number, maximum: number) {
    'worklet';
    return Math.max(minimum, Math.min(maximum, value));
}

function createStepPoints(minimum: number, maximum: number, step: number) {
    const points: number[] = [];
    for (let value = minimum; value <= maximum + step * 0.000001; value += step) {
        points.push(clamp(value, minimum, maximum));
    }
    return points;
}

const styles = StyleSheet.create({
    track: {
        width: '100%',
        overflow: 'hidden',
    },
    dragOverlay: {
        backgroundColor: '#000000',
    },
    knob: {
        position: 'absolute',
        left: 0,
    },
});

import { switchThumbOffset, switchThumbScale, switchTrackColor } from '@/src/ui/motion';
import { useTheme } from '@/src/ui/theme';
import React, { useCallback } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useDerivedValue, useSharedValue, withSpring } from 'react-native-reanimated';

/**
 * Design System Switch — self-drawn (not the RN system switch).
 *
 * Visual reference:
 *   miuix-vue/src/components/switch/Switch.vue (Switch.kt)
 *
 * Track 49×28, thumb 20, off left 4, on left 25, travel 21.
 * Three springs from source:
 *   thumb offset: folmeSpring(0.7, 987)
 *   thumb scale:  folmeSpring(0.6, 987)
 *   track color:  folmeSpring(0.99, 438.6)
 * Drag: raw offset accumulates translationX / 2, clamped [-21,0] checked /
 * [0,21] unchecked; snap threshold 10.5 (50%); thumb scales UP to 1.127 on
 * press / hover / drag.
 */

export interface AppSwitchProps {
    value?: boolean;
    onValueChange?: (value: boolean) => void;
    disabled?: boolean;
    /** 在整行可点击时关闭开关自身手势，避免一次点击触发两次切换。 */
    interactive?: boolean;
}

const THUMB_TRAVEL = 21; // 25 - 4
const DRAG_HALF = 10.5; // 21 / 2 — half-way snap threshold
const SCALE_HOVER_PRESS = 1.127;

export function Switch({ value = false, onValueChange, disabled = false, interactive = true }: AppSwitchProps) {
    const theme = useTheme();
    const c = theme.components.switch;
    const thumbInset = (c.height - c.thumbSize) / 2;

    const pressed = useSharedValue(0);
    const dragging = useSharedValue(0);
    const didDrag = useSharedValue(0);
    const rawDrag = useSharedValue(0);
    const dragOffset = useSharedValue(0);
    // translationX at the previous onUpdate — used to derive the per-frame
    // delta (RNGH's TS payload doesn't expose changeX on Pan).
    const lastTranslationX = useSharedValue(0);

    const checked = value;
    const baseX = checked ? THUMB_TRAVEL : 0;

    const toggle = useCallback(() => {
        if (disabled) return;
        onValueChange?.(!checked);
    }, [disabled, onValueChange, checked]);

    // ---- track color (spring-driven) ----
    const trackTarget = disabled
        ? checked
            ? theme.colors.disabledPrimary
            : theme.colors.disabledSecondary
        : checked
            ? theme.colors.primary
            : theme.colors.secondary;

    const trackStyle = useAnimatedStyle(() => ({
        backgroundColor: withSpring(trackTarget, switchTrackColor),
    }));

    // ---- thumb position + scale (spring-driven) ----
    const thumbX = useDerivedValue(() => {
        if (dragging.value === 1) return baseX + dragOffset.value;
        return withSpring(baseX, switchThumbOffset);
    });

    const thumbScale = useDerivedValue(() => {
        if (disabled) return 1;
        const target =
            pressed.value === 1 || dragging.value === 1 || Math.abs(dragOffset.value) > 0.01
                ? SCALE_HOVER_PRESS
                : 1;
        return withSpring(target, switchThumbScale);
    });

    const thumbStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: thumbX.value }, { scale: thumbScale.value }],
    }));

    const thumbColor = disabled
        ? checked
            ? theme.colors.disabledOnPrimary
            : theme.colors.disabledOnSecondary
        : checked
            ? theme.colors.onPrimary
            : theme.colors.onSecondary;

    // ---- drag + tap gestures ----
    const pan = Gesture.Pan()
        .enabled(!disabled)
        .activeOffsetX([-3, 3])
        .onBegin(() => {
            pressed.value = 1;
            lastTranslationX.value = 0;
        })
        .onUpdate((e) => {
            dragging.value = 1;
            const change = e.translationX - lastTranslationX.value;
            lastTranslationX.value = e.translationX;
            if (Math.abs(change) > 3) didDrag.value = 1;
            rawDrag.value += change / 2;
            dragOffset.value = checked
                ? Math.max(-THUMB_TRAVEL, Math.min(0, rawDrag.value))
                : Math.max(0, Math.min(THUMB_TRAVEL, rawDrag.value));
        })
        .onFinalize(() => {
            const wasDrag = didDrag.value === 1;
            const snapped = Math.abs(dragOffset.value) > DRAG_HALF;
            pressed.value = 0;
            dragging.value = 0;
            didDrag.value = 0;
            rawDrag.value = 0;
            dragOffset.value = 0;
            if (wasDrag && snapped) runOnJS(toggle)();
        });

    const tap = Gesture.Tap()
        .enabled(!disabled)
        .maxDistance(10)
        .onBegin(() => {
            pressed.value = 1;
        })
        .onFinalize(() => {
            pressed.value = 0;
        })
        .onEnd(() => {
            runOnJS(toggle)();
        });

    const gesture = Gesture.Exclusive(pan, tap);

    const content = (
        <Animated.View
            accessibilityRole="switch"
            accessibilityState={{ checked, disabled }}
            pointerEvents={interactive ? 'auto' : 'none'}
            style={[
                {
                    width: c.width,
                    height: c.height,
                    borderRadius: theme.radius.full,
                    justifyContent: 'center',
                },
                trackStyle,
            ]}
        >
            <Animated.View
                style={[
                    {
                        position: 'absolute',
                        top: thumbInset,
                        left: thumbInset,
                        width: c.thumbSize,
                        height: c.thumbSize,
                        borderRadius: c.thumbSize / 2,
                        backgroundColor: thumbColor,
                    },
                    thumbStyle,
                ]}
            />
            {!checked ? (
                <Animated.View
                    pointerEvents="none"
                    style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        bottom: 0,
                        left: 0,
                        borderWidth: 1,
                        borderColor: theme.colors.outline,
                        borderRadius: theme.radius.full,
                    }}
                />
            ) : null}
        </Animated.View>
    );

    return interactive ? <GestureDetector gesture={gesture}>{content}</GestureDetector> : content;
}

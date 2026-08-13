import { checkboxColor, checkboxMarkHide, checkboxMarkShow, checkboxSink } from '@/src/ui/motion';
import { useReducedMotionPreference } from '@/src/ui/motion/MotionProvider';
import { useTheme } from '@/src/ui/theme';
import React from 'react';
import { Pressable } from 'react-native';
import Animated, { interpolateColor, useAnimatedProps, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export interface AppCheckboxProps {
    value?: boolean;
    onValueChange?: (value: boolean) => void;
    disabled?: boolean;
    accessibilityLabel?: string;
}

/** MIUIX 26dp circular checkbox with sink press feedback and animated checkmark. */
export function Checkbox({ value = false, onValueChange, disabled = false, accessibilityLabel }: AppCheckboxProps) {
    const theme = useTheme();
    const reduced = useReducedMotionPreference();
    const checked = useSharedValue(value ? 1 : 0);
    const pressed = useSharedValue(0);

    React.useEffect(() => {
        checked.value = reduced ? (value ? 1 : 0) : withTiming(value ? 1 : 0, checkboxColor);
    }, [checked, reduced, value]);

    const containerStyle = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(
            checked.value,
            [0, 1],
            [disabled ? theme.colors.disabledSecondary : theme.colors.secondary, disabled ? theme.colors.disabledPrimary : theme.colors.primary],
        ),
        transform: [{ scale: reduced ? 1 : withSpring(pressed.value ? 0.85 : 1, checkboxSink) }],
    }));

    const markProps = useAnimatedProps(() => ({
        strokeDashoffset: reduced
            ? (checked.value ? 0 : 30)
            : withTiming(checked.value ? 0 : 30, checked.value ? checkboxMarkShow : checkboxMarkHide),
        opacity: checked.value,
    }));

    return (
        <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel={accessibilityLabel}
            accessibilityState={{ checked: value, disabled }}
            disabled={disabled}
            hitSlop={8}
            onPress={() => onValueChange?.(!value)}
            onPressIn={() => (pressed.value = 1)}
            onPressOut={() => (pressed.value = 0)}
        >
            <Animated.View style={[{ width: 26, height: 26, borderRadius: 13, overflow: 'hidden' }, containerStyle]}>
                <Svg width={26} height={26} viewBox="0 0 26 26">
                    <AnimatedPath
                        animatedProps={markProps}
                        d="M6.9 12.1 L11.8 17.2 L19.1 7.8"
                        fill="none"
                        stroke={disabled ? theme.colors.disabledOnPrimary : theme.colors.onPrimary}
                        strokeWidth={2.34}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray={30}
                    />
                </Svg>
            </Animated.View>
        </Pressable>
    );
}

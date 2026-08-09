import { inputMotion } from '@/src/ui/motion';
import { useTheme } from '@/src/ui/theme';
import React, { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { TextInput, View } from 'react-native';
import type { StyleProp, TextInputProps, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

/**
 * Design System Input (Miuix TextField).
 *
 * Visual reference:
 *   miuix-vue/src/components/input/Input.vue (TextField.kt)
 *
 * cornerRadius 16, insideMargin 16×16, border 0 (unfocused) → 2 (focused),
 * label font 17 (normal) → 10 (floating), label weight Medium, bg
 * secondaryContainer, label onSecondaryContainer, border + caret primary.
 * Border width, label offset and label font size animate on the Compose default
 * spring spring(dampingRatio=1, stiffness=1500) = folmeSpring(1, 1500).
 *
 * Label states:
 *   Hidden      — no label prop
 *   Placeholder — useLabelAsPlaceholder && text present → label hidden
 *   Normal      — text empty → label shown at 17px over the input
 *   Floating    — text present (!useLabelAsPlaceholder) → label floats up (-8)
 *                 and shrinks to 10px; text shifts down 8.
 */

export interface AppInputProps {
    value?: string;
    onChangeText?: (text: string) => void;
    /** Floating label text. When set, drives the 4-state label animation. */
    label?: string;
    /** When true, the label is only a placeholder (hidden once text is entered). */
    useLabelAsPlaceholder?: boolean;
    /** Plain placeholder, used only when no `label` is provided. */
    placeholder?: string;
    disabled?: boolean;
    readonly?: boolean;
    /** Single line (input) vs multi-line (textarea). */
    singleLine?: boolean;
    leading?: ReactNode;
    trailing?: ReactNode;
    onFocus?: TextInputProps['onFocus'];
    onBlur?: TextInputProps['onBlur'];
    inputProps?: Partial<TextInputProps>;
    style?: StyleProp<ViewStyle>;
}

export function Input({
    value = '',
    onChangeText,
    label,
    useLabelAsPlaceholder = false,
    placeholder,
    disabled = false,
    readonly = false,
    singleLine = true,
    leading,
    trailing,
    onFocus,
    onBlur,
    inputProps,
    style,
}: AppInputProps) {
    const theme = useTheme();
    const [focused, setFocused] = useState(false);
    const { style: inputStyle, ...restInputProps } = inputProps ?? {};

    const hasText = value.length > 0;
    const labelVisible = label != null && !(useLabelAsPlaceholder && hasText);
    const floating = label != null && !useLabelAsPlaceholder && hasText;

    const focusProgress = useSharedValue(0);
    const floatProgress = useSharedValue(floating ? 1 : 0);

    useEffect(() => {
        focusProgress.value = withSpring(focused ? 1 : 0, inputMotion);
    }, [focused, focusProgress]);

    useEffect(() => {
        floatProgress.value = withSpring(floating ? 1 : 0, inputMotion);
    }, [floating, floatProgress]);

    // Border via outline (drawn outside the box, no layout shift — matches the
    // reference's inset box-shadow) is available on the new architecture.
    const borderStyle = useAnimatedStyle(() => ({
        outlineWidth: 2 * focusProgress.value,
        outlineColor: theme.colors.primary,
    }));

    const labelStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: -8 * floatProgress.value }],
        fontSize: 17 - 7 * floatProgress.value,
    }));

    const fieldStyle = useAnimatedStyle(() => ({
        paddingTop: theme.spacing.lg + 8 * floatProgress.value,
        paddingBottom: theme.spacing.lg - 8 * floatProgress.value,
    }));

    return (
        <Animated.View
            style={[
                {
                    width: '100%',
                    borderRadius: theme.radius.component,
                    backgroundColor: theme.colors.secondaryContainer,
                    flexDirection: 'row',
                    alignItems: 'stretch',
                    overflow: 'hidden',
                },
                borderStyle,
                style,
            ]}
        >
            {leading != null && <View style={{ justifyContent: 'center', paddingLeft: theme.spacing.lg }}>{leading}</View>}
            <View style={{ flex: 1, minWidth: 0, position: 'relative' }}>
                {labelVisible && (
                    <Animated.Text
                        pointerEvents="none"
                        numberOfLines={1}
                        style={[
                            {
                                position: 'absolute',
                                left: leading != null ? 0 : theme.spacing.lg,
                                top: theme.spacing.lg,
                                color: theme.colors.onSecondaryContainer,
                                fontWeight: '500',
                                lineHeight: 20.4,
                            },
                            labelStyle,
                        ]}
                    >
                        {label}
                    </Animated.Text>
                )}
                <TextInput
                    value={value}
                    onChangeText={onChangeText}
                    onFocus={(e) => {
                        setFocused(true);
                        onFocus?.(e);
                    }}
                    onBlur={(e) => {
                        setFocused(false);
                        onBlur?.(e);
                    }}
                    editable={!disabled}
                    // readonly ~ disabled editing but still focusable for copy
                    multiline={!singleLine}
                    placeholder={label != null ? undefined : placeholder}
                    placeholderTextColor={theme.colors.onSecondaryContainer}
                    cursorColor={theme.colors.primary}
                    style={[
                        {
                            width: '100%',
                            paddingLeft: leading != null ? 0 : theme.spacing.lg,
                            paddingRight: trailing != null ? 0 : theme.spacing.lg,
                            color: theme.colors.onBackground,
                            fontSize: 17,
                            lineHeight: 20.4,
                        },
                        fieldStyle,
                        inputStyle,
                    ]}
                    {...restInputProps}
                />
            </View>
            {trailing != null && <View style={{ justifyContent: 'center', paddingRight: theme.spacing.lg }}>{trailing}</View>}
        </Animated.View>
    );
}

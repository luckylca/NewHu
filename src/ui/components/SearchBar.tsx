import { Icon, Text } from '@/src/ui/primitives';
import { searchBarReveal } from '@/src/ui/motion';
import { useTheme } from '@/src/ui/theme';
import React, { useCallback, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import type { TextInputProps, StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

/**
 * Design System SearchBar — capsule input.
 *
 * Visual reference:
 *   miuix-vue/src/components/search-bar/SearchBar.vue (SearchBar.kt + InputField)
 *
 * Capsule: bg surfaceContainerHigh, min-height 45, leading Search icon
 * (start 16 / end 8, onSurfaceContainerHigh), input font 17 Medium, label shown
 * only when empty AND collapsed, trailing clear X when query present. Focusing
 * expands the bar: a Cancel action slides in (spring stiffness 400 damping 40 =
 * folmeSpring(1,400)) and the results content reveals. insideMargin 12×0.
 */

export interface AppSearchBarProps {
    value?: string;
    onChangeText?: (text: string) => void;
    onSearch?: (text: string) => void;
    /** Use the collapsed bar as a navigation action instead of an editable field. */
    onPress?: () => void;
    /** Expanded = focused; drives the Cancel slide-in + results reveal. */
    expanded?: boolean;
    onExpandedChange?: (expanded: boolean) => void;
    label?: string;
    cancelText?: string;
    placeholderTextColor?: string;
    inputProps?: Partial<TextInputProps>;
    /** Results area — shown only while expanded. */
    children?: ReactNode;
    style?: StyleProp<ViewStyle>;
}

export function SearchBar({
    value = '',
    onChangeText,
    onSearch,
    onPress,
    expanded = false,
    onExpandedChange,
    label = 'Search',
    cancelText = 'Cancel',
    inputProps,
    children,
    style,
}: AppSearchBarProps) {
    const theme = useTheme();
    const c = theme.components.searchBar;
    const inputRef = useRef<TextInput>(null);

    const hasText = value.length > 0;
    const showLabel = !hasText && !expanded;

    const cancelShown = useSharedValue(expanded ? 1 : 0);
    useEffect(() => {
        cancelShown.value = expanded ? 1 : 0;
    }, [expanded, cancelShown]);

    const cancelWidthStyle = useAnimatedStyle(() => ({
        width: withSpring(cancelShown.value * 88, searchBarReveal),
        opacity: cancelShown.value,
    }));

    const resultsStyle = useAnimatedStyle(() => ({
        opacity: cancelShown.value,
        maxHeight: cancelShown.value * 400,
    }));

    const handleFocus = useCallback(() => {
        onExpandedChange?.(true);
    }, [onExpandedChange]);

    const handleCancel = useCallback(() => {
        onChangeText?.('');
        onExpandedChange?.(false);
        inputRef.current?.blur();
    }, [onChangeText, onExpandedChange]);

    const handleClear = useCallback(() => {
        onChangeText?.('');
        inputRef.current?.focus();
    }, [onChangeText]);

    const handleSubmit = useCallback(() => {
        onSearch?.(value);
    }, [onSearch, value]);

    return (
        <View style={[{ width: '100%' }, style]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.md }}>
                <View
                    style={{
                        flex: 1,
                        minWidth: 0,
                        minHeight: c.minHeight,
                        borderRadius: c.radius,
                        backgroundColor: theme.colors.surfaceContainerHigh,
                        flexDirection: 'row',
                        alignItems: 'center',
                    }}
                >
                    <View style={{ paddingLeft: theme.spacing.lg, paddingRight: theme.spacing.sm }}>
                        <Icon name="magnify" size={22} color={theme.colors.onSurfaceContainerHigh} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0, position: 'relative', justifyContent: 'center' }}>
                        {showLabel && (
                            <Text
                                type="body1"
                                size={c.fontSize}
                                weight="medium"
                                color={theme.colors.onSurfaceContainerHigh}
                                style={{ position: 'absolute', left: 0 }}
                                pointerEvents="none"
                                numberOfLines={1}
                            >
                                {label}
                            </Text>
                        )}
                        <TextInput
                            ref={inputRef}
                            value={value}
                            onChangeText={onChangeText}
                            onFocus={handleFocus}
                            onBlur={() => {}}
                            onSubmitEditing={handleSubmit}
                            returnKeyType="search"
                            cursorColor={theme.colors.primary}
                            style={{
                                padding: 0,
                                margin: 0,
                                color: theme.colors.onSurface,
                                fontSize: c.fontSize,
                                fontWeight: '500',
                                paddingVertical: 0,
                            }}
                            placeholderTextColor={theme.colors.onSurfaceContainerHigh}
                            autoCorrect={false}
                            {...inputProps}
                        />
                    </View>
                    {hasText && (
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Clear"
                            onPress={handleClear}
                            hitSlop={8}
                            style={{ paddingLeft: theme.spacing.sm, paddingRight: theme.spacing.lg, alignItems: 'center', justifyContent: 'center' }}
                        >
                            {/* SearchCleanup glyph: circle fill 0.06, X 0.3, tinted onSurfaceContainerHighest */}
                            <View
                                style={{
                                    width: 16,
                                    height: 16,
                                    borderRadius: 8,
                                    backgroundColor: theme.colors.onSurfaceContainerHighest,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    opacity: 0.06,
                                }}
                            />
                            <View style={{ position: 'absolute', width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}>
                                <Icon name="close" size={14} color={theme.colors.onSurfaceContainerHighest} style={{ opacity: 0.3 }} />
                            </View>
                        </Pressable>
                    )}
                    {onPress ? (
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={label}
                            onPress={onPress}
                            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: c.radius }}
                        />
                    ) : null}
                </View>

                {/* Cancel — springs in from the right when expanded */}
                <Animated.View
                    style={[
                        {
                            overflow: 'hidden',
                            flexDirection: 'row',
                            justifyContent: 'flex-end',
                        },
                        cancelWidthStyle,
                    ]}
                >
                    <Pressable accessibilityRole="button" onPress={handleCancel} style={{ paddingHorizontal: theme.spacing.md }}>
                        <Text type="button" weight="bold" color={theme.colors.primary}>
                            {cancelText}
                        </Text>
                    </Pressable>
                </Animated.View>
            </View>

            {children != null && (
                <Animated.View style={[{ overflow: 'hidden' }, resultsStyle]}>{children}</Animated.View>
            )}
        </View>
    );
}

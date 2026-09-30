import { Icon, Text } from '../primitives';
import { GlassSurface } from '@newhu/react-native-liquid-glass';
import { searchBarReveal } from '../motion';
import { useTheme } from '../theme';
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
 * expands the bar: an action slides in (spring stiffness 400 damping 40 =
 * folmeSpring(1,400)) and the results content reveals. insideMargin 12×0.
 */

export interface AppSearchBarProps {
    value?: string;
    onChangeText?: (text: string) => void;
    onSearch?: (text: string) => void;
    /** Use the collapsed bar as a navigation action instead of an editable field. */
    onPress?: () => void;
    onPressIn?: () => void;
    /** Expanded = focused; drives the Cancel slide-in + results reveal. */
    expanded?: boolean;
    onExpandedChange?: (expanded: boolean) => void;
    label?: string;
    /** Text for the trailing action. `cancelText` is kept for compatibility. */
    actionText?: string;
    onAction?: () => void;
    cancelText?: string;
    /** Horizontal inset of the capsule row. */
    horizontalPadding?: number;
    /** Width reserved for the trailing action while expanded. */
    actionWidth?: number;
    /** Horizontal padding inside the trailing action. */
    actionPaddingHorizontal?: number;
    /** Keep pager pages in-tree while inactive; active Liquid Glass pages use backdrop by default. */
    glassRenderMode?: 'local' | 'backdrop';
    placeholderTextColor?: string;
    inputProps?: Partial<TextInputProps>;
    /** Results area — shown only while expanded. */
    children?: ReactNode;
    style?: StyleProp<ViewStyle>;
}

export const SearchBar = React.memo(function SearchBar({
    value = '',
    onChangeText,
    onSearch,
    onPress,
    onPressIn,
    expanded = false,
    onExpandedChange,
    label = 'Search',
    actionText,
    onAction,
    cancelText = 'Cancel',
    horizontalPadding,
    actionWidth = 88,
    actionPaddingHorizontal,
    glassRenderMode,
    placeholderTextColor,
    inputProps,
    children,
    style,
}: AppSearchBarProps) {
    const theme = useTheme();
    const c = theme.components.searchBar;
    const usesGlassMaterial = theme.presentation.search.material === 'glass' && theme.glass.enabled;
    const glassForeground = usesGlassMaterial ? theme.colors.onGlass : theme.colors.onSurfaceContainerHigh;
    const glassForegroundSecondary = usesGlassMaterial ? theme.colors.onGlassSecondary : theme.colors.onSurfaceContainerHigh;
    const resolvedPlaceholderTextColor = placeholderTextColor ?? inputProps?.placeholderTextColor ?? glassForegroundSecondary;
    const inputRef = useRef<TextInput>(null);
    const barPadding = horizontalPadding ?? theme.spacing.md;
    const actionPadding = actionPaddingHorizontal ?? theme.spacing.md;

    const hasText = value.length > 0;
    const showLabel = !hasText;

    const cancelShown = useSharedValue(expanded ? 1 : 0);
    useEffect(() => {
        cancelShown.value = expanded ? 1 : 0;
    }, [expanded, cancelShown]);

    const cancelWidthStyle = useAnimatedStyle(() => ({
        width: withSpring(cancelShown.value * actionWidth, searchBarReveal),
        opacity: cancelShown.value,
    }), [actionWidth]);

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

    const handleAction = useCallback(() => {
        if (onAction) {
            onAction();
            return;
        }
        handleCancel();
    }, [handleCancel, onAction]);

    const handleClear = useCallback(() => {
        onChangeText?.('');
        inputRef.current?.focus();
    }, [onChangeText]);

    const handleSubmit = useCallback(() => {
        onSearch?.(value);
    }, [onSearch, value]);

    return (
        <View style={[{ width: '100%' }, style]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: barPadding }}>
                <GlassSurface
                    variant={usesGlassMaterial ? 'search' : 'control'}
                    positioning={theme.presentation.search.defaultMode}
                    sampling={usesGlassMaterial ? glassRenderMode ?? (theme.presentation.search.defaultMode === 'floating' ? 'backdrop' : 'local') : 'local'}
                    interactive={Boolean(onPress)}
                    style={{
                        flex: 1,
                        minWidth: 0,
                        minHeight: c.minHeight,
                        borderRadius: c.radius,
                        backgroundColor: usesGlassMaterial ? 'transparent' : theme.colors.surfaceContainerHigh,
                        borderColor: theme.colors.outline,
                        borderWidth: usesGlassMaterial ? 0.5 : 0,
                    }}
                    placeholderChildren={usesGlassMaterial ? <View style={{ flex: 1, minHeight: c.minHeight }} /> : undefined}
                >
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ paddingLeft: theme.spacing.lg, paddingRight: theme.spacing.sm }}>
                        <Icon name="magnify" size={22} color={glassForegroundSecondary} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0, justifyContent: 'center', height: '100%' }}>
                        <TextInput
                            {...inputProps}
                            ref={inputRef}
                            value={value}
                            onChangeText={onChangeText}
                            onFocus={handleFocus}
                            onBlur={() => {}}
                            onSubmitEditing={handleSubmit}
                            placeholder={showLabel ? label : undefined}
                            returnKeyType="search"
                            cursorColor={theme.colors.primary}
                            style={{
                                padding: 0,
                                margin: 0,
                                color: usesGlassMaterial ? theme.colors.onGlass : theme.colors.onSurface,
                                fontSize: c.fontSize,
                                fontWeight: '500',
                                height: '100%',
                                paddingVertical: 0,
                                textAlignVertical: 'center',
                            }}
                            placeholderTextColor={resolvedPlaceholderTextColor}
                            autoCorrect={false}
                        />
                    </View>
                    {hasText && (
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Clear"
                            onPress={handleClear}
                            hitSlop={8}
                            style={{
                                width: 40,
                                height: c.minHeight,
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <View
                                style={{
                                    width: 16,
                                    height: 16,
                                    borderRadius: 8,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <View
                                    pointerEvents="none"
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        right: 0,
                                        bottom: 0,
                                        left: 0,
                                        borderRadius: 8,
                                        backgroundColor: usesGlassMaterial ? theme.colors.onGlass : theme.colors.onSurfaceContainerHighest,
                                        opacity: 0.06,
                                    }}
                                />
                                <Icon name="close" size={14} color={usesGlassMaterial ? theme.colors.onGlassMuted : theme.colors.onSurfaceContainerHighest} style={{ opacity: 0.72 }} />
                            </View>
                        </Pressable>
                    )}
                    {onPress ? (
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={label}
                            onPress={onPress}
                            onPressIn={onPressIn}
                            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: c.radius }}
                        />
                    ) : null}
                    </View>
                </GlassSurface>

                {/* Trailing action — springs in from the right when expanded */}
                <Animated.View
                    style={[
                        {
                            overflow: 'hidden',
                            flexDirection: 'row',
                            alignItems: 'center',
                        },
                        cancelWidthStyle,
                    ]}
                >
                    <Pressable accessibilityRole="button" onPress={handleAction} style={{ paddingHorizontal: actionPadding }}>
                        <Text type="button" weight="bold" color={theme.colors.primary}>
                            {actionText ?? cancelText}
                        </Text>
                    </Pressable>
                </Animated.View>
            </View>

            {children != null && (
                <Animated.View style={[{ overflow: 'hidden' }, resultsStyle]}>{children}</Animated.View>
            )}
        </View>
    );
});
SearchBar.displayName = 'HyperSearchBar';

import { PressIndication, Text } from '@/src/ui/primitives';
import { useTheme } from '@/src/ui/theme';
import React from 'react';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

/**
 * Design System ListRow (Preference row).
 *
 * Visual reference:
 *   miuix-vue/src/components/basic-component/BasicComponent.vue (Component.kt)
 *
 * min-height 56, padding 16, gap 8.
 * title: headline1 (17) weight Medium, color onBackground.
 * summary: body2 (14), color onSurfaceVariantSummary.
 * When clickable + enabled, draws the MiuixIndication alpha overlay.
 *
 * Pages must NOT decide the row's padding / fonts / gap / press overlay —
 * use this component.
 */

export interface AppListRowProps {
    title?: string;
    summary?: string;
    summaryNumberOfLines?: number;
    /** Start region — icon etc. */
    icon?: ReactNode;
    /** End region — Switch / value / chevron. */
    trailing?: ReactNode;
    onPress?: () => void;
    onPressIn?: () => void;
    disabled?: boolean;
    titleColor?: string;
    summaryColor?: string;
    style?: StyleProp<ViewStyle>;
}

export function ListRow({ title, summary, summaryNumberOfLines = 1, icon, trailing, onPress, onPressIn, disabled, titleColor: titleColorOverride, summaryColor: summaryColorOverride, style }: AppListRowProps) {
    const theme = useTheme();
    const c = theme.components.preference;
    const pressed = useSharedValue(0);

    const interactive = !!onPress && !disabled;
    const titleColor = disabled ? theme.colors.disabledOnSecondaryVariant : titleColorOverride ?? theme.colors.onBackground;
    const summaryColor = disabled ? theme.colors.disabledOnSecondaryVariant : summaryColorOverride ?? theme.colors.onSurfaceVariantSummary;

    return (
        <Pressable
            accessibilityRole={interactive ? 'button' : undefined}
            accessibilityState={{ disabled: !!disabled }}
            onPress={interactive ? onPress : undefined}
            onPressIn={interactive ? () => {
                pressed.value = 1;
                onPressIn?.();
            } : undefined}
            onPressOut={interactive ? () => (pressed.value = 0) : undefined}
            style={[{ minHeight: c.minHeight, padding: c.padding, justifyContent: 'center' }, style]}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: c.gap }}>
                {icon != null && <View style={{ flex: 0, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>}
                <View style={{ flex: 1, minWidth: 0, flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center' }}>
                    {title != null && (
                        <Text type="headline1" weight="medium" color={titleColor} numberOfLines={1}>
                            {title}
                        </Text>
                    )}
                    {summary != null && (
                        <Text type="body2" color={summaryColor} numberOfLines={summaryNumberOfLines}>
                            {summary}
                        </Text>
                    )}
                </View>
                {trailing != null && (
                    <View style={{ flex: 0, alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' }}>
                        {trailing}
                    </View>
                )}
            </View>
            {!!onPress && <PressIndication pressed={pressed} color={theme.colors.onBackground} />}
        </Pressable>
    );
}

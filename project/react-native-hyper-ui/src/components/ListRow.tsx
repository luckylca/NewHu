import { PressIndication, Text } from '../primitives';
import { useTheme } from '../theme';
import React, { memo } from 'react';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

export interface AppListRowProps {
    title?: string;
    summary?: string;
    summaryNumberOfLines?: number;
    icon?: ReactNode;
    trailing?: ReactNode;
    onPress?: () => void;
    onPressIn?: () => void;
    disabled?: boolean;
    titleColor?: string;
    summaryColor?: string;
    style?: StyleProp<ViewStyle>;
}

export const ListRow = memo(function ListRow(props: AppListRowProps) {
    return (props.onPress || props.onPressIn) && !props.disabled
        ? <InteractiveListRow {...props} />
        : <StaticListRow {...props} />;
});
ListRow.displayName = 'HyperListRow';

function ListRowContent({ props }: { props: AppListRowProps }) {
    const theme = useTheme();
    const c = theme.components.preference;
    const titleColor = props.disabled
        ? theme.colors.disabledOnSecondaryVariant
        : props.titleColor ?? theme.colors.onBackground;
    const summaryColor = props.disabled
        ? theme.colors.disabledOnSecondaryVariant
        : props.summaryColor ?? theme.colors.onSurfaceVariantSummary;

    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: c.gap }}>
            {props.icon != null && <View style={{ flex: 0, alignItems: 'center', justifyContent: 'center' }}>{props.icon}</View>}
            <View style={{ flex: 1, minWidth: 0, flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center' }}>
                {props.title != null && (
                    <Text type="headline1" weight="medium" color={titleColor} numberOfLines={1}>
                        {props.title}
                    </Text>
                )}
                {props.summary != null && (
                    <Text type="body2" color={summaryColor} numberOfLines={props.summaryNumberOfLines ?? 1}>
                        {props.summary}
                    </Text>
                )}
            </View>
            {props.trailing != null && (
                <View style={{ flex: 0, alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' }}>
                    {props.trailing}
                </View>
            )}
        </View>
    );
}

function StaticListRow(props: AppListRowProps) {
    const theme = useTheme();
    const c = theme.components.preference;

    return (
        <View
            accessibilityState={{ disabled: !!props.disabled }}
            style={[{ minHeight: c.minHeight, padding: c.padding, justifyContent: 'center' }, props.style]}
        >
            <ListRowContent props={props} />
        </View>
    );
}

function InteractiveListRow(props: AppListRowProps) {
    const theme = useTheme();
    const c = theme.components.preference;
    const pressed = useSharedValue(0);

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: false }}
            onPress={props.onPress}
            onPressIn={() => {
                pressed.value = 1;
                props.onPressIn?.();
            }}
            onPressOut={() => {
                pressed.value = 0;
            }}
            style={[{ minHeight: c.minHeight, padding: c.padding, justifyContent: 'center' }, props.style]}
        >
            <ListRowContent props={props} />
            <PressIndication pressed={pressed} color={theme.colors.onBackground} />
        </Pressable>
    );
}

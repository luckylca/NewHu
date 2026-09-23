import { Divider, Text } from '../primitives';
import { useTheme } from '../theme';
import React from 'react';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Design System bottom NavigationBar.
 *
 * Visual reference:
 *   miuix-vue/src/components/navigation-bar/NavigationBar.vue (NavigationBar.kt)
 *
 * Item height 64, icon 26, label 12. Selected = opacity 1 + bold label;
 * unselected = opacity 0.4; pressed dims further (selected 0.5 / unselected
 * 0.6). A top Divider; bg surface. No Material 3 selected pill.
 */

export interface NavigationBarItem {
    label: string;
}

export interface AppNavigationBarProps {
    items?: NavigationBarItem[];
    selected?: number;
    onSelect?: (index: number) => void;
    /** Render the item icon: (item, index, selected) => node. */
    renderIcon?: (item: NavigationBarItem, index: number, selected: boolean) => ReactNode;
    showDivider?: boolean;
}

export const NavigationBar = React.memo(function NavigationBar({ items = [], selected = 0, onSelect, renderIcon, showDivider = true }: AppNavigationBarProps) {
    const theme = useTheme();
    const c = theme.components.navigationBar;
    const insets = useSafeAreaInsets();

    return (
        <View style={{ backgroundColor: theme.colors.surface, width: '100%', paddingBottom: insets.bottom }}>
            {showDivider && <Divider />}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {items.map((item, index) => (
                    <NavigationItem
                        key={index}
                        item={item}
                        index={index}
                        selected={index === selected}
                        onSelect={onSelect}
                        renderIcon={renderIcon}
                    />
                ))}
            </View>
        </View>
    );
});
NavigationBar.displayName = 'HyperNavigationBar';

const NavigationItem = React.memo(function NavigationItem({
    item,
    index,
    selected,
    onSelect,
    renderIcon,
}: {
    item: NavigationBarItem;
    index: number;
    selected: boolean;
    onSelect?: (index: number) => void;
    renderIcon?: (item: NavigationBarItem, index: number, selected: boolean) => ReactNode;
}) {
    const theme = useTheme();
    const c = theme.components.navigationBar;
    return (
        <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onSelect?.(index)}
            style={({ pressed }) => ({ flex: 1, opacity: selected ? pressed ? theme.opacity.navPressedSelected : theme.opacity.navSelected : pressed ? theme.opacity.navPressedUnselected : theme.opacity.navUnselected })}
        >
            <View style={{ height: c.itemHeight, alignItems: 'center', justifyContent: 'flex-start' }}>
                <View style={{ width: c.iconSize, height: c.iconSize, marginTop: theme.spacing.sm, alignItems: 'center', justifyContent: 'center' }}>
                    {renderIcon?.(item, index, selected)}
                </View>
                <Text
                    size={c.labelSize}
                    weight={selected ? 'bold' : 'normal'}
                    color={theme.colors.onSurfaceContainer}
                    style={{ marginBottom: theme.spacing.sm, lineHeight: 12 }}
                >
                    {item.label}
                </Text>
            </View>
        </Pressable>
    );
});
NavigationItem.displayName = 'HyperNavigationItem';

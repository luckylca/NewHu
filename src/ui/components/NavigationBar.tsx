import { Divider, Text } from '@/src/ui/primitives';
import { useTheme } from '@/src/ui/theme';
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

export function NavigationBar({ items = [], selected = 0, onSelect, renderIcon, showDivider = true }: AppNavigationBarProps) {
    const theme = useTheme();
    const c = theme.components.navigationBar;
    const insets = useSafeAreaInsets();

    return (
        <View style={{ backgroundColor: theme.colors.surface, width: '100%', paddingBottom: insets.bottom }}>
            {showDivider && <Divider />}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {items.map((item, index) => {
                    const isSelected = index === selected;
                    return (
                        <Pressable
                            key={index}
                            accessibilityRole="tab"
                            accessibilityState={{ selected: isSelected }}
                            onPress={() => onSelect?.(index)}
                            style={({ pressed }) => ({
                                flex: 1,
                                height: c.itemHeight,
                                alignItems: 'center',
                                justifyContent: 'flex-start',
                                opacity: isSelected
                                    ? pressed
                                        ? theme.opacity.navPressedSelected
                                        : theme.opacity.navSelected
                                    : pressed
                                        ? theme.opacity.navPressedUnselected
                                        : theme.opacity.navUnselected,
                            })}
                        >
                            <View style={{ width: c.iconSize, height: c.iconSize, marginTop: theme.spacing.sm, alignItems: 'center', justifyContent: 'center' }}>
                                {renderIcon?.(item, index, isSelected)}
                            </View>
                            <Text
                                size={c.labelSize}
                                weight={isSelected ? 'bold' : 'normal'}
                                color={theme.colors.onSurfaceContainer}
                                style={{ marginBottom: theme.spacing.sm, lineHeight: 12 }}
                            >
                                {item.label}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}

import { Text } from '@/src/ui/primitives';
import { tabIndicator } from '@/src/ui/motion';
import { useTheme } from '@/src/ui/theme';
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, withTiming } from 'react-native-reanimated';

/**
 * Design System SegmentedControl (= Miuix TabRow).
 *
 * Visual reference:
 *   miuix-vue/src/components/tab-row/TabRow.vue (TabRow.kt)
 *
 * TabRow defaults: height 42, radius 12, tab min 76 / max 98, spacing 9,
 * text body1 (16). bg surface / text onSurfaceVariantSummary; selected bg
 * surfaceContainer / text onBackground (bold). Equal tab widths via
 * calculateTabWidth (clamped to [min,max]); the selected indicator slides with
 * tween 200ms linear.
 *
 * `contour` (TabRowWithContour): height 45, radius 8, tab min 62 / max 84,
 * spacing 5, text body2 (14), contour padding 5 → outer radius 13.
 */

export interface AppSegmentedControlProps {
    tabs: string[];
    selected?: number;
    onSelect?: (index: number) => void;
    /** TabRowWithContour variant. */
    contour?: boolean;
}

export function SegmentedControl({ tabs, selected = 0, onSelect, contour = false }: AppSegmentedControlProps) {
    const theme = useTheme();
    const c = theme.components.tabRow;

    const defaults = contour
        ? { height: 45, radius: 8, minW: 62, maxW: 84, spacing: 5, pad: 5, textSize: 14 }
        : { height: c.height, radius: c.radius, minW: 76, maxW: 98, spacing: 9, pad: 0, textSize: 16 };

    const [availableWidth, setAvailableWidth] = useState(0);

    const onLayout = useCallback((e: LayoutChangeEvent) => {
        const width = e.nativeEvent.layout.width;
        setAvailableWidth(Math.max(0, width - defaults.pad * 2));
    }, [defaults.pad]);

    // Mirrors calculateTabWidth in source.
    const count = tabs.length;
    let tabWidth = defaults.minW;
    if (count > 0) {
        const totalSpacing = count > 1 ? (count - 1) * defaults.spacing : 0;
        const contentWidth = availableWidth - totalSpacing;
        if (contentWidth > 0) {
            const ideal = contentWidth / count;
            if (ideal < defaults.minW) tabWidth = defaults.minW;
            else if (ideal > defaults.maxW) {
                const totalMax = defaults.maxW * count + totalSpacing;
                tabWidth = totalMax < availableWidth ? ideal : defaults.maxW;
            } else tabWidth = ideal;
        }
    }

    // Indicator: absolute, slides via tween 200ms linear. Derived so it
    // re-targets the timing whenever the selection / geometry changes.
    const indicatorX = useDerivedValue(() => withTiming(selected * (tabWidth + defaults.spacing), tabIndicator));
    const indicatorStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: indicatorX.value }],
    }));

    return (
        <View style={{ width: '100%' }} onLayout={onLayout}>
            <View
                style={{
                    height: defaults.height,
                    borderRadius: contour ? defaults.radius + defaults.pad : 0,
                    backgroundColor: contour ? theme.colors.surface : theme.colors.surface,
                    overflow: 'hidden',
                }}
            >
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ flexGrow: 0 }}
                    contentContainerStyle={{ padding: defaults.pad }}
                    bounces={false}
                >
                    <View style={{ flexDirection: 'row', gap: defaults.spacing }}>
                        {/* Indicator sits behind the tabs */}
                        {count > 0 && (
                            <Animated.View
                                pointerEvents="none"
                                style={[
                                    {
                                        position: 'absolute',
                                        top: 0,
                                        bottom: 0,
                                        left: 0,
                                        width: tabWidth,
                                        height: '100%',
                                        borderRadius: defaults.radius,
                                        backgroundColor: theme.colors.surfaceContainer,
                                    },
                                    indicatorStyle,
                                ]}
                            />
                        )}
                        {tabs.map((tab, index) => {
                            const isSelected = index === selected;
                            return (
                                <Pressable
                                    key={index}
                                    accessibilityRole="tab"
                                    accessibilityState={{ selected: isSelected }}
                                    onPress={() => onSelect?.(index)}
                                    style={{
                                        flex: 0,
                                        width: tabWidth,
                                        height: '100%',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderRadius: defaults.radius,
                                        paddingHorizontal: contour ? 0 : 12,
                                    }}
                                >
                                    <Text
                                        type="body1"
                                        size={defaults.textSize}
                                        weight={isSelected ? 'bold' : 'normal'}
                                        color={isSelected ? theme.colors.onBackground : theme.colors.onSurfaceVariantSummary}
                                        numberOfLines={1}
                                    >
                                        {tab}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                </ScrollView>
            </View>
        </View>
    );
}

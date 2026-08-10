import { Text } from '@/src/ui/primitives';
import { tabIndicator } from '@/src/ui/motion';
import { useTheme } from '@/src/ui/theme';
import React, { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

export interface AppSegmentedControlProps {
    tabs: string[];
    selected?: number;
    onSelect?: (index: number) => void;
    contour?: boolean;
}

const CONTROL_HEIGHT = 46;
const CONTROL_PADDING = 3;

export function SegmentedControl({ tabs, selected = 0, onSelect }: AppSegmentedControlProps) {
    const theme = useTheme();
    const [width, setWidth] = useState(0);
    const count = Math.max(tabs.length, 1);
    const tabWidth = Math.max(0, (width - CONTROL_PADDING * 2) / count);

    const onLayout = useCallback((event: LayoutChangeEvent) => {
        setWidth(event.nativeEvent.layout.width);
    }, []);

    const indicatorStyle = useAnimatedStyle(() => ({
        width: tabWidth,
        transform: [{
            translateX: withTiming(
                CONTROL_PADDING + selected * tabWidth,
                tabIndicator,
            ),
        }],
    }), [selected, tabWidth]);

    return (
        <View
            onLayout={onLayout}
            style={{
                width: '100%',
                height: CONTROL_HEIGHT,
                padding: CONTROL_PADDING,
                borderRadius: 15,
                backgroundColor: theme.colors.surfaceContainerHigh,
                overflow: 'hidden',
            }}
        >
            {width > 0 ? (
                <Animated.View
                    pointerEvents="none"
                    style={[
                        {
                            position: 'absolute',
                            top: CONTROL_PADDING,
                            bottom: CONTROL_PADDING,
                            left: 0,
                            borderRadius: 12,
                            backgroundColor: theme.colors.surfaceContainerHighest,
                        },
                        indicatorStyle,
                    ]}
                />
            ) : null}

            <View style={{ flex: 1, flexDirection: 'row' }}>
                {tabs.map((tab, index) => {
                    const isSelected = index === selected;
                    return (
                        <Pressable
                            key={`${tab}-${index}`}
                            accessibilityRole="tab"
                            accessibilityState={{ selected: isSelected }}
                            onPress={() => onSelect?.(index)}
                            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12 }}
                        >
                            <Text
                                type="body1"
                                weight={isSelected ? 'bold' : 'medium'}
                                color={isSelected ? theme.colors.onBackground : theme.colors.onSurfaceVariantSummary}
                                numberOfLines={1}
                            >
                                {tab}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}

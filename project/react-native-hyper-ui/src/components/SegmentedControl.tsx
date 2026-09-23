import { Text } from '../primitives';
import { tabIndicator } from '../motion';
import { useReducedMotionPreference } from '../motion/MotionProvider';
import { useTheme } from '../theme';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

export interface AppSegmentedControlProps {
    tabs: string[];
    selected?: number;
    onSelect?: (index: number) => void;
    contour?: boolean;
}

const CONTROL_HEIGHT = 56;
const CONTROL_PADDING = 4;

export const SegmentedControl = React.memo(function SegmentedControl({ tabs, selected = 0, onSelect }: AppSegmentedControlProps) {
    const theme = useTheme();
    const reducedMotion = useReducedMotionPreference();
    const [width, setWidth] = useState(0);
    const [visualSelected, setVisualSelected] = useState(selected);
    const indicatorX = useSharedValue(CONTROL_PADDING);
    const indicatorInitialized = useRef(false);
    const count = Math.max(tabs.length, 1);
    const tabWidth = Math.max(0, (width - CONTROL_PADDING * 2) / count);

    const onLayout = useCallback((event: LayoutChangeEvent) => {
        setWidth(event.nativeEvent.layout.width);
    }, []);

    useEffect(() => {
        setVisualSelected(selected);
        if (tabWidth <= 0) return;
        const target = CONTROL_PADDING + selected * tabWidth;
        if (!indicatorInitialized.current || reducedMotion) {
            indicatorX.value = target;
            indicatorInitialized.current = true;
        } else {
            indicatorX.value = withTiming(target, tabIndicator);
        }
    }, [indicatorX, reducedMotion, selected, tabWidth]);

    const indicatorStyle = useAnimatedStyle(() => ({
        width: tabWidth,
        transform: [{ translateX: indicatorX.value }],
    }), [indicatorX, tabWidth]);

    const handlePress = useCallback((index: number) => {
        setVisualSelected(index);
        if (tabWidth > 0) {
            const target = CONTROL_PADDING + index * tabWidth;
            indicatorX.value = reducedMotion ? target : withTiming(target, tabIndicator);
            indicatorInitialized.current = true;
        }
        onSelect?.(index);
    }, [indicatorX, onSelect, reducedMotion, tabWidth]);

    return (
        <View
            onLayout={onLayout}
            style={{
                width: '100%',
                height: CONTROL_HEIGHT,
                padding: CONTROL_PADDING,
                borderRadius: 18,
                backgroundColor: theme.colors.secondaryVariant,
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
                            borderRadius: 14,
                            backgroundColor: theme.colors.surfaceContainer,
                        },
                        indicatorStyle,
                    ]}
                />
            ) : null}

            <View style={{ flex: 1, flexDirection: 'row' }}>
                {tabs.map((tab, index) => (
                    <SegmentedTab
                        key={`${tab}-${index}`}
                        label={tab}
                        index={index}
                        selected={index === visualSelected}
                        onSelect={handlePress}
                    />
                ))}
            </View>
        </View>
    );
});
SegmentedControl.displayName = 'HyperSegmentedControl';

const SegmentedTab = React.memo(function SegmentedTab({
    label,
    index,
    selected,
    onSelect,
}: {
    label: string;
    index: number;
    selected: boolean;
    onSelect: (index: number) => void;
}) {
    const theme = useTheme();
    return (
        <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onSelect(index)}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 14 }}
        >
            <Text
                type="body1"
                weight={selected ? 'bold' : 'medium'}
                color={selected ? theme.colors.onBackground : theme.colors.onSurfaceVariantSummary}
                numberOfLines={1}
            >
                {label}
            </Text>
        </Pressable>
    );
});
SegmentedTab.displayName = 'HyperSegmentedTab';

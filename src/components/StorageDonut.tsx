import { Text } from '@/src/ui/primitives';
import { useTheme } from '@/src/ui/theme';
import React from 'react';
import { InteractionManager, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { storageEnter } from '@/src/ui/motion';

export type StorageSegment = { value: number; color: string };

function StorageDonut({ segments, totalText }: { segments: StorageSegment[]; totalText: string }) {
    const theme = useTheme();
    const size = 196;
    const strokeWidth = 15;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0);
    const entrance = useSharedValue(0);
    let offset = 0;

    React.useEffect(() => {
        if (total <= 0) return;
        const task = InteractionManager.runAfterInteractions(() => {
            entrance.value = withSpring(1, storageEnter);
        });
        return () => task.cancel();
    }, [entrance, total]);

    const ringStyle = useAnimatedStyle(() => ({
        opacity: entrance.value,
        transform: [
            { scale: 0.84 + entrance.value * 0.16 },
            { rotate: `${(1 - entrance.value) * -12}deg` },
        ],
    }));
    const labelStyle = useAnimatedStyle(() => ({
        opacity: entrance.value,
        transform: [{ translateY: (1 - entrance.value) * 8 }],
    }));

    return (
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View style={[{ position: 'absolute' }, ringStyle]}>
                <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
                    <Circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke={theme.colors.sliderBackground}
                        strokeWidth={strokeWidth}
                    />
                    {total > 0 ? segments.map((segment, index) => {
                        const length = circumference * (Math.max(0, segment.value) / total);
                        const currentOffset = offset;
                        offset += length;
                        return (
                            <Circle
                                key={`${segment.color}:${index}`}
                                cx={size / 2}
                                cy={size / 2}
                                r={radius}
                                fill="none"
                                stroke={segment.color}
                                strokeWidth={strokeWidth}
                                strokeDasharray={`${Math.max(0, length - 2)} ${circumference}`}
                                strokeDashoffset={-currentOffset}
                                strokeLinecap="round"
                            />
                        );
                    }) : null}
                </Svg>
            </Animated.View>
            <Animated.View style={[{ alignItems: 'center' }, labelStyle]}>
                <Text type="footnote1" color={theme.colors.onSurfaceVariantSummary}>应用数据</Text>
                <Text type="title2" weight="bold" style={{ marginTop: 2 }}>{totalText}</Text>
            </Animated.View>
        </View>
    );
}

export default React.memo(StorageDonut, (previous, next) => (
    previous.totalText === next.totalText
    && previous.segments.length === next.segments.length
    && previous.segments.every((segment, index) => segment.value === next.segments[index]?.value && segment.color === next.segments[index]?.color)
));

import { Text } from '@/src/ui/primitives';
import { useTheme } from '@/src/ui/theme';
import React from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

export type StorageSegment = { value: number; color: string };

function StorageDonut({ segments, totalText }: { segments: StorageSegment[]; totalText: string }) {
    const theme = useTheme();
    const size = 196;
    const strokeWidth = 15;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0);
    let offset = 0;

    return (
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ position: 'absolute' }}>
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
            </View>
            <View style={{ alignItems: 'center' }}>
                <Text type="footnote1" color={theme.colors.onSurfaceVariantSummary}>应用数据</Text>
                <Text type="title2" weight="bold" style={{ marginTop: 2 }}>{totalText}</Text>
            </View>
        </View>
    );
}

export default React.memo(StorageDonut, (previous, next) => (
    previous.totalText === next.totalText
    && previous.segments.length === next.segments.length
    && previous.segments.every((segment, index) => segment.value === next.segments[index]?.value && segment.color === next.segments[index]?.color)
));

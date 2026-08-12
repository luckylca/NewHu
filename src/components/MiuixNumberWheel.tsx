import { Text } from '@/src/ui/primitives';
import { useTheme } from '@/src/ui/theme';
import React, { memo, useCallback, useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

// Miuix NumberPicker: 45dp rows and five visible rows.
const ITEM_HEIGHT = 45;
const VISIBLE_ITEM_COUNT = 5;
const HALF_VISIBLE_COUNT = Math.floor(VISIBLE_ITEM_COUNT / 2);
const FLING_FRICTION = 8.4;
const SPRING_CONFIG = {
    damping: 42,
    mass: 0.7,
    overshootClamping: true,
    stiffness: 520,
};

type WheelItemProps = {
    index: number;
    value: number;
    currentIndex: ReturnType<typeof useSharedValue<number>>;
    offset: ReturnType<typeof useSharedValue<number>>;
    color: string;
};

const WheelItem = memo(function WheelItem({ index, value, currentIndex, offset, color }: WheelItemProps) {
    const itemStyle = useAnimatedStyle(() => {
        // `distance` is measured in rows from the centered item. This is the
        // same scale/alpha curve used by miuix-vue's NumberPicker.
        // The offset follows the finger: moving up produces a positive offset,
        // so the content also moves up instead of exposing an empty area.
        const distance = index - currentIndex.value - offset.value;
        const normalizedDistance = Math.min(Math.abs(distance) / (HALF_VISIBLE_COUNT + 0.5), 1);
        const alpha =
            (1 - normalizedDistance) *
            (1 - normalizedDistance * 0.5) *
            (1 - normalizedDistance * 0.2);
        const scale = 1 - normalizedDistance * 0.2;

        return {
            opacity: alpha,
            transform: [{ translateY: distance * ITEM_HEIGHT }, { scale }],
        };
    });

    return (
        <Animated.View
            pointerEvents="none"
            style={[
                {
                    position: 'absolute',
                    top: ITEM_HEIGHT * HALF_VISIBLE_COUNT,
                    left: 0,
                    right: 0,
                    height: ITEM_HEIGHT,
                    marginTop: -ITEM_HEIGHT / 2,
                    alignItems: 'center',
                    justifyContent: 'center',
                },
                itemStyle,
            ]}
        >
            <Text type="title1" weight="semibold" color={color}>
                {value}
            </Text>
        </Animated.View>
    );
});

export default function MiuixNumberWheel({
    value,
    min = 0,
    max,
    step = 5,
    onChange,
}: {
    value: number;
    min?: number;
    max: number;
    step?: number;
    onChange: (value: number) => void;
}) {
    const theme = useTheme();
    const values = useMemo(() => {
        const result: number[] = [];
        for (let current = min; current <= max; current += step) result.push(current);
        return result.length > 0 ? result : [min];
    }, [max, min, step]);

    const selectedIndex = Math.max(0, Math.min(values.length - 1, values.indexOf(value) < 0 ? 0 : values.indexOf(value)));
    const currentIndex = useSharedValue(selectedIndex);
    const offset = useSharedValue(0);
    const startOffset = useSharedValue(0);

    useEffect(() => {
        currentIndex.value = selectedIndex;
        offset.value = 0;
    }, [currentIndex, offset, selectedIndex]);

    const commit = useCallback(
        (rowOffset: number) => {
            const nextIndex = Math.max(0, Math.min(values.length - 1, selectedIndex + Math.round(rowOffset)));
            currentIndex.value = nextIndex;
            offset.value = 0;
            const nextValue = values[nextIndex];
            if (nextValue !== value) onChange(nextValue);
        },
        [currentIndex, offset, onChange, selectedIndex, value, values],
    );

    const pan = useMemo(
        () => {
            const settle = (velocityY: number) => {
                'worklet';
                // Project the fling, then clamp before springing. This keeps
                // the first and last values centered with no blank overscroll.
                const projectedOffset = offset.value + (-velocityY / ITEM_HEIGHT) / FLING_FRICTION;
                const minimum = -currentIndex.value;
                const maximum = values.length - 1 - currentIndex.value;
                const target = Math.max(minimum, Math.min(maximum, Math.round(projectedOffset)));
                offset.value = withSpring(target, SPRING_CONFIG, (finished) => {
                    if (finished) runOnJS(commit)(target);
                });
            };

            return Gesture.Pan()
                .activeOffsetY([-4, 4])
                .maxPointers(1)
                .onStart(() => {
                    // A new drag must always start from the currently visible
                    // position; otherwise an interrupted spring can leave a gap.
                    cancelAnimation(offset);
                    startOffset.value = offset.value;
                })
                .onUpdate((event) => {
                    // Positive offset means the finger moved up. The rendered
                    // distance subtracts it, so the number layer follows the drag.
                    const rawOffset = startOffset.value - event.translationY / ITEM_HEIGHT;
                    const minimum = -currentIndex.value;
                    const maximum = values.length - 1 - currentIndex.value;
                    offset.value = Math.max(minimum, Math.min(maximum, rawOffset));
                })
                .onEnd((event) => settle(event.velocityY))
                .onFinalize((...finalizeArgs) => {
                    const success = finalizeArgs[1];
                    if (!success) settle(0);
                });
        },
        [commit, currentIndex, offset, startOffset, values.length],
    );

    const items = useMemo(
        () => values.map((item, index) => (
            <WheelItem
                key={item}
                index={index}
                value={item}
                currentIndex={currentIndex}
                offset={offset}
                color={theme.colors.onSurface}
            />
        )),
        [currentIndex, offset, theme.colors.onSurface, values],
    );

    const wheelWidth = Math.max(60, String(values[values.length - 1]).length * 24);

    return (
        <View
            style={{
                height: ITEM_HEIGHT * VISIBLE_ITEM_COUNT,
                width: '100%',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
            }}
        >
            <GestureDetector gesture={pan}>
                <View
                    accessible
                    accessibilityRole="adjustable"
                    accessibilityLabel="缓存数量"
                    style={{ width: wheelWidth, height: '100%' }}
                >
                    <View pointerEvents="none" style={{ width: '100%', height: '100%' }}>
                        {items}
                    </View>
                </View>
            </GestureDetector>
        </View>
    );
}

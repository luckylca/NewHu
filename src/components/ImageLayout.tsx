import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

export default function ImageLayout({ uri, onClose, onLongPress }: {
    uri: string;
    onClose: () => void;
    onLongPress?: (x: number, y: number) => void;
}) {
    const { width, height } = useWindowDimensions();
    const scale = useSharedValue(1);
    const savedScale = useSharedValue(1);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const contextX = useSharedValue(0);
    const contextY = useSharedValue(0);

    const doubleTap = Gesture.Tap()
        .numberOfTaps(2)
        .onStart(() => {
            if (scale.value !== 1) {
                scale.value = withTiming(1);
                translateX.value = withTiming(0);
                translateY.value = withTiming(0);
                savedScale.value = 1;
            } else {
                scale.value = withTiming(2);
                savedScale.value = 2;
            }
        });

    const singleTap = Gesture.Tap()
        .maxDistance(12)
        .onEnd((_, success) => {
            if (success) scheduleOnRN(onClose);
        });

    const longPress = Gesture.LongPress()
        .minDuration(500)
        .maxDistance(20)
        .onStart((event) => {
            if (onLongPress) scheduleOnRN(onLongPress, event.absoluteX, event.absoluteY);
        });

    const pinchGesture = Gesture.Pinch()
        .onUpdate((event) => {
            scale.value = event.scale * savedScale.value;
        })
        .onEnd(() => {
            if (scale.value < 1) {
                scale.value = withTiming(1);
                translateX.value = withTiming(0);
                translateY.value = withTiming(0);
                savedScale.value = 1;
            } else {
                savedScale.value = scale.value;
            }
        });

    const boundaries = useDerivedValue(() => ({
        maxX: Math.max(0, (width * scale.value - width) / 2),
        maxY: Math.max(0, (height * scale.value - height) / 2),
    }));

    const panGesture = Gesture.Pan()
        .onStart(() => {
            contextX.value = translateX.value;
            contextY.value = translateY.value;
        })
        .onUpdate((event) => {
            translateX.value = contextX.value + event.translationX;
            translateY.value = contextY.value + event.translationY;
        })
        .onEnd(() => {
            translateX.value = withTiming(Math.max(-boundaries.value.maxX, Math.min(boundaries.value.maxX, translateX.value)));
            translateY.value = withTiming(Math.max(-boundaries.value.maxY, Math.min(boundaries.value.maxY, translateY.value)));
        });

    const gesture = Gesture.Simultaneous(
        Gesture.Exclusive(doubleTap, singleTap, longPress),
        pinchGesture,
        panGesture,
    );

    const imageStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { scale: scale.value },
        ],
    }));

    return (
        <View style={styles.container}>
            <GestureDetector gesture={gesture}>
                <Animated.Image source={{ uri }} style={[styles.image, imageStyle]} resizeMode="contain" />
            </GestureDetector>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        overflow: 'hidden',
        backgroundColor: '#000000',
    },
    image: {
        width: '100%',
        height: '100%',
    },
});

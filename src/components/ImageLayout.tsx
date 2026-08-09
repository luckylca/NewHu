import { Icon, Text } from '@/src/ui';
import React from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

const MAX_SCALE = 4;

export default function ImageLayout({ uri, onClose }: { uri: string; onClose: () => void }) {
    const { width, height } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const scale = useSharedValue(1);
    const savedScale = useSharedValue(1);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const savedX = useSharedValue(0);
    const savedY = useSharedValue(0);

    const resetImage = () => {
        'worklet';
        scale.value = withTiming(1);
        savedScale.value = 1;
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedX.value = 0;
        savedY.value = 0;
    };

    const clampPosition = () => {
        'worklet';
        const maxX = Math.max(0, (width * scale.value - width) / 2);
        const maxY = Math.max(0, (height * scale.value - height) / 2);
        translateX.value = withTiming(Math.max(-maxX, Math.min(maxX, translateX.value)));
        translateY.value = withTiming(Math.max(-maxY, Math.min(maxY, translateY.value)));
        savedX.value = Math.max(-maxX, Math.min(maxX, translateX.value));
        savedY.value = Math.max(-maxY, Math.min(maxY, translateY.value));
    };

    const singleTap = Gesture.Tap()
        .maxDuration(250)
        .onEnd((_, success) => {
            if (success && scale.value <= 1.01) scheduleOnRN(onClose);
        });

    const doubleTap = Gesture.Tap()
        .numberOfTaps(2)
        .onEnd((_, success) => {
            if (!success) return;
            if (scale.value > 1.01) {
                resetImage();
            } else {
                scale.value = withTiming(2.5);
                savedScale.value = 2.5;
            }
        });

    const pinch = Gesture.Pinch()
        .onUpdate((event) => {
            scale.value = Math.max(0.8, Math.min(MAX_SCALE, savedScale.value * event.scale));
        })
        .onEnd(() => {
            if (scale.value < 1) {
                resetImage();
                return;
            }
            savedScale.value = scale.value;
            clampPosition();
        });

    const pan = Gesture.Pan()
        .minDistance(4)
        .onStart(() => {
            savedX.value = translateX.value;
            savedY.value = translateY.value;
        })
        .onUpdate((event) => {
            if (scale.value <= 1) return;
            translateX.value = savedX.value + event.translationX;
            translateY.value = savedY.value + event.translationY;
        })
        .onEnd(clampPosition);

    const gesture = Gesture.Simultaneous(pinch, pan, Gesture.Exclusive(doubleTap, singleTap));
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

            <View style={[styles.toolbar, { top: insets.top + 8 }]}>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="关闭图片"
                    onPress={onClose}
                    hitSlop={8}
                    style={({ pressed }) => [styles.closeButton, { opacity: pressed ? 0.65 : 1 }]}
                >
                    <Icon name="close" size={24} color="#FFFFFF" />
                </Pressable>
            </View>

            <Text type="footnote1" color="rgba(255,255,255,0.65)" style={[styles.hint, { bottom: insets.bottom + 14 }]}>
                双击缩放 · 单击关闭
            </Text>
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
    toolbar: {
        position: 'absolute',
        left: 12,
        zIndex: 2,
    },
    closeButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.45)',
    },
    hint: {
        position: 'absolute',
        alignSelf: 'center',
    },
});

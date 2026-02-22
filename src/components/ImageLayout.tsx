import React from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    useDerivedValue
} from 'react-native-reanimated';
import { Portal,Menu } from 'react-native-paper';
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
import { scheduleOnRN } from 'react-native-worklets';

export default function ImageLayout({ uri }: { uri: string }) {
    // 定义缩放比例的共享变量
    const scale = useSharedValue(1);
    const savedScale = useSharedValue(1); // 用于保存上一次的缩放比例
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const contextX = useSharedValue(0);
    const contextY = useSharedValue(0);
    const [longPressPlace, setLongPressPlace] = React.useState({ x: 0, y: 0 });
    const [showMenu, setShowMenu] = React.useState(false);
    // 定义双击手势
    const doubleTap = Gesture.Tap()
        .numberOfTaps(2)
        .onStart(() => {
            if (scale.value !== 1) {
                // 如果当前已经放大，双击恢复原状
                scale.value = withTiming(1);
                translateX.value = withTiming(0);
                translateY.value = withTiming(0);
                savedScale.value = 1;
            } else {
                // 如果当前是原状，双击放大到 2 倍
                scale.value = withTiming(2);
                savedScale.value = 2;
            }
        });
    const pinchGesture = Gesture.Pinch()
        .onUpdate((e) => {
            scale.value = e.scale*savedScale.value;
        })
        .onEnd(() => {
            if (scale.value < 1) scale.value = withTiming(1);
            else savedScale.value = scale.value; // 结束时保存当前的缩放比例
        });

    const boundaries = useDerivedValue(() => {
        // 这里的逻辑运行在 UI 线程
        const maxW = Math.max(0, (screenWidth * scale.value - screenWidth) / 2);
        const maxH = Math.max(0, (screenHeight * scale.value - screenHeight) / 2);
        return { maxW, maxH };
    });

    const panGesture = Gesture.Pan()
        .onStart((e) => {
            contextX.value = translateX.value;
            contextY.value = translateY.value;
        })
        .onUpdate((e) => {
            translateX.value = contextX.value + e.translationX;
            translateY.value = contextY.value + e.translationY;
        })
        .onEnd(() => {
            if (translateX.value > boundaries.value.maxW) {
                translateX.value = withTiming(boundaries.value.maxW);
            } else if (translateX.value < -boundaries.value.maxW) {
                translateX.value = withTiming(-boundaries.value.maxW);
            }
            if (translateY.value > boundaries.value.maxH) {
                translateY.value = withTiming(boundaries.value.maxH);
            } else if (translateY.value < -boundaries.value.maxH) {
                translateY.value = withTiming(-boundaries.value.maxH);
            }
        });
    const longPressGesture = Gesture.LongPress()
        .onStart((e) => {
            scheduleOnRN(setLongPressPlace, { x: e.x, y: e.y });
            scheduleOnRN(setShowMenu,true)
        });
    // 使用 Gesture.Exclusive 或 Gesture.Race 组合
    const composedGesture = Gesture.Simultaneous(doubleTap, pinchGesture, panGesture,longPressGesture);
    // 将缩放应用到样式
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { scale: scale.value },
        ],
    }));

    return (
        <View style={styles.container}>
            <Portal>
                <Menu
                    visible={showMenu}
                    onDismiss={() => setShowMenu(false)}
                    anchor={{ x: longPressPlace.x, y: longPressPlace.y }}
                >
                    <Menu.Item onPress={() => {console.log(uri)}} title="保存图片" />
                    <Menu.Item onPress={() => {console.log(uri)}} title="分享图片" />
                </Menu>
            </Portal>
            <GestureDetector gesture={composedGesture}>
                <Animated.Image
                    source={{ uri }}
                    style={[styles.image, animatedStyle]}
                    resizeMode="contain"
                />
            </GestureDetector>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        overflow: 'hidden', // 必须加，防止图片放大后超出容器遮挡其他内容
        backgroundColor: '#000',
    },
    image: {
        width: '100%',
        height: '100%',
    },
});
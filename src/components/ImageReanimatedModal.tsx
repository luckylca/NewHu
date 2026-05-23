import ImageLayout from "@/src/components/ImageLayout";
import React, { useEffect } from 'react';
import { BackHandler, Dimensions, StyleSheet } from 'react-native';
import { Portal } from 'react-native-paper';
import Animated, {
    Extrapolation,
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const ImageReanimatedModal = ({origin, visible, url, onClose}: {origin: { x: number; y: number; width: number; height: number }, visible: boolean, url: string, onClose: () => void}) => {

    const progress = useSharedValue(0);
    const [showImage, setShowImage] = React.useState(visible);
    useEffect(() => {
        if (visible) {
            setShowImage(true);
            progress.value = withSpring(1, {
                damping: 50,
                stiffness: 200,
                mass: 1,
            });
        }
        else {
            progress.value = withTiming(0, { duration: 300 }, (finished) => {
                if (finished) {
                    scheduleOnRN(setShowImage, false);
                }
            });
        }
    }, [visible, progress]);
    useEffect(() => {
        const backAction = () => {
            if (visible) {
                onClose();
                return true;
            }
            return false;
        };

        const backHandler = BackHandler.addEventListener(
            'hardwareBackPress',
            backAction
        );
        return () => backHandler.remove();
    }, [visible, onClose]);

    const safeOrigin = origin ?? { x: 0, y: 0, width: 0, height: 0 };
    const containerStyle = useAnimatedStyle(() => {
        const top = interpolate(progress.value, [0, 1], [safeOrigin.y, 0]);
        const left = interpolate(progress.value, [0, 1], [safeOrigin.x, 0]);
        const width = interpolate(progress.value, [0, 1], [safeOrigin.width, SCREEN_WIDTH]);
        const height = interpolate(progress.value, [0, 1], [safeOrigin.height, SCREEN_HEIGHT]);
        const borderRadius = interpolate(progress.value, [0, 1], [10, 0]);

        return {
            top,
            left,
            width,
            height,
            borderRadius,
        };
    });
    const backStyle = useAnimatedStyle(() => {
        const opacity = interpolate(progress.value, [0, 1], [0, 0.7], Extrapolation.CLAMP);
        return {
            opacity,
        };
    });

    if (!showImage || url === "" || !origin) return (<></>);
    return (
        <Portal>
            <Animated.View style={[styles.backdrop, backStyle]} />
            <Animated.View style={[styles.animatedContainer, containerStyle]}>
                <ImageLayout uri={url} onClose={onClose} />
            </Animated.View>
        </Portal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'black',
    },
    animatedContainer: {
        position: 'absolute',
        overflow: 'hidden', // 确保圆角生效
        backgroundColor: 'black', // 避免动画过程中出现透明缝隙
    },
    image: {
        width: '100%',
        height: '100%',
    },
    closeBtnContainer: {
        position: 'absolute',
        top: 50,
        left: 20,
        zIndex: 10,
    },
});


export default ImageReanimatedModal;
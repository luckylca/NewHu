import ImageLayout from '@/src/components/ImageLayout';
import React, { useEffect } from 'react';
import { Modal, StatusBar, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
    Extrapolation,
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { useTheme } from '@/src/ui/theme';

type ImageOrigin = { x: number; y: number; width: number; height: number };

const ImageReanimatedModal = ({ origin, visible, url, onClose }: {
    origin: ImageOrigin;
    visible: boolean;
    url: string;
    onClose: () => void;
}) => {
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const theme = useTheme();
    const progress = useSharedValue(0);
    const [mounted, setMounted] = React.useState(visible);

    useEffect(() => {
        if (visible) {
            setMounted(true);
            progress.value = withSpring(1, { damping: 50, stiffness: 200, mass: 1 });
            return;
        }

        progress.value = withTiming(0, { duration: 220 }, (finished) => {
            if (finished) scheduleOnRN(setMounted, false);
        });
    }, [visible, progress]);

    useEffect(() => {
        if (!mounted) return;
        StatusBar.setBarStyle('light-content', true);
        StatusBar.setBackgroundColor('#000000', true);
        return () => {
            StatusBar.setBarStyle(theme.dark ? 'light-content' : 'dark-content', true);
            StatusBar.setBackgroundColor('transparent', true);
        };
    }, [mounted, theme.dark]);

    const startY = Math.max(0, origin.y - insets.top);
    const containerStyle = useAnimatedStyle(() => ({
        top: interpolate(progress.value, [0, 1], [startY, 0]),
        left: interpolate(progress.value, [0, 1], [origin.x, 0]),
        width: interpolate(progress.value, [0, 1], [origin.width, screenWidth]),
        height: interpolate(progress.value, [0, 1], [origin.height, screenHeight]),
        borderRadius: interpolate(progress.value, [0, 1], [10, 0]),
    }));

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
    }));

    if (!mounted || !url) return null;

    return (
        <Modal
            visible={mounted}
            transparent
            animationType="none"
            statusBarTranslucent={false}
            navigationBarTranslucent={false}
            onRequestClose={onClose}
        >
            <StatusBar barStyle="light-content" backgroundColor="#000000" />
            <Animated.View style={[styles.backdrop, backdropStyle]} />
            <Animated.View style={[styles.container, containerStyle]}>
                <ImageLayout uri={url} onClose={onClose} />
            </Animated.View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000000',
    },
    container: {
        position: 'absolute',
        overflow: 'hidden',
        backgroundColor: '#000000',
    },
});

export default ImageReanimatedModal;

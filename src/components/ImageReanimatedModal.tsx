import ImageLayout from '@/src/components/ImageLayout';
import { Menu } from '@/src/ui';
import React, { useEffect } from 'react';
import { BackHandler, Modal, StatusBar, StyleSheet, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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
import { useReducedMotionPreference } from '@/src/ui/motion';

type ImageOrigin = { x: number; y: number; width: number; height: number };

const ImageReanimatedModal = ({ origin, visible, url, onClose, onLongPress }: {
    origin: ImageOrigin;
    visible: boolean;
    url: string;
    onClose: () => void;
    onLongPress?: () => void;
}) => {
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const theme = useTheme();
    const reducedMotion = useReducedMotionPreference();
    const progress = useSharedValue(0);
    const [mounted, setMounted] = React.useState(visible);
    const [menuVisible, setMenuVisible] = React.useState(false);
    const [menuAnchor, setMenuAnchor] = React.useState({ x: 0, y: 0, width: 1, height: 1 });

    useEffect(() => {
        if (visible) {
            // Mount the transparent modal at the exact source rect first, then
            // start the spring on the next frame. Starting the animation before
            // Modal has committed can skip the first part of the shared motion.
            progress.value = 0;
            setMounted(true);
            const frame = requestAnimationFrame(() => {
                progress.value = reducedMotion ? 1 : withSpring(1, { damping: 50, stiffness: 200, mass: 1 });
            });
            return () => cancelAnimationFrame(frame);
        }

        progress.value = withTiming(0, { duration: reducedMotion ? 100 : 220 }, (finished) => {
            if (finished) scheduleOnRN(setMounted, false);
        });
    }, [visible, reducedMotion, progress]);

    useEffect(() => {
        if (!visible) setMenuVisible(false);
    }, [visible]);

    useEffect(() => {
        if (!mounted) return;
        StatusBar.setBarStyle('light-content', true);
        StatusBar.setBackgroundColor('#000000', true);
        return () => {
            StatusBar.setBarStyle(theme.dark ? 'light-content' : 'dark-content', true);
            StatusBar.setBackgroundColor('transparent', true);
        };
    }, [mounted, theme.dark]);

    useEffect(() => {
        if (!visible) return;
        const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
            onClose();
            return true;
        });
        return () => subscription.remove();
    }, [onClose, visible]);

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

    const openImageMenu = (x: number, y: number) => {
        if (!onLongPress) return;
        setMenuAnchor({ x, y, width: 1, height: 1 });
        setMenuVisible(true);
    };

    return (
        <Modal
            visible={mounted}
            transparent
            animationType="none"
            statusBarTranslucent={false}
            navigationBarTranslucent={false}
            onRequestClose={onClose}
        >
            <GestureHandlerRootView style={styles.modalRoot}>
                <StatusBar barStyle="light-content" backgroundColor="#000000" />
                <Animated.View style={[styles.backdrop, backdropStyle]} />
                <Animated.View style={[styles.container, containerStyle]}>
                    <ImageLayout
                        uri={url}
                        onClose={onClose}
                        onLongPress={openImageMenu}
                    />
                </Animated.View>
                <Menu
                    visible={menuVisible}
                    onClose={() => setMenuVisible(false)}
                    anchor={menuAnchor}
                    items={[{ label: '导出图片', onPress: onLongPress }]}
                />
            </GestureHandlerRootView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalRoot: {
        flex: 1,
        // Keep the source page visible at progress=0. The separate backdrop
        // fades to black while the image expands from its measured position.
        backgroundColor: 'transparent',
    },
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

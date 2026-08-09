import { Text } from '@/src/ui/primitives';
import { bottomSheetEnter, bottomSheetSettle, linearEasing, sheetHandlePress, sheetHandleRelease } from '@/src/ui/motion';
import { useTheme } from '@/src/ui/theme';
import React, { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Design System BottomSheet (Miuix BottomSheetContentLayout + OverlayBottomSheet).
 *
 * Visual reference:
 *   miuix-vue/src/components/bottom-sheet/BottomSheet.vue
 *
 * bg background, top cornerRadius 28, maxWidth 640, insideMargin 24 horizontal,
 * dragHandle 45×4 (radius 2) at onSurfaceVariantSummary @ 0.2; pressed → width
 * 55 / scaleY 1.15 / opacity 0.35 (press 100ms / release 150ms). Enter/exit
 * slide folmeSpring(0.9,0.38); settle-back folmeSpring(0.85,0.4). Drag the
 * handle down past 150 to dismiss (when allowDismiss). Dim backdrop =
 * windowDimming, fades with drag. Upward overscroll (dy*0.1) reveals an
 * overscroll strip behind.
 */

export interface AppBottomSheetProps {
    visible?: boolean;
    onClose?: () => void;
    title?: string;
    allowDismiss?: boolean;
    closeOnClickModal?: boolean;
    /** Start region of the title row (flex: none). */
    startAction?: ReactNode;
    /** End region of the title row (flex: none, pushed right). */
    endAction?: ReactNode;
    children?: ReactNode | ((close: () => void) => ReactNode);
}

const DISMISS_THRESHOLD = 150;
const UPWARD_DAMPING = 0.1;

export function BottomSheet({
    visible = false,
    onClose,
    title,
    allowDismiss = true,
    closeOnClickModal = true,
    startAction,
    endAction,
    children,
}: AppBottomSheetProps) {
    const theme = useTheme();
    const c = theme.components.bottomSheet;
    const { height: windowH } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const sheetBackground = theme.dark ? '#242424' : '#FFFFFF';

    const [rendered, setRendered] = useState(visible);

    const sheetY = useSharedValue(windowH);
    const dimOpacity = useSharedValue(0);
    const handlePressed = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            setRendered(true);
            sheetY.value = withSpring(0, bottomSheetEnter);
            dimOpacity.value = withTiming(1, { duration: 300, easing: linearEasing });
        } else if (rendered) {
            const finish = (finished: boolean | undefined) => {
                if (finished) runOnJS(setRendered)(false);
            };
            sheetY.value = withSpring(windowH, bottomSheetEnter, finish);
            dimOpacity.value = withTiming(0, { duration: 250, easing: linearEasing });
        }
    }, [visible, rendered, windowH, sheetY, dimOpacity]);

    const dragY = useSharedValue(0);

    const handleClose = useCallback(() => {
        onClose?.();
    }, [onClose]);

    const pan = Gesture.Pan()
        .enabled(visible && rendered)
        .activeOffsetY([-4, 4])
        .onBegin(() => {
            handlePressed.value = 1;
        })
        .onUpdate((e) => {
            const dy = e.translationY;
            const damped = dy < 0 ? dy * UPWARD_DAMPING : allowDismiss ? dy : dy * UPWARD_DAMPING;
            dragY.value = damped;
            // Dim fades as the sheet travels down.
            const progress = Math.max(0, Math.min(1, dy / DISMISS_THRESHOLD));
            dimOpacity.value = 1 - progress * 0.6;
        })
        .onFinalize(() => {
            handlePressed.value = 0;
            const dy = dragY.value;
            if (allowDismiss && dy > DISMISS_THRESHOLD) {
                sheetY.value = withSpring(windowH, bottomSheetEnter, (finished) => {
                    if (finished) {
                        runOnJS(setRendered)(false);
                        runOnJS(handleClose)();
                    }
                });
            } else {
                sheetY.value = withSpring(0, bottomSheetSettle);
                dimOpacity.value = withTiming(1, { duration: 150, easing: linearEasing });
            }
            dragY.value = 0;
        });

    const handleStyle = useAnimatedStyle(() => ({
        width: withTiming(handlePressed.value === 1 ? 55 : c.handleWidth, handlePressed.value === 1 ? sheetHandlePress : sheetHandleRelease),
        transform: [{ scaleY: withTiming(handlePressed.value === 1 ? 1.15 : 1, handlePressed.value === 1 ? sheetHandlePress : sheetHandleRelease) }],
        opacity: withTiming(handlePressed.value === 1 ? theme.opacity.sheetHandlePressed : theme.opacity.sheetHandle, handlePressed.value === 1 ? sheetHandlePress : sheetHandleRelease),
    }));

    const sheetStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: sheetY.value + dragY.value }],
    }));

    const dimStyle = useAnimatedStyle(() => ({
        opacity: dimOpacity.value,
        backgroundColor: theme.colors.windowDimming,
    }));

    const overscrollHeight = useAnimatedStyle(() => ({
        height: Math.max(0, -dragY.value) + 1,
    }));

    return (
        <Modal transparent statusBarTranslucent animationType="none" visible={rendered} onRequestClose={handleClose}>
            <Animated.View style={[{ flex: 1, justifyContent: 'flex-end', alignItems: 'center' }, dimStyle]}>
                <Pressable style={StyleSheet.absoluteFill} onPress={closeOnClickModal && allowDismiss ? handleClose : undefined} />
                <Animated.View
                    style={[
                        {
                            width: '100%',
                            maxWidth: c.maxWidth,
                            maxHeight: windowH - insets.top - 24,
                            borderTopLeftRadius: c.radius,
                            borderTopRightRadius: c.radius,
                            backgroundColor: sheetBackground,
                            paddingHorizontal: c.horizontalPadding,
                            paddingBottom: insets.bottom,
                            overflow: 'hidden',
                        },
                        sheetStyle,
                    ]}
                >
                    {/* Overscroll strip — fills the gap when dragged up */}
                    <Animated.View
                        pointerEvents="none"
                        style={[
                            { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: sheetBackground },
                            overscrollHeight,
                        ]}
                    />
                    {/* Drag handle area (only this region drags, like the source) */}
                    <GestureDetector gesture={pan}>
                        <View style={{ height: theme.spacing.xl, alignItems: 'center', justifyContent: 'center' }}>
                            <Animated.View style={[{ height: c.handleHeight, borderRadius: 2, backgroundColor: theme.colors.onSurfaceVariantSummary }, handleStyle]} />
                        </View>
                    </GestureDetector>
                    {(title != null || startAction != null || endAction != null) && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingBottom: 12 }}>
                            <View style={{ flex: 0, justifyContent: 'flex-start' }}>{startAction}</View>
                            <Text type="title4" weight="medium" color={theme.colors.onSurface} style={{ flex: 1, textAlign: 'center' }}>
                                {title}
                            </Text>
                            <View style={{ flex: 0, justifyContent: 'flex-end', marginLeft: 'auto' }}>{endAction}</View>
                        </View>
                    )}
                    <View style={{ flex: 1, minHeight: 0 }}>{typeof children === 'function' ? (children as (close: () => void) => ReactNode)(handleClose) : children}</View>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
}

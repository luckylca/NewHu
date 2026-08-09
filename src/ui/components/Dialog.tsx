import { Text } from '@/src/ui/primitives';
import { dialogContentExit, dialogDimEnter, dialogDimExit, dialogLargeEnter, dialogMobileEnter } from '@/src/ui/motion';
import { useTheme } from '@/src/ui/theme';
import React, { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

/**
 * Design System Dialog (Miuix DialogContentLayout + OverlayDialog).
 *
 * Visual reference:
 *   miuix-vue/src/components/dialog/Dialog.vue (DialogContentLayout.kt)
 *
 * Two forms, switched by isLargeScreen() (windowH ≥ 480 && windowW ≥ 840):
 *   large  — centred, scale 0.8→1 spring (folmeSpringByResponse(0.9,0.3)).
 *   mobile — bottom-aligned, slide up the FULL viewport height
 *            (folmeSpring(0.88,450)); opacity fixed at 1.
 * Content: maxWidth 420, insideMargin 24, cornerRadius coerceAtLeast(32);
 * large maxHeight = viewportH·2/3. title title4(18) Medium centered onBackground
 * mb 12; summary body1(16) centered onSurfaceSecondary mb 12; bg background.
 * Animations: exit content tween 260ms DecelerateEasing(1.5); dim in/out tween
 * 300/250ms DecelerateEasing(1.5). outsideMargin 12.
 */

export interface AppDialogProps {
    visible?: boolean;
    onClose?: () => void;
    title?: string;
    summary?: string;
    closeOnClickModal?: boolean;
    children?: ReactNode | ((close: () => void) => ReactNode);
}

const LARGE_MIN_WIDTH = 840;
const LARGE_MIN_HEIGHT = 480;

export function Dialog({ visible = false, onClose, title, summary, closeOnClickModal = true, children }: AppDialogProps) {
    const theme = useTheme();
    const c = theme.components.dialog;
    const { width: windowW, height: windowH } = useWindowDimensions();

    // Mounted stays true while the exit animation plays, so the Modal is still
    // on screen when visible flips false.
    const [rendered, setRendered] = useState(visible);

    const isLarge = windowW >= LARGE_MIN_WIDTH && windowH >= LARGE_MIN_HEIGHT;

    const dimOpacity = useSharedValue(0);
    const largeScale = useSharedValue(0.8);
    const largeOpacity = useSharedValue(0);
    const mobileY = useSharedValue(windowH);

    useEffect(() => {
        if (visible) {
            setRendered(true);
            // Enter.
            dimOpacity.value = withTiming(1, dialogDimEnter);
            if (isLarge) {
                largeOpacity.value = withTiming(1, dialogDimEnter);
                largeScale.value = withSpring(1, dialogLargeEnter);
            } else {
                mobileY.value = withSpring(0, dialogMobileEnter);
            }
        } else if (rendered) {
            // Exit: content tween 260ms Decelerate(1.5), dim 250ms.
            const finish = (finished: boolean | undefined) => {
                if (finished) runOnJS(setRendered)(false);
            };
            dimOpacity.value = withTiming(0, dialogDimExit, finish);
            if (isLarge) {
                largeOpacity.value = withTiming(0, dialogContentExit);
                largeScale.value = withTiming(0.8, dialogContentExit);
            } else {
                mobileY.value = withTiming(windowH, dialogContentExit);
            }
        }
    }, [visible, rendered, isLarge, windowH, dimOpacity, largeOpacity, largeScale, mobileY]);

    const dimStyle = useAnimatedStyle(() => ({
        opacity: dimOpacity.value,
        backgroundColor: theme.colors.windowDimming,
    }));

    const largeStyle = useAnimatedStyle(() => ({
        opacity: largeOpacity.value,
        transform: [{ scale: largeScale.value }],
    }));

    const mobileStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: mobileY.value }],
    }));

    const handleClose = useCallback(() => {
        onClose?.();
    }, [onClose]);

    const handleBackdrop = useCallback(() => {
        if (closeOnClickModal) handleClose();
    }, [closeOnClickModal, handleClose]);

    return (
        <Modal
            transparent
            statusBarTranslucent
            animationType="none"
            visible={rendered}
            onRequestClose={handleClose}
        >
            <Animated.View
                style={[{ flex: 1, padding: c.outsideMargin, justifyContent: isLarge ? 'center' : 'flex-end' }, dimStyle]}
            >
                <Pressable style={StyleSheet.absoluteFill} onPress={handleBackdrop} />
                <Animated.View
                    accessibilityViewIsModal
                    style={[
                        {
                            alignSelf: 'center',
                            width: '100%',
                            maxWidth: c.maxWidth,
                            maxHeight: isLarge ? (windowH * 2) / 3 : windowH - c.outsideMargin * 2,
                            borderRadius: c.radius,
                            padding: c.padding,
                            backgroundColor: theme.colors.background,
                            overflow: 'hidden',
                        },
                        isLarge ? largeStyle : mobileStyle,
                    ]}
                >
                    {title != null && (
                        <Text type="title4" weight="medium" color={theme.colors.onBackground} style={{ marginBottom: theme.spacing.md, textAlign: 'center' }}>
                            {title}
                        </Text>
                    )}
                    {summary != null && (
                        <Text type="body1" color={theme.colors.onSurfaceSecondary} style={{ marginBottom: theme.spacing.md, textAlign: 'center' }}>
                            {summary}
                        </Text>
                    )}
                    <View>
                        {typeof children === 'function' ? (children as (close: () => void) => ReactNode)(handleClose) : children}
                    </View>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
}

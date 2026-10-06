import { Text } from '../primitives';
import { glassController, GlassOverlay, GlassSurface, useGlassProviderId } from '@newhu/react-native-liquid-glass';
import { bottomSheetEnter, bottomSheetSettle, linearEasing, sheetHandlePress, sheetHandleRelease } from '../motion';
import { useReducedMotionPreference } from '../motion/MotionProvider';
import { useTheme } from '../theme';
import { GlassOverlayContentScope } from './SurfaceEnvironmentContext';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { BackHandler, Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
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
    /** Lets a feature-level motion preference disable the sheet transition. */
    animationsEnabled?: boolean;
    /** Called after the sheet has finished closing. */
    onDismissed?: () => void;
    children?: ReactNode | ((close: () => void) => ReactNode);
}

const DISMISS_THRESHOLD = 150;
const UPWARD_DAMPING = 0.1;
const FROZEN_SHEET_MATERIAL_OVERRIDE = { blurRadius: 0 } as const;

export const BottomSheet = React.memo(function BottomSheet({
    visible = false,
    onClose,
    title,
    allowDismiss = true,
    closeOnClickModal = true,
    startAction,
    endAction,
    animationsEnabled = true,
    onDismissed,
    children,
}: AppBottomSheetProps) {
    const theme = useTheme();
    const usesGlassMaterial = theme.presentation.overlays.sheet === 'glass' && theme.glass.enabled;
    const reducedMotion = useReducedMotionPreference();
    const c = theme.components.bottomSheet;
    const { height: windowH } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const sheetBackground = theme.colors.surfaceContainer;
    const providerId = useGlassProviderId();

    const [rendered, setRendered] = useState(visible);
    const openAnimationStarted = useRef(false);

    const sheetY = useSharedValue(windowH);
    const dimOpacity = useSharedValue(0);
    const handlePressed = useSharedValue(0);
    const handleDismissed = useCallback(() => {
        if (usesGlassMaterial) glassController.resume(providerId);
        onDismissed?.();
    }, [onDismissed, providerId, usesGlassMaterial]);

    useLayoutEffect(() => {
        if (visible) {
            if (!openAnimationStarted.current) {
                openAnimationStarted.current = true;
                if (usesGlassMaterial) glassController.prepareFrozenBackdrop(providerId, 32);
                setRendered(true);
                sheetY.value = windowH;
                dimOpacity.value = 0;
                if (!animationsEnabled) {
                    sheetY.value = 0;
                    dimOpacity.value = 1;
                } else {
                    sheetY.value = reducedMotion ? 0 : withSpring(0, bottomSheetEnter);
                    dimOpacity.value = withTiming(1, { duration: reducedMotion ? 120 : 300, easing: linearEasing });
                }
            }
        } else if (rendered) {
            openAnimationStarted.current = false;
            const finish = (finished: boolean | undefined) => {
                if (finished) {
                    runOnJS(setRendered)(false);
                    runOnJS(handleDismissed)();
                }
            };
            if (!animationsEnabled) {
                sheetY.value = windowH;
                dimOpacity.value = 0;
                setRendered(false);
                handleDismissed();
            } else if (reducedMotion) {
                dimOpacity.value = withTiming(0, { duration: 100, easing: linearEasing }, finish);
            } else {
                sheetY.value = withSpring(windowH, bottomSheetEnter, finish);
                dimOpacity.value = withTiming(0, { duration: 250, easing: linearEasing });
            }
        }
    }, [visible, usesGlassMaterial, providerId, windowH, rendered, animationsEnabled, reducedMotion, sheetY, dimOpacity, handleDismissed]);

    const dragY = useSharedValue(0);

    const handleClose = useCallback(() => {
        onClose?.();
    }, [onClose]);

    useEffect(() => {
        if (!usesGlassMaterial || !rendered) return;
        const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
            handleClose();
            return true;
        });
        return () => subscription.remove();
    }, [usesGlassMaterial, rendered, handleClose]);

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
                if (animationsEnabled) {
                    sheetY.value = withSpring(windowH, bottomSheetEnter, (finished) => {
                        if (finished) {
                            runOnJS(setRendered)(false);
                            runOnJS(handleClose)();
                            runOnJS(handleDismissed)();
                        }
                    });
                } else {
                    sheetY.value = windowH;
                    dimOpacity.value = 0;
                    runOnJS(setRendered)(false);
                    runOnJS(handleClose)();
                    runOnJS(handleDismissed)();
                }
            } else {
                sheetY.value = animationsEnabled ? withSpring(0, bottomSheetSettle) : 0;
                if (animationsEnabled) dimOpacity.value = withTiming(1, { duration: 150, easing: linearEasing });
                else dimOpacity.value = 1;
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

    const sheetBody = (
        <>
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
                    <Animated.View style={[{ height: c.handleHeight, borderRadius: 2, backgroundColor: usesGlassMaterial ? theme.colors.onGlassMuted : theme.colors.onSurfaceVariantSummary }, handleStyle]} />
                </View>
            </GestureDetector>
            {(title != null || startAction != null || endAction != null) && (
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingBottom: 12 }}>
                    <View style={{ flex: 0, justifyContent: 'flex-start' }}>{startAction}</View>
                    <Text type="title4" weight="medium" color={usesGlassMaterial ? theme.colors.onGlass : theme.colors.onSurface} style={{ flex: 1, textAlign: 'center' }}>
                        {title}
                    </Text>
                    <View style={{ flex: 0, justifyContent: 'flex-end', marginLeft: 'auto' }}>{endAction}</View>
                </View>
            )}
            {/* Keep sheet content content-sized unless a child scroll view has a height. */}
            <View style={{ width: '100%', minHeight: 0, flexGrow: 0, flexShrink: 1 }}>
                {typeof children === 'function' ? (children as (close: () => void) => ReactNode)(handleClose) : children}
            </View>
        </>
    );

    const content = (
        <GestureHandlerRootView style={{ flex: 1 }}>
                    <Animated.View style={[{ flex: 1, justifyContent: 'flex-end', alignItems: 'center' }, dimStyle]}>
                        <Pressable style={StyleSheet.absoluteFill} onPress={closeOnClickModal && allowDismiss ? handleClose : undefined} />
                        <GlassSurface
                            variant="sheet"
                            positioning="floating"
                            sampling="backdrop"
                            samplingSource="routeScene"
                            materialOverrides={usesGlassMaterial ? FROZEN_SHEET_MATERIAL_OVERRIDE : undefined}
                            placement="bottom"
                            animatedStyle={sheetStyle}
                            zIndex={101}
                            style={{
                                width: '100%',
                                maxWidth: c.maxWidth,
                                maxHeight: windowH - insets.top - 24,
                                borderTopLeftRadius: c.radius,
                                borderTopRightRadius: c.radius,
                                backgroundColor: sheetBackground,
                                overflow: 'hidden',
                            }}
                            contentStyle={{
                                width: '100%',
                                maxHeight: windowH - insets.top - 24,
                                paddingHorizontal: c.horizontalPadding,
                                paddingBottom: insets.bottom,
                                overflow: 'hidden',
                            }}
                        >
                            {usesGlassMaterial ? (
                                <GlassOverlayContentScope>{sheetBody}</GlassOverlayContentScope>
                            ) : sheetBody}
                        </GlassSurface>
                    </Animated.View>
        </GestureHandlerRootView>
    );

    if (usesGlassMaterial) return rendered ? <GlassOverlay>{content}</GlassOverlay> : null;
    return (
        <Modal transparent statusBarTranslucent animationType="none" visible={rendered} onRequestClose={handleClose}>
            {content}
        </Modal>
    );
});
BottomSheet.displayName = 'HyperBottomSheet';

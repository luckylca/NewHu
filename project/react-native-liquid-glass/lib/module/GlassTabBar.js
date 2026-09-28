import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { LiquidGlassProvider, LiquidGlassView } from 'liquid-glass-kit';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { createAnimatedComponent, runOnJS, useAnimatedProps, useAnimatedStyle, useSharedValue, withSpring, withTiming, } from 'react-native-reanimated';
import { GlassOverlay, GlassSurface, useGlassAppearance, useGlassReducedMotion } from './GlassSurface';
const TAB_BAR_HEIGHT = 66;
const TAB_BAR_BOTTOM_GAP = 8;
const TAB_BAR_SCROLL_CLEARANCE = 12;
const TAB_BAR_SIDE_MARGIN = 16;
const TAB_BAR_MAX_WIDTH = 280;
const TAB_BAR_MIN_WIDTH = 208;
const TAB_BAR_HORIZONTAL_PADDING = 8;
const SELECTION_LENS_HEIGHT = 48;
const SELECTION_LENS_MAX_WIDTH = 94;
const LONG_PRESS_THRESHOLD_MS = 360;
const TAB_BAR_PORTAL_Z_INDEX = 80;
const IDLE_SPRING = { damping: 24, stiffness: 330, mass: 0.68 };
const EDGE_SPRING_FAST = { damping: 31, stiffness: 620, mass: 0.62 };
const EDGE_SPRING_SLOW = { damping: 29, stiffness: 260, mass: 0.76 };
const AnimatedLiquidGlassView = createAnimatedComponent(LiquidGlassView);
/** Extra scroll room below content: bar height + bottom gap + visual clearance. */
export const GLASS_TAB_BAR_CONTENT_INSET = TAB_BAR_HEIGHT + TAB_BAR_BOTTOM_GAP + TAB_BAR_SCROLL_CLEARANCE;
function emitTargetHaptic(_index) {
    void Haptics.selectionAsync().catch(() => undefined);
}
/**
 * One persistent cropped backdrop lens handles idle selection, long-press
 * inflation, drag deformation and snap. It is cached while still and requests
 * continuous cropped captures only during the active drag/settle phase.
 */
export function GlassTabBar({ items, selected, bottomInset, shellBackgroundColor, onSelect, onSelectFromDrag, renderIcon }) {
    const { width: windowWidth } = useWindowDimensions();
    const appearance = useGlassAppearance();
    const reducedMotion = useGlassReducedMotion();
    const tabBarMaterial = appearance?.tokens.materials.tabBarShell ?? appearance?.tokens.materials.tabBar;
    const nativeLiveAvailable = Platform.OS === 'android' && appearance?.tokens.quality !== 'fallback';
    const dark = appearance?.dark ?? false;
    const opaqueShellColor = shellBackgroundColor ?? (dark ? '#283547' : '#EAF0F7');
    const providerId = React.useId();
    const shellBorderColor = appearance?.tokens.fallbackBorder[dark ? 'dark' : 'light'] ?? 'transparent';
    const shellShadowColor = appearance?.tokens.procedural.outerShadow[dark ? 'dark' : 'light'] ?? 'transparent';
    const itemCount = Math.max(items.length, 1);
    const desiredWidth = itemCount * 100 + TAB_BAR_HORIZONTAL_PADDING * 2;
    const barWidth = Math.min(Math.min(TAB_BAR_MAX_WIDTH, Math.max(TAB_BAR_MIN_WIDTH, desiredWidth)), Math.max(0, windowWidth - TAB_BAR_SIDE_MARGIN * 2));
    const itemWidth = Math.max(0, (barWidth - TAB_BAR_HORIZONTAL_PADDING * 2) / itemCount);
    const lensWidth = Math.max(44, Math.min(SELECTION_LENS_MAX_WIDTH, itemWidth - 8));
    const selectedCenterX = TAB_BAR_HORIZONTAL_PADDING + itemWidth * (selected + 0.5);
    const selectedLeft = selectedCenterX - lensWidth / 2;
    const shellScreenLeft = (windowWidth - barWidth) / 2;
    const lensLeft = useSharedValue(selectedLeft);
    const lensRight = useSharedValue(selectedLeft + lensWidth);
    const lensHeight = useSharedValue(SELECTION_LENS_HEIGHT);
    const lensOffsetY = useSharedValue(0);
    const interactionProgress = useSharedValue(0);
    const phase = useSharedValue('idle');
    const grabOffsetX = useSharedValue(0);
    const originSelectedIndex = useSharedValue(selected);
    const releaseTargetIndex = useSharedValue(selected);
    const snapCallbacksRemaining = useSharedValue(0);
    const lastHapticIndex = useSharedValue(-1);
    const dragVelocityX = useSharedValue(0);
    const dragVelocityY = useSharedValue(0);
    const [liveBackdropEnabled, setLiveBackdropEnabled] = useState(false);
    const interactionActiveRef = useRef(false);
    const lastSelectedRef = useRef(selected);
    useEffect(() => {
        if (lastSelectedRef.current === selected)
            return;
        lastSelectedRef.current = selected;
        if (interactionActiveRef.current)
            return;
        const nextCenter = TAB_BAR_HORIZONTAL_PADDING + itemWidth * (selected + 0.5);
        const nextLeft = nextCenter - lensWidth / 2;
        if (reducedMotion) {
            lensLeft.value = withTiming(nextLeft, { duration: 130 });
            lensRight.value = withTiming(nextLeft + lensWidth, { duration: 130 });
            lensHeight.value = withTiming(SELECTION_LENS_HEIGHT, { duration: 110 });
        }
        else {
            lensLeft.value = withSpring(nextLeft, IDLE_SPRING);
            lensRight.value = withSpring(nextLeft + lensWidth, IDLE_SPRING);
            lensHeight.value = withTiming(SELECTION_LENS_HEIGHT - 2, { duration: 90 }, (finished) => {
                if (finished)
                    lensHeight.value = withSpring(SELECTION_LENS_HEIGHT, { damping: 19, stiffness: 320 });
            });
        }
        lensOffsetY.value = withTiming(0, { duration: 110 });
    }, [itemWidth, lensHeight, lensLeft, lensRight, lensWidth, reducedMotion, selected, lensOffsetY]);
    const beginInteraction = useCallback(() => {
        interactionActiveRef.current = true;
        if (nativeLiveAvailable)
            setLiveBackdropEnabled(true);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    }, [nativeLiveAvailable]);
    const finishInteraction = useCallback(() => {
        interactionActiveRef.current = false;
        setLiveBackdropEnabled(false);
    }, []);
    const onDragUpdate = useCallback((absoluteX, relativeY, velocityX, velocityY, startIndex) => {
        'worklet';
        if (phase.value === 'inflating')
            phase.value = 'dragging';
        const rawCenter = absoluteX - shellScreenLeft - grabOffsetX.value;
        const baseHalf = lensWidth / 2;
        const minCenter = baseHalf;
        const maxCenter = barWidth - baseHalf;
        let center = rawCenter;
        if (center < minCenter)
            center = minCenter + (center - minCenter) * 0.2;
        if (center > maxCenter)
            center = maxCenter + (center - maxCenter) * 0.2;
        center = Math.max(minCenter - 16, Math.min(maxCenter + 16, center));
        let nearestIndex = 0;
        let nearestDistance = Number.MAX_VALUE;
        for (let index = 0; index < itemCount; index += 1) {
            const tabCenter = TAB_BAR_HORIZONTAL_PADDING + itemWidth * (index + 0.5);
            const distance = Math.abs(center - tabCenter);
            if (distance < nearestDistance) {
                nearestIndex = index;
                nearestDistance = distance;
            }
        }
        const magneticRange = Math.max(itemWidth * 0.9, 1);
        const magneticStrength = 0.075 * (1 - Math.min(nearestDistance / magneticRange, 1));
        center += (TAB_BAR_HORIZONTAL_PADDING + itemWidth * (nearestIndex + 0.5) - center) * magneticStrength;
        const speed = Math.min(Math.abs(velocityX) / 1800, 1);
        const stretch = reducedMotion ? 0 : speed * 16;
        const activeWidth = lensWidth + (reducedMotion ? 0 : 20) + stretch;
        const direction = velocityX > 28 ? 1 : velocityX < -28 ? -1 : 0;
        const leadingExtra = stretch * 0.62;
        const trailingExtra = stretch * 0.14;
        const targetLeft = center - activeWidth / 2 - (direction < 0 ? leadingExtra : trailingExtra);
        const targetRight = center + activeWidth / 2 + (direction > 0 ? leadingExtra : trailingExtra);
        const yOffset = reducedMotion ? 0 : Math.max(-8, Math.min(8, relativeY - TAB_BAR_HEIGHT / 2));
        dragVelocityX.value = velocityX;
        dragVelocityY.value = velocityY;
        lensOffsetY.value = yOffset;
        lensHeight.value = SELECTION_LENS_HEIGHT + interactionProgress.value * 10 - (reducedMotion ? 0 : speed * 3);
        // Keep the leading edge locked to the finger. Only the trailing edge
        // chases it with a spring, so the lens translates continuously while
        // still stretching like a viscous surface.
        if (direction > 0) {
            lensRight.value = targetRight;
            lensLeft.value = withSpring(targetLeft, EDGE_SPRING_SLOW);
        }
        else if (direction < 0) {
            lensLeft.value = targetLeft;
            lensRight.value = withSpring(targetRight, EDGE_SPRING_SLOW);
        }
        else {
            lensLeft.value = withSpring(targetLeft, IDLE_SPRING);
            lensRight.value = withSpring(targetRight, IDLE_SPRING);
        }
        const hapticIndex = nearestDistance < itemWidth * 0.36 && nearestIndex !== startIndex ? nearestIndex : -1;
        if (hapticIndex !== lastHapticIndex.value) {
            lastHapticIndex.value = hapticIndex;
            if (hapticIndex >= 0)
                runOnJS(emitTargetHaptic)(hapticIndex);
        }
    }, [barWidth, dragVelocityX, dragVelocityY, grabOffsetX, interactionProgress, itemCount, itemWidth, lastHapticIndex, lensHeight, lensLeft, lensRight, lensWidth, phase, reducedMotion, shellScreenLeft, lensOffsetY]);
    const onBeginSnap = useCallback((velocityX, startIndex) => {
        'worklet';
        phase.value = 'snapping';
        const currentCenter = (lensLeft.value + lensRight.value) / 2;
        const projectedCenter = currentCenter + velocityX * 0.075;
        let targetIndex = 0;
        let nearestDistance = Number.MAX_VALUE;
        for (let index = 0; index < itemCount; index += 1) {
            const tabCenter = TAB_BAR_HORIZONTAL_PADDING + itemWidth * (index + 0.5);
            const distance = Math.abs(projectedCenter - tabCenter);
            if (distance < nearestDistance) {
                nearestDistance = distance;
                targetIndex = index;
            }
        }
        const targetCenter = TAB_BAR_HORIZONTAL_PADDING + itemWidth * (targetIndex + 0.5);
        const targetLeft = targetCenter - lensWidth / 2;
        releaseTargetIndex.value = targetIndex;
        originSelectedIndex.value = startIndex;
        if (targetIndex !== startIndex)
            runOnJS(onSelectFromDrag ?? onSelect)(targetIndex);
        lensOffsetY.value = withSpring(0, { damping: 24, stiffness: 300 });
        lensHeight.value = reducedMotion
            ? withTiming(SELECTION_LENS_HEIGHT, { duration: 100 })
            : withSpring(SELECTION_LENS_HEIGHT, { damping: 25, stiffness: 320, mass: 0.7 });
        snapCallbacksRemaining.value = 2;
        const finishEdge = (finished) => {
            'worklet';
            if (!finished)
                return;
            snapCallbacksRemaining.value -= 1;
            if (snapCallbacksRemaining.value !== 0)
                return;
            phase.value = 'settling';
            interactionProgress.value = withTiming(0, { duration: reducedMotion ? 95 : 145 }, (settled) => {
                if (!settled)
                    return;
                phase.value = 'idle';
                dragVelocityX.value = 0;
                dragVelocityY.value = 0;
                lastHapticIndex.value = -1;
                runOnJS(finishInteraction)();
            });
        };
        if (reducedMotion) {
            lensLeft.value = withTiming(targetLeft, { duration: 120 }, finishEdge);
            lensRight.value = withTiming(targetLeft + lensWidth, { duration: 120 }, finishEdge);
        }
        else {
            // Both edges settle independently; the edge trailing the drag has a
            // slightly lower stiffness and catches up last.
            const wasMovingRight = velocityX >= 0;
            lensLeft.value = withSpring(targetLeft, wasMovingRight ? EDGE_SPRING_SLOW : EDGE_SPRING_FAST, finishEdge);
            lensRight.value = withSpring(targetLeft + lensWidth, wasMovingRight ? EDGE_SPRING_FAST : EDGE_SPRING_SLOW, finishEdge);
        }
    }, [dragVelocityX, dragVelocityY, finishInteraction, interactionProgress, itemCount, itemWidth, lastHapticIndex, lensHeight, lensLeft, lensOffsetY, lensRight, lensWidth, onSelect, onSelectFromDrag, originSelectedIndex, phase, reducedMotion, releaseTargetIndex, snapCallbacksRemaining]);
    const localLensStyle = useAnimatedStyle(() => {
        const width = Math.max(lensRight.value - lensLeft.value, 1);
        const center = (lensLeft.value + lensRight.value) / 2;
        return {
            borderRadius: Math.min(lensHeight.value, width) / 2,
            transform: [
                { translateX: center - selectedCenterX },
                { translateY: lensOffsetY.value },
                { scaleX: width / lensWidth },
                { scaleY: lensHeight.value / SELECTION_LENS_HEIGHT },
            ],
        };
    }, [lensWidth, selectedCenterX]);
    const liveLensStyle = useAnimatedStyle(() => ({
        left: lensLeft.value,
        top: (TAB_BAR_HEIGHT - lensHeight.value) / 2 + lensOffsetY.value,
        width: Math.max(lensRight.value - lensLeft.value, 1),
        height: lensHeight.value,
        borderRadius: Math.min(lensHeight.value, lensRight.value - lensLeft.value) / 2,
    }));
    const liveLensAnimatedProps = useAnimatedProps(() => ({
        interactionProgress: interactionProgress.value,
        motionX: Math.max(-1, Math.min(1, dragVelocityX.value / 1800)),
        motionY: Math.max(-1, Math.min(1, dragVelocityY.value / 1800)),
    }));
    const tabItems = items.map((item, index) => (_jsx(GlassTabItem, { item: item, index: index, selected: index === selected, itemWidth: itemWidth, renderIcon: renderIcon, onSelect: onSelect, reducedMotion: reducedMotion, shellScreenLeft: shellScreenLeft, lensWidth: lensWidth, lensLeft: lensLeft, lensRight: lensRight, lensHeight: lensHeight, phase: phase, interactionProgress: interactionProgress, grabOffsetX: grabOffsetX, originSelectedIndex: originSelectedIndex, releaseTargetIndex: releaseTargetIndex, lastHapticIndex: lastHapticIndex, onBeginSnap: onBeginSnap, onDragUpdate: onDragUpdate, onBeginInteraction: beginInteraction }, `${item.label}-${index}`)));
    return (_jsx(GlassOverlay, { zIndex: TAB_BAR_PORTAL_Z_INDEX + 1, children: _jsx(View, { pointerEvents: "box-none", style: [
                styles.host,
                {
                    left: shellScreenLeft,
                    bottom: bottomInset + TAB_BAR_BOTTOM_GAP,
                    width: barWidth,
                    height: TAB_BAR_HEIGHT,
                },
            ], children: nativeLiveAvailable ? (_jsxs(_Fragment, { children: [_jsx(LiquidGlassProvider, { providerId: providerId, maxCaptureRateHz: appearance?.tokens.quality === 'high' ? 120 : 60, style: [
                            styles.localBackdropProvider,
                            {
                                width: barWidth,
                                height: TAB_BAR_HEIGHT,
                                borderRadius: TAB_BAR_HEIGHT / 2,
                                backgroundColor: opaqueShellColor,
                                shadowColor: shellShadowColor,
                                shadowOpacity: tabBarMaterial?.shadowOpacity ?? 0,
                                shadowRadius: tabBarMaterial?.shadowRadius ?? 0,
                                shadowOffset: { width: 0, height: tabBarMaterial?.shadowOffsetY ?? 0 },
                                elevation: tabBarMaterial?.elevation ?? 0,
                            },
                        ], children: _jsx(View, { style: [
                                styles.shell,
                                {
                                    width: barWidth,
                                    height: TAB_BAR_HEIGHT,
                                    borderRadius: TAB_BAR_HEIGHT / 2,
                                    borderColor: shellBorderColor,
                                    backgroundColor: opaqueShellColor,
                                },
                            ], children: _jsx(View, { style: styles.row, children: tabItems }) }) }), _jsx(AnimatedLiquidGlassView, { pointerEvents: "none", providerId: providerId, cornerRadius: appearance?.tokens.materials.tabSelectionLens.radius ?? SELECTION_LENS_HEIGHT / 2, blurRadius: (appearance?.tokens.materials.tabSelectionLens.blurRadius ?? 0.35) * (appearance?.tokens.quality === 'high' ? 1.2 : 1), refractionHeight: appearance?.tokens.materials.tabSelectionLens.refractionHeight ?? 12, refractionAmount: appearance?.tokens.materials.tabSelectionLens.refractionAmount ?? 5.5, bodyRefractionAmount: appearance?.tokens.materials.tabSelectionLens.refractionBodyAmount ?? 1.5, saturation: appearance?.tokens.materials.tabSelectionLens.saturation ?? 1.02, chromaticAberration: appearance?.tokens.materials.tabSelectionLens.chromaticAberration ?? 0.3, highlightAlpha: appearance?.tokens.materials.tabSelectionLens.highlightAlpha ?? 0.62, highlightWidth: appearance?.tokens.materials.tabSelectionLens.highlightWidth ?? 1.3, tintAlpha: appearance?.tokens.materials.tabSelectionLens.tintAlpha ?? 0.08, specularStrength: appearance?.tokens.materials.tabSelectionLens.specularStrength ?? 0.95, fresnelStrength: appearance?.tokens.materials.tabSelectionLens.fresnelStrength ?? 0.72, innerShadowStrength: appearance?.tokens.materials.tabSelectionLens.innerShadowStrength ?? 0.2, tint: appearance?.tokens.tint[dark ? 'dark' : 'light'], continuous: liveBackdropEnabled, animatedProps: liveLensAnimatedProps, style: [styles.nativeLens, liveLensStyle] })] })) : (_jsxs(View, { style: [
                    styles.shell,
                    {
                        width: barWidth,
                        height: TAB_BAR_HEIGHT,
                        borderRadius: TAB_BAR_HEIGHT / 2,
                        borderColor: shellBorderColor,
                        backgroundColor: opaqueShellColor,
                        shadowColor: shellShadowColor,
                        shadowOpacity: tabBarMaterial?.shadowOpacity ?? 0,
                        shadowRadius: tabBarMaterial?.shadowRadius ?? 0,
                        shadowOffset: { width: 0, height: tabBarMaterial?.shadowOffsetY ?? 0 },
                        elevation: tabBarMaterial?.elevation ?? 0,
                    },
                ], children: [_jsx(GlassSurface, { variant: "tabSelectionLens", renderMode: "local", pointerEvents: "none", style: {
                            position: 'absolute',
                            left: selectedLeft,
                            top: (TAB_BAR_HEIGHT - SELECTION_LENS_HEIGHT) / 2,
                            width: lensWidth,
                            height: SELECTION_LENS_HEIGHT,
                            borderRadius: SELECTION_LENS_HEIGHT / 2,
                        }, animatedStyle: localLensStyle }), _jsx(View, { style: styles.row, children: tabItems })] })) }) }));
}
function GlassTabItem({ item, index, selected, itemWidth, renderIcon, onSelect, reducedMotion, shellScreenLeft, lensWidth, lensLeft, lensRight, lensHeight, phase, interactionProgress, grabOffsetX, originSelectedIndex, releaseTargetIndex, lastHapticIndex, onBeginSnap, onDragUpdate, onBeginInteraction, }) {
    const pressed = useSharedValue(0);
    const interactionHandledRef = useRef(false);
    const notifyInteractionStart = useCallback(() => {
        interactionHandledRef.current = true;
        onBeginInteraction();
    }, [onBeginInteraction]);
    const itemFocusStyle = useAnimatedStyle(() => {
        const center = (lensLeft.value + lensRight.value) / 2;
        const tabCenter = TAB_BAR_HORIZONTAL_PADDING + itemWidth * (index + 0.5);
        const strength = Math.max(0, Math.min(1, 1 - Math.abs(center - tabCenter) / Math.max(itemWidth * 0.92, 1)));
        return {
            opacity: 1 - pressed.value * 0.05,
            transform: [{ scale: 1 - pressed.value * 0.025 + strength * 0.025 }],
        };
    }, [index, itemWidth]);
    const activeIconStyle = useAnimatedStyle(() => {
        const center = (lensLeft.value + lensRight.value) / 2;
        const tabCenter = TAB_BAR_HORIZONTAL_PADDING + itemWidth * (index + 0.5);
        const strength = Math.max(0, Math.min(1, 1 - Math.abs(center - tabCenter) / Math.max(itemWidth * 0.92, 1)));
        return { opacity: strength };
    }, [index, itemWidth]);
    const gesture = React.useMemo(() => Gesture.Pan()
        .enabled(selected)
        .activateAfterLongPress(LONG_PRESS_THRESHOLD_MS)
        .onBegin(() => {
        phase.value = 'pressing';
    })
        .onStart((event) => {
        phase.value = 'inflating';
        originSelectedIndex.value = index;
        releaseTargetIndex.value = index;
        lastHapticIndex.value = -1;
        const currentCenter = (lensLeft.value + lensRight.value) / 2;
        grabOffsetX.value = event.absoluteX - shellScreenLeft - currentCenter;
        const expandedWidth = lensWidth + (reducedMotion ? 8 : 20);
        const expandedHeight = SELECTION_LENS_HEIGHT + (reducedMotion ? 4 : 10);
        lensLeft.value = withSpring(currentCenter - expandedWidth / 2, reducedMotion ? IDLE_SPRING : { damping: 23, stiffness: 360, mass: 0.7 });
        lensRight.value = withSpring(currentCenter + expandedWidth / 2, reducedMotion ? IDLE_SPRING : { damping: 23, stiffness: 360, mass: 0.7 });
        lensHeight.value = withSpring(expandedHeight, reducedMotion ? { damping: 25, stiffness: 390 } : { damping: 23, stiffness: 350, mass: 0.7 });
        interactionProgress.value = withTiming(1, { duration: reducedMotion ? 85 : 135 }, (finished) => {
            if (finished && phase.value === 'inflating')
                phase.value = 'dragging';
        });
        runOnJS(notifyInteractionStart)();
    })
        .onUpdate((event) => {
        onDragUpdate(event.absoluteX, event.y, event.velocityX, event.velocityY, index);
    })
        .onEnd((event, success) => {
        if (success)
            onBeginSnap(event.velocityX, index);
    })
        .onFinalize((_event, success) => {
        if (!success && phase.value === 'pressing') {
            phase.value = 'idle';
        }
        else if (!success && (phase.value === 'inflating' || phase.value === 'dragging')) {
            onBeginSnap(0, index);
        }
    }), [selected, phase, index, originSelectedIndex, releaseTargetIndex, lastHapticIndex, lensLeft, lensRight, lensHeight, lensWidth, shellScreenLeft, grabOffsetX, interactionProgress, reducedMotion, notifyInteractionStart, onDragUpdate, onBeginSnap]);
    return (_jsx(GestureDetector, { gesture: gesture, children: _jsx(Pressable, { accessibilityRole: "tab", accessibilityLabel: item.label, accessibilityHint: "\u957F\u6309\u5E76\u62D6\u52A8\u5F53\u524D\u9009\u4E2D\u9875\u7B7E\u53EF\u5207\u6362\u9875\u9762", accessibilityState: { selected }, onPress: () => {
                if (interactionHandledRef.current) {
                    interactionHandledRef.current = false;
                    return;
                }
                onSelect(index);
            }, onPressIn: () => {
                interactionHandledRef.current = false;
                pressed.value = reducedMotion ? withTiming(1, { duration: 60 }) : withSpring(1, { damping: 20, stiffness: 420 });
            }, onPressOut: () => {
                pressed.value = reducedMotion ? withTiming(0, { duration: 80 }) : withSpring(0, { damping: 20, stiffness: 420 });
            }, style: styles.item, children: _jsx(Animated.View, { style: [styles.itemContent, itemFocusStyle], children: _jsxs(View, { style: styles.icon, children: [_jsx(View, { style: styles.baseIcon, children: renderIcon(item, index, false) }), _jsx(Animated.View, { pointerEvents: "none", style: [styles.activeIcon, activeIconStyle], children: renderIcon(item, index, true) })] }) }) }) }));
}
const styles = StyleSheet.create({
    host: {
        position: 'absolute',
        zIndex: 1,
    },
    localBackdropProvider: {
        position: 'absolute',
        left: 0,
        top: 0,
        zIndex: 1,
        elevation: 6,
    },
    nativeLens: {
        position: 'absolute',
        zIndex: 2,
        elevation: 8,
        backgroundColor: 'transparent',
        overflow: 'hidden',
    },
    shell: {
        overflow: 'hidden',
        borderWidth: StyleSheet.hairlineWidth,
    },
    row: {
        ...StyleSheet.absoluteFillObject,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: TAB_BAR_HORIZONTAL_PADDING,
        position: 'relative',
        zIndex: 1,
        elevation: 1,
    },
    item: {
        flex: 1,
        minWidth: 44,
        minHeight: 44,
        height: TAB_BAR_HEIGHT,
        alignItems: 'center',
        justifyContent: 'center',
    },
    itemContent: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
    },
    icon: {
        height: 25,
        minWidth: 26,
        alignItems: 'center',
        justifyContent: 'center',
    },
    baseIcon: { alignItems: 'center', justifyContent: 'center' },
    activeIcon: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
});
//# sourceMappingURL=GlassTabBar.js.map
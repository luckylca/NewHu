import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    cancelAnimation,
    createAnimatedComponent,
    runOnJS,
    useAnimatedProps,
    useAnimatedReaction,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { GlassOverlay, GlassSurface, useGlassAppearance, useGlassReducedMotion } from './GlassSurface';
import { getGlassNativeEngine, subscribeGlassNativeEngine } from './glassNativeEngine';
import {
    CoreGlassCaptureSource,
    CoreGlassSurfaceView,
    LegacyGlassCaptureSource,
    LegacyGlassSurfaceView,
} from './nativeGlassViews';

const TAB_BAR_HEIGHT = 66;
const TAB_BAR_BOTTOM_GAP = 8;
const TAB_BAR_SCROLL_CLEARANCE = 12;
const TAB_BAR_SIDE_MARGIN = 16;
const TAB_BAR_MAX_WIDTH = 280;
const TAB_BAR_MIN_WIDTH = 208;
const TAB_BAR_HORIZONTAL_PADDING = 8;
const SELECTION_LENS_HEIGHT = 48;
const SELECTION_LENS_MAX_WIDTH = 94;
const LONG_PRESS_THRESHOLD_MS = 300;
const PRE_HOLD_SLOP = 20;
const DRAG_START_SLOP = 3;
const TAB_BAR_PORTAL_Z_INDEX = 80;
const GESTURE_DEBUG_ENABLED = __DEV__ && process.env.EXPO_PUBLIC_GLASS_TAB_DEBUG === '1';
const IDLE_SPRING = { damping: 24, stiffness: 330, mass: 0.68 };
const TAP_SELECTION_SPRING = { damping: 26, stiffness: 520, mass: 0.56 };
const EDGE_SPRING_FAST = { damping: 31, stiffness: 620, mass: 0.62 };
const EDGE_SPRING_SLOW = { damping: 29, stiffness: 260, mass: 0.76 };
const AnimatedLegacyGlassSurface = createAnimatedComponent(LegacyGlassSurfaceView);
const AnimatedCoreGlassSurface = CoreGlassSurfaceView
    ? createAnimatedComponent(CoreGlassSurfaceView)
    : null;

type TabLensState = 'idle' | 'pressing' | 'inflating' | 'dragging' | 'snapping' | 'settling';

interface GestureDebugSnapshot {
    phase: TabLensState;
    holdCandidate: boolean;
    holdActivated: boolean;
    dragging: boolean;
    snapStarted: boolean;
    gestureCount: number;
    origin: number;
    hovered: number;
    pending: number;
    touchCount: number;
}

function logGlassTabGesture(event: string, detail?: string) {
    if (GESTURE_DEBUG_ENABLED) {
        const timestamp = globalThis.performance?.now?.();
        const time = typeof timestamp === 'number' ? timestamp.toFixed(1) : 'n/a';
        console.info(`[GlassTab ${time}ms] ${event}${detail ? ` ${detail}` : ''}`);
    }
}

/** Extra scroll room below content: bar height + bottom gap + visual clearance. */
export const GLASS_TAB_BAR_CONTENT_INSET = TAB_BAR_HEIGHT + TAB_BAR_BOTTOM_GAP + TAB_BAR_SCROLL_CLEARANCE;

export interface GlassTabBarItem {
    label: string;
}

export interface GlassTabBarProps {
    items: GlassTabBarItem[];
    selected: number;
    bottomInset?: number;
    /** Render as a normal in-flow segmented selector instead of a screen overlay. */
    presentation?: 'floating' | 'inline';
    /** Geometry overrides used by inline selectors; omitted values keep the bottom bar defaults. */
    height?: number;
    width?: number | '100%';
    horizontalPadding?: number;
    shellRadius?: number;
    lensMaxWidth?: number;
    /** Optional per-instance optical rim width. Smaller values keep center content flatter. */
    lensRefractionHeight?: number;
    accessibilityHint?: string;
    /** Fully opaque fill behind the tab icons; the selected lens samples this local scene. */
    shellBackgroundColor?: string;
    onSelect: (index: number) => void;
    /** Drag selection commits at finger-up without entering the tap/double-tap path. */
    onSelectFromDrag?: (index: number) => void;
    renderIcon?: (item: GlassTabBarItem, index: number, selected: boolean) => ReactNode;
    /** Custom cell content; receives base/active states for continuous lens blending. */
    renderItem?: (item: GlassTabBarItem, index: number, selected: boolean) => ReactNode;
}

function emitTargetHaptic(_index: number) {
    void Haptics.selectionAsync().catch(() => undefined);
}

/**
 * One persistent cropped backdrop lens handles idle selection, long-press
 * inflation, drag deformation and snap. It is cached while still and requests
 * continuous cropped captures only during the active drag/settle phase.
 */
export function GlassTabBar({
    items,
    selected,
    bottomInset = 0,
    shellBackgroundColor,
    onSelect,
    onSelectFromDrag,
    renderIcon,
    renderItem,
    presentation = 'floating',
    height = TAB_BAR_HEIGHT,
    width: requestedWidth,
    horizontalPadding = TAB_BAR_HORIZONTAL_PADDING,
    shellRadius,
    lensMaxWidth = SELECTION_LENS_MAX_WIDTH,
    lensRefractionHeight,
    accessibilityHint,
}: GlassTabBarProps) {
    const { width: windowWidth } = useWindowDimensions();
    const nativeEngine = useSyncExternalStore(subscribeGlassNativeEngine, getGlassNativeEngine, getGlassNativeEngine);
    const appearance = useGlassAppearance();
    const reducedMotion = useGlassReducedMotion();
    const tabBarMaterial = appearance?.tokens.materials.tabBarShell ?? appearance?.tokens.materials.tabBar;
    const nativeLiveAvailable = Platform.OS === 'android' && appearance?.tokens.quality !== 'fallback';
    const NativeCaptureSource = nativeEngine === 'core' && CoreGlassCaptureSource
        ? CoreGlassCaptureSource
        : LegacyGlassCaptureSource;
    const NativeGlassSurface = nativeEngine === 'core' && AnimatedCoreGlassSurface
        ? AnimatedCoreGlassSurface
        : AnimatedLegacyGlassSurface;
    const dark = appearance?.dark ?? false;
    const opaqueShellColor = shellBackgroundColor ?? (dark ? '#283547' : '#EAF0F7');
    const providerId = React.useId();
    const [inlineWidth, setInlineWidth] = useState(0);
    const shellBorderColor = appearance?.tokens.fallbackBorder[dark ? 'dark' : 'light'] ?? 'transparent';
    const shellShadowColor = appearance?.tokens.procedural.outerShadow[dark ? 'dark' : 'light'] ?? 'transparent';
    const itemCount = Math.max(items.length, 1);
    const desiredWidth = itemCount * 100 + TAB_BAR_HORIZONTAL_PADDING * 2;
    const floatingWidth = Math.min(
        Math.min(TAB_BAR_MAX_WIDTH, Math.max(TAB_BAR_MIN_WIDTH, desiredWidth)),
        Math.max(0, windowWidth - TAB_BAR_SIDE_MARGIN * 2),
    );
    const barWidth = presentation === 'inline'
        ? (typeof requestedWidth === 'number' ? requestedWidth : inlineWidth)
        : floatingWidth;
    const itemWidth = Math.max(0, (barWidth - horizontalPadding * 2) / itemCount);
    const lensWidth = Math.max(44, Math.min(lensMaxWidth, itemWidth - 8));
    const lensBaseHeight = Math.min(SELECTION_LENS_HEIGHT, height - 8);
    const verticalInset = (height - lensBaseHeight) / 2;
    const selectedCenterX = horizontalPadding + itemWidth * (selected + 0.5);
    const selectedLeft = selectedCenterX - lensWidth / 2;
    const [inlineScreenLeft, setInlineScreenLeft] = useState(0);
    const inlineHostRef = useRef<View>(null);
    const shellScreenLeft = presentation === 'floating' ? (windowWidth - barWidth) / 2 : inlineScreenLeft;

    const lensLeft = useSharedValue(selectedLeft);
    const lensRight = useSharedValue(selectedLeft + lensWidth);
    const lensHeight = useSharedValue(lensBaseHeight);
    const lensOffsetY = useSharedValue(0);
    const interactionProgress = useSharedValue(0);
    const phase = useSharedValue<TabLensState>('idle');
    const grabOffsetX = useSharedValue(0);
    const originSelectedIndex = useSharedValue(selected);
    const hoveredIndex = useSharedValue(selected);
    const pendingIndex = useSharedValue(selected);
    const snapStarted = useSharedValue(false);
    const interactionActive = useSharedValue(false);
    const holdCandidate = useSharedValue(false);
    const holdActivated = useSharedValue(false);
    const panActivated = useSharedValue(false);
    const panActivationRequested = useSharedValue(false);
    const panUpdateLogged = useSharedValue(false);
    const touchSessionActive = useSharedValue(false);
    const touchMovedPastSlop = useSharedValue(false);
    const sessionId = useSharedValue(0);
    const touchedIndex = useSharedValue(selected);
    const holdTimerProgress = useSharedValue(0);
    const touchStartX = useSharedValue(0);
    const touchStartY = useSharedValue(0);
    const lastHapticIndex = useSharedValue(-1);
    const dragVelocityX = useSharedValue(0);
    const dragVelocityY = useSharedValue(0);
    const [liveBackdropEnabled, setLiveBackdropEnabled] = useState(false);
    const interactionActiveRef = useRef(false);
    const dragCommittedTargetRef = useRef<number | null>(null);
    const previousGeometryRef = useRef({ selected, barWidth: 0 });
    const [gestureDebug, setGestureDebug] = useState<GestureDebugSnapshot>({
        phase: 'idle',
        holdCandidate: false,
        holdActivated: false,
        dragging: false,
        snapStarted: false,
        gestureCount: 0,
        origin: selected,
        hovered: selected,
        pending: selected,
        touchCount: 0,
    });
    const noteTabViewTouch = useCallback(() => {
        if (GESTURE_DEBUG_ENABLED) setGestureDebug((current) => ({ ...current, touchCount: current.touchCount + 1 }));
    }, []);
    const noteGestureDown = useCallback(() => {
        if (GESTURE_DEBUG_ENABLED) setGestureDebug((current) => ({ ...current, gestureCount: current.gestureCount + 1 }));
    }, []);

    const updateGestureDebug = useCallback((
        nextPhase: TabLensState,
        nextHoldCandidate: boolean,
        nextHoldActivated: boolean,
        nextDragging: boolean,
        nextSnapStarted: boolean,
        origin: number,
        hovered: number,
        pending: number,
    ) => {
        if (!GESTURE_DEBUG_ENABLED) return;
        setGestureDebug((current) => ({
            ...current,
            phase: nextPhase,
            holdCandidate: nextHoldCandidate,
            holdActivated: nextHoldActivated,
            dragging: nextDragging,
            snapStarted: nextSnapStarted,
            origin,
            hovered,
            pending,
        }));
    }, []);

    useAnimatedReaction(
        () => ({
            phase: phase.value,
            holdCandidate: holdCandidate.value,
            holdActivated: holdActivated.value,
            dragging: panActivated.value,
            snapStarted: snapStarted.value,
            origin: originSelectedIndex.value,
            hovered: hoveredIndex.value,
            pending: pendingIndex.value,
        }),
        (current, previous) => {
            if (!GESTURE_DEBUG_ENABLED) return;
            if (
                previous == null ||
                current.phase !== previous.phase ||
                current.holdCandidate !== previous.holdCandidate ||
                current.holdActivated !== previous.holdActivated ||
                current.dragging !== previous.dragging ||
                current.snapStarted !== previous.snapStarted ||
                current.origin !== previous.origin ||
                current.hovered !== previous.hovered ||
                current.pending !== previous.pending
            ) {
                runOnJS(updateGestureDebug)(
                    current.phase,
                    current.holdCandidate,
                    current.holdActivated,
                    current.dragging,
                    current.snapStarted,
                    current.origin,
                    current.hovered,
                    current.pending,
                );
            }
        },
        [holdCandidate, holdActivated, hoveredIndex, originSelectedIndex, panActivated, pendingIndex, phase, snapStarted, updateGestureDebug],
    );

    const beginInteraction = useCallback(() => {
        interactionActiveRef.current = true;
        dragCommittedTargetRef.current = null;
        if (nativeLiveAvailable) setLiveBackdropEnabled(true);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    }, [nativeLiveAvailable]);

    const activateHoldOnUI = useCallback((expectedSessionId: number, expectedIndex: number) => {
        'worklet';
        if (
            !touchSessionActive.value ||
            sessionId.value !== expectedSessionId ||
            !holdCandidate.value ||
            touchMovedPastSlop.value ||
            expectedIndex !== selected
        ) return;

        holdCandidate.value = false;
        holdActivated.value = true;
        phase.value = 'inflating';
        interactionActive.value = true;
        originSelectedIndex.value = selected;
        hoveredIndex.value = selected;
        pendingIndex.value = selected;
        const currentCenter = (lensLeft.value + lensRight.value) / 2;
        grabOffsetX.value = touchStartX.value - shellScreenLeft - currentCenter;
        const expandedWidth = lensWidth + (reducedMotion ? 8 : 20);
        const expandedHeight = lensBaseHeight + (reducedMotion ? 4 : 10);
        lensLeft.value = withSpring(currentCenter - expandedWidth / 2, reducedMotion ? IDLE_SPRING : { damping: 23, stiffness: 360, mass: 0.7 });
        lensRight.value = withSpring(currentCenter + expandedWidth / 2, reducedMotion ? IDLE_SPRING : { damping: 23, stiffness: 360, mass: 0.7 });
        lensHeight.value = withSpring(expandedHeight, reducedMotion ? { damping: 25, stiffness: 390 } : { damping: 23, stiffness: 350, mass: 0.7 });
        interactionProgress.value = withTiming(1, { duration: reducedMotion ? 85 : 135 });
        runOnJS(logGlassTabGesture)('HOLD_ACTIVE', `index=${selected}`);
        runOnJS(beginInteraction)();
        if (GESTURE_DEBUG_ENABLED) {
            runOnJS(updateGestureDebug)('inflating', false, true, false, false, selected, selected, selected);
        }
    }, [beginInteraction, grabOffsetX, holdActivated, holdCandidate, hoveredIndex, interactionActive, interactionProgress, lensBaseHeight, lensHeight, lensLeft, lensRight, lensWidth, originSelectedIndex, pendingIndex, phase, reducedMotion, selected, sessionId, shellScreenLeft, touchMovedPastSlop, touchSessionActive, touchStartX, updateGestureDebug]);

    const commitDragSelection = useCallback((targetIndex: number, startIndex: number) => {
        const safeTarget = Math.max(0, Math.min(itemCount - 1, targetIndex));
        const safeStart = Math.max(0, Math.min(itemCount - 1, startIndex));
        if (safeTarget === safeStart || dragCommittedTargetRef.current !== null) return;

        // Mark this as the drag's own page change before notifying navigation.
        // The selection effect must leave the remaining glass settle intact.
        dragCommittedTargetRef.current = safeTarget;
        previousGeometryRef.current = { selected: safeTarget, barWidth };
        logGlassTabGesture('COMMIT', `target=${safeTarget}`);
        (onSelectFromDrag ?? onSelect)(safeTarget);
    }, [barWidth, itemCount, onSelect, onSelectFromDrag]);

    const finishInteraction = useCallback((targetIndex: number) => {
        const safeTarget = Math.max(0, Math.min(itemCount - 1, targetIndex));
        interactionActiveRef.current = false;
        setLiveBackdropEnabled(false);
        previousGeometryRef.current = { selected: safeTarget, barWidth };
        dragCommittedTargetRef.current = null;
        logGlassTabGesture('BACKDROP_OFF');
        logGlassTabGesture('RESET');
    }, [barWidth, itemCount]);

    const resetInteractionOnUI = useCallback((targetIndex: number) => {
        'worklet';
        const safeTarget = Math.max(0, Math.min(itemCount - 1, targetIndex));
        if (phase.value === 'idle' && !interactionActive.value && !snapStarted.value) return;

        // Mark idle before cancelling. A cancelled animation callback can
        // re-enter this function, where it will now be a harmless no-op.
        phase.value = 'idle';
        interactionActive.value = false;
        snapStarted.value = false;
        holdCandidate.value = false;
        holdActivated.value = false;
        panActivated.value = false;
        panActivationRequested.value = false;
        panUpdateLogged.value = false;
        touchSessionActive.value = false;
        touchMovedPastSlop.value = false;
        touchStartX.value = 0;
        touchStartY.value = 0;
        touchedIndex.value = safeTarget;
        cancelAnimation(holdTimerProgress);
        holdTimerProgress.value = 0;
        cancelAnimation(lensLeft);
        cancelAnimation(lensRight);
        cancelAnimation(lensHeight);
        cancelAnimation(lensOffsetY);
        cancelAnimation(interactionProgress);

        const center = horizontalPadding + itemWidth * (safeTarget + 0.5);
        const left = center - lensWidth / 2;
        lensLeft.value = left;
        lensRight.value = left + lensWidth;
        lensHeight.value = lensBaseHeight;
        lensOffsetY.value = 0;
        interactionProgress.value = 0;
        dragVelocityX.value = 0;
        dragVelocityY.value = 0;
        originSelectedIndex.value = safeTarget;
        hoveredIndex.value = safeTarget;
        pendingIndex.value = safeTarget;
        lastHapticIndex.value = -1;
        runOnJS(finishInteraction)(safeTarget);
    }, [dragVelocityX, dragVelocityY, finishInteraction, holdActivated, holdCandidate, holdTimerProgress, horizontalPadding, hoveredIndex, interactionActive, interactionProgress, itemCount, itemWidth, lastHapticIndex, lensBaseHeight, lensHeight, lensLeft, lensOffsetY, lensRight, lensWidth, originSelectedIndex, panActivated, panActivationRequested, panUpdateLogged, pendingIndex, phase, snapStarted, touchMovedPastSlop, touchSessionActive, touchStartX, touchStartY, touchedIndex]);

    useEffect(() => {
        if (barWidth <= 0) return;

        const previous = previousGeometryRef.current;
        const initialMeasurement = previous.barWidth <= 0;
        const selectionChanged = previous.selected !== selected;
        const widthChanged = previous.barWidth > 0 && previous.barWidth !== barWidth;

        if (dragCommittedTargetRef.current === selected) {
            // Our drag already placed the lens at this page. Do not cancel its
            // settling animation or run the normal tap-selection spring again.
            previousGeometryRef.current = { selected, barWidth };
            return;
        }

        if (interactionActiveRef.current || interactionActive.value || phase.value !== 'idle') {
            // An external page change during a live gesture takes ownership:
            // cancel its animations and reconcile once the external selection
            // is known. A drag's own commit pre-updates previousGeometryRef.
            if (selectionChanged) {
                phase.value = 'idle';
                interactionActive.value = false;
                snapStarted.value = false;
                holdCandidate.value = false;
                holdActivated.value = false;
                panActivated.value = false;
                panActivationRequested.value = false;
                panUpdateLogged.value = false;
                touchSessionActive.value = false;
                touchMovedPastSlop.value = false;
                touchStartX.value = 0;
                touchStartY.value = 0;
                touchedIndex.value = selected;
                sessionId.value += 1;
                cancelAnimation(holdTimerProgress);
                holdTimerProgress.value = 0;
                cancelAnimation(lensLeft);
                cancelAnimation(lensRight);
                cancelAnimation(lensHeight);
                cancelAnimation(lensOffsetY);
                cancelAnimation(interactionProgress);
                const safeIndex = Math.max(0, Math.min(itemCount - 1, selected));
                const center = horizontalPadding + itemWidth * (safeIndex + 0.5);
                const left = center - lensWidth / 2;
                lensLeft.value = left;
                lensRight.value = left + lensWidth;
                lensHeight.value = lensBaseHeight;
                lensOffsetY.value = 0;
                interactionProgress.value = 0;
                dragVelocityX.value = 0;
                dragVelocityY.value = 0;
                hoveredIndex.value = safeIndex;
                pendingIndex.value = safeIndex;
                originSelectedIndex.value = safeIndex;
                lastHapticIndex.value = -1;
                interactionActiveRef.current = false;
                setLiveBackdropEnabled(false);
                dragCommittedTargetRef.current = null;
                logGlassTabGesture('BACKDROP_OFF');
                logGlassTabGesture('RESET', 'external_selection');
                previousGeometryRef.current = { selected, barWidth };
            }
            // Keep same-selection and layout changes pending while the
            // session owns the lens; reconcile them after it finishes.
            return;
        }

        if (!initialMeasurement && !selectionChanged && !widthChanged) return;

        const safeIndex = Math.max(0, Math.min(itemCount - 1, selected));
        const nextCenter = horizontalPadding + itemWidth * (safeIndex + 0.5);
        const nextLeft = nextCenter - lensWidth / 2;
        if (initialMeasurement) {
            lensLeft.value = nextLeft;
            lensRight.value = nextLeft + lensWidth;
            lensHeight.value = lensBaseHeight;
        } else if (reducedMotion) {
            lensLeft.value = withTiming(nextLeft, { duration: 115 });
            lensRight.value = withTiming(nextLeft + lensWidth, { duration: 115 });
            lensHeight.value = withTiming(lensBaseHeight, { duration: 95 });
        } else {
            lensLeft.value = withSpring(nextLeft, TAP_SELECTION_SPRING);
            lensRight.value = withSpring(nextLeft + lensWidth, TAP_SELECTION_SPRING);
            lensHeight.value = withSpring(lensBaseHeight, { damping: 28, stiffness: 500, mass: 0.55 });
        }
        lensOffsetY.value = withTiming(0, { duration: 110 });
        previousGeometryRef.current = { selected, barWidth };
    }, [barWidth, dragVelocityX, dragVelocityY, holdActivated, holdCandidate, holdTimerProgress, horizontalPadding, hoveredIndex, interactionActive, interactionProgress, itemCount, itemWidth, lastHapticIndex, lensBaseHeight, lensHeight, lensLeft, lensOffsetY, lensRight, lensWidth, originSelectedIndex, panActivated, panActivationRequested, panUpdateLogged, pendingIndex, phase, reducedMotion, selected, sessionId, snapStarted, touchMovedPastSlop, touchSessionActive, touchStartX, touchStartY, touchedIndex]);

    useEffect(() => () => {
        cancelAnimation(holdTimerProgress);
        phase.value = 'idle';
        interactionActive.value = false;
        snapStarted.value = false;
        holdCandidate.value = false;
        holdActivated.value = false;
        panActivated.value = false;
        panActivationRequested.value = false;
        panUpdateLogged.value = false;
        touchSessionActive.value = false;
        touchMovedPastSlop.value = false;
        sessionId.value += 1;
        touchedIndex.value = -1;
        touchStartX.value = 0;
        touchStartY.value = 0;
        interactionActiveRef.current = false;
        cancelAnimation(lensLeft);
        cancelAnimation(lensRight);
        cancelAnimation(lensHeight);
        cancelAnimation(lensOffsetY);
        cancelAnimation(interactionProgress);
    }, [holdActivated, holdCandidate, holdTimerProgress, interactionActive, interactionProgress, lensHeight, lensLeft, lensOffsetY, lensRight, panActivated, panActivationRequested, panUpdateLogged, phase, sessionId, snapStarted, touchMovedPastSlop, touchSessionActive, touchStartX, touchStartY, touchedIndex]);

    const onDragUpdate = useCallback((absoluteX: number, relativeY: number, velocityX: number, velocityY: number, startIndex: number) => {
        'worklet';
        if (phase.value === 'inflating') phase.value = 'dragging';
        const rawCenter = absoluteX - shellScreenLeft - grabOffsetX.value;
        const baseHalf = lensWidth / 2;
        const minCenter = baseHalf;
        const maxCenter = barWidth - baseHalf;
        let center = rawCenter;
        if (center < minCenter) center = minCenter + (center - minCenter) * 0.2;
        if (center > maxCenter) center = maxCenter + (center - maxCenter) * 0.2;
        center = Math.max(minCenter - 16, Math.min(maxCenter + 16, center));

        let nearestIndex = 0;
        let nearestDistance = Number.MAX_VALUE;
        for (let index = 0; index < itemCount; index += 1) {
            const tabCenter = horizontalPadding + itemWidth * (index + 0.5);
            const distance = Math.abs(center - tabCenter);
            if (distance < nearestDistance) {
                nearestIndex = index;
                nearestDistance = distance;
            }
        }
        hoveredIndex.value = nearestIndex;
        const magneticRange = Math.max(itemWidth * 0.9, 1);
        const magneticStrength = 0.075 * (1 - Math.min(nearestDistance / magneticRange, 1));
        center += (horizontalPadding + itemWidth * (nearestIndex + 0.5) - center) * magneticStrength;

        const speed = Math.min(Math.abs(velocityX) / 1800, 1);
        const stretch = reducedMotion ? 0 : speed * 16;
        const activeWidth = lensWidth + (reducedMotion ? 0 : 20) + stretch;
        const direction = velocityX > 28 ? 1 : velocityX < -28 ? -1 : 0;
        const leadingExtra = stretch * 0.62;
        const trailingExtra = stretch * 0.14;
        const targetLeft = center - activeWidth / 2 - (direction < 0 ? leadingExtra : trailingExtra);
        const targetRight = center + activeWidth / 2 + (direction > 0 ? leadingExtra : trailingExtra);
        const yOffset = reducedMotion ? 0 : Math.max(-8, Math.min(8, relativeY - height / 2));

        dragVelocityX.value = velocityX;
        dragVelocityY.value = velocityY;
        lensOffsetY.value = yOffset;
        lensHeight.value = lensBaseHeight + interactionProgress.value * 10 - (reducedMotion ? 0 : speed * 3);
        // Keep the leading edge locked to the finger. Only the trailing edge
        // chases it with a spring, so the lens translates continuously while
        // still stretching like a viscous surface.
        if (direction > 0) {
            lensRight.value = targetRight;
            lensLeft.value = withSpring(targetLeft, EDGE_SPRING_SLOW);
        } else if (direction < 0) {
            lensLeft.value = targetLeft;
            lensRight.value = withSpring(targetRight, EDGE_SPRING_SLOW);
        } else {
            lensLeft.value = withSpring(targetLeft, IDLE_SPRING);
            lensRight.value = withSpring(targetRight, IDLE_SPRING);
        }

        const hapticIndex = nearestDistance < itemWidth * 0.36 && nearestIndex !== startIndex ? nearestIndex : -1;
        if (hapticIndex !== lastHapticIndex.value) {
            lastHapticIndex.value = hapticIndex;
            if (hapticIndex >= 0) runOnJS(emitTargetHaptic)(hapticIndex);
        }
    }, [barWidth, dragVelocityX, dragVelocityY, grabOffsetX, height, horizontalPadding, hoveredIndex, interactionProgress, itemCount, itemWidth, lastHapticIndex, lensBaseHeight, lensHeight, lensLeft, lensRight, lensWidth, phase, reducedMotion, shellScreenLeft, lensOffsetY]);

    const onBeginSnap = useCallback((velocityX: number, startIndex: number, cancelled = false) => {
        'worklet';
        if (snapStarted.value || (phase.value !== 'inflating' && phase.value !== 'dragging')) return;
        snapStarted.value = true;
        phase.value = 'snapping';
        const originIndex = cancelled ? startIndex : originSelectedIndex.value;
        const currentCenter = (lensLeft.value + lensRight.value) / 2;
        const projectedCenter = currentCenter + velocityX * 0.075;
        let targetIndex = 0;
        let nearestDistance = Number.MAX_VALUE;
        if (cancelled) {
            targetIndex = originIndex;
        } else {
            for (let index = 0; index < itemCount; index += 1) {
                const tabCenter = horizontalPadding + itemWidth * (index + 0.5);
                const distance = Math.abs(projectedCenter - tabCenter);
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    targetIndex = index;
                }
            }
        }
        const targetCenter = horizontalPadding + itemWidth * (targetIndex + 0.5);
        const targetLeft = targetCenter - lensWidth / 2;
        pendingIndex.value = targetIndex;
        runOnJS(logGlassTabGesture)('SNAP_START', `target=${targetIndex}${cancelled ? ' rollback' : ''}`);

        // Page ownership changes as soon as the finger is released and the
        // destination is known. The glass snap/settle continues independently,
        // so navigation never waits for the trailing spring to finish.
        if (!cancelled && targetIndex !== originIndex) {
            runOnJS(commitDragSelection)(targetIndex, originIndex);
        }

        lensOffsetY.value = withSpring(0, { damping: 24, stiffness: 300 });
        lensHeight.value = reducedMotion
            ? withTiming(lensBaseHeight, { duration: 100 })
            : withSpring(lensBaseHeight, { damping: 25, stiffness: 320, mass: 0.7 });

        const finishSnap = (finished?: boolean) => {
            'worklet';
            if (phase.value !== 'snapping') return;
            if (!finished) {
                resetInteractionOnUI(originIndex);
                return;
            }
            phase.value = 'settling';
            runOnJS(logGlassTabGesture)('SNAP_END', `target=${targetIndex}`);
            interactionProgress.value = withTiming(0, { duration: reducedMotion ? 95 : 145 }, (settled) => {
                if (settled) {
                    runOnJS(logGlassTabGesture)('SETTLE_END');
                    resetInteractionOnUI(targetIndex);
                } else {
                    resetInteractionOnUI(originIndex);
                }
            });
        };
        if (reducedMotion) {
            lensLeft.value = withTiming(targetLeft, { duration: 120 });
            // One trailing edge owns completion. This avoids a two-callback
            // counter getting stranded if either independent animation cancels.
            lensRight.value = withTiming(targetLeft + lensWidth, { duration: 120 }, finishSnap);
        } else {
            // The trailing edge is the sole completion signal. It uses the
            // slower spring, while the leading edge reaches the target first.
            const wasMovingRight = velocityX >= 0;
            lensLeft.value = withSpring(targetLeft, wasMovingRight ? EDGE_SPRING_SLOW : EDGE_SPRING_FAST, wasMovingRight ? finishSnap : undefined);
            lensRight.value = withSpring(targetLeft + lensWidth, wasMovingRight ? EDGE_SPRING_FAST : EDGE_SPRING_SLOW, wasMovingRight ? undefined : finishSnap);
        }
    }, [commitDragSelection, horizontalPadding, interactionProgress, itemCount, itemWidth, lensBaseHeight, lensHeight, lensLeft, lensOffsetY, lensRight, lensWidth, originSelectedIndex, pendingIndex, phase, reducedMotion, resetInteractionOnUI, snapStarted]);

    const tabBarGesture = React.useMemo(() => Gesture.Pan()
        .manualActivation(true)
        .shouldCancelWhenOutside(false)
        .maxPointers(1)
        .onTouchesDown((event, manager) => {
            'worklet';
            const touch = event.changedTouches[0] ?? event.allTouches[0];
            if (!touch) {
                manager.fail();
                return;
            }
            runOnJS(noteGestureDown)();
            if (touchSessionActive.value || phase.value !== 'idle') {
                runOnJS(logGlassTabGesture)('INTERACTION_DOWN_BLOCKED', `phase=${phase.value}`);
                manager.fail();
                return;
            }

            const localX = touch.absoluteX - shellScreenLeft;
            const rawIndex = Math.floor((localX - horizontalPadding) / Math.max(itemWidth, 1));
            const hitIndex = Math.max(0, Math.min(itemCount - 1, rawIndex));
            const nextSessionId = sessionId.value + 1;
            sessionId.value = nextSessionId;
            touchSessionActive.value = true;
            touchMovedPastSlop.value = false;
            touchedIndex.value = hitIndex;
            touchStartX.value = touch.absoluteX;
            touchStartY.value = touch.absoluteY;
            originSelectedIndex.value = selected;
            hoveredIndex.value = hitIndex;
            pendingIndex.value = hitIndex;
            holdCandidate.value = hitIndex === selected;
            holdActivated.value = false;
            panActivated.value = false;
            panActivationRequested.value = false;
            panUpdateLogged.value = false;
            snapStarted.value = false;
            interactionActive.value = false;
            lastHapticIndex.value = -1;
            phase.value = 'pressing';
            manager.begin();

            runOnJS(logGlassTabGesture)('INTERACTION_DOWN', `hit=${hitIndex} selected=${selected}`);
            if (hitIndex === selected) {
                runOnJS(logGlassTabGesture)('HOLD_BEGIN', `index=${selected}`);
                holdTimerProgress.value = withDelay(
                    LONG_PRESS_THRESHOLD_MS,
                    withTiming(1, { duration: 1 }, (finished) => {
                        if (finished) activateHoldOnUI(nextSessionId, selected);
                    }),
                );
            }
        })
        .onTouchesMove((event, manager) => {
            'worklet';
            if (!touchSessionActive.value) return;
            const touch = event.changedTouches[0] ?? event.allTouches[0];
            if (!touch) return;
            const dx = touch.absoluteX - touchStartX.value;
            const dy = touch.absoluteY - touchStartY.value;
            const distanceSquared = dx * dx + dy * dy;

            if (!holdActivated.value) {
                if (distanceSquared > PRE_HOLD_SLOP * PRE_HOLD_SLOP) {
                    touchMovedPastSlop.value = true;
                    holdCandidate.value = false;
                    cancelAnimation(holdTimerProgress);
                    holdTimerProgress.value = 0;
                    manager.fail();
                }
                return;
            }

            if (distanceSquared >= DRAG_START_SLOP * DRAG_START_SLOP && !panActivationRequested.value) {
                panActivationRequested.value = true;
                runOnJS(logGlassTabGesture)('PAN_REQUEST_ACTIVATE');
                manager.activate();
            }
        })
        .onTouchesUp((event, manager) => {
            'worklet';
            if (!touchSessionActive.value) return;
            runOnJS(logGlassTabGesture)('RELEASE');
            cancelAnimation(holdTimerProgress);
            holdTimerProgress.value = 0;

            if (panActivated.value) {
                // Pan's normal END event owns snap/commit after activation.
                touchSessionActive.value = false;
                return;
            }

            const touch = event.changedTouches[0] ?? event.allTouches[0];
            const localX = touch ? touch.absoluteX - shellScreenLeft : touchStartX.value - shellScreenLeft;
            const rawIndex = Math.floor((localX - horizontalPadding) / Math.max(itemWidth, 1));
            const releaseIndex = Math.max(0, Math.min(itemCount - 1, rawIndex));
            const origin = originSelectedIndex.value;
            const didHold = holdActivated.value;
            const wasCancelledByMovement = touchMovedPastSlop.value;
            touchSessionActive.value = false;

            if (didHold) {
                runOnJS(logGlassTabGesture)('HOLD_RELEASE', 'without_drag');
                onBeginSnap(0, origin, true);
            } else if (!wasCancelledByMovement) {
                phase.value = 'idle';
                holdCandidate.value = false;
                holdActivated.value = false;
                interactionActive.value = false;
                touchedIndex.value = releaseIndex;
                runOnJS(logGlassTabGesture)('TAP', `target=${releaseIndex}`);
                runOnJS(onSelect)(releaseIndex);
            }

            manager.fail();
        })
        .onStart(() => {
            'worklet';
            if (!holdActivated.value || phase.value !== 'inflating') return;
            panActivated.value = true;
            phase.value = 'dragging';
            // Keep the finger offset captured when the hold inflated the lens;
            // that preserves the initial 3dp of movement instead of jumping.
            runOnJS(logGlassTabGesture)('PAN_ACTIVE');
        })
        .onUpdate((event) => {
            'worklet';
            if (phase.value !== 'dragging') return;
            if (!panUpdateLogged.value) {
                panUpdateLogged.value = true;
                runOnJS(logGlassTabGesture)('PAN_UPDATE_FIRST');
            }
            onDragUpdate(event.absoluteX, event.y, event.velocityX, event.velocityY, originSelectedIndex.value);
        })
        .onEnd((event, success) => {
            'worklet';
            if (!success || !panActivated.value) return;
            touchSessionActive.value = false;
            cancelAnimation(holdTimerProgress);
            holdTimerProgress.value = 0;
            runOnJS(logGlassTabGesture)('PAN_END');
            onBeginSnap(event.velocityX, originSelectedIndex.value, false);
        })
        .onFinalize((_event, success) => {
            'worklet';
            if (success) return;
            cancelAnimation(holdTimerProgress);
            holdTimerProgress.value = 0;
            touchSessionActive.value = false;
            if (phase.value === 'pressing') {
                resetInteractionOnUI(originSelectedIndex.value);
            } else if (phase.value === 'inflating' || phase.value === 'dragging') {
                runOnJS(logGlassTabGesture)('PAN_END', 'cancel');
                onBeginSnap(0, originSelectedIndex.value, true);
            }
        }), [activateHoldOnUI, horizontalPadding, holdActivated, holdCandidate, holdTimerProgress, interactionActive, itemCount, itemWidth, lastHapticIndex, noteGestureDown, onBeginSnap, onDragUpdate, onSelect, originSelectedIndex, panActivated, panActivationRequested, panUpdateLogged, pendingIndex, phase, resetInteractionOnUI, selected, sessionId, shellScreenLeft, snapStarted, touchMovedPastSlop, touchSessionActive, touchStartX, touchStartY, touchedIndex, hoveredIndex]);

    const localLensStyle = useAnimatedStyle(() => {
        const width = Math.max(lensRight.value - lensLeft.value, 1);
        const center = (lensLeft.value + lensRight.value) / 2;
        return {
            borderRadius: Math.min(lensHeight.value, width) / 2,
            transform: [
                { translateX: center - selectedCenterX },
                { translateY: lensOffsetY.value },
                { scaleX: width / lensWidth },
                { scaleY: lensHeight.value / lensBaseHeight },
            ],
        };
    }, [lensBaseHeight, lensWidth, selectedCenterX]);

    const liveLensStyle = useAnimatedStyle(() => ({
        left: lensLeft.value,
        top: (height - lensHeight.value) / 2 + lensOffsetY.value,
        width: Math.max(lensRight.value - lensLeft.value, 1),
        height: lensHeight.value,
        borderRadius: Math.min(lensHeight.value, lensRight.value - lensLeft.value) / 2,
    }), [height]);

    const liveLensAnimatedProps = useAnimatedProps(() => ({
        interactionProgress: interactionProgress.value,
        motionX: Math.max(-1, Math.min(1, dragVelocityX.value / 1800)),
        motionY: Math.max(-1, Math.min(1, dragVelocityY.value / 1800)),
    }));

    const renderVisual = renderItem ?? renderIcon ?? ((item: GlassTabBarItem) => item.label);
    const tabItems = items.map((item, index) => (
        <GlassTabItem
            key={`${item.label}-${index}`}
            item={item}
            index={index}
            selected={index === selected}
            itemWidth={itemWidth}
            horizontalPadding={horizontalPadding}
            barHeight={height}
            renderVisual={renderVisual}
            customContent={renderItem != null}
            lensLeft={lensLeft}
            lensRight={lensRight}
        />
    ));
    const accessibilityTargets = items.map((item, index) => (
        <View
            key={`tab-accessibility-${item.label}-${index}`}
            accessible
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityHint={accessibilityHint ?? '长按并拖动当前选中页签可切换页面'}
            accessibilityState={{ selected: index === selected }}
            accessibilityActions={[{ name: 'activate', label: item.label }]}
            onAccessibilityAction={() => onSelect(index)}
            style={styles.interactionTarget}
        />
    ));

    const resolvedShellRadius = shellRadius ?? height / 2;
    const shellStyle = {
        width: barWidth,
        height,
        borderRadius: resolvedShellRadius,
        borderColor: shellBorderColor,
        backgroundColor: opaqueShellColor,
        shadowColor: shellShadowColor,
        shadowOpacity: tabBarMaterial?.shadowOpacity ?? 0,
        shadowRadius: tabBarMaterial?.shadowRadius ?? 0,
        shadowOffset: { width: 0, height: tabBarMaterial?.shadowOffsetY ?? 0 },
        elevation: tabBarMaterial?.elevation ?? 0,
    };
    const barContents = (
        <View
            ref={inlineHostRef}
            onLayout={presentation === 'inline' && typeof requestedWidth !== 'number'
                ? (event) => {
                    setInlineWidth(event.nativeEvent.layout.width);
                    inlineHostRef.current?.measureInWindow((left) => setInlineScreenLeft(left));
                }
                : undefined}
            pointerEvents="box-none"
            style={presentation === 'floating'
                ? [styles.host, { left: shellScreenLeft, bottom: bottomInset + TAB_BAR_BOTTOM_GAP, width: barWidth, height }]
                : [styles.inlineHost, { width: requestedWidth ?? '100%', height }]}
        >
            {nativeLiveAvailable ? (
                <>
                    <NativeCaptureSource
                        providerId={providerId}
                        pointerEvents="none"
                        style={[
                            styles.localBackdropProvider,
                            {
                                width: barWidth,
                                height,
                                borderRadius: resolvedShellRadius,
                                backgroundColor: opaqueShellColor,
                                shadowColor: shellShadowColor,
                                shadowOpacity: tabBarMaterial?.shadowOpacity ?? 0,
                                shadowRadius: tabBarMaterial?.shadowRadius ?? 0,
                                shadowOffset: { width: 0, height: tabBarMaterial?.shadowOffsetY ?? 0 },
                                elevation: tabBarMaterial?.elevation ?? 0,
                            },
                        ]}
                    >
                        <View pointerEvents="none" style={[styles.shell, shellStyle]}>
                            <View pointerEvents="none" style={[styles.row, { paddingHorizontal: horizontalPadding }]}>{tabItems}</View>
                        </View>
                    </NativeCaptureSource>
                    <NativeGlassSurface
                        pointerEvents="none"
                        providerId={providerId}
                        cornerRadius={appearance?.tokens.materials.tabSelectionLens.radius ?? lensBaseHeight / 2}
                        blurRadius={(appearance?.tokens.materials.tabSelectionLens.blurRadius ?? 0.35) * (appearance?.tokens.quality === 'high' ? 1.2 : 1)}
                        refractionHeight={lensRefractionHeight ?? appearance?.tokens.materials.tabSelectionLens.refractionHeight ?? 12}
                        refractionAmount={appearance?.tokens.materials.tabSelectionLens.refractionAmount ?? 5.5}
                        bodyRefractionAmount={appearance?.tokens.materials.tabSelectionLens.refractionBodyAmount ?? 1.5}
                        saturation={appearance?.tokens.materials.tabSelectionLens.saturation ?? 1.02}
                        chromaticAberration={appearance?.tokens.materials.tabSelectionLens.chromaticAberration ?? 0.3}
                        highlightAlpha={appearance?.tokens.materials.tabSelectionLens.highlightAlpha ?? 0.62}
                        highlightWidth={appearance?.tokens.materials.tabSelectionLens.highlightWidth ?? 1.3}
                        tintAlpha={appearance?.tokens.materials.tabSelectionLens.tintAlpha ?? 0.08}
                        specularStrength={appearance?.tokens.materials.tabSelectionLens.specularStrength ?? 0.95}
                        fresnelStrength={appearance?.tokens.materials.tabSelectionLens.fresnelStrength ?? 0.72}
                        innerShadowStrength={appearance?.tokens.materials.tabSelectionLens.innerShadowStrength ?? 0.2}
                        tint={appearance?.tokens.tint[dark ? 'dark' : 'light']}
                        continuous={liveBackdropEnabled}
                        animatedProps={liveLensAnimatedProps}
                        style={[styles.nativeLens, liveLensStyle]}
                    />
                </>
            ) : (
                    <View pointerEvents="none" style={[styles.shell, shellStyle]}>
                        <GlassSurface
                        variant="tabSelectionLens"
                        positioning="inFlow"
                        sampling="local"
                        pointerEvents="none"
                        style={{
                            position: 'absolute',
                            left: selectedLeft,
                            top: verticalInset,
                            width: lensWidth,
                            height: lensBaseHeight,
                            borderRadius: lensBaseHeight / 2,
                        }}
                        animatedStyle={localLensStyle}
                    />
                    <View pointerEvents="none" style={[styles.row, { paddingHorizontal: horizontalPadding }]}>{tabItems}</View>
                </View>
            )}
            {GESTURE_DEBUG_ENABLED && (
                <View
                    pointerEvents="none"
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    style={[styles.gestureDebugOverlay, { width: Math.max(barWidth, TAB_BAR_MIN_WIDTH) }]}
                >
                    <Text style={styles.gestureDebugText}>
                        {`view DOWN ${gestureDebug.touchCount} · gesture DOWN ${gestureDebug.gestureCount}\nphase ${gestureDebug.phase} · hold candidate ${gestureDebug.holdCandidate ? 'ON' : 'off'} · hold ${gestureDebug.holdActivated ? 'ON' : 'off'} · drag ${gestureDebug.dragging ? 'ON' : 'off'} · snap ${gestureDebug.snapStarted ? 'ON' : 'off'}\norigin ${gestureDebug.origin} · hovered ${gestureDebug.hovered} · pending ${gestureDebug.pending}`}
                    </Text>
                </View>
            )}
            <GestureDetector gesture={tabBarGesture}>
                <View
                    pointerEvents="auto"
                    onTouchStart={GESTURE_DEBUG_ENABLED ? noteTabViewTouch : undefined}
                    collapsable={false}
                    style={[styles.interactionLayer, { width: barWidth, height }]}
                >
                    {accessibilityTargets}
                </View>
            </GestureDetector>
        </View>
    );

    return presentation === 'floating'
        ? <GlassOverlay zIndex={TAB_BAR_PORTAL_Z_INDEX + 1}>{barContents}</GlassOverlay>
        : barContents;
}

function GlassTabItem({
    item,
    index,
    selected,
    itemWidth,
    horizontalPadding,
    barHeight,
    renderVisual,
    customContent,
    lensLeft,
    lensRight,
}: {
    item: GlassTabBarItem;
    index: number;
    selected: boolean;
    itemWidth: number;
    horizontalPadding: number;
    barHeight: number;
    renderVisual: NonNullable<GlassTabBarProps['renderItem']>;
    customContent: boolean;
    lensLeft: SharedValue<number>;
    lensRight: SharedValue<number>;
}) {
    const itemFocusStyle = useAnimatedStyle(() => {
        const center = (lensLeft.value + lensRight.value) / 2;
        const tabCenter = horizontalPadding + itemWidth * (index + 0.5);
        const strength = Math.max(0, Math.min(1, 1 - Math.abs(center - tabCenter) / Math.max(itemWidth * 0.92, 1)));
        return {
            transform: [{ scale: 1 + strength * 0.025 }],
        };
    }, [horizontalPadding, index, itemWidth]);
    const activeIconStyle = useAnimatedStyle(() => {
        const center = (lensLeft.value + lensRight.value) / 2;
        const tabCenter = horizontalPadding + itemWidth * (index + 0.5);
        const strength = Math.max(0, Math.min(1, 1 - Math.abs(center - tabCenter) / Math.max(itemWidth * 0.92, 1)));
        return { opacity: strength };
    }, [horizontalPadding, index, itemWidth]);
    const baseVisual = renderVisual(item, index, false);
    const activeVisual = renderVisual(item, index, true);

    return (
        <View
            pointerEvents="none"
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[styles.item, { height: barHeight }]}
        >
            <Animated.View style={[customContent ? styles.itemContentInline : styles.itemContent, itemFocusStyle]}>
                {customContent ? (
                    <View style={styles.customContent}>
                        <View style={styles.baseIcon}>{baseVisual}</View>
                        <Animated.View
                            pointerEvents="none"
                            accessible={false}
                            accessibilityElementsHidden
                            importantForAccessibility="no-hide-descendants"
                            style={[styles.customActive, activeIconStyle]}
                        >
                            {activeVisual}
                        </Animated.View>
                    </View>
                ) : (
                    <View style={styles.icon}>
                        <View style={styles.baseIcon}>{baseVisual}</View>
                        <Animated.View pointerEvents="none" style={[styles.activeIcon, activeIconStyle]}>
                            {activeVisual}
                        </Animated.View>
                    </View>
                )}
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    host: {
        position: 'absolute',
        zIndex: 1,
    },
    inlineHost: {
        position: 'relative',
        alignSelf: 'stretch',
        zIndex: 1,
    },
    interactionLayer: {
        ...StyleSheet.absoluteFillObject,
        flexDirection: 'row',
        zIndex: 100,
        elevation: 100,
        backgroundColor: 'transparent',
    },
    interactionTarget: {
        flex: 1,
        minWidth: 44,
        minHeight: 44,
        backgroundColor: 'transparent',
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
    gestureDebugOverlay: {
        position: 'absolute',
        left: 0,
        top: -46,
        zIndex: 99,
        elevation: 99,
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 6,
        backgroundColor: 'rgba(12, 18, 28, 0.86)',
    },
    gestureDebugText: {
        color: '#FFFFFF',
        fontSize: 10,
        lineHeight: 13,
        fontVariant: ['tabular-nums'],
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
    itemContentInline: {
        flex: 1,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    customContent: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    customActive: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

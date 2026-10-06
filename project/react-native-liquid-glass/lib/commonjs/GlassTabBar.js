"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GLASS_TAB_BAR_CONTENT_INSET = void 0;
exports.GlassTabBar = GlassTabBar;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
const Haptics = __importStar(require("expo-haptics"));
const react_native_gesture_handler_1 = require("react-native-gesture-handler");
const react_native_reanimated_1 = __importStar(require("react-native-reanimated"));
const GlassSurface_1 = require("./GlassSurface");
const glassNativeEngine_1 = require("./glassNativeEngine");
const nativeGlassViews_1 = require("./nativeGlassViews");
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
const AnimatedLegacyGlassSurface = (0, react_native_reanimated_1.createAnimatedComponent)(nativeGlassViews_1.LegacyGlassSurfaceView);
const AnimatedCoreGlassSurface = nativeGlassViews_1.CoreGlassSurfaceView
    ? (0, react_native_reanimated_1.createAnimatedComponent)(nativeGlassViews_1.CoreGlassSurfaceView)
    : null;
function logGlassTabGesture(event, detail) {
    if (GESTURE_DEBUG_ENABLED) {
        const timestamp = globalThis.performance?.now?.();
        const time = typeof timestamp === 'number' ? timestamp.toFixed(1) : 'n/a';
        console.info(`[GlassTab ${time}ms] ${event}${detail ? ` ${detail}` : ''}`);
    }
}
/** Extra scroll room below content: bar height + bottom gap + visual clearance. */
exports.GLASS_TAB_BAR_CONTENT_INSET = TAB_BAR_HEIGHT + TAB_BAR_BOTTOM_GAP + TAB_BAR_SCROLL_CLEARANCE;
function emitTargetHaptic(_index) {
    void Haptics.selectionAsync().catch(() => undefined);
}
/**
 * One persistent cropped backdrop lens handles idle selection, long-press
 * inflation, drag deformation and snap. It is cached while still and requests
 * continuous cropped captures only during the active drag/settle phase.
 */
function GlassTabBar({ items, selected, bottomInset = 0, shellBackgroundColor, onSelect, onSelectFromDrag, renderIcon, renderItem, presentation = 'floating', height = TAB_BAR_HEIGHT, width: requestedWidth, horizontalPadding = TAB_BAR_HORIZONTAL_PADDING, shellRadius, lensMaxWidth = SELECTION_LENS_MAX_WIDTH, lensRefractionHeight, accessibilityHint, }) {
    const { width: windowWidth } = (0, react_native_1.useWindowDimensions)();
    const nativeEngine = (0, react_1.useSyncExternalStore)(glassNativeEngine_1.subscribeGlassNativeEngine, glassNativeEngine_1.getGlassNativeEngine, glassNativeEngine_1.getGlassNativeEngine);
    const appearance = (0, GlassSurface_1.useGlassAppearance)();
    const reducedMotion = (0, GlassSurface_1.useGlassReducedMotion)();
    const tabBarMaterial = appearance?.tokens.materials.tabBarShell ?? appearance?.tokens.materials.tabBar;
    const nativeLiveAvailable = react_native_1.Platform.OS === 'android' && appearance?.tokens.quality !== 'fallback';
    const NativeCaptureSource = nativeEngine === 'core' && nativeGlassViews_1.CoreGlassCaptureSource
        ? nativeGlassViews_1.CoreGlassCaptureSource
        : nativeGlassViews_1.LegacyGlassCaptureSource;
    const NativeGlassSurface = nativeEngine === 'core' && AnimatedCoreGlassSurface
        ? AnimatedCoreGlassSurface
        : AnimatedLegacyGlassSurface;
    const dark = appearance?.dark ?? false;
    const opaqueShellColor = shellBackgroundColor ?? (dark ? '#283547' : '#EAF0F7');
    const providerId = react_1.default.useId();
    const [inlineWidth, setInlineWidth] = (0, react_1.useState)(0);
    const shellBorderColor = appearance?.tokens.fallbackBorder[dark ? 'dark' : 'light'] ?? 'transparent';
    const shellShadowColor = appearance?.tokens.procedural.outerShadow[dark ? 'dark' : 'light'] ?? 'transparent';
    const itemCount = Math.max(items.length, 1);
    const desiredWidth = itemCount * 100 + TAB_BAR_HORIZONTAL_PADDING * 2;
    const floatingWidth = Math.min(Math.min(TAB_BAR_MAX_WIDTH, Math.max(TAB_BAR_MIN_WIDTH, desiredWidth)), Math.max(0, windowWidth - TAB_BAR_SIDE_MARGIN * 2));
    const barWidth = presentation === 'inline'
        ? (typeof requestedWidth === 'number' ? requestedWidth : inlineWidth)
        : floatingWidth;
    const itemWidth = Math.max(0, (barWidth - horizontalPadding * 2) / itemCount);
    const lensWidth = Math.max(44, Math.min(lensMaxWidth, itemWidth - 8));
    const lensBaseHeight = Math.min(SELECTION_LENS_HEIGHT, height - 8);
    const verticalInset = (height - lensBaseHeight) / 2;
    const selectedCenterX = horizontalPadding + itemWidth * (selected + 0.5);
    const selectedLeft = selectedCenterX - lensWidth / 2;
    const [inlineScreenLeft, setInlineScreenLeft] = (0, react_1.useState)(0);
    const inlineHostRef = (0, react_1.useRef)(null);
    const shellScreenLeft = presentation === 'floating' ? (windowWidth - barWidth) / 2 : inlineScreenLeft;
    const lensLeft = (0, react_native_reanimated_1.useSharedValue)(selectedLeft);
    const lensRight = (0, react_native_reanimated_1.useSharedValue)(selectedLeft + lensWidth);
    const lensHeight = (0, react_native_reanimated_1.useSharedValue)(lensBaseHeight);
    const lensOffsetY = (0, react_native_reanimated_1.useSharedValue)(0);
    const interactionProgress = (0, react_native_reanimated_1.useSharedValue)(0);
    const phase = (0, react_native_reanimated_1.useSharedValue)('idle');
    const grabOffsetX = (0, react_native_reanimated_1.useSharedValue)(0);
    const originSelectedIndex = (0, react_native_reanimated_1.useSharedValue)(selected);
    const hoveredIndex = (0, react_native_reanimated_1.useSharedValue)(selected);
    const pendingIndex = (0, react_native_reanimated_1.useSharedValue)(selected);
    const snapStarted = (0, react_native_reanimated_1.useSharedValue)(false);
    const interactionActive = (0, react_native_reanimated_1.useSharedValue)(false);
    const holdCandidate = (0, react_native_reanimated_1.useSharedValue)(false);
    const holdActivated = (0, react_native_reanimated_1.useSharedValue)(false);
    const panActivated = (0, react_native_reanimated_1.useSharedValue)(false);
    const panActivationRequested = (0, react_native_reanimated_1.useSharedValue)(false);
    const panUpdateLogged = (0, react_native_reanimated_1.useSharedValue)(false);
    const touchSessionActive = (0, react_native_reanimated_1.useSharedValue)(false);
    const touchMovedPastSlop = (0, react_native_reanimated_1.useSharedValue)(false);
    const sessionId = (0, react_native_reanimated_1.useSharedValue)(0);
    const touchedIndex = (0, react_native_reanimated_1.useSharedValue)(selected);
    const holdTimerProgress = (0, react_native_reanimated_1.useSharedValue)(0);
    const touchStartX = (0, react_native_reanimated_1.useSharedValue)(0);
    const touchStartY = (0, react_native_reanimated_1.useSharedValue)(0);
    const lastHapticIndex = (0, react_native_reanimated_1.useSharedValue)(-1);
    const dragVelocityX = (0, react_native_reanimated_1.useSharedValue)(0);
    const dragVelocityY = (0, react_native_reanimated_1.useSharedValue)(0);
    const [liveBackdropEnabled, setLiveBackdropEnabled] = (0, react_1.useState)(false);
    const interactionActiveRef = (0, react_1.useRef)(false);
    const dragCommittedTargetRef = (0, react_1.useRef)(null);
    const previousGeometryRef = (0, react_1.useRef)({ selected, barWidth: 0 });
    const [gestureDebug, setGestureDebug] = (0, react_1.useState)({
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
    const noteTabViewTouch = (0, react_1.useCallback)(() => {
        if (GESTURE_DEBUG_ENABLED)
            setGestureDebug((current) => ({ ...current, touchCount: current.touchCount + 1 }));
    }, []);
    const noteGestureDown = (0, react_1.useCallback)(() => {
        if (GESTURE_DEBUG_ENABLED)
            setGestureDebug((current) => ({ ...current, gestureCount: current.gestureCount + 1 }));
    }, []);
    const updateGestureDebug = (0, react_1.useCallback)((nextPhase, nextHoldCandidate, nextHoldActivated, nextDragging, nextSnapStarted, origin, hovered, pending) => {
        if (!GESTURE_DEBUG_ENABLED)
            return;
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
    (0, react_native_reanimated_1.useAnimatedReaction)(() => ({
        phase: phase.value,
        holdCandidate: holdCandidate.value,
        holdActivated: holdActivated.value,
        dragging: panActivated.value,
        snapStarted: snapStarted.value,
        origin: originSelectedIndex.value,
        hovered: hoveredIndex.value,
        pending: pendingIndex.value,
    }), (current, previous) => {
        if (!GESTURE_DEBUG_ENABLED)
            return;
        if (previous == null ||
            current.phase !== previous.phase ||
            current.holdCandidate !== previous.holdCandidate ||
            current.holdActivated !== previous.holdActivated ||
            current.dragging !== previous.dragging ||
            current.snapStarted !== previous.snapStarted ||
            current.origin !== previous.origin ||
            current.hovered !== previous.hovered ||
            current.pending !== previous.pending) {
            (0, react_native_reanimated_1.runOnJS)(updateGestureDebug)(current.phase, current.holdCandidate, current.holdActivated, current.dragging, current.snapStarted, current.origin, current.hovered, current.pending);
        }
    }, [holdCandidate, holdActivated, hoveredIndex, originSelectedIndex, panActivated, pendingIndex, phase, snapStarted, updateGestureDebug]);
    const beginInteraction = (0, react_1.useCallback)(() => {
        interactionActiveRef.current = true;
        dragCommittedTargetRef.current = null;
        if (nativeLiveAvailable)
            setLiveBackdropEnabled(true);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    }, [nativeLiveAvailable]);
    const activateHoldOnUI = (0, react_1.useCallback)((expectedSessionId, expectedIndex) => {
        'worklet';
        if (!touchSessionActive.value ||
            sessionId.value !== expectedSessionId ||
            !holdCandidate.value ||
            touchMovedPastSlop.value ||
            expectedIndex !== selected)
            return;
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
        lensLeft.value = (0, react_native_reanimated_1.withSpring)(currentCenter - expandedWidth / 2, reducedMotion ? IDLE_SPRING : { damping: 23, stiffness: 360, mass: 0.7 });
        lensRight.value = (0, react_native_reanimated_1.withSpring)(currentCenter + expandedWidth / 2, reducedMotion ? IDLE_SPRING : { damping: 23, stiffness: 360, mass: 0.7 });
        lensHeight.value = (0, react_native_reanimated_1.withSpring)(expandedHeight, reducedMotion ? { damping: 25, stiffness: 390 } : { damping: 23, stiffness: 350, mass: 0.7 });
        interactionProgress.value = (0, react_native_reanimated_1.withTiming)(1, { duration: reducedMotion ? 85 : 135 });
        (0, react_native_reanimated_1.runOnJS)(logGlassTabGesture)('HOLD_ACTIVE', `index=${selected}`);
        (0, react_native_reanimated_1.runOnJS)(beginInteraction)();
        if (GESTURE_DEBUG_ENABLED) {
            (0, react_native_reanimated_1.runOnJS)(updateGestureDebug)('inflating', false, true, false, false, selected, selected, selected);
        }
    }, [beginInteraction, grabOffsetX, holdActivated, holdCandidate, hoveredIndex, interactionActive, interactionProgress, lensBaseHeight, lensHeight, lensLeft, lensRight, lensWidth, originSelectedIndex, pendingIndex, phase, reducedMotion, selected, sessionId, shellScreenLeft, touchMovedPastSlop, touchSessionActive, touchStartX, updateGestureDebug]);
    const commitDragSelection = (0, react_1.useCallback)((targetIndex, startIndex) => {
        const safeTarget = Math.max(0, Math.min(itemCount - 1, targetIndex));
        const safeStart = Math.max(0, Math.min(itemCount - 1, startIndex));
        if (safeTarget === safeStart || dragCommittedTargetRef.current !== null)
            return;
        // Mark this as the drag's own page change before notifying navigation.
        // The selection effect must leave the remaining glass settle intact.
        dragCommittedTargetRef.current = safeTarget;
        previousGeometryRef.current = { selected: safeTarget, barWidth };
        logGlassTabGesture('COMMIT', `target=${safeTarget}`);
        (onSelectFromDrag ?? onSelect)(safeTarget);
    }, [barWidth, itemCount, onSelect, onSelectFromDrag]);
    const finishInteraction = (0, react_1.useCallback)((targetIndex) => {
        const safeTarget = Math.max(0, Math.min(itemCount - 1, targetIndex));
        interactionActiveRef.current = false;
        setLiveBackdropEnabled(false);
        previousGeometryRef.current = { selected: safeTarget, barWidth };
        dragCommittedTargetRef.current = null;
        logGlassTabGesture('BACKDROP_OFF');
        logGlassTabGesture('RESET');
    }, [barWidth, itemCount]);
    const resetInteractionOnUI = (0, react_1.useCallback)((targetIndex) => {
        'worklet';
        const safeTarget = Math.max(0, Math.min(itemCount - 1, targetIndex));
        if (phase.value === 'idle' && !interactionActive.value && !snapStarted.value)
            return;
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
        (0, react_native_reanimated_1.cancelAnimation)(holdTimerProgress);
        holdTimerProgress.value = 0;
        (0, react_native_reanimated_1.cancelAnimation)(lensLeft);
        (0, react_native_reanimated_1.cancelAnimation)(lensRight);
        (0, react_native_reanimated_1.cancelAnimation)(lensHeight);
        (0, react_native_reanimated_1.cancelAnimation)(lensOffsetY);
        (0, react_native_reanimated_1.cancelAnimation)(interactionProgress);
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
        (0, react_native_reanimated_1.runOnJS)(finishInteraction)(safeTarget);
    }, [dragVelocityX, dragVelocityY, finishInteraction, holdActivated, holdCandidate, holdTimerProgress, horizontalPadding, hoveredIndex, interactionActive, interactionProgress, itemCount, itemWidth, lastHapticIndex, lensBaseHeight, lensHeight, lensLeft, lensOffsetY, lensRight, lensWidth, originSelectedIndex, panActivated, panActivationRequested, panUpdateLogged, pendingIndex, phase, snapStarted, touchMovedPastSlop, touchSessionActive, touchStartX, touchStartY, touchedIndex]);
    (0, react_1.useEffect)(() => {
        if (barWidth <= 0)
            return;
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
                (0, react_native_reanimated_1.cancelAnimation)(holdTimerProgress);
                holdTimerProgress.value = 0;
                (0, react_native_reanimated_1.cancelAnimation)(lensLeft);
                (0, react_native_reanimated_1.cancelAnimation)(lensRight);
                (0, react_native_reanimated_1.cancelAnimation)(lensHeight);
                (0, react_native_reanimated_1.cancelAnimation)(lensOffsetY);
                (0, react_native_reanimated_1.cancelAnimation)(interactionProgress);
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
        if (!initialMeasurement && !selectionChanged && !widthChanged)
            return;
        const safeIndex = Math.max(0, Math.min(itemCount - 1, selected));
        const nextCenter = horizontalPadding + itemWidth * (safeIndex + 0.5);
        const nextLeft = nextCenter - lensWidth / 2;
        if (initialMeasurement) {
            lensLeft.value = nextLeft;
            lensRight.value = nextLeft + lensWidth;
            lensHeight.value = lensBaseHeight;
        }
        else if (reducedMotion) {
            lensLeft.value = (0, react_native_reanimated_1.withTiming)(nextLeft, { duration: 115 });
            lensRight.value = (0, react_native_reanimated_1.withTiming)(nextLeft + lensWidth, { duration: 115 });
            lensHeight.value = (0, react_native_reanimated_1.withTiming)(lensBaseHeight, { duration: 95 });
        }
        else {
            lensLeft.value = (0, react_native_reanimated_1.withSpring)(nextLeft, TAP_SELECTION_SPRING);
            lensRight.value = (0, react_native_reanimated_1.withSpring)(nextLeft + lensWidth, TAP_SELECTION_SPRING);
            lensHeight.value = (0, react_native_reanimated_1.withSpring)(lensBaseHeight, { damping: 28, stiffness: 500, mass: 0.55 });
        }
        lensOffsetY.value = (0, react_native_reanimated_1.withTiming)(0, { duration: 110 });
        previousGeometryRef.current = { selected, barWidth };
    }, [barWidth, dragVelocityX, dragVelocityY, holdActivated, holdCandidate, holdTimerProgress, horizontalPadding, hoveredIndex, interactionActive, interactionProgress, itemCount, itemWidth, lastHapticIndex, lensBaseHeight, lensHeight, lensLeft, lensOffsetY, lensRight, lensWidth, originSelectedIndex, panActivated, panActivationRequested, panUpdateLogged, pendingIndex, phase, reducedMotion, selected, sessionId, snapStarted, touchMovedPastSlop, touchSessionActive, touchStartX, touchStartY, touchedIndex]);
    (0, react_1.useEffect)(() => () => {
        (0, react_native_reanimated_1.cancelAnimation)(holdTimerProgress);
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
        (0, react_native_reanimated_1.cancelAnimation)(lensLeft);
        (0, react_native_reanimated_1.cancelAnimation)(lensRight);
        (0, react_native_reanimated_1.cancelAnimation)(lensHeight);
        (0, react_native_reanimated_1.cancelAnimation)(lensOffsetY);
        (0, react_native_reanimated_1.cancelAnimation)(interactionProgress);
    }, [holdActivated, holdCandidate, holdTimerProgress, interactionActive, interactionProgress, lensHeight, lensLeft, lensOffsetY, lensRight, panActivated, panActivationRequested, panUpdateLogged, phase, sessionId, snapStarted, touchMovedPastSlop, touchSessionActive, touchStartX, touchStartY, touchedIndex]);
    const onDragUpdate = (0, react_1.useCallback)((absoluteX, relativeY, velocityX, velocityY, startIndex) => {
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
            lensLeft.value = (0, react_native_reanimated_1.withSpring)(targetLeft, EDGE_SPRING_SLOW);
        }
        else if (direction < 0) {
            lensLeft.value = targetLeft;
            lensRight.value = (0, react_native_reanimated_1.withSpring)(targetRight, EDGE_SPRING_SLOW);
        }
        else {
            lensLeft.value = (0, react_native_reanimated_1.withSpring)(targetLeft, IDLE_SPRING);
            lensRight.value = (0, react_native_reanimated_1.withSpring)(targetRight, IDLE_SPRING);
        }
        const hapticIndex = nearestDistance < itemWidth * 0.36 && nearestIndex !== startIndex ? nearestIndex : -1;
        if (hapticIndex !== lastHapticIndex.value) {
            lastHapticIndex.value = hapticIndex;
            if (hapticIndex >= 0)
                (0, react_native_reanimated_1.runOnJS)(emitTargetHaptic)(hapticIndex);
        }
    }, [barWidth, dragVelocityX, dragVelocityY, grabOffsetX, height, horizontalPadding, hoveredIndex, interactionProgress, itemCount, itemWidth, lastHapticIndex, lensBaseHeight, lensHeight, lensLeft, lensRight, lensWidth, phase, reducedMotion, shellScreenLeft, lensOffsetY]);
    const onBeginSnap = (0, react_1.useCallback)((velocityX, startIndex, cancelled = false) => {
        'worklet';
        if (snapStarted.value || (phase.value !== 'inflating' && phase.value !== 'dragging'))
            return;
        snapStarted.value = true;
        phase.value = 'snapping';
        const originIndex = cancelled ? startIndex : originSelectedIndex.value;
        const currentCenter = (lensLeft.value + lensRight.value) / 2;
        const projectedCenter = currentCenter + velocityX * 0.075;
        let targetIndex = 0;
        let nearestDistance = Number.MAX_VALUE;
        if (cancelled) {
            targetIndex = originIndex;
        }
        else {
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
        (0, react_native_reanimated_1.runOnJS)(logGlassTabGesture)('SNAP_START', `target=${targetIndex}${cancelled ? ' rollback' : ''}`);
        // Page ownership changes as soon as the finger is released and the
        // destination is known. The glass snap/settle continues independently,
        // so navigation never waits for the trailing spring to finish.
        if (!cancelled && targetIndex !== originIndex) {
            (0, react_native_reanimated_1.runOnJS)(commitDragSelection)(targetIndex, originIndex);
        }
        lensOffsetY.value = (0, react_native_reanimated_1.withSpring)(0, { damping: 24, stiffness: 300 });
        lensHeight.value = reducedMotion
            ? (0, react_native_reanimated_1.withTiming)(lensBaseHeight, { duration: 100 })
            : (0, react_native_reanimated_1.withSpring)(lensBaseHeight, { damping: 25, stiffness: 320, mass: 0.7 });
        const finishSnap = (finished) => {
            'worklet';
            if (phase.value !== 'snapping')
                return;
            if (!finished) {
                resetInteractionOnUI(originIndex);
                return;
            }
            phase.value = 'settling';
            (0, react_native_reanimated_1.runOnJS)(logGlassTabGesture)('SNAP_END', `target=${targetIndex}`);
            interactionProgress.value = (0, react_native_reanimated_1.withTiming)(0, { duration: reducedMotion ? 95 : 145 }, (settled) => {
                if (settled) {
                    (0, react_native_reanimated_1.runOnJS)(logGlassTabGesture)('SETTLE_END');
                    resetInteractionOnUI(targetIndex);
                }
                else {
                    resetInteractionOnUI(originIndex);
                }
            });
        };
        if (reducedMotion) {
            lensLeft.value = (0, react_native_reanimated_1.withTiming)(targetLeft, { duration: 120 });
            // One trailing edge owns completion. This avoids a two-callback
            // counter getting stranded if either independent animation cancels.
            lensRight.value = (0, react_native_reanimated_1.withTiming)(targetLeft + lensWidth, { duration: 120 }, finishSnap);
        }
        else {
            // The trailing edge is the sole completion signal. It uses the
            // slower spring, while the leading edge reaches the target first.
            const wasMovingRight = velocityX >= 0;
            lensLeft.value = (0, react_native_reanimated_1.withSpring)(targetLeft, wasMovingRight ? EDGE_SPRING_SLOW : EDGE_SPRING_FAST, wasMovingRight ? finishSnap : undefined);
            lensRight.value = (0, react_native_reanimated_1.withSpring)(targetLeft + lensWidth, wasMovingRight ? EDGE_SPRING_FAST : EDGE_SPRING_SLOW, wasMovingRight ? undefined : finishSnap);
        }
    }, [commitDragSelection, horizontalPadding, interactionProgress, itemCount, itemWidth, lensBaseHeight, lensHeight, lensLeft, lensOffsetY, lensRight, lensWidth, originSelectedIndex, pendingIndex, phase, reducedMotion, resetInteractionOnUI, snapStarted]);
    const tabBarGesture = react_1.default.useMemo(() => react_native_gesture_handler_1.Gesture.Pan()
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
        (0, react_native_reanimated_1.runOnJS)(noteGestureDown)();
        if (touchSessionActive.value || phase.value !== 'idle') {
            (0, react_native_reanimated_1.runOnJS)(logGlassTabGesture)('INTERACTION_DOWN_BLOCKED', `phase=${phase.value}`);
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
        (0, react_native_reanimated_1.runOnJS)(logGlassTabGesture)('INTERACTION_DOWN', `hit=${hitIndex} selected=${selected}`);
        if (hitIndex === selected) {
            (0, react_native_reanimated_1.runOnJS)(logGlassTabGesture)('HOLD_BEGIN', `index=${selected}`);
            holdTimerProgress.value = (0, react_native_reanimated_1.withDelay)(LONG_PRESS_THRESHOLD_MS, (0, react_native_reanimated_1.withTiming)(1, { duration: 1 }, (finished) => {
                if (finished)
                    activateHoldOnUI(nextSessionId, selected);
            }));
        }
    })
        .onTouchesMove((event, manager) => {
        'worklet';
        if (!touchSessionActive.value)
            return;
        const touch = event.changedTouches[0] ?? event.allTouches[0];
        if (!touch)
            return;
        const dx = touch.absoluteX - touchStartX.value;
        const dy = touch.absoluteY - touchStartY.value;
        const distanceSquared = dx * dx + dy * dy;
        if (!holdActivated.value) {
            if (distanceSquared > PRE_HOLD_SLOP * PRE_HOLD_SLOP) {
                touchMovedPastSlop.value = true;
                holdCandidate.value = false;
                (0, react_native_reanimated_1.cancelAnimation)(holdTimerProgress);
                holdTimerProgress.value = 0;
                manager.fail();
            }
            return;
        }
        if (distanceSquared >= DRAG_START_SLOP * DRAG_START_SLOP && !panActivationRequested.value) {
            panActivationRequested.value = true;
            (0, react_native_reanimated_1.runOnJS)(logGlassTabGesture)('PAN_REQUEST_ACTIVATE');
            manager.activate();
        }
    })
        .onTouchesUp((event, manager) => {
        'worklet';
        if (!touchSessionActive.value)
            return;
        (0, react_native_reanimated_1.runOnJS)(logGlassTabGesture)('RELEASE');
        (0, react_native_reanimated_1.cancelAnimation)(holdTimerProgress);
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
            (0, react_native_reanimated_1.runOnJS)(logGlassTabGesture)('HOLD_RELEASE', 'without_drag');
            onBeginSnap(0, origin, true);
        }
        else if (!wasCancelledByMovement) {
            phase.value = 'idle';
            holdCandidate.value = false;
            holdActivated.value = false;
            interactionActive.value = false;
            touchedIndex.value = releaseIndex;
            (0, react_native_reanimated_1.runOnJS)(logGlassTabGesture)('TAP', `target=${releaseIndex}`);
            (0, react_native_reanimated_1.runOnJS)(onSelect)(releaseIndex);
        }
        manager.fail();
    })
        .onStart(() => {
        'worklet';
        if (!holdActivated.value || phase.value !== 'inflating')
            return;
        panActivated.value = true;
        phase.value = 'dragging';
        // Keep the finger offset captured when the hold inflated the lens;
        // that preserves the initial 3dp of movement instead of jumping.
        (0, react_native_reanimated_1.runOnJS)(logGlassTabGesture)('PAN_ACTIVE');
    })
        .onUpdate((event) => {
        'worklet';
        if (phase.value !== 'dragging')
            return;
        if (!panUpdateLogged.value) {
            panUpdateLogged.value = true;
            (0, react_native_reanimated_1.runOnJS)(logGlassTabGesture)('PAN_UPDATE_FIRST');
        }
        onDragUpdate(event.absoluteX, event.y, event.velocityX, event.velocityY, originSelectedIndex.value);
    })
        .onEnd((event, success) => {
        'worklet';
        if (!success || !panActivated.value)
            return;
        touchSessionActive.value = false;
        (0, react_native_reanimated_1.cancelAnimation)(holdTimerProgress);
        holdTimerProgress.value = 0;
        (0, react_native_reanimated_1.runOnJS)(logGlassTabGesture)('PAN_END');
        onBeginSnap(event.velocityX, originSelectedIndex.value, false);
    })
        .onFinalize((_event, success) => {
        'worklet';
        if (success)
            return;
        (0, react_native_reanimated_1.cancelAnimation)(holdTimerProgress);
        holdTimerProgress.value = 0;
        touchSessionActive.value = false;
        if (phase.value === 'pressing') {
            resetInteractionOnUI(originSelectedIndex.value);
        }
        else if (phase.value === 'inflating' || phase.value === 'dragging') {
            (0, react_native_reanimated_1.runOnJS)(logGlassTabGesture)('PAN_END', 'cancel');
            onBeginSnap(0, originSelectedIndex.value, true);
        }
    }), [activateHoldOnUI, horizontalPadding, holdActivated, holdCandidate, holdTimerProgress, interactionActive, itemCount, itemWidth, lastHapticIndex, noteGestureDown, onBeginSnap, onDragUpdate, onSelect, originSelectedIndex, panActivated, panActivationRequested, panUpdateLogged, pendingIndex, phase, resetInteractionOnUI, selected, sessionId, shellScreenLeft, snapStarted, touchMovedPastSlop, touchSessionActive, touchStartX, touchStartY, touchedIndex, hoveredIndex]);
    const localLensStyle = (0, react_native_reanimated_1.useAnimatedStyle)(() => {
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
    const liveLensStyle = (0, react_native_reanimated_1.useAnimatedStyle)(() => ({
        left: lensLeft.value,
        top: (height - lensHeight.value) / 2 + lensOffsetY.value,
        width: Math.max(lensRight.value - lensLeft.value, 1),
        height: lensHeight.value,
        borderRadius: Math.min(lensHeight.value, lensRight.value - lensLeft.value) / 2,
    }), [height]);
    const liveLensAnimatedProps = (0, react_native_reanimated_1.useAnimatedProps)(() => ({
        interactionProgress: interactionProgress.value,
        motionX: Math.max(-1, Math.min(1, dragVelocityX.value / 1800)),
        motionY: Math.max(-1, Math.min(1, dragVelocityY.value / 1800)),
    }));
    const renderVisual = renderItem ?? renderIcon ?? ((item) => item.label);
    const tabItems = items.map((item, index) => ((0, jsx_runtime_1.jsx)(GlassTabItem, { item: item, index: index, selected: index === selected, itemWidth: itemWidth, horizontalPadding: horizontalPadding, barHeight: height, renderVisual: renderVisual, customContent: renderItem != null, lensLeft: lensLeft, lensRight: lensRight }, `${item.label}-${index}`)));
    const accessibilityTargets = items.map((item, index) => ((0, jsx_runtime_1.jsx)(react_native_1.View, { accessible: true, accessibilityRole: "tab", accessibilityLabel: item.label, accessibilityHint: accessibilityHint ?? '长按并拖动当前选中页签可切换页面', accessibilityState: { selected: index === selected }, accessibilityActions: [{ name: 'activate', label: item.label }], onAccessibilityAction: () => onSelect(index), style: styles.interactionTarget }, `tab-accessibility-${item.label}-${index}`)));
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
    const barContents = ((0, jsx_runtime_1.jsxs)(react_native_1.View, { ref: inlineHostRef, onLayout: presentation === 'inline' && typeof requestedWidth !== 'number'
            ? (event) => {
                setInlineWidth(event.nativeEvent.layout.width);
                inlineHostRef.current?.measureInWindow((left) => setInlineScreenLeft(left));
            }
            : undefined, pointerEvents: "box-none", style: presentation === 'floating'
            ? [styles.host, { left: shellScreenLeft, bottom: bottomInset + TAB_BAR_BOTTOM_GAP, width: barWidth, height }]
            : [styles.inlineHost, { width: requestedWidth ?? '100%', height }], children: [nativeLiveAvailable ? ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(NativeCaptureSource, { providerId: providerId, pointerEvents: "none", style: [
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
                        ], children: (0, jsx_runtime_1.jsx)(react_native_1.View, { pointerEvents: "none", style: [styles.shell, shellStyle], children: (0, jsx_runtime_1.jsx)(react_native_1.View, { pointerEvents: "none", style: [styles.row, { paddingHorizontal: horizontalPadding }], children: tabItems }) }) }), (0, jsx_runtime_1.jsx)(NativeGlassSurface, { pointerEvents: "none", providerId: providerId, cornerRadius: appearance?.tokens.materials.tabSelectionLens.radius ?? lensBaseHeight / 2, blurRadius: (appearance?.tokens.materials.tabSelectionLens.blurRadius ?? 0.35) * (appearance?.tokens.quality === 'high' ? 1.2 : 1), refractionHeight: lensRefractionHeight ?? appearance?.tokens.materials.tabSelectionLens.refractionHeight ?? 12, refractionAmount: appearance?.tokens.materials.tabSelectionLens.refractionAmount ?? 5.5, bodyRefractionAmount: appearance?.tokens.materials.tabSelectionLens.refractionBodyAmount ?? 1.5, saturation: appearance?.tokens.materials.tabSelectionLens.saturation ?? 1.02, chromaticAberration: appearance?.tokens.materials.tabSelectionLens.chromaticAberration ?? 0.3, highlightAlpha: appearance?.tokens.materials.tabSelectionLens.highlightAlpha ?? 0.62, highlightWidth: appearance?.tokens.materials.tabSelectionLens.highlightWidth ?? 1.3, tintAlpha: appearance?.tokens.materials.tabSelectionLens.tintAlpha ?? 0.08, specularStrength: appearance?.tokens.materials.tabSelectionLens.specularStrength ?? 0.95, fresnelStrength: appearance?.tokens.materials.tabSelectionLens.fresnelStrength ?? 0.72, innerShadowStrength: appearance?.tokens.materials.tabSelectionLens.innerShadowStrength ?? 0.2, tint: appearance?.tokens.tint[dark ? 'dark' : 'light'], continuous: liveBackdropEnabled, animatedProps: liveLensAnimatedProps, style: [styles.nativeLens, liveLensStyle] })] })) : ((0, jsx_runtime_1.jsxs)(react_native_1.View, { pointerEvents: "none", style: [styles.shell, shellStyle], children: [(0, jsx_runtime_1.jsx)(GlassSurface_1.GlassSurface, { variant: "tabSelectionLens", positioning: "inFlow", sampling: "local", pointerEvents: "none", style: {
                            position: 'absolute',
                            left: selectedLeft,
                            top: verticalInset,
                            width: lensWidth,
                            height: lensBaseHeight,
                            borderRadius: lensBaseHeight / 2,
                        }, animatedStyle: localLensStyle }), (0, jsx_runtime_1.jsx)(react_native_1.View, { pointerEvents: "none", style: [styles.row, { paddingHorizontal: horizontalPadding }], children: tabItems })] })), GESTURE_DEBUG_ENABLED && ((0, jsx_runtime_1.jsx)(react_native_1.View, { pointerEvents: "none", accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants", style: [styles.gestureDebugOverlay, { width: Math.max(barWidth, TAB_BAR_MIN_WIDTH) }], children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.gestureDebugText, children: `view DOWN ${gestureDebug.touchCount} · gesture DOWN ${gestureDebug.gestureCount}\nphase ${gestureDebug.phase} · hold candidate ${gestureDebug.holdCandidate ? 'ON' : 'off'} · hold ${gestureDebug.holdActivated ? 'ON' : 'off'} · drag ${gestureDebug.dragging ? 'ON' : 'off'} · snap ${gestureDebug.snapStarted ? 'ON' : 'off'}\norigin ${gestureDebug.origin} · hovered ${gestureDebug.hovered} · pending ${gestureDebug.pending}` }) })), (0, jsx_runtime_1.jsx)(react_native_gesture_handler_1.GestureDetector, { gesture: tabBarGesture, children: (0, jsx_runtime_1.jsx)(react_native_1.View, { pointerEvents: "auto", onTouchStart: GESTURE_DEBUG_ENABLED ? noteTabViewTouch : undefined, collapsable: false, style: [styles.interactionLayer, { width: barWidth, height }], children: accessibilityTargets }) })] }));
    return presentation === 'floating'
        ? (0, jsx_runtime_1.jsx)(GlassSurface_1.GlassOverlay, { zIndex: TAB_BAR_PORTAL_Z_INDEX + 1, children: barContents })
        : barContents;
}
function GlassTabItem({ item, index, selected, itemWidth, horizontalPadding, barHeight, renderVisual, customContent, lensLeft, lensRight, }) {
    const itemFocusStyle = (0, react_native_reanimated_1.useAnimatedStyle)(() => {
        const center = (lensLeft.value + lensRight.value) / 2;
        const tabCenter = horizontalPadding + itemWidth * (index + 0.5);
        const strength = Math.max(0, Math.min(1, 1 - Math.abs(center - tabCenter) / Math.max(itemWidth * 0.92, 1)));
        return {
            transform: [{ scale: 1 + strength * 0.025 }],
        };
    }, [horizontalPadding, index, itemWidth]);
    const activeIconStyle = (0, react_native_reanimated_1.useAnimatedStyle)(() => {
        const center = (lensLeft.value + lensRight.value) / 2;
        const tabCenter = horizontalPadding + itemWidth * (index + 0.5);
        const strength = Math.max(0, Math.min(1, 1 - Math.abs(center - tabCenter) / Math.max(itemWidth * 0.92, 1)));
        return { opacity: strength };
    }, [horizontalPadding, index, itemWidth]);
    const baseVisual = renderVisual(item, index, false);
    const activeVisual = renderVisual(item, index, true);
    return ((0, jsx_runtime_1.jsx)(react_native_1.View, { pointerEvents: "none", accessible: false, accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants", style: [styles.item, { height: barHeight }], children: (0, jsx_runtime_1.jsx)(react_native_reanimated_1.default.View, { style: [customContent ? styles.itemContentInline : styles.itemContent, itemFocusStyle], children: customContent ? ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.customContent, children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: styles.baseIcon, children: baseVisual }), (0, jsx_runtime_1.jsx)(react_native_reanimated_1.default.View, { pointerEvents: "none", accessible: false, accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants", style: [styles.customActive, activeIconStyle], children: activeVisual })] })) : ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.icon, children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: styles.baseIcon, children: baseVisual }), (0, jsx_runtime_1.jsx)(react_native_reanimated_1.default.View, { pointerEvents: "none", style: [styles.activeIcon, activeIconStyle], children: activeVisual })] })) }) }));
}
const styles = react_native_1.StyleSheet.create({
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
        ...react_native_1.StyleSheet.absoluteFillObject,
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
        borderWidth: react_native_1.StyleSheet.hairlineWidth,
    },
    row: {
        ...react_native_1.StyleSheet.absoluteFillObject,
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
    activeIcon: { ...react_native_1.StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
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
        ...react_native_1.StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
//# sourceMappingURL=GlassTabBar.js.map
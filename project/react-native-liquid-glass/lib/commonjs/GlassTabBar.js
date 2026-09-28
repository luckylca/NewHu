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
const liquid_glass_kit_1 = require("liquid-glass-kit");
const react_native_gesture_handler_1 = require("react-native-gesture-handler");
const react_native_reanimated_1 = __importStar(require("react-native-reanimated"));
const GlassSurface_1 = require("./GlassSurface");
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
const AnimatedLiquidGlassView = (0, react_native_reanimated_1.createAnimatedComponent)(liquid_glass_kit_1.LiquidGlassView);
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
function GlassTabBar({ items, selected, bottomInset, shellBackgroundColor, onSelect, onSelectFromDrag, renderIcon }) {
    const { width: windowWidth } = (0, react_native_1.useWindowDimensions)();
    const appearance = (0, GlassSurface_1.useGlassAppearance)();
    const reducedMotion = (0, GlassSurface_1.useGlassReducedMotion)();
    const tabBarMaterial = appearance?.tokens.materials.tabBarShell ?? appearance?.tokens.materials.tabBar;
    const nativeLiveAvailable = react_native_1.Platform.OS === 'android' && appearance?.tokens.quality !== 'fallback';
    const dark = appearance?.dark ?? false;
    const opaqueShellColor = shellBackgroundColor ?? (dark ? '#283547' : '#EAF0F7');
    const providerId = react_1.default.useId();
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
    const lensLeft = (0, react_native_reanimated_1.useSharedValue)(selectedLeft);
    const lensRight = (0, react_native_reanimated_1.useSharedValue)(selectedLeft + lensWidth);
    const lensHeight = (0, react_native_reanimated_1.useSharedValue)(SELECTION_LENS_HEIGHT);
    const lensOffsetY = (0, react_native_reanimated_1.useSharedValue)(0);
    const interactionProgress = (0, react_native_reanimated_1.useSharedValue)(0);
    const phase = (0, react_native_reanimated_1.useSharedValue)('idle');
    const grabOffsetX = (0, react_native_reanimated_1.useSharedValue)(0);
    const originSelectedIndex = (0, react_native_reanimated_1.useSharedValue)(selected);
    const releaseTargetIndex = (0, react_native_reanimated_1.useSharedValue)(selected);
    const snapCallbacksRemaining = (0, react_native_reanimated_1.useSharedValue)(0);
    const lastHapticIndex = (0, react_native_reanimated_1.useSharedValue)(-1);
    const dragVelocityX = (0, react_native_reanimated_1.useSharedValue)(0);
    const dragVelocityY = (0, react_native_reanimated_1.useSharedValue)(0);
    const [liveBackdropEnabled, setLiveBackdropEnabled] = (0, react_1.useState)(false);
    const interactionActiveRef = (0, react_1.useRef)(false);
    const lastSelectedRef = (0, react_1.useRef)(selected);
    (0, react_1.useEffect)(() => {
        if (lastSelectedRef.current === selected)
            return;
        lastSelectedRef.current = selected;
        if (interactionActiveRef.current)
            return;
        const nextCenter = TAB_BAR_HORIZONTAL_PADDING + itemWidth * (selected + 0.5);
        const nextLeft = nextCenter - lensWidth / 2;
        if (reducedMotion) {
            lensLeft.value = (0, react_native_reanimated_1.withTiming)(nextLeft, { duration: 130 });
            lensRight.value = (0, react_native_reanimated_1.withTiming)(nextLeft + lensWidth, { duration: 130 });
            lensHeight.value = (0, react_native_reanimated_1.withTiming)(SELECTION_LENS_HEIGHT, { duration: 110 });
        }
        else {
            lensLeft.value = (0, react_native_reanimated_1.withSpring)(nextLeft, IDLE_SPRING);
            lensRight.value = (0, react_native_reanimated_1.withSpring)(nextLeft + lensWidth, IDLE_SPRING);
            lensHeight.value = (0, react_native_reanimated_1.withTiming)(SELECTION_LENS_HEIGHT - 2, { duration: 90 }, (finished) => {
                if (finished)
                    lensHeight.value = (0, react_native_reanimated_1.withSpring)(SELECTION_LENS_HEIGHT, { damping: 19, stiffness: 320 });
            });
        }
        lensOffsetY.value = (0, react_native_reanimated_1.withTiming)(0, { duration: 110 });
    }, [itemWidth, lensHeight, lensLeft, lensRight, lensWidth, reducedMotion, selected, lensOffsetY]);
    const beginInteraction = (0, react_1.useCallback)(() => {
        interactionActiveRef.current = true;
        if (nativeLiveAvailable)
            setLiveBackdropEnabled(true);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    }, [nativeLiveAvailable]);
    const finishInteraction = (0, react_1.useCallback)(() => {
        interactionActiveRef.current = false;
        setLiveBackdropEnabled(false);
    }, []);
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
    }, [barWidth, dragVelocityX, dragVelocityY, grabOffsetX, interactionProgress, itemCount, itemWidth, lastHapticIndex, lensHeight, lensLeft, lensRight, lensWidth, phase, reducedMotion, shellScreenLeft, lensOffsetY]);
    const onBeginSnap = (0, react_1.useCallback)((velocityX, startIndex) => {
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
            (0, react_native_reanimated_1.runOnJS)(onSelectFromDrag ?? onSelect)(targetIndex);
        lensOffsetY.value = (0, react_native_reanimated_1.withSpring)(0, { damping: 24, stiffness: 300 });
        lensHeight.value = reducedMotion
            ? (0, react_native_reanimated_1.withTiming)(SELECTION_LENS_HEIGHT, { duration: 100 })
            : (0, react_native_reanimated_1.withSpring)(SELECTION_LENS_HEIGHT, { damping: 25, stiffness: 320, mass: 0.7 });
        snapCallbacksRemaining.value = 2;
        const finishEdge = (finished) => {
            'worklet';
            if (!finished)
                return;
            snapCallbacksRemaining.value -= 1;
            if (snapCallbacksRemaining.value !== 0)
                return;
            phase.value = 'settling';
            interactionProgress.value = (0, react_native_reanimated_1.withTiming)(0, { duration: reducedMotion ? 95 : 145 }, (settled) => {
                if (!settled)
                    return;
                phase.value = 'idle';
                dragVelocityX.value = 0;
                dragVelocityY.value = 0;
                lastHapticIndex.value = -1;
                (0, react_native_reanimated_1.runOnJS)(finishInteraction)();
            });
        };
        if (reducedMotion) {
            lensLeft.value = (0, react_native_reanimated_1.withTiming)(targetLeft, { duration: 120 }, finishEdge);
            lensRight.value = (0, react_native_reanimated_1.withTiming)(targetLeft + lensWidth, { duration: 120 }, finishEdge);
        }
        else {
            // Both edges settle independently; the edge trailing the drag has a
            // slightly lower stiffness and catches up last.
            const wasMovingRight = velocityX >= 0;
            lensLeft.value = (0, react_native_reanimated_1.withSpring)(targetLeft, wasMovingRight ? EDGE_SPRING_SLOW : EDGE_SPRING_FAST, finishEdge);
            lensRight.value = (0, react_native_reanimated_1.withSpring)(targetLeft + lensWidth, wasMovingRight ? EDGE_SPRING_FAST : EDGE_SPRING_SLOW, finishEdge);
        }
    }, [dragVelocityX, dragVelocityY, finishInteraction, interactionProgress, itemCount, itemWidth, lastHapticIndex, lensHeight, lensLeft, lensOffsetY, lensRight, lensWidth, onSelect, onSelectFromDrag, originSelectedIndex, phase, reducedMotion, releaseTargetIndex, snapCallbacksRemaining]);
    const localLensStyle = (0, react_native_reanimated_1.useAnimatedStyle)(() => {
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
    const liveLensStyle = (0, react_native_reanimated_1.useAnimatedStyle)(() => ({
        left: lensLeft.value,
        top: (TAB_BAR_HEIGHT - lensHeight.value) / 2 + lensOffsetY.value,
        width: Math.max(lensRight.value - lensLeft.value, 1),
        height: lensHeight.value,
        borderRadius: Math.min(lensHeight.value, lensRight.value - lensLeft.value) / 2,
    }));
    const liveLensAnimatedProps = (0, react_native_reanimated_1.useAnimatedProps)(() => ({
        interactionProgress: interactionProgress.value,
        motionX: Math.max(-1, Math.min(1, dragVelocityX.value / 1800)),
        motionY: Math.max(-1, Math.min(1, dragVelocityY.value / 1800)),
    }));
    const tabItems = items.map((item, index) => ((0, jsx_runtime_1.jsx)(GlassTabItem, { item: item, index: index, selected: index === selected, itemWidth: itemWidth, renderIcon: renderIcon, onSelect: onSelect, reducedMotion: reducedMotion, shellScreenLeft: shellScreenLeft, lensWidth: lensWidth, lensLeft: lensLeft, lensRight: lensRight, lensHeight: lensHeight, phase: phase, interactionProgress: interactionProgress, grabOffsetX: grabOffsetX, originSelectedIndex: originSelectedIndex, releaseTargetIndex: releaseTargetIndex, lastHapticIndex: lastHapticIndex, onBeginSnap: onBeginSnap, onDragUpdate: onDragUpdate, onBeginInteraction: beginInteraction }, `${item.label}-${index}`)));
    return ((0, jsx_runtime_1.jsx)(GlassSurface_1.GlassOverlay, { zIndex: TAB_BAR_PORTAL_Z_INDEX + 1, children: (0, jsx_runtime_1.jsx)(react_native_1.View, { pointerEvents: "box-none", style: [
                styles.host,
                {
                    left: shellScreenLeft,
                    bottom: bottomInset + TAB_BAR_BOTTOM_GAP,
                    width: barWidth,
                    height: TAB_BAR_HEIGHT,
                },
            ], children: nativeLiveAvailable ? ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(liquid_glass_kit_1.LiquidGlassProvider, { providerId: providerId, maxCaptureRateHz: appearance?.tokens.quality === 'high' ? 120 : 60, style: [
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
                        ], children: (0, jsx_runtime_1.jsx)(react_native_1.View, { style: [
                                styles.shell,
                                {
                                    width: barWidth,
                                    height: TAB_BAR_HEIGHT,
                                    borderRadius: TAB_BAR_HEIGHT / 2,
                                    borderColor: shellBorderColor,
                                    backgroundColor: opaqueShellColor,
                                },
                            ], children: (0, jsx_runtime_1.jsx)(react_native_1.View, { style: styles.row, children: tabItems }) }) }), (0, jsx_runtime_1.jsx)(AnimatedLiquidGlassView, { pointerEvents: "none", providerId: providerId, cornerRadius: appearance?.tokens.materials.tabSelectionLens.radius ?? SELECTION_LENS_HEIGHT / 2, blurRadius: (appearance?.tokens.materials.tabSelectionLens.blurRadius ?? 0.35) * (appearance?.tokens.quality === 'high' ? 1.2 : 1), refractionHeight: appearance?.tokens.materials.tabSelectionLens.refractionHeight ?? 12, refractionAmount: appearance?.tokens.materials.tabSelectionLens.refractionAmount ?? 5.5, bodyRefractionAmount: appearance?.tokens.materials.tabSelectionLens.refractionBodyAmount ?? 1.5, saturation: appearance?.tokens.materials.tabSelectionLens.saturation ?? 1.02, chromaticAberration: appearance?.tokens.materials.tabSelectionLens.chromaticAberration ?? 0.3, highlightAlpha: appearance?.tokens.materials.tabSelectionLens.highlightAlpha ?? 0.62, highlightWidth: appearance?.tokens.materials.tabSelectionLens.highlightWidth ?? 1.3, tintAlpha: appearance?.tokens.materials.tabSelectionLens.tintAlpha ?? 0.08, specularStrength: appearance?.tokens.materials.tabSelectionLens.specularStrength ?? 0.95, fresnelStrength: appearance?.tokens.materials.tabSelectionLens.fresnelStrength ?? 0.72, innerShadowStrength: appearance?.tokens.materials.tabSelectionLens.innerShadowStrength ?? 0.2, tint: appearance?.tokens.tint[dark ? 'dark' : 'light'], continuous: liveBackdropEnabled, animatedProps: liveLensAnimatedProps, style: [styles.nativeLens, liveLensStyle] })] })) : ((0, jsx_runtime_1.jsxs)(react_native_1.View, { style: [
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
                ], children: [(0, jsx_runtime_1.jsx)(GlassSurface_1.GlassSurface, { variant: "tabSelectionLens", renderMode: "local", pointerEvents: "none", style: {
                            position: 'absolute',
                            left: selectedLeft,
                            top: (TAB_BAR_HEIGHT - SELECTION_LENS_HEIGHT) / 2,
                            width: lensWidth,
                            height: SELECTION_LENS_HEIGHT,
                            borderRadius: SELECTION_LENS_HEIGHT / 2,
                        }, animatedStyle: localLensStyle }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: styles.row, children: tabItems })] })) }) }));
}
function GlassTabItem({ item, index, selected, itemWidth, renderIcon, onSelect, reducedMotion, shellScreenLeft, lensWidth, lensLeft, lensRight, lensHeight, phase, interactionProgress, grabOffsetX, originSelectedIndex, releaseTargetIndex, lastHapticIndex, onBeginSnap, onDragUpdate, onBeginInteraction, }) {
    const pressed = (0, react_native_reanimated_1.useSharedValue)(0);
    const interactionHandledRef = (0, react_1.useRef)(false);
    const notifyInteractionStart = (0, react_1.useCallback)(() => {
        interactionHandledRef.current = true;
        onBeginInteraction();
    }, [onBeginInteraction]);
    const itemFocusStyle = (0, react_native_reanimated_1.useAnimatedStyle)(() => {
        const center = (lensLeft.value + lensRight.value) / 2;
        const tabCenter = TAB_BAR_HORIZONTAL_PADDING + itemWidth * (index + 0.5);
        const strength = Math.max(0, Math.min(1, 1 - Math.abs(center - tabCenter) / Math.max(itemWidth * 0.92, 1)));
        return {
            opacity: 1 - pressed.value * 0.05,
            transform: [{ scale: 1 - pressed.value * 0.025 + strength * 0.025 }],
        };
    }, [index, itemWidth]);
    const activeIconStyle = (0, react_native_reanimated_1.useAnimatedStyle)(() => {
        const center = (lensLeft.value + lensRight.value) / 2;
        const tabCenter = TAB_BAR_HORIZONTAL_PADDING + itemWidth * (index + 0.5);
        const strength = Math.max(0, Math.min(1, 1 - Math.abs(center - tabCenter) / Math.max(itemWidth * 0.92, 1)));
        return { opacity: strength };
    }, [index, itemWidth]);
    const gesture = react_1.default.useMemo(() => react_native_gesture_handler_1.Gesture.Pan()
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
        lensLeft.value = (0, react_native_reanimated_1.withSpring)(currentCenter - expandedWidth / 2, reducedMotion ? IDLE_SPRING : { damping: 23, stiffness: 360, mass: 0.7 });
        lensRight.value = (0, react_native_reanimated_1.withSpring)(currentCenter + expandedWidth / 2, reducedMotion ? IDLE_SPRING : { damping: 23, stiffness: 360, mass: 0.7 });
        lensHeight.value = (0, react_native_reanimated_1.withSpring)(expandedHeight, reducedMotion ? { damping: 25, stiffness: 390 } : { damping: 23, stiffness: 350, mass: 0.7 });
        interactionProgress.value = (0, react_native_reanimated_1.withTiming)(1, { duration: reducedMotion ? 85 : 135 }, (finished) => {
            if (finished && phase.value === 'inflating')
                phase.value = 'dragging';
        });
        (0, react_native_reanimated_1.runOnJS)(notifyInteractionStart)();
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
    return ((0, jsx_runtime_1.jsx)(react_native_gesture_handler_1.GestureDetector, { gesture: gesture, children: (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "tab", accessibilityLabel: item.label, accessibilityHint: "\u957F\u6309\u5E76\u62D6\u52A8\u5F53\u524D\u9009\u4E2D\u9875\u7B7E\u53EF\u5207\u6362\u9875\u9762", accessibilityState: { selected }, onPress: () => {
                if (interactionHandledRef.current) {
                    interactionHandledRef.current = false;
                    return;
                }
                onSelect(index);
            }, onPressIn: () => {
                interactionHandledRef.current = false;
                pressed.value = reducedMotion ? (0, react_native_reanimated_1.withTiming)(1, { duration: 60 }) : (0, react_native_reanimated_1.withSpring)(1, { damping: 20, stiffness: 420 });
            }, onPressOut: () => {
                pressed.value = reducedMotion ? (0, react_native_reanimated_1.withTiming)(0, { duration: 80 }) : (0, react_native_reanimated_1.withSpring)(0, { damping: 20, stiffness: 420 });
            }, style: styles.item, children: (0, jsx_runtime_1.jsx)(react_native_reanimated_1.default.View, { style: [styles.itemContent, itemFocusStyle], children: (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.icon, children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: styles.baseIcon, children: renderIcon(item, index, false) }), (0, jsx_runtime_1.jsx)(react_native_reanimated_1.default.View, { pointerEvents: "none", style: [styles.activeIcon, activeIconStyle], children: renderIcon(item, index, true) })] }) }) }) }));
}
const styles = react_native_1.StyleSheet.create({
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
    activeIcon: { ...react_native_1.StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
});
//# sourceMappingURL=GlassTabBar.js.map
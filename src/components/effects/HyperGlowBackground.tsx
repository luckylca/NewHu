import type { Transforms3d, Vector } from '@shopify/react-native-skia';
import React, { memo, useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, TurboModuleRegistry, View } from 'react-native';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import {
    default as Animated,
    cancelAnimation,
    Easing,
    interpolate,
    useAnimatedStyle,
    useDerivedValue,
    useReducedMotion,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import Svg, { Defs, Ellipse, RadialGradient as SvgRadialGradient, Rect, Stop } from 'react-native-svg';

type SkiaModule = typeof import('@shopify/react-native-skia');

let cachedSkia: SkiaModule | null | undefined;

function loadSkia() {
    if (cachedSkia !== undefined) return cachedSkia;

    const hasInstalledSkia = Platform.OS === 'web'
        || (globalThis as { SkiaApi?: unknown }).SkiaApi != null
        || TurboModuleRegistry.get('RNSkiaModule') != null;

    if (!hasInstalledSkia) {
        cachedSkia = null;
        return cachedSkia;
    }

    try {
        // Skia must stay lazy so an older development client can still open.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        cachedSkia = require('@shopify/react-native-skia') as SkiaModule;
    } catch (error) {
        console.warn('当前开发客户端未包含 Skia，柔光背景已使用静态降级效果', error);
        cachedSkia = null;
    }
    return cachedSkia;
}

export interface HyperGlowBackgroundProps {
    animated?: boolean;
    intensity?: number;
    speed?: number;
    pinkColor?: string;
    blueColor?: string;
    style?: StyleProp<ViewStyle>;
}

export const HyperGlowBackground = memo(function HyperGlowBackground({
    animated = true,
    intensity = 1,
    speed = 1,
    pinkColor = '#F29FC2',
    blueColor = '#9DBEFF',
    style,
}: HyperGlowBackgroundProps) {
    const skia = useMemo(loadSkia, []);
    const reduceMotion = useReducedMotion();
    const [{ width, height }, setSize] = useState({ width: 0, height: 0 });
    const pinkProgress = useSharedValue(0);
    const blueProgress = useSharedValue(0);
    const whiteProgress = useSharedValue(0);
    const animationSpeed = Math.max(0.1, speed);

    const onLayout = (event: LayoutChangeEvent) => {
        const next = event.nativeEvent.layout;
        setSize((current) => current.width === next.width && current.height === next.height
            ? current
            : { width: next.width, height: next.height });
    };

    useEffect(() => {
        cancelAnimation(pinkProgress);
        cancelAnimation(blueProgress);
        cancelAnimation(whiteProgress);
        pinkProgress.value = 0;
        blueProgress.value = 2;
        whiteProgress.value = 1;

        if (!animated || reduceMotion || width === 0 || height === 0) return;

        const easing = Easing.inOut(Easing.quad);
        pinkProgress.value = withRepeat(withSequence(
            withTiming(1, { duration: 2500 / animationSpeed, easing }),
            withTiming(2, { duration: 2500 / animationSpeed, easing }),
            withTiming(3, { duration: 2500 / animationSpeed, easing }),
            withTiming(0, { duration: 2500 / animationSpeed, easing }),
        ), -1);
        blueProgress.value = withRepeat(withSequence(
            withTiming(0, { duration: 2700 / animationSpeed, easing }),
            withTiming(3, { duration: 2700 / animationSpeed, easing }),
            withTiming(1, { duration: 2700 / animationSpeed, easing }),
            withTiming(2, { duration: 2700 / animationSpeed, easing }),
        ), -1);
        whiteProgress.value = withRepeat(withSequence(
            withTiming(3, { duration: 2600 / animationSpeed, easing }),
            withTiming(0, { duration: 2600 / animationSpeed, easing }),
            withTiming(2, { duration: 2600 / animationSpeed, easing }),
            withTiming(1, { duration: 2600 / animationSpeed, easing }),
        ), -1);

        return () => {
            cancelAnimation(pinkProgress);
            cancelAnimation(blueProgress);
            cancelAnimation(whiteProgress);
        };
    }, [animated, animationSpeed, blueProgress, height, pinkProgress, reduceMotion, whiteProgress, width]);

    const pinkCenter = useMemo(() => ({ x: width * 0.22, y: height * 0.78 }), [height, width]);
    const blueCenter = useMemo(() => ({ x: width * 0.78, y: height * 0.24 }), [height, width]);
    const whiteCenter = useMemo(() => ({ x: width * 0.5, y: height * 0.52 }), [height, width]);

    const pinkTransform = useDerivedValue<Transforms3d>(() => {
        const progress = pinkProgress.value;
        return [
            { translateX: width * interpolate(progress, [0, 1, 2, 3], [-0.12, 0.42, 0.55, 0.08]) },
            { translateY: height * interpolate(progress, [0, 1, 2, 3], [0.1, -0.52, 0, -0.38]) },
            { scaleX: 1.18 * interpolate(progress, [0, 1, 2, 3], [1, 1.06, 0.98, 1.04]) },
            { scaleY: 0.92 * interpolate(progress, [0, 1, 2, 3], [1.03, 0.98, 1.06, 1]) },
        ];
    }, [height, width]);

    const blueTransform = useDerivedValue<Transforms3d>(() => {
        const progress = blueProgress.value;
        return [
            { translateX: width * interpolate(progress, [0, 1, 2, 3], [0.05, -0.48, -0.62, -0.18]) },
            { translateY: height * interpolate(progress, [0, 1, 2, 3], [-0.08, 0.55, 0.12, 0.48]) },
            { scaleX: 1.04 * interpolate(progress, [0, 1, 2, 3], [1.04, 0.98, 1.06, 1]) },
            { scaleY: 1.2 * interpolate(progress, [0, 1, 2, 3], [0.98, 1.05, 1, 1.04]) },
        ];
    }, [height, width]);

    const whiteTransform = useDerivedValue<Transforms3d>(() => {
        const progress = whiteProgress.value;
        return [
            { translateX: width * interpolate(progress, [0, 1, 2, 3], [0, 0.22, -0.25, 0.18]) },
            { translateY: height * interpolate(progress, [0, 1, 2, 3], [0, -0.24, 0.2, 0.22]) },
            { scale: interpolate(progress, [0, 1, 2, 3], [1, 1.04, 0.98, 1.03]) },
        ];
    }, [height, width]);

    const glowOpacity = Math.max(0, Math.min(1, intensity));

    return (
        <View pointerEvents="none" onLayout={onLayout} style={[StyleSheet.absoluteFill, style]}>
            {width > 0 && height > 0 ? (
                skia ? (
                    <SkiaGlowCanvas
                        skia={skia}
                        width={width}
                        pinkColor={pinkColor}
                        blueColor={blueColor}
                        glowOpacity={glowOpacity}
                        pinkCenter={pinkCenter}
                        blueCenter={blueCenter}
                        whiteCenter={whiteCenter}
                        pinkTransform={pinkTransform}
                        blueTransform={blueTransform}
                        whiteTransform={whiteTransform}
                    />
                ) : (
                    <AnimatedGlowFallback
                        width={width}
                        height={height}
                        intensity={glowOpacity}
                        pinkColor={pinkColor}
                        blueColor={blueColor}
                        pinkProgress={pinkProgress}
                        blueProgress={blueProgress}
                        whiteProgress={whiteProgress}
                    />
                )
            ) : null}
        </View>
    );
});

function SkiaGlowCanvas({
    skia,
    width,
    pinkColor,
    blueColor,
    glowOpacity,
    pinkCenter,
    blueCenter,
    whiteCenter,
    pinkTransform,
    blueTransform,
    whiteTransform,
}: {
    skia: SkiaModule;
    width: number;
    pinkColor: string;
    blueColor: string;
    glowOpacity: number;
    pinkCenter: Vector;
    blueCenter: Vector;
    whiteCenter: Vector;
    pinkTransform: SharedValue<Transforms3d>;
    blueTransform: SharedValue<Transforms3d>;
    whiteTransform: SharedValue<Transforms3d>;
}) {
    const { Blur, Canvas, Circle, Fill, Group, RadialGradient } = skia;

    return (
        <Canvas pointerEvents="none" opaque style={StyleSheet.absoluteFill}>
            <Fill color="#FBFBFD" />

            <Group opacity={glowOpacity * 0.34}>
                <Group origin={whiteCenter} transform={whiteTransform}>
                    <Circle c={whiteCenter} r={width * 0.34} dither>
                        <RadialGradient
                            c={whiteCenter}
                            r={width * 0.34}
                            positions={[0, 0.42, 0.78, 1]}
                            colors={['rgba(255,255,255,0.92)', 'rgba(255,255,255,0.58)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']}
                        />
                        <Blur blur={26} />
                    </Circle>
                </Group>
            </Group>

            <Group opacity={glowOpacity * 0.88}>
                <Group origin={pinkCenter} transform={pinkTransform}>
                    <Circle c={pinkCenter} r={width * 0.82} dither>
                        <RadialGradient
                            c={pinkCenter}
                            r={width * 0.82}
                            positions={[0, 0.34, 0.7, 1]}
                            colors={[pinkColor, 'rgba(246,151,190,0.76)', 'rgba(250,194,217,0.42)', 'rgba(255,220,235,0)']}
                        />
                        <Blur blur={38} />
                    </Circle>
                </Group>
            </Group>

            <Group opacity={glowOpacity * 0.84}>
                <Group origin={blueCenter} transform={blueTransform}>
                    <Circle c={blueCenter} r={width * 0.88} dither>
                        <RadialGradient
                            c={blueCenter}
                            r={width * 0.88}
                            positions={[0, 0.36, 0.72, 1]}
                            colors={[blueColor, 'rgba(151,185,250,0.76)', 'rgba(190,215,255,0.42)', 'rgba(215,232,255,0)']}
                        />
                        <Blur blur={42} />
                    </Circle>
                </Group>
            </Group>

        </Canvas>
    );
}

function AnimatedGlowFallback({
    width,
    height,
    intensity,
    pinkColor,
    blueColor,
    pinkProgress,
    blueProgress,
    whiteProgress,
}: {
    width: number;
    height: number;
    intensity: number;
    pinkColor: string;
    blueColor: string;
    pinkProgress: SharedValue<number>;
    blueProgress: SharedValue<number>;
    whiteProgress: SharedValue<number>;
}) {
    const pinkStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: width * interpolate(pinkProgress.value, [0, 1, 2, 3], [-0.12, 0.42, 0.55, 0.08]) },
            { translateY: height * interpolate(pinkProgress.value, [0, 1, 2, 3], [0.1, -0.52, 0, -0.38]) },
            { scaleX: interpolate(pinkProgress.value, [0, 1, 2, 3], [1, 1.06, 0.98, 1.04]) },
            { scaleY: interpolate(pinkProgress.value, [0, 1, 2, 3], [1.03, 0.98, 1.06, 1]) },
        ],
    }));
    const blueStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: width * interpolate(blueProgress.value, [0, 1, 2, 3], [0.05, -0.48, -0.62, -0.18]) },
            { translateY: height * interpolate(blueProgress.value, [0, 1, 2, 3], [-0.08, 0.55, 0.12, 0.48]) },
            { scaleX: interpolate(blueProgress.value, [0, 1, 2, 3], [1.04, 0.98, 1.06, 1]) },
            { scaleY: interpolate(blueProgress.value, [0, 1, 2, 3], [0.98, 1.05, 1, 1.04]) },
        ],
    }));
    const whiteStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: width * interpolate(whiteProgress.value, [0, 1, 2, 3], [0, 0.22, -0.25, 0.18]) },
            { translateY: height * interpolate(whiteProgress.value, [0, 1, 2, 3], [0, -0.24, 0.2, 0.22]) },
            { scale: interpolate(whiteProgress.value, [0, 1, 2, 3], [1, 1.04, 0.98, 1.03]) },
        ],
    }));

    return (
        <View style={[StyleSheet.absoluteFill, styles.fallback]}>
            <Animated.View style={[StyleSheet.absoluteFill, whiteStyle]}>
                <GlowLayer
                    id="white"
                    color="#FFFFFF"
                    opacity={intensity * 0.32}
                    ellipse={{ cx: '50%', cy: '52%', rx: '34%', ry: '29%' }}
                />
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, pinkStyle]}>
                <GlowLayer
                    id="pink"
                    color={pinkColor}
                    opacity={intensity * 0.9}
                    ellipse={{ cx: '22%', cy: '78%', rx: '82%', ry: '70%' }}
                />
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, blueStyle]}>
                <GlowLayer
                    id="blue"
                    color={blueColor}
                    opacity={intensity * 0.86}
                    ellipse={{ cx: '78%', cy: '24%', rx: '86%', ry: '78%' }}
                />
            </Animated.View>
        </View>
    );
}

function GlowLayer({
    id,
    color,
    opacity,
    ellipse,
}: {
    id: string;
    color: string;
    opacity: number;
    ellipse: { cx: string; cy: string; rx: string; ry: string };
}) {
    return (
        <Svg width="100%" height="100%">
            <Defs>
                <SvgRadialGradient id={id} cx="50%" cy="50%" r="50%">
                    <Stop offset="0%" stopColor={color} stopOpacity={opacity} />
                    <Stop offset="38%" stopColor={color} stopOpacity={opacity * 0.7} />
                    <Stop offset="72%" stopColor={color} stopOpacity={opacity * 0.34} />
                    <Stop offset="100%" stopColor={color} stopOpacity={0} />
                </SvgRadialGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="transparent" />
            <Ellipse {...ellipse} fill={`url(#${id})`} />
        </Svg>
    );
}

const styles = StyleSheet.create({
    fallback: {
        overflow: 'hidden',
        backgroundColor: '#FBFBFD',
    },
});

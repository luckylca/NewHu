import { PressIndication } from '../primitives';
import { cardSink, cardTilt } from '../motion';
import { useReducedMotionPreference } from '../motion/MotionProvider';
import { useTheme } from '../theme';
import { useSurfaceEnvironment } from './SurfaceEnvironmentContext';
import { Surface } from '../primitives/Surface';
import type { SurfaceMaterialMode } from '../primitives/Surface';
import type { GlassVariant } from '@newhu/react-native-liquid-glass';
import type { GlassSurfaceRole } from '@newhu/react-native-liquid-glass';
import React, { useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import type { GestureResponderEvent, LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, useSharedValue, withSpring } from 'react-native-reanimated';
import type { AnimatedStyle, SharedValue } from 'react-native-reanimated';

/**
 * Material and interaction are independent: static cards keep their themed
 * Glass/solid surface without mounting Pressable or press animation state.
 */
export type CardFeedback = 'none' | 'sink' | 'tilt';

export interface AppCardProps {
    feedback?: CardFeedback;
    showIndication?: boolean;
    holdDown?: boolean;
    glassVariant?: GlassVariant;
    surfaceRole?: GlassSurfaceRole;
    accessibilityLabel?: string;
    onPress?: () => void;
    onPressIn?: () => void;
    onLongPress?: (event: GestureResponderEvent) => void;
    style?: StyleProp<ViewStyle>;
    contentStyle?: StyleProp<ViewStyle>;
    children?: ReactNode;
}

const SINK_AMOUNT = 0.94;
const TILT_AMOUNT = 9;
const TILT_PERSPECTIVE_FACTOR = 1.6;

export const Card = React.memo(function Card(props: AppCardProps) {
    const hasPressAction = !!props.onPress || !!props.onLongPress || !!props.onPressIn;
    const feedback = props.feedback ?? (hasPressAction || props.holdDown ? 'sink' : 'none');

    if (feedback === 'tilt') return <TiltCard {...props} />;
    if (feedback === 'sink' && props.holdDown && !hasPressAction && !props.showIndication) {
        return <LatchedSinkCard {...props} />;
    }
    if (feedback === 'sink') return <SinkCard {...props} />;
    if (feedback === 'none' && props.showIndication) return <IndicationCard {...props} />;
    if (hasPressAction) return <PressOnlyCard {...props} />;
    return <StaticCardSurface {...props} />;
});
Card.displayName = 'HyperCard';

function CardSurface({
    glassVariant,
    surfaceRole,
    contentStyle,
    animatedStyle,
    centeredTransformOrigin,
    style,
    showIndication,
    pressed,
    children,
}: Pick<AppCardProps, 'glassVariant' | 'surfaceRole' | 'contentStyle' | 'showIndication' | 'children'> & {
    style?: AppCardProps['style'];
    animatedStyle?: AnimatedStyle<ViewStyle>;
    centeredTransformOrigin?: boolean;
    pressed?: SharedValue<number>;
}) {
    const theme = useTheme();
    const surfaceEnvironment = useSurfaceEnvironment();
    const radius = theme.components.card.radius;
    const themedGlass = theme.presentation.content.cardMaterial === 'glass' && theme.glass.enabled;
    const embeddedInGlassOverlay = themedGlass && surfaceEnvironment === 'glassOverlay';
    const material: SurfaceMaterialMode = themedGlass && !embeddedInGlassOverlay
        ? 'glass'
        : embeddedInGlassOverlay ? 'overlayTint' : 'solid';

    return (
        <Surface
            material={material}
            glassVariant={glassVariant}
            surfaceRole={surfaceRole}
            radius={radius}
            backgroundColor={embeddedInGlassOverlay
                ? theme.glass.tint[theme.dark ? 'dark' : 'light']
                : theme.colors.surfaceContainer}
            borderWidth={embeddedInGlassOverlay ? StyleSheet.hairlineWidth : 0}
            borderColor={embeddedInGlassOverlay ? theme.colors.dividerLine : 'transparent'}
            contentStyle={contentStyle}
            animatedStyle={animatedStyle}
            centeredTransformOrigin={centeredTransformOrigin}
            style={style}
        >
            {children}
            {showIndication && pressed != null &&
                <PressIndication pressed={pressed} color={theme.colors.onBackground} radius={radius} />}
        </Surface>
    );
}

function StaticCardSurface(props: AppCardProps) {
    return (
        <CardSurface
            glassVariant={props.glassVariant}
            surfaceRole={props.surfaceRole}
            contentStyle={props.contentStyle}
            style={props.style}
            showIndication={false}
        >
            {props.children}
        </CardSurface>
    );
}

function PressOnlyCard(props: AppCardProps) {
    const longPressFired = useRef(false);
    const handlePress = useCallback(() => {
        if (longPressFired.current) {
            longPressFired.current = false;
            return;
        }
        props.onPress?.();
    }, [props.onPress]);
    const handleLongPress = useCallback((event: GestureResponderEvent) => {
        longPressFired.current = true;
        props.onLongPress?.(event);
    }, [props.onLongPress]);

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={props.accessibilityLabel}
            onPress={handlePress}
            onPressIn={props.onPressIn}
            onLongPress={props.onLongPress ? handleLongPress : undefined}
            style={props.style}
        >
            <CardSurface glassVariant={props.glassVariant} surfaceRole={props.surfaceRole} contentStyle={props.contentStyle} showIndication={false}>
                {props.children}
            </CardSurface>
        </Pressable>
    );
}

function IndicationCard(props: AppCardProps) {
    const pressed = useSharedValue(0);
    const longPressFired = useRef(false);
    const handlePress = useCallback(() => {
        if (longPressFired.current) {
            longPressFired.current = false;
            return;
        }
        props.onPress?.();
    }, [props.onPress]);
    const handleLongPress = useCallback((event: GestureResponderEvent) => {
        longPressFired.current = true;
        props.onLongPress?.(event);
    }, [props.onLongPress]);
    const onPressIn = useCallback(() => {
        pressed.value = 1;
        props.onPressIn?.();
    }, [props.onPressIn, pressed]);
    const onPressOut = useCallback(() => {
        pressed.value = 0;
    }, [pressed]);

    return (
        <Pressable
            accessibilityRole={props.onPress || props.onLongPress ? 'button' : undefined}
            accessibilityLabel={props.accessibilityLabel}
            onPress={handlePress}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            onLongPress={props.onLongPress ? handleLongPress : undefined}
            style={props.style}
        >
            <CardSurface
                glassVariant={props.glassVariant}
                surfaceRole={props.surfaceRole}
                contentStyle={props.contentStyle}
                showIndication
                pressed={pressed}
            >
                {props.children}
            </CardSurface>
        </Pressable>
    );
}

function SinkCard(props: AppCardProps) {
    const reducedMotion = useReducedMotionPreference();
    const pressed = useSharedValue(0);
    const engaged = useDerivedValue(() => (pressed.value === 1 || props.holdDown ? 1 : 0));
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: reducedMotion ? 1 : withSpring(engaged.value === 1 ? SINK_AMOUNT : 1, cardSink) }],
    }), [reducedMotion]);
    const longPressFired = useRef(false);
    const handlePress = useCallback(() => {
        if (longPressFired.current) {
            longPressFired.current = false;
            return;
        }
        props.onPress?.();
    }, [props.onPress]);
    const handleLongPress = useCallback((event: GestureResponderEvent) => {
        longPressFired.current = true;
        props.onLongPress?.(event);
    }, [props.onLongPress]);
    const onPressIn = useCallback(() => {
        longPressFired.current = false;
        pressed.value = 1;
        props.onPressIn?.();
    }, [props.onPressIn, pressed]);
    const onPressOut = useCallback(() => {
        pressed.value = 0;
    }, [pressed]);

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={props.accessibilityLabel}
            onPress={handlePress}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            onLongPress={props.onLongPress ? handleLongPress : undefined}
            style={props.style}
        >
            <CardSurface
                glassVariant={props.glassVariant}
                surfaceRole={props.surfaceRole}
                contentStyle={props.contentStyle}
                animatedStyle={animatedStyle}
                showIndication={props.showIndication}
                pressed={pressed}
            >
                {props.children}
            </CardSurface>
        </Pressable>
    );
}

function LatchedSinkCard(props: AppCardProps) {
    const reducedMotion = useReducedMotionPreference();
    const engaged = useDerivedValue(() => (props.holdDown ? 1 : 0), [props.holdDown]);
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: reducedMotion ? 1 : withSpring(engaged.value === 1 ? SINK_AMOUNT : 1, cardSink) }],
    }), [reducedMotion]);

    return (
        <Animated.View style={props.style}>
            <CardSurface
                glassVariant={props.glassVariant}
                surfaceRole={props.surfaceRole}
                contentStyle={props.contentStyle}
                animatedStyle={animatedStyle}
                showIndication={false}
            >
                {props.children}
            </CardSurface>
        </Animated.View>
    );
}

function TiltCard(props: AppCardProps) {
    const reducedMotion = useReducedMotionPreference();
    const pressed = useSharedValue(0);
    const tiltX = useSharedValue(0);
    const tiltY = useSharedValue(0);
    const cardWidth = useSharedValue(1000);
    const cardSize = useRef({ width: 0, height: 0 });
    const longPressFired = useRef(false);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { perspective: Math.max(cardWidth.value * TILT_PERSPECTIVE_FACTOR, 800) },
            { rotateX: reducedMotion ? '0deg' : withSpring(tiltX.value + 'deg', cardTilt) },
            { rotateY: reducedMotion ? '0deg' : withSpring(tiltY.value + 'deg', cardTilt) },
        ],
    }), [reducedMotion]);

    const onLayout = useCallback((event: LayoutChangeEvent) => {
        const { width, height } = event.nativeEvent.layout;
        cardSize.current = { width, height };
        cardWidth.value = width || 1000;
    }, [cardWidth]);
    const handlePressIn = useCallback((event: GestureResponderEvent) => {
        longPressFired.current = false;
        const { locationX, locationY } = event.nativeEvent;
        const halfW = (cardSize.current.width || 1) / 2;
        const halfH = (cardSize.current.height || 1) / 2;
        tiltX.value = locationY < halfH ? TILT_AMOUNT : -TILT_AMOUNT;
        tiltY.value = locationX < halfW ? -TILT_AMOUNT : TILT_AMOUNT;
        pressed.value = 1;
        props.onPressIn?.();
    }, [props.onPressIn, pressed, tiltX, tiltY]);
    const handlePressOut = useCallback(() => {
        pressed.value = 0;
        tiltX.value = 0;
        tiltY.value = 0;
    }, [pressed, tiltX, tiltY]);
    const handleLongPress = useCallback((event: GestureResponderEvent) => {
        longPressFired.current = true;
        props.onLongPress?.(event);
    }, [props.onLongPress]);
    const handlePress = useCallback(() => {
        if (longPressFired.current) {
            longPressFired.current = false;
            return;
        }
        props.onPress?.();
    }, [props.onPress]);

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={props.accessibilityLabel}
            onPress={handlePress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onLongPress={props.onLongPress ? handleLongPress : undefined}
            onLayout={onLayout}
            style={props.style}
        >
            <CardSurface
                glassVariant={props.glassVariant}
                surfaceRole={props.surfaceRole}
                contentStyle={props.contentStyle}
                animatedStyle={animatedStyle}
                centeredTransformOrigin
                showIndication={props.showIndication}
                pressed={pressed}
            >
                {props.children}
            </CardSurface>
        </Pressable>
    );
}

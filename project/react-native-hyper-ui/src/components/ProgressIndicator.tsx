import { useTheme } from '../theme';
import { linearEasing, useReducedMotionPreference } from '../motion';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

type ProgressIndicatorProps = {
    progress?: number;
    indeterminate?: boolean;
    height?: number;
};

/** Determinate linear ProgressIndicator ported from miuix-vue. */
const ProgressIndicator = React.memo(function ProgressIndicator({ progress = 0, indeterminate = false, height = 6 }: ProgressIndicatorProps) {
    const theme = useTheme();
    const reducedMotion = useReducedMotionPreference();
    const [trackWidth, setTrackWidth] = useState(0);
    const clampedProgress = Math.max(0, Math.min(1, progress));
    // Miuix keeps a round dot visible at 0%, rather than rendering an empty
    // track with a zero-width fill.
    const fillWidth = trackWidth > 0 ? height + (trackWidth - height) * clampedProgress : height;
    const travel = useSharedValue(0);

    useEffect(() => {
        cancelAnimation(travel);
        travel.value = 0;
        if (indeterminate && !reducedMotion) {
            // Keep a constant velocity. Reanimated's default timing easing
            // visibly accelerates/decelerates on every loop at 120 Hz.
            travel.value = withRepeat(withTiming(1, { duration: 1100, easing: linearEasing }), -1, false);
        }
        return () => cancelAnimation(travel);
    }, [indeterminate, reducedMotion, travel]);

    const indeterminateStyle = useAnimatedStyle(() => {
        const segmentWidth = Math.max(36, trackWidth * 0.32);
        return {
            width: segmentWidth,
            transform: [{ translateX: reducedMotion ? Math.max(0, trackWidth * 0.34) : -segmentWidth + travel.value * (trackWidth + segmentWidth) }],
        };
    }, [trackWidth, reducedMotion]);

    return (
        <View
            onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
            style={{
                width: '100%',
                height,
                borderRadius: theme.radius.full,
                overflow: 'hidden',
                backgroundColor: theme.colors.secondaryContainer,
            }}
        >
            {indeterminate ? (
                <Animated.View style={[{ height, borderRadius: theme.radius.full, backgroundColor: theme.colors.primary }, indeterminateStyle]} />
            ) : (
                <View style={{ width: fillWidth, height, borderRadius: theme.radius.full, backgroundColor: theme.colors.primary }} />
            )}
        </View>
    );
});
ProgressIndicator.displayName = 'HyperProgressIndicator';
export default ProgressIndicator;

import { PressIndication } from '../primitives';
import { useTheme } from '../theme';
import { GlassSurface } from '@newhu/react-native-liquid-glass';
import React, { type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

export interface GlassFabProps {
    accessibilityLabel: string;
    onPress: () => void;
    children: ReactNode | ((foregroundColor: string) => ReactNode);
    size?: number;
    style?: StyleProp<ViewStyle>;
    /** Adds the theme primary tint while keeping the same floating glass material. */
    primary?: boolean;
}

/** Floating functional control; content remains foreground over the glass lens. */
export const GlassFab = React.memo(function GlassFab({
    accessibilityLabel,
    onPress,
    children,
    size = 48,
    style,
    primary = false,
}: GlassFabProps) {
    const theme = useTheme();
    const usesGlassMaterial = theme.presentation.overlays.floatingAction === 'glass' && theme.glass.enabled;
    const foregroundColor = theme.colors[theme.presentation.controls.floatingActionForeground];
    const foreground = typeof children === 'function' ? children(foregroundColor) : children;
    const radius = size / 2;
    const pressed = useSharedValue(0);
    const content = (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            onPress={onPress}
            onPressIn={() => (pressed.value = 1)}
            onPressOut={() => (pressed.value = 0)}
            style={{ width: size, height: size, borderRadius: radius, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: usesGlassMaterial ? 'transparent' : theme.colors.primary }}
        >
            {usesGlassMaterial && primary ? (
                <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: radius, backgroundColor: theme.colors.primary, opacity: 0.16 }} />
            ) : null}
            <PressIndication pressed={pressed} color={usesGlassMaterial ? theme.colors.onGlass : theme.colors.onBackground} radius={radius} />
            {foreground}
        </Pressable>
    );

    if (usesGlassMaterial) {
        return (
            <GlassSurface
                variant="floating"
                positioning="floating"
                sampling="backdrop"
                interactive
                style={[{ width: size, height: size, borderRadius: radius, backgroundColor: 'transparent' }, style]}
                placeholderChildren={<View style={{ width: size, height: size }} />}
            >
                {content}
            </GlassSurface>
        );
    }

    return <View style={[{ borderRadius: radius, elevation: 4, shadowColor: '#000000', shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }, style]}>{content}</View>;
});

GlassFab.displayName = 'HyperGlassFab';

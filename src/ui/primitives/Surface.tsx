import { useTheme } from '@/src/ui/theme';
import React from 'react';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

export interface AppSurfaceProps {
    /** Background color; defaults to surface. */
    color?: string;
    /** Content (text) color — used only for context; RN doesn't inherit colors. */
    contentColor?: string;
    /** Border radius; defaults to 0 (RectangleShape). */
    radius?: number;
    children?: ReactNode;
    style?: StyleProp<ViewStyle>;
}

/**
 * Design System Surface — the default themed container.
 *
 * Visual reference:
 *   miuix-vue/src/components/surface/Surface.vue (Surface.kt)
 *
 * Defaults: background = surface, radius = 0, shadow = 0. No border / shadow /
 * blur by default — surface hierarchy comes from the surface token ladder.
 * Ordinary page roots should be Surface, not Card.
 */
export function Surface({ color, contentColor, radius, children, style }: AppSurfaceProps) {
    const theme = useTheme();
    return (
        <View
            style={[
                {
                    backgroundColor: color ?? theme.colors.surface,
                },
                radius != null ? { borderRadius: radius } : undefined,
                style,
            ]}
        >
            {children}
        </View>
    );
}

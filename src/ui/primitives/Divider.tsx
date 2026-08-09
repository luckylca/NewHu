import { useTheme } from '@/src/ui/theme';
import React from 'react';
import { View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

export interface AppDividerProps {
    orientation?: 'horizontal' | 'vertical';
    /** Thickness; defaults to DividerDefaults.Thickness (0.75). */
    thickness?: number;
    /** Color override; defaults to dividerLine. */
    color?: string;
    style?: StyleProp<ViewStyle>;
}

/**
 * Design System Divider.
 *
 * Visual reference:
 *   miuix-vue/src/components/divider/Divider.vue (Divider.kt)
 *
 * DividerDefaults: thickness 0.75dp, color = dividerLine. Pages must not
 * hardcode `#E0E0E0` — use this.
 */
export function Divider({ orientation = 'horizontal', thickness = 0.75, color, style }: AppDividerProps) {
    const theme = useTheme();
    const isHorizontal = orientation === 'horizontal';
    return (
        <View
            style={[
                {
                    backgroundColor: color ?? theme.colors.dividerLine,
                },
                isHorizontal
                    ? { width: '100%', height: thickness }
                    : { height: '100%', width: thickness },
                style,
            ]}
        />
    );
}

import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import React from 'react';
import type { StyleProp, TextStyle } from 'react-native';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
export type IconWeight = 'thin' | 'light' | 'regular' | 'bold' | 'fill';

export interface AppIconProps {
    /** MaterialCommunityIcons icon name (preferred). */
    name?: IconName;
    /** Legacy alias of `name`. */
    source?: string;
    size?: number;
    color?: string;
    /** Extra opacity multiplier. */
    opacity?: number;
    /** Disabled state — dims the icon to 0.38 (RNP/M3 disabled semantics). */
    disabled?: boolean;
    /** Icon weight. Miuix Icons carry weights; MaterialCommunityIcons does not
     *  (accepted for API compatibility, applied when the Miuix icon set lands). */
    weight?: IconWeight;
    style?: StyleProp<TextStyle>;
}

/**
 * Design System Icon — the only icon entry point business pages use.
 *
 * The underlying glyph set is @expo/vector-icons MaterialCommunityIcons for now
 * (task §57); Miuix Icons can slot in behind the same props later without
 * touching callers.
 */
export function Icon({ name, source, size = 24, color, opacity, disabled, weight, style }: AppIconProps) {
    return (
        <MaterialCommunityIcons
            // `weight` is accepted but not applicable to MaterialCommunityIcons yet.
            name={(name ?? source) as IconName}
            size={size}
            color={color}
            style={[opacity != null ? { opacity } : undefined, disabled ? { opacity: 0.38 } : undefined, style]}
        />
    );
}

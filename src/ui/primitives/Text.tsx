import { useTheme } from '@/src/ui/theme';
import React from 'react';
import type { ReactNode } from 'react';
import { Text as RNText } from 'react-native';
import type { StyleProp, TextProps, TextStyle } from 'react-native';
import type { ThemeTypography } from '../theme';

/**
 * Miuix typography preset name — a key of ThemeTypography
 * ('main' | 'body1' | … | 'title1').
 */
export type TextType = keyof ThemeTypography;

export type TextWeight = 'normal' | 'medium' | 'semibold' | 'bold' | number;

const WEIGHT_MAP: Record<string, TextStyle['fontWeight']> = {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
};

export interface AppTextProps extends TextProps {
    /**
     * Miuix typography preset (TextStyles.kt). Defaults to `main` (17).
     *
     * Prefer Miuix semantics over the legacy RNP variant names.
     */
    type?: TextType;
    /** Font weight override; number or named ('normal' | 'medium' | 'semibold' | 'bold'). */
    weight?: TextWeight;
    /** Explicit color override; defaults to onSurface. */
    color?: string;
    /** Explicit font size override (px). */
    size?: number;
    align?: 'auto' | 'left' | 'right' | 'center' | 'justify';
    children?: ReactNode;
    style?: StyleProp<TextStyle>;
}

/**
 * Design System Text.
 *
 * Visual reference:
 *   miuix-vue/src/components/text/Text.vue (TextStyles.kt presets)
 *
 * Resolution precedence: explicit props > style preset > theme default.
 */
export function Text({ type = 'main', weight, color, size, align, style, children, ...rest }: AppTextProps) {
    const theme = useTheme();
    const preset = theme.typography[type];

    const resolvedWeight =
        weight != null
            ? typeof weight === 'number'
                ? String(weight) as TextStyle['fontWeight']
                : WEIGHT_MAP[weight]
            : preset.fontWeight;

    const resolvedLineHeight = preset.lineHeightRatio != null ? Math.round(preset.fontSize * preset.lineHeightRatio) : preset.lineHeight;

    return (
        <RNText
            {...rest}
            style={[
                {
                    color: color ?? theme.colors.onSurface,
                    fontSize: size ?? preset.fontSize,
                    fontWeight: resolvedWeight,
                    textAlign: align,
                    lineHeight: resolvedLineHeight,
                },
                style,
            ]}
        >
            {children}
        </RNText>
    );
}

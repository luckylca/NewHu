import { useTheme } from '@/src/theme/ThemeProvider';
import React from 'react';
import type { ReactNode } from 'react';
import { Text as RNText, TextProps, TextStyle } from 'react-native';

export type TextVariant =
    | 'displaySmall'
    | 'headlineSmall'
    | 'titleLarge'
    | 'titleMedium'
    | 'titleSmall'
    | 'labelLarge'
    | 'labelMedium'
    | 'labelSmall'
    | 'bodyLarge'
    | 'bodyMedium'
    | 'bodySmall';

// 对应原 RNP(MD3) 的 Typography 字阶，保持视觉一致
const TYPOGRAPHY: Record<TextVariant, TextStyle> = {
    displaySmall: { fontSize: 36, lineHeight: 44, fontWeight: '400', letterSpacing: 0 },
    headlineSmall: { fontSize: 24, lineHeight: 32, fontWeight: '400', letterSpacing: 0 },
    titleLarge: { fontSize: 22, lineHeight: 28, fontWeight: '400', letterSpacing: 0 },
    titleMedium: { fontSize: 16, lineHeight: 24, fontWeight: '500', letterSpacing: 0.15 },
    titleSmall: { fontSize: 14, lineHeight: 20, fontWeight: '500', letterSpacing: 0.1 },
    labelLarge: { fontSize: 14, lineHeight: 20, fontWeight: '500', letterSpacing: 0.1 },
    labelMedium: { fontSize: 12, lineHeight: 16, fontWeight: '500', letterSpacing: 0.5 },
    labelSmall: { fontSize: 11, lineHeight: 16, fontWeight: '500', letterSpacing: 0.5 },
    bodyLarge: { fontSize: 16, lineHeight: 24, fontWeight: '400', letterSpacing: 0.5 },
    bodyMedium: { fontSize: 14, lineHeight: 20, fontWeight: '400', letterSpacing: 0.25 },
    bodySmall: { fontSize: 12, lineHeight: 16, fontWeight: '400', letterSpacing: 0.4 },
};

export interface AppTextProps extends TextProps {
    variant?: TextVariant;
    children?: ReactNode;
}

export function Text({ variant = 'bodyMedium', style, children, ...rest }: AppTextProps) {
    const theme = useTheme();
    return (
        <RNText {...rest} style={[{ color: theme.colors.onSurface }, TYPOGRAPHY[variant], style]}>
            {children}
        </RNText>
    );
}

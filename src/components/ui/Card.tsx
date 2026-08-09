import { useTheme } from '@/src/theme/ThemeProvider';
import React from 'react';
import type { ReactNode } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';

export interface AppCardProps {
    mode?: 'contained' | 'elevated';
    style?: StyleProp<ViewStyle>;
    children?: ReactNode;
}

export interface AppCardContentProps {
    style?: StyleProp<ViewStyle>;
    children?: ReactNode;
}

function CardBase({ mode = 'contained', style, children }: AppCardProps) {
    const theme = useTheme();
    return (
        <View
            style={[
                {
                    backgroundColor: mode === 'contained' ? theme.colors.surfaceVariant : theme.colors.surface,
                    borderRadius: 12,
                    elevation: mode === 'elevated' ? 3 : 0,
                    shadowColor: '#000',
                    shadowOpacity: mode === 'elevated' ? 0.1 : 0,
                    shadowRadius: mode === 'elevated' ? 4 : 0,
                    shadowOffset: { width: 0, height: 2 },
                },
                style,
            ]}
        >
            {children}
        </View>
    );
}

function CardContent({ style, children }: AppCardContentProps) {
    return <View style={[{ padding: 16 }, style]}>{children}</View>;
}

export const Card = Object.assign(CardBase, { Content: CardContent });

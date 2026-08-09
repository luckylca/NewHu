import { useTheme } from '@/src/theme/ThemeProvider';
import React from 'react';
import type { ReactNode } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';

export interface AppSurfaceProps {
    mode?: 'flat' | 'elevated';
    elevation?: number;
    style?: StyleProp<ViewStyle>;
    children?: ReactNode;
}

export function Surface({ mode = 'flat', elevation = 1, style, children }: AppSurfaceProps) {
    const theme = useTheme();
    const elevated = mode === 'elevated';
    return (
        <View
            style={[
                {
                    backgroundColor: theme.colors.surface,
                    elevation: elevated ? elevation : 0,
                    shadowColor: '#000',
                    shadowOpacity: elevated ? 0.1 : 0,
                    shadowRadius: elevated ? elevation * 2 : 0,
                    shadowOffset: { width: 0, height: elevated ? elevation * 0.5 : 0 },
                },
                style,
            ]}
        >
            {children}
        </View>
    );
}

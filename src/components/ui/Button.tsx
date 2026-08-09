import { useTheme } from '@/src/theme/ThemeProvider';
import React from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleProp, Text as RNText, TextStyle, View, ViewStyle } from 'react-native';

export interface AppButtonProps {
    /** 对应原 RNP Button 的 mode */
    mode?: 'text' | 'contained' | 'elevated';
    onPress?: () => void;
    disabled?: boolean;
    style?: StyleProp<ViewStyle>;
    contentStyle?: StyleProp<ViewStyle>;
    labelStyle?: StyleProp<TextStyle>;
    children?: ReactNode;
}

export function Button({ mode = 'text', onPress, disabled, style, contentStyle, labelStyle, children }: AppButtonProps) {
    const theme = useTheme();
    const isText = typeof children === 'string';

    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            android_ripple={{ color: 'rgba(0,0,0,0.12)', foreground: true }}
            style={[
                {
                    backgroundColor:
                        mode === 'contained'
                            ? theme.colors.primary
                            : mode === 'elevated'
                                ? theme.colors.surface
                                : 'transparent',
                    borderRadius: 20,
                    minHeight: 40,
                    justifyContent: 'center',
                    elevation: mode === 'elevated' ? 3 : 0,
                    shadowColor: '#000',
                    shadowOpacity: mode === 'elevated' ? 0.1 : 0,
                    shadowRadius: mode === 'elevated' ? 4 : 0,
                    shadowOffset: { width: 0, height: 2 },
                },
                { opacity: disabled ? 0.4 : 1 },
                style,
            ]}
        >
            <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }, contentStyle]}>
                {isText ? (
                    <RNText
                        style={[
                            { color: mode === 'contained' ? theme.colors.onPrimary : theme.colors.primary, fontSize: 14 },
                            labelStyle,
                        ]}
                    >
                        {children}
                    </RNText>
                ) : (
                    children
                )}
            </View>
        </Pressable>
    );
}

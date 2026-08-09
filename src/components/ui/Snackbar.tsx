import { useTheme } from '@/src/theme/ThemeProvider';
import React, { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Animated, Pressable, StyleProp, Text as RNText, View, ViewStyle } from 'react-native';

export interface AppSnackbarProps {
    visible: boolean;
    onDismiss?: () => void;
    duration?: number;
    action?: { label: string; onPress?: () => void };
    style?: StyleProp<ViewStyle>;
    children?: ReactNode;
}

export function Snackbar({ visible, onDismiss, duration = 1400, action, style, children }: AppSnackbarProps) {
    const theme = useTheme();
    const opacity = useRef(new Animated.Value(0)).current;
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (visible) {
            Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
            timerRef.current = setTimeout(() => onDismiss?.(), duration);
        } else {
            Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }).start();
        }
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [visible, duration, onDismiss, opacity]);

    if (!visible) return null;

    return (
        <Animated.View style={[{ position: 'absolute', left: 8, right: 8, bottom: 8, opacity }, style]}>
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: theme.colors.inverseSurface,
                    borderRadius: 8,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                }}
            >
                <View style={{ flex: 1 }}>
                    <RNText style={{ color: theme.colors.inverseOnSurface, fontSize: 14, lineHeight: 20 }}>{children}</RNText>
                </View>
                {action && (
                    <Pressable hitSlop={8} onPress={() => { action.onPress?.(); onDismiss?.(); }}>
                        <RNText style={{ color: theme.colors.primary, fontSize: 14, fontWeight: '600', marginLeft: 16 }}>
                            {action.label}
                        </RNText>
                    </Pressable>
                )}
            </View>
        </Animated.View>
    );
}

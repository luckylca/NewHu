import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/ThemeProvider';
import React from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleProp, TextStyle, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './Text';

function Header({ children, style, elevated }: { children?: ReactNode; style?: StyleProp<ViewStyle>; elevated?: boolean }) {
    const insets = useSafeAreaInsets();
    const theme = useTheme();
    return (
        <View
            style={[
                {
                    backgroundColor: theme.colors.surface,
                    paddingTop: insets.top,
                    height: 64 + insets.top,
                    flexDirection: 'row',
                    alignItems: 'center',
                    elevation: elevated ? 4 : 0,
                    shadowColor: '#000',
                    shadowOpacity: elevated ? 0.08 : 0,
                    shadowRadius: elevated ? 8 : 0,
                    shadowOffset: { width: 0, height: 2 },
                    zIndex: 10,
                },
                style,
            ]}
        >
            {children}
        </View>
    );
}

function BackAction({ onPress, color }: { onPress?: () => void; color?: string }) {
    const theme = useTheme();
    return (
        <Pressable
            onPress={onPress}
            hitSlop={8}
            android_ripple={{ color: 'rgba(0,0,0,0.12)', borderless: true }}
            style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
        >
            <MaterialCommunityIcons name="arrow-left" size={24} color={color ?? theme.colors.onSurfaceVariant} />
        </Pressable>
    );
}

function Content({ title, style, titleStyle }: { title?: string; style?: StyleProp<ViewStyle>; titleStyle?: StyleProp<TextStyle> }) {
    const theme = useTheme();
    return (
        <View style={[{ flex: 1, paddingHorizontal: 16, justifyContent: 'center' }, style]}>
            <Text variant="titleLarge" numberOfLines={1} style={[{ color: theme.colors.onSurface }, titleStyle]}>
                {title}
            </Text>
        </View>
    );
}

function Action({ icon, onPress, color, size = 24 }: { icon: string; onPress?: () => void; color?: string; size?: number }) {
    const theme = useTheme();
    return (
        <Pressable
            onPress={onPress}
            hitSlop={8}
            android_ripple={{ color: 'rgba(0,0,0,0.12)', borderless: true }}
            style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
        >
            <MaterialCommunityIcons name={icon as any} size={size} color={color ?? theme.colors.onSurfaceVariant} />
        </Pressable>
    );
}

export const Appbar = { Header, BackAction, Content, Action };

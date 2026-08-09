import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/ThemeProvider';
import React from 'react';
import { Pressable, StyleProp, ViewStyle } from 'react-native';

export interface AppIconButtonProps {
    icon: string;
    size?: number;
    iconColor?: string;
    containerColor?: string;
    mode?: 'contained';
    disabled?: boolean;
    onPress?: () => void;
    style?: StyleProp<ViewStyle>;
}

export function IconButton({
    icon,
    size = 24,
    iconColor,
    containerColor,
    mode,
    disabled,
    onPress,
    style,
}: AppIconButtonProps) {
    const theme = useTheme();
    const bg = mode === 'contained' ? (containerColor ?? theme.colors.primary) : 'transparent';
    const color = iconColor ?? (disabled ? theme.colors.onSurfaceDisabled : theme.colors.onSurfaceVariant);
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            hitSlop={6}
            android_ripple={{ color: 'rgba(0,0,0,0.12)', borderless: true }}
            style={[
                {
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: disabled ? 0.6 : 1,
                },
                style,
            ]}
        >
            <MaterialCommunityIcons name={icon as any} size={size} color={color} />
        </Pressable>
    );
}

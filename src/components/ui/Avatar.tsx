import { useTheme } from '@/src/theme/ThemeProvider';
import React from 'react';
import { Image, ImageSourcePropType, StyleProp, View, ViewStyle, ImageStyle } from 'react-native';
import { Text } from './Text';

function AvatarImage({ size = 64, source, style }: { size?: number; source: ImageSourcePropType; style?: StyleProp<ImageStyle> }) {
    const theme = useTheme();
    return (
        <Image
            source={source}
            style={[
                { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.colors.surfaceVariant },
                style,
            ]}
        />
    );
}

function AvatarText({ size = 64, label, style }: { size?: number; label?: string; style?: StyleProp<ViewStyle> }) {
    const theme = useTheme();
    return (
        <View
            style={[
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: theme.colors.primaryContainer,
                    alignItems: 'center',
                    justifyContent: 'center',
                },
                style,
            ]}
        >
            <Text style={{ color: theme.colors.onPrimaryContainer, fontSize: Math.round(size * 0.36), fontWeight: '500' }}>
                {label}
            </Text>
        </View>
    );
}

export const Avatar = { Image: AvatarImage, Text: AvatarText };

import { useTheme } from '@/src/theme/ThemeProvider';
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
    const theme = useTheme();
    return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.outlineVariant }, style]} />;
}

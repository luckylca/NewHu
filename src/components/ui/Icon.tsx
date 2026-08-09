import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleProp, TextStyle } from 'react-native';

export interface AppIconProps {
    /** 对应原 RNP Icon 的 source：MaterialCommunityIcons 图标名 */
    source: string;
    size?: number;
    color?: string;
    style?: StyleProp<TextStyle>;
}

export function Icon({ source, size = 24, color, style }: AppIconProps) {
    return <MaterialCommunityIcons name={source as any} size={size} color={color} style={style} />;
}

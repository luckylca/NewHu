import { Text } from '../primitives';
import { useTheme } from '../theme';
import { Card } from './Card';
import { GlassSurface } from '@newhu/react-native-liquid-glass';
import React from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

export interface PreferenceGroupProps {
    title: string;
    children: ReactNode;
    style?: StyleProp<ViewStyle>;
}

/** Theme-aware grouped settings surface; row content stays the same. */
export const PreferenceGroup = React.memo(function PreferenceGroup({ title, children, style }: PreferenceGroupProps) {
    const theme = useTheme();
    const soft = theme.presentation.content.groupStyle === 'softGrouped';
    const glass = theme.presentation.content.groupMaterial === 'glass' && theme.glass.enabled;
    const groupBackground = soft ? theme.colors.surfaceContainerHigh : theme.colors.surfaceContainer;
    const content = (
        <>
            <View style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.xs }}>
                <Text type="footnote1" weight="bold" color={theme.colors.primary}>{title}</Text>
            </View>
            {children}
        </>
    );

    return (
        <View style={[{ marginTop: theme.spacing.lg }, style]}>
            {glass ? (
                <GlassSurface
                    variant="preferencePanel"
                    positioning="inFlow"
                    sampling="local"
                    style={{
                    width: '100%',
                    borderRadius: theme.glass.materials.preferencePanel.radius,
                    overflow: 'hidden',
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: theme.dark ? 'rgba(190,214,247,0.34)' : 'rgba(101,139,191,0.30)',
                    }}
                >
                    {content}
                </GlassSurface>
            ) : (
                <Card
                    feedback="none"
                    contentStyle={{
                        overflow: 'hidden',
                        backgroundColor: groupBackground,
                        borderWidth: soft ? StyleSheet.hairlineWidth : 0,
                        borderColor: theme.colors.outline,
                    }}
                >
                    {content}
                </Card>
            )}
        </View>
    );
});

PreferenceGroup.displayName = 'HyperPreferenceGroup';

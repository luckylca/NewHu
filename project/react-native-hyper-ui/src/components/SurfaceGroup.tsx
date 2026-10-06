import { GlassSurface } from '@newhu/react-native-liquid-glass';
import React from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { Card } from './Card';
import { useTheme } from '../theme';
import { useSurfaceEnvironment } from './SurfaceEnvironmentContext';

export interface SurfaceGroupProps {
    children: ReactNode;
    style?: StyleProp<ViewStyle>;
}

/** Theme-aware local material for grouped list rows. */
export const SurfaceGroup = React.memo(function SurfaceGroup({ children, style }: SurfaceGroupProps) {
    const theme = useTheme();
    const embeddedInGlassOverlay = useSurfaceEnvironment() === 'glassOverlay';
    const glass = theme.presentation.content.groupMaterial === 'glass' && theme.glass.enabled && !embeddedInGlassOverlay;

    if (glass) {
        return (
            <View style={style}>
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
                    {children}
                </GlassSurface>
            </View>
        );
    }

    return (
        <Card feedback="none" style={style} contentStyle={{ overflow: 'hidden' }}>
            {children}
        </Card>
    );
});

SurfaceGroup.displayName = 'HyperSurfaceGroup';

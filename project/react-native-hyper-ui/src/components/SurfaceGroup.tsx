import React from 'react';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../theme';
import { useSurfaceEnvironment } from './SurfaceEnvironmentContext';
import { Surface } from '../primitives/Surface';
import type { SurfaceMaterialMode } from '../primitives/Surface';

export interface SurfaceGroupProps {
    children: ReactNode;
    style?: StyleProp<ViewStyle>;
}

/** Theme-aware local material for grouped list rows. */
export const SurfaceGroup = React.memo(function SurfaceGroup({ children, style }: SurfaceGroupProps) {
    const theme = useTheme();
    const embeddedInGlassOverlay = useSurfaceEnvironment() === 'glassOverlay';
    const groupGlass = theme.presentation.content.groupMaterial === 'glass' &&
        theme.glass.enabled && !embeddedInGlassOverlay;
    const cardGlass = theme.presentation.content.cardMaterial === 'glass' && theme.glass.enabled;
    const material: SurfaceMaterialMode = groupGlass
        ? 'glass'
        : cardGlass && embeddedInGlassOverlay ? 'overlayTint'
            : cardGlass ? 'glass' : 'solid';

    return (
        <Surface
            material={material}
            glassVariant={groupGlass ? 'preferencePanel' : 'card'}
            radius={groupGlass
                ? theme.glass.materials.preferencePanel.radius
                : theme.components.card.radius}
            backgroundColor={cardGlass && embeddedInGlassOverlay
                ? theme.glass.tint[theme.dark ? 'dark' : 'light']
                : theme.colors.surfaceContainer}
            borderWidth={groupGlass || cardGlass && embeddedInGlassOverlay ? StyleSheet.hairlineWidth : 0}
            borderColor={groupGlass
                ? theme.dark ? 'rgba(190,214,247,0.34)' : 'rgba(101,139,191,0.30)'
                : cardGlass && embeddedInGlassOverlay ? theme.colors.dividerLine : 'transparent'}
            style={style}
            contentStyle={groupGlass ? undefined : { overflow: 'hidden' }}
        >
            {children}
        </Surface>
    );
});

SurfaceGroup.displayName = 'HyperSurfaceGroup';

import { Text } from '../primitives';
import { useTheme } from '../theme';
import { useSurfaceEnvironment } from './SurfaceEnvironmentContext';
import { Surface } from '../primitives/Surface';
import type { SurfaceMaterialMode } from '../primitives/Surface';
import React from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

export interface PreferenceGroupProps {
    title: string;
    children: ReactNode;
    style?: StyleProp<ViewStyle>;
    /** Diagnostic override for comparing local Glass surfaces with solid cards. */
    materialOverride?: 'theme' | 'solid';
}

/** Theme-aware grouped settings surface; row content stays the same. */
export const PreferenceGroup = React.memo(function PreferenceGroup({ title, children, style, materialOverride = 'theme' }: PreferenceGroupProps) {
    const theme = useTheme();
    const embeddedInGlassOverlay = useSurfaceEnvironment() === 'glassOverlay';
    const soft = theme.presentation.content.groupStyle === 'softGrouped';
    const groupGlass = materialOverride === 'theme' &&
        theme.presentation.content.groupMaterial === 'glass' &&
        theme.glass.enabled && !embeddedInGlassOverlay;
    const cardGlass = theme.presentation.content.cardMaterial === 'glass' && theme.glass.enabled;
    const material: SurfaceMaterialMode = groupGlass
        ? 'glass'
        : cardGlass && embeddedInGlassOverlay ? 'overlayTint'
            : cardGlass ? 'glass' : 'solid';
    const groupBackground = soft ? theme.colors.surfaceContainerHigh : theme.colors.surfaceContainer;
    const content = (
        <>
            <View style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.xs }}>
                <Text type="footnote1" weight="bold" color={theme.colors.primary}>{title}</Text>
            </View>
            {children}
        </>
    );
    const groupBorder = theme.dark ? 'rgba(190,214,247,0.34)' : 'rgba(101,139,191,0.30)';

    return (
        <View style={[{ marginTop: theme.spacing.lg }, style]}>
            <Surface
                material={material}
                surfaceRole="staticGroup"
                glassVariant={groupGlass ? 'preferencePanel' : 'card'}
                radius={groupGlass
                    ? theme.glass.materials.preferencePanel.radius
                    : theme.components.card.radius}
                backgroundColor={cardGlass && embeddedInGlassOverlay
                    ? theme.glass.tint[theme.dark ? 'dark' : 'light']
                    : groupBackground}
                borderWidth={groupGlass || cardGlass && embeddedInGlassOverlay
                    ? StyleSheet.hairlineWidth
                    : 0}
                borderColor={groupGlass
                    ? groupBorder
                    : cardGlass && embeddedInGlassOverlay ? theme.colors.dividerLine : 'transparent'}
                contentStyle={groupGlass ? undefined : {
                    overflow: 'hidden',
                    backgroundColor: groupBackground,
                    borderWidth: soft ? StyleSheet.hairlineWidth : 0,
                    borderColor: theme.colors.outline,
                }}
            >
                {content}
            </Surface>
        </View>
    );
});

PreferenceGroup.displayName = 'HyperPreferenceGroup';

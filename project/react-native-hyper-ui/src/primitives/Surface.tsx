import { useTheme } from '../theme';
import React, { useMemo } from 'react';
import type { ReactNode } from 'react';
import { GlassSurface } from '@newhu/react-native-liquid-glass';
import type { GlassVariant } from '@newhu/react-native-liquid-glass';
import type { GlassSurfaceRole } from '@newhu/react-native-liquid-glass';
import Animated from 'react-native-reanimated';
import type { AnimatedStyle } from 'react-native-reanimated';
import { StyleSheet, View } from 'react-native';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';

export type SurfaceMaterialMode = 'solid' | 'glass' | 'overlayTint';

export interface AppSurfaceProps {
    /** Background color; defaults to the theme surface. */
    color?: string;
    backgroundColor?: ColorValue;
    /** Content (text) color — used only for context; RN doesn't inherit colors. */
    contentColor?: string;
    /** Border radius; defaults to 0 (RectangleShape). */
    radius?: number;
    /** Material and interaction are independent; Surface never adds a responder. */
    material?: SurfaceMaterialMode;
    glassVariant?: GlassVariant;
    /** Reusable material purpose; local renderer selection stays in Liquid Glass runtime. */
    surfaceRole?: GlassSurfaceRole;
    borderColor?: ColorValue;
    borderWidth?: number;
    contentStyle?: StyleProp<ViewStyle>;
    animatedStyle?: AnimatedStyle<ViewStyle>;
    centeredTransformOrigin?: boolean;
    children?: ReactNode;
    style?: StyleProp<ViewStyle>;
}

/**
 * Design System Surface — themed material without press semantics.
 *
 * Defaults to a plain solid surface for compatibility. Glass is a material
 * choice only; callers add Pressable behavior separately when the content acts.
 */
export const Surface = React.memo(function Surface({
    color,
    backgroundColor,
    radius = 0,
    material = 'solid',
    glassVariant = 'card',
    surfaceRole = 'staticGroup',
    borderColor = 'transparent',
    borderWidth = 0,
    contentStyle,
    animatedStyle,
    centeredTransformOrigin,
    children,
    style,
}: AppSurfaceProps) {
    const theme = useTheme();
    const flattenedContentStyle = useMemo(() => StyleSheet.flatten(contentStyle), [contentStyle]);
    const glassContentStyle = useMemo(() => {
        if (!flattenedContentStyle || !('backgroundColor' in flattenedContentStyle)) return contentStyle;
        const layoutStyle = { ...flattenedContentStyle };
        delete layoutStyle.backgroundColor;
        return layoutStyle;
    }, [contentStyle, flattenedContentStyle]);
    const glassSizingStyle = useMemo(() => {
        if (!flattenedContentStyle) return undefined;
        const containerStyle: ViewStyle = {};
        const sizingKeys: Array<keyof ViewStyle> = [
            'flex', 'flexGrow', 'flexShrink', 'flexBasis', 'alignSelf',
            'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight',
        ];
        for (const key of sizingKeys) {
            const value = flattenedContentStyle[key];
            if (value !== undefined) {
                (containerStyle as Record<string, unknown>)[key] = value;
            }
        }
        return containerStyle;
    }, [flattenedContentStyle]);
    const resolvedBackground = backgroundColor ?? color ?? theme.colors.surface;
    const centeredOriginStyle = centeredTransformOrigin ? { transformOrigin: '50% 50%' as const } : undefined;
    const resolvedSolidContentStyle = material === 'overlayTint' ? glassContentStyle : contentStyle;

    if (material === 'glass') {
        return (
            <GlassSurface
                variant={glassVariant}
                surfaceRole={surfaceRole}
                positioning="inFlow"
                sampling="local"
                style={[
                    {
                        width: '100%',
                        borderRadius: radius,
                        overflow: 'hidden',
                        backgroundColor: 'transparent',
                        borderWidth,
                        borderColor,
                    },
                    glassSizingStyle,
                    centeredOriginStyle,
                    style,
                ]}
                contentStyle={glassContentStyle}
                animatedStyle={animatedStyle}
            >
                {children}
            </GlassSurface>
        );
    }

    const solidStyle: StyleProp<ViewStyle> = [
        {
            backgroundColor: resolvedBackground,
            borderRadius: radius,
            overflow: 'hidden' as const,
            flexDirection: 'column' as const,
            borderWidth,
            borderColor,
        },
        centeredOriginStyle,
        resolvedSolidContentStyle,
        style,
    ];
    return animatedStyle
        ? <Animated.View style={[solidStyle, animatedStyle]}>{children}</Animated.View>
        : <View style={solidStyle}>{children}</View>;
});
Surface.displayName = 'HyperSurface';

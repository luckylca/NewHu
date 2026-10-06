import { PressIndication, Text } from '../primitives';
import { GlassSurface } from '@newhu/react-native-liquid-glass';
import { useTheme } from '../theme';
import { useSurfaceEnvironment } from './SurfaceEnvironmentContext';
import { memo } from 'react';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

/**
 * Design System Button.
 *
 * Visual reference:
 *   miuix-vue/src/components/button/Button.vue (Button.kt)
 *
 * minWidth 58, minHeight 40, padding 16x13, radius 16, font 17.
 * Default bg secondaryVariant / text onSecondaryVariant;
 * Primary bg primary / text onPrimary.
 * Disabled Default bg disabledSecondaryVariant / text disabledOnSecondaryVariant;
 * Disabled Primary bg disabledPrimaryButton / text disabledOnPrimaryButton.
 * Press = MiuixIndication alpha overlay (onBackground, 0.10, 120ms linear).
 * NO scale, NO shadow, NO gradient, NO blur.
 */

export type ButtonType = 'default' | 'primary';

export interface AppButtonProps {
    /** 'default' = miuix buttonColors(); 'primary' = buttonColorsPrimary(). */
    type?: ButtonType;
    onPress?: () => void;
    disabled?: boolean;
    style?: StyleProp<ViewStyle>;
    contentStyle?: StyleProp<ViewStyle>;
    children?: ReactNode;
}

export const Button = memo(function Button({ type = 'default', onPress, disabled, style, contentStyle, children }: AppButtonProps) {
    const theme = useTheme();
    const embeddedInGlassOverlay = useSurfaceEnvironment() === 'glassOverlay';
    const c = theme.components.button;
    const useGlassMaterial = theme.presentation.controls.buttonMaterial === 'glass' && theme.glass.enabled && !embeddedInGlassOverlay;
    const pressed = useSharedValue(0);

    const backgroundColor = disabled
        ? type === 'primary'
            ? theme.colors.disabledPrimaryButton
            : theme.colors.disabledSecondaryVariant
        : type === 'primary'
            ? theme.colors.primary
            : theme.colors.secondaryVariant;

    const materialTextColor = disabled
        ? type === 'primary'
            ? theme.colors.disabledOnPrimaryButton
            : theme.colors.disabledOnSecondaryVariant
        : type === 'primary'
            ? theme.colors.onPrimary
            : theme.colors.onSecondaryVariant;
    const textColor = useGlassMaterial
        ? disabled ? theme.colors.onGlassMuted : theme.colors.onGlass
        : materialTextColor;

    const isString = typeof children === 'string';
    const placeholderChildren = (
        <View style={{
            minWidth: c.minWidth,
            minHeight: c.minHeight,
            paddingHorizontal: c.paddingHorizontal,
            paddingVertical: c.paddingVertical,
            alignItems: 'center',
            justifyContent: 'center',
        }}>
            {isString ? <Text type="button" color="transparent">{children}</Text> : null}
        </View>
    );

    const button = (
        <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !!disabled }}
            disabled={disabled}
            onPress={onPress}
            onPressIn={() => (pressed.value = 1)}
            onPressOut={() => (pressed.value = 0)}
            style={[
                {
                    minWidth: c.minWidth,
                    minHeight: c.minHeight,
                    paddingHorizontal: c.paddingHorizontal,
                    paddingVertical: c.paddingVertical,
                    borderRadius: c.radius,
                    backgroundColor: useGlassMaterial ? 'transparent' : backgroundColor,
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                },
                useGlassMaterial ? undefined : style,
            ]}
        >
            {useGlassMaterial && type === 'primary' ? (
                <View
                    pointerEvents="none"
                    style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: c.radius, backgroundColor: theme.colors.primary, opacity: 0.14 }}
                />
            ) : null}
            <PressIndication pressed={pressed} color={theme.colors.onBackground} radius={c.radius} />
            <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }, contentStyle]}>
                {isString ? (
                    <Text type="button" color={textColor}>
                        {children}
                    </Text>
                ) : (
                    children
                )}
            </View>
        </Pressable>
    );

    if (useGlassMaterial) {
        return (
            <GlassSurface
                variant="control"
                positioning="inFlow"
                sampling="local"
                interactive={!disabled}
                style={style}
                placeholderChildren={placeholderChildren}
            >
                {button}
            </GlassSurface>
        );
    }

    return button;
});
Button.displayName = 'HyperButton';

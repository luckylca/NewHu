import { Icon, PressIndication, Text } from '@/src/ui/primitives';
import { snackbarMotion } from '@/src/ui/motion';
import { useTheme } from '@/src/ui/theme';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

/**
 * Design System Snackbar (Miuix Snackbar).
 *
 * Visual reference:
 *   miuix-vue/src/components/snackbar/SnackbarHost.vue (Snackbar.kt)
 *
 * Dark container (onSecondaryVariant), radius 16, min-height 48, inside margin
 * 12 all, outer padding 12 horizontal + 8 top, max-width 420, soft drop shadow
 * (blur 10, black 10%). Message body2 (max 2 lines, color secondaryVariant).
 * Optional action = primary filled pill (primary bg / onPrimary text, radius 50,
 * font 15, min 26×26, inside margin 12×0) + dismiss X (Close, 20px,
 * onSurfaceContainerVariant, no ripple). Enter: slide-up + fade; exit: slide-down
 * + fade — one critically-damped spring folmeSpring(1, 400).
 */

export interface AppSnackbarProps {
    visible?: boolean;
    message?: string;
    actionLabel?: string;
    onAction?: () => void;
    withDismissAction?: boolean;
    onDismiss?: () => void;
    /** Bottom inset — lift the snackbar above a bottom navigation bar. */
    bottomInset?: number;
}

const ENTER_OFFSET = 24;

export function Snackbar({ visible = false, message, actionLabel, onAction, withDismissAction = false, onDismiss, bottomInset = 0 }: AppSnackbarProps) {
    const theme = useTheme();

    // Stay mounted while the exit animation plays.
    const [rendered, setRendered] = useState(visible);
    const y = useSharedValue(ENTER_OFFSET);
    const opacity = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            setRendered(true);
            y.value = withSpring(0, snackbarMotion);
            opacity.value = withSpring(1, snackbarMotion);
        } else if (rendered) {
            y.value = withSpring(ENTER_OFFSET, snackbarMotion, (finished) => {
                if (finished) runOnJS(setRendered)(false);
            });
            opacity.value = withSpring(0, snackbarMotion);
        }
    }, [visible, rendered, y, opacity]);

    const containerStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: y.value }],
        opacity: opacity.value,
    }));

    if (!rendered) return null;

    return (
        <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', alignItems: 'center' }]}>
            <Animated.View style={[{ width: '100%', maxWidth: 420, paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.sm, bottom: bottomInset }, containerStyle]}>
                <View
                    style={{
                        minHeight: 48,
                        padding: theme.spacing.md,
                        borderRadius: theme.radius.component,
                        backgroundColor: theme.colors.onSecondaryVariant,
                        flexDirection: 'row',
                        alignItems: 'center',
                        shadowColor: '#000000',
                        shadowOpacity: visible ? 0.1 : 0,
                        shadowRadius: 10,
                        shadowOffset: { width: 0, height: 0 },
                        elevation: visible ? 4 : 0,
                    }}
                >
                    <Text type="body2" color={theme.colors.secondaryVariant} style={{ flex: 1, minWidth: 0 }} numberOfLines={2}>
                        {message}
                    </Text>
                    {actionLabel != null && <SnackbarAction label={actionLabel} onPress={onAction} />}
                    {withDismissAction && (
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Dismiss"
                            onPress={onDismiss}
                            hitSlop={8}
                            style={{ width: 20, height: 20, marginLeft: theme.spacing.sm, alignItems: 'center', justifyContent: 'center' }}
                        >
                            <Icon name="close" size={20} color={theme.colors.onSurfaceContainerVariant} />
                        </Pressable>
                    )}
                </View>
            </Animated.View>
        </View>
    );
}

function SnackbarAction({ label, onPress }: { label: string; onPress?: () => void }) {
    const theme = useTheme();
    const pressed = useSharedValue(0);
    return (
        <Pressable
            accessibilityRole="button"
            onPress={onPress}
            onPressIn={() => (pressed.value = 1)}
            onPressOut={() => (pressed.value = 0)}
            style={{
                marginLeft: theme.spacing.md,
                minWidth: 26,
                minHeight: 26,
                paddingHorizontal: 12,
                borderRadius: 50,
                backgroundColor: theme.colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
            }}
        >
            <PressIndication pressed={pressed} color={theme.colors.onBackground} radius={50} />
            <Text style={{ fontSize: 15, color: theme.colors.onPrimary, lineHeight: 15 }}>{label}</Text>
        </Pressable>
    );
}

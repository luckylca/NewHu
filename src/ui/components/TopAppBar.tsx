import { Icon, Text } from '@/src/ui/primitives';
import { topAppBarHide, topAppBarShow } from '@/src/ui/motion';
import { useTheme } from '@/src/ui/theme';
import React from 'react';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, withSpring } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Design System TopAppBar.
 *
 * Visual reference:
 *   miuix-vue/src/components/top-app-bar/TopAppBar.vue (TopAppBar.kt)
 *
 * Two forms:
 *   small (default) — the 52-tall pinned bar. title3 (20) Medium centred,
 *     optional subtitle (body2, onSurfaceVariantSummary) below it.
 *   large — the scroll-driven COLLAPSING large-title bar. The large title
 *     (title1 32, left-aligned) scrolls away under the 52-bar; as it goes the
 *     small title springs in.
 *
 * Collapse (from TopAppBarLayout):
 *   collapsedFraction = scrollY / expansion
 *   largeTitleAlpha   = 1 - (collapsedFraction * 3).coerceIn(0,1)  — fades over
 *     the first 1/3 of the collapse.
 *   smallTitleVisible = collapsedFraction * 3 >= 1 — on flip the small title
 *     springs alpha (0↔1) + translationY (20↔0):
 *     show = folmeSpring(damping 1.0, response 0.3),
 *     hide = folmeSpring(damping 1.0, response 0.15).
 */

export interface AppTopAppBarProps {
    title?: string;
    /** Large title text; defaults to title. */
    largeTitle?: string;
    subtitle?: string;
    /** Collapsing large-title form. Requires `scrollY` + `expansion`. */
    large?: boolean;
    /** Scroll offset of the driving scroll container (large form). */
    scrollY?: SharedValue<number>;
    /** Large title block height — the collapse expansion. */
    expansion?: number;
    /** Render a back action at the left. */
    back?: (() => void) | boolean;
    /** Trailing actions (right). */
    actions?: ReactNode;
    /** Optional left slot (nav). */
    navigation?: ReactNode;
}

const HIDDEN_TRANSLATION_Y = 20;

export function TopAppBar({ title = '', largeTitle, subtitle, large = false, scrollY, expansion = 88, back, actions, navigation }: AppTopAppBarProps) {
    const theme = useTheme();
    const titleColor = theme.colors.onBackground;
    const subtitleColor = theme.colors.onSurfaceVariantSummary;
    const insets = useSafeAreaInsets();

    const hasBack = back !== undefined && back !== false && back !== null;

    // Collapse fraction 0..1 (0 = fully expanded).
    const collapsedFraction = useDerivedValue(() => {
        if (!large || !scrollY || expansion <= 0) return 0;
        const f = scrollY.value / expansion;
        return Math.max(0, Math.min(1, f));
    });

    // largeTitleAlpha = 1 - (fraction * 3).coerceIn(0,1)
    const largeAlphaStyle = useAnimatedStyle(() => ({
        opacity: 1 - Math.max(0, Math.min(1, collapsedFraction.value * 3)),
    }));

    // Small title: visible when fraction*3 >= 1.
    const smallVisible = useDerivedValue(() => collapsedFraction.value * 3 >= 1 ? 1 : 0);
    const smallTitleStyle = useAnimatedStyle(() => {
        const visible = smallVisible.value === 1;
        return {
            opacity: visible ? withSpring(1, topAppBarShow) : withSpring(0, topAppBarHide),
            transform: [{ translateY: visible ? withSpring(0, topAppBarShow) : withSpring(HIDDEN_TRANSLATION_Y, topAppBarHide) }],
        };
    });

    return (
        <View style={{ backgroundColor: theme.colors.surface, paddingTop: insets.top }}>
            {/* Collapsed 52-bar */}
            <View style={{ minHeight: theme.components.navigationBar.topBarCollapsedHeight, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ position: 'absolute', left: 0, paddingLeft: theme.spacing.lg, minWidth: 0 }}>
                    {navigation ?? (hasBack ? <BackAction onPress={typeof back === 'function' ? back : undefined} /> : null)}
                </View>
                {large ? (
                    <Animated.View style={[{ alignItems: 'center', paddingHorizontal: 26, pointerEvents: 'none' }, smallTitleStyle]}>
                        <TitleText>{title}</TitleText>
                        {subtitle != null && <Text type="body2" color={subtitleColor}>{subtitle}</Text>}
                    </Animated.View>
                ) : (
                    <View style={{ alignItems: 'center', paddingHorizontal: 26 }}>
                        <TitleText>{title}</TitleText>
                        {subtitle != null && <Text type="body2" color={subtitleColor}>{subtitle}</Text>}
                    </View>
                )}
                <View style={{ position: 'absolute', right: 0, paddingRight: theme.spacing.lg, flexDirection: 'row', alignItems: 'center' }}>{actions}</View>
            </View>

            {/* Large title (collapsing, in flow) */}
            {large && (
                <Animated.View style={[{ paddingHorizontal: 26, paddingBottom: 4 }, largeAlphaStyle]}>
                    <Text type="title1" color={titleColor}>
                        {largeTitle ?? title}
                    </Text>
                    {subtitle != null && <Text type="body2" color={subtitleColor}>{subtitle}</Text>}
                </Animated.View>
            )}
        </View>
    );
}

function TitleText({ children }: { children: ReactNode }) {
    const theme = useTheme();
    return (
        <Text type="title3" weight="medium" color={theme.colors.onBackground} style={{ textAlign: 'center' }}>
            {children}
        </Text>
    );
}

function BackAction({ onPress }: { onPress?: () => void }) {
    const theme = useTheme();
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={onPress}
            hitSlop={8}
            style={({ pressed }) => [
                {
                    width: 40,
                    height: 40,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 40,
                    opacity: pressed ? 0.6 : 1,
                },
            ]}
        >
            <Icon name="arrow-left" size={24} color={theme.colors.onBackground} />
        </Pressable>
    );
}

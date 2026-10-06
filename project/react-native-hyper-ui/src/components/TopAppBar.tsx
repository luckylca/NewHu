import { Icon, Text } from '../primitives';
import { GlassSurface } from '@newhu/react-native-liquid-glass';
import { topAppBarHide, topAppBarShow } from '../motion';
import { useReducedMotionPreference } from '../motion/MotionProvider';
import { useTheme } from '../theme';
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
    /** Selects the backdrop source for the optical backing; defaults to live route content. */
    samplingSource?: 'routeScene' | 'themeBackdrop';
    /** Diagnostic override for measuring the route without its optical backing. */
    opticalBackingEnabled?: boolean;
    /** Trailing actions (right). */
    actions?: ReactNode;
    /** Optional left slot (nav). */
    navigation?: ReactNode;
}

const HIDDEN_TRANSLATION_Y = 20;

export const TopAppBar = React.memo(function TopAppBar({ title = '', largeTitle, subtitle, large = false, scrollY, expansion = 88, back, samplingSource = 'routeScene', opticalBackingEnabled = true, actions, navigation }: AppTopAppBarProps) {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const barHeight = insets.top + theme.components.navigationBar.topBarCollapsedHeight + (large ? 42 + (subtitle != null ? 20 : 0) : 0);
    const floating = theme.presentation.topBar.mode === 'floating';
    const hasGlassMaterial = theme.presentation.topBar.material === 'glass' && theme.glass.enabled;
    const useGlassBacking = hasGlassMaterial && opticalBackingEnabled;
    const titleColor = hasGlassMaterial ? theme.colors.onGlass : theme.colors.onBackground;
    const subtitleColor = hasGlassMaterial ? theme.colors.onGlassSecondary : theme.colors.onSurfaceVariantSummary;

    const hasBack = back !== undefined && back !== false && back !== null;

    const content = large ? (
                <LargeTopAppBarContent
                    title={title}
                    largeTitle={largeTitle ?? title}
                    subtitle={subtitle}
                    scrollY={scrollY}
                    expansion={expansion}
                    navigation={navigation}
                    hasBack={hasBack}
                    back={back}
                    actions={actions}
                    titleColor={titleColor}
                    subtitleColor={subtitleColor}
                    topInset={insets.top}
                    rowHeight={theme.components.navigationBar.topBarCollapsedHeight}
                    horizontalInset={theme.spacing.lg}
                />
            ) : (
                <SmallTopAppBarContent
                    title={title}
                    subtitle={subtitle}
                    navigation={navigation}
                    hasBack={hasBack}
                    back={back}
                    actions={actions}
                    titleColor={titleColor}
                    subtitleColor={subtitleColor}
                    topInset={insets.top}
                    rowHeight={theme.components.navigationBar.topBarCollapsedHeight}
                    horizontalInset={theme.spacing.lg}
                />
            );

    if (useGlassBacking) {
        return (
            <GlassSurface
                variant="bar"
                positioning={floating ? 'floating' : 'inFlow'}
                sampling="backdrop"
                samplingSource={samplingSource}
                inlineBackdrop
                style={{ width: '100%', height: barHeight, backgroundColor: 'transparent' }}
            >
                {content}
            </GlassSurface>
        );
    }

    return (
        <View style={{ width: '100%', minHeight: hasGlassMaterial ? barHeight : undefined, backgroundColor: hasGlassMaterial ? 'transparent' : theme.colors.surface }}>
            {content}
        </View>
    );
});
TopAppBar.displayName = 'HyperTopAppBar';

type TopAppBarContentProps = Pick<AppTopAppBarProps, 'title' | 'subtitle' | 'back' | 'actions' | 'navigation'> & {
    titleColor: string;
    subtitleColor: string;
    topInset: number;
    rowHeight: number;
    horizontalInset: number;
    hasBack: boolean;
};

function TopAppBarRow({ title, subtitle, navigation, hasBack, back, actions, titleColor, subtitleColor, rowHeight, horizontalInset, animatedTitle }: TopAppBarContentProps & { animatedTitle?: ReactNode }) {
    return (
        <View style={{ minHeight: rowHeight, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ position: 'absolute', left: 0, paddingLeft: horizontalInset, minWidth: 0 }}>
                {navigation ?? (hasBack ? <BackAction color={titleColor} onPress={typeof back === 'function' ? back : undefined} /> : null)}
            </View>
            {animatedTitle ?? (
                <View style={{ alignItems: 'center', maxWidth: '68%', minWidth: 0 }}>
                    <TitleText color={titleColor}>{title}</TitleText>
                    {subtitle != null && <Text type="body2" color={subtitleColor} numberOfLines={1} ellipsizeMode="tail">{subtitle}</Text>}
                </View>
            )}
            <View style={{ position: 'absolute', right: 0, paddingRight: horizontalInset, flexDirection: 'row', alignItems: 'center' }}>{actions}</View>
        </View>
    );
}

function SmallTopAppBarContent(props: TopAppBarContentProps) {
    return (
        <View style={{ backgroundColor: 'transparent', paddingTop: props.topInset }}>
            <TopAppBarRow {...props} />
        </View>
    );
}

function LargeTopAppBarContent({ title, largeTitle, subtitle, scrollY, expansion, navigation, hasBack, back, actions, titleColor, subtitleColor, topInset, rowHeight, horizontalInset }: TopAppBarContentProps & { largeTitle: string; scrollY?: SharedValue<number>; expansion: number }) {
    const reducedMotion = useReducedMotionPreference();
    const collapsedFraction = useDerivedValue(() => {
        if (!scrollY || expansion <= 0) return 0;
        return Math.max(0, Math.min(1, scrollY.value / expansion));
    });
    const largeAlphaStyle = useAnimatedStyle(() => ({ opacity: 1 - Math.max(0, Math.min(1, collapsedFraction.value * 3)) }));
    const smallVisible = useDerivedValue(() => collapsedFraction.value * 3 >= 1 ? 1 : 0);
    const smallTitleStyle = useAnimatedStyle(() => {
        const visible = smallVisible.value === 1;
        return {
            opacity: reducedMotion ? (visible ? 1 : 0) : visible ? withSpring(1, topAppBarShow) : withSpring(0, topAppBarHide),
            transform: [{ translateY: reducedMotion ? 0 : visible ? withSpring(0, topAppBarShow) : withSpring(HIDDEN_TRANSLATION_Y, topAppBarHide) }],
        };
    });

    return (
        <View style={{ backgroundColor: 'transparent', paddingTop: topInset }}>
            <TopAppBarRow
                title={title}
                subtitle={subtitle}
                navigation={navigation}
                hasBack={hasBack}
                back={back}
                actions={actions}
                titleColor={titleColor}
                subtitleColor={subtitleColor}
                topInset={topInset}
                rowHeight={rowHeight}
                horizontalInset={horizontalInset}
                animatedTitle={(
                    <Animated.View style={[{ alignItems: 'center', maxWidth: '68%', minWidth: 0, pointerEvents: 'none' }, smallTitleStyle]}>
                        <TitleText color={titleColor}>{title}</TitleText>
                        {subtitle != null && <Text type="body2" color={subtitleColor} numberOfLines={1} ellipsizeMode="tail">{subtitle}</Text>}
                    </Animated.View>
                )}
            />
            <Animated.View style={[{ paddingHorizontal: 26, paddingBottom: 4 }, largeAlphaStyle]}>
                <Text type="title1" color={titleColor} numberOfLines={1} ellipsizeMode="tail">{largeTitle}</Text>
                {subtitle != null && <Text type="body2" color={subtitleColor} numberOfLines={1} ellipsizeMode="tail">{subtitle}</Text>}
            </Animated.View>
        </View>
    );
}

function TitleText({ children, color }: { children: ReactNode; color: string }) {
    return (
        <Text
            type="title3"
            weight="medium"
            color={color}
            numberOfLines={1}
            ellipsizeMode="tail"
            style={{ textAlign: 'center' }}
        >
            {children}
        </Text>
    );
}

function BackAction({ onPress, color }: { onPress?: () => void; color: string }) {
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
            <Icon name="arrow-left" size={24} color={color} />
        </Pressable>
    );
}

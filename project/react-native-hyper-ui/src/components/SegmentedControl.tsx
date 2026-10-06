import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { GlassTabBar } from '@newhu/react-native-liquid-glass';
import { Text } from '../primitives';
import { useTheme } from '../theme';
import { useSurfaceEnvironment } from './SurfaceEnvironmentContext';

export interface AppSegmentedControlProps {
    tabs: string[];
    selected?: number;
    onSelect?: (index: number) => void;
    /** Optional narrower/wider refraction rim for text-heavy segmented selectors. */
    lensRefractionHeight?: number;
}

const CONTROL_HEIGHT = 56;

/**
 * Glass mode selectors intentionally use the same lens, tap and drag controller
 * as the app's bottom navigation. This keeps long-press drag behavior identical.
 */
export const SegmentedControl = React.memo(function SegmentedControl({ tabs, selected = 0, onSelect, lensRefractionHeight }: AppSegmentedControlProps) {
    const theme = useTheme();
    const embeddedInGlassOverlay = useSurfaceEnvironment() === 'glassOverlay';
    const renderModeLabel = useCallback((item: { label: string }, _index: number, active: boolean) => (
        <Text
            type="body1"
            weight={active ? 'bold' : 'medium'}
            color={active ? theme.colors.onBackground : theme.colors.onSurfaceVariantSummary}
            numberOfLines={1}
        >
            {item.label}
        </Text>
    ), [theme.colors.onBackground, theme.colors.onSurfaceVariantSummary]);

    if (theme.glass.enabled && !embeddedInGlassOverlay) {
        return (
            <GlassTabBar
                items={tabs.map((label) => ({ label }))}
                selected={selected}
                presentation="inline"
                height={CONTROL_HEIGHT}
                width="100%"
                horizontalPadding={4}
                shellRadius={18}
                lensRefractionHeight={lensRefractionHeight}
                shellBackgroundColor={theme.colors.surfaceContainerHigh}
                accessibilityHint="点击切换，或长按玻璃选中项并横向拖动切换"
                onSelect={(index) => onSelect?.(index)}
                onSelectFromDrag={(index) => onSelect?.(index)}
                renderItem={renderModeLabel}
            />
        );
    }

    return (
        <View style={[styles.fallbackShell, { backgroundColor: embeddedInGlassOverlay ? 'transparent' : theme.colors.secondaryVariant }]}>
            {tabs.map((label, index) => {
                const active = index === selected;
                return (
                    <Pressable
                        key={`${label}-${index}`}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: active }}
                        onPress={() => onSelect?.(index)}
                        style={[styles.fallbackItem, active && {
                            backgroundColor: embeddedInGlassOverlay
                                ? theme.glass.tint[theme.dark ? 'dark' : 'light']
                                : theme.colors.surfaceContainer,
                        }]}
                    >
                        <Text
                            type="body1"
                            weight={active ? 'bold' : 'medium'}
                            color={active ? theme.colors.onBackground : theme.colors.onSurfaceVariantSummary}
                            numberOfLines={1}
                        >
                            {label}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
});

SegmentedControl.displayName = 'HyperSegmentedControl';

const styles = StyleSheet.create({
    fallbackShell: {
        width: '100%',
        height: CONTROL_HEIGHT,
        padding: 4,
        borderRadius: 18,
        flexDirection: 'row',
        overflow: 'hidden',
    },
    fallbackItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 14,
    },
});

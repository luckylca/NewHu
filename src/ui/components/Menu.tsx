import { Icon, PressIndication, Text } from '@/src/ui/primitives';
import { menuAlphaIn, menuAlphaOut, menuDimIn, menuDimOut, menuFraction } from '@/src/ui/motion';
import { useTheme } from '@/src/ui/theme';
import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

/**
 * Design System Menu (Miuix ListPopup — see DropdownPreference's popup).
 *
 * Visual reference:
 *   miuix-vue/src/components/dropdown-preference/DropdownPreference.vue
 *
 * Popup: minWidth 200 / maxWidth 288, radius 16, bg surfaceContainer,
 * shadow 0 10px 40 rgba(0,0,0,0.18). Items: pad 20 horizontal, first/last 20 /
 * middle 12 vertical; title body1(16) Medium, summary body2(14); selected →
 * primary + Check 20.
 * Animation (1:1 ListPopup):
 *   fraction: spring(dampingRatio 0.82, stiffness 362.5) → scale 0.15 + 0.85·f
 *   alpha:    tween 200ms in / 150ms out (FastOutSlowIn)
 *   dim:      windowDimming, tween 300ms SinOut in / 150ms out
 *   transformOrigin = anchor spawn corner (End-aligned → right edge).
 *
 * The `anchor` is a rect in WINDOW coordinates (from measureInWindow), so the
 * popup spawns 8dp below the anchor's right edge when it fits, else above, else
 * centred on it — miuix dropdownPositionProvider's 3-branch choice.
 */

export interface AppMenuItem {
    label: string;
    summary?: string;
    disabled?: boolean;
    onPress?: () => void;
}

export interface AppMenuProps {
    visible?: boolean;
    onClose?: () => void;
    /** Anchor rect in WINDOW coordinates (measureInWindow of the trigger). */
    anchor?: { x: number; y: number; width: number; height: number };
    items?: (AppMenuItem | string)[];
    selectedIndex?: number;
}

const MARGIN = 8;
const SCALE_HIDDEN = 0.15;
// miuix ListPopup item paddings — reference values (not on the spacing scale).
const ITEM_PADDING_HORIZONTAL = 20;
const ITEM_PADDING_VERTICAL_EDGE = 20; // first / last item
const ITEM_PADDING_VERTICAL_MIDDLE = 12; // middle items

type Placement = 'below' | 'above' | 'middle';

export function Menu({ visible = false, onClose, anchor, items = [], selectedIndex }: AppMenuProps) {
    const theme = useTheme();
    const { width: windowW, height: windowH } = useWindowDimensions();

    const [rendered, setRendered] = useState(visible);
    const [popupHeight, setPopupHeight] = useState(0);
    const [placement, setPlacement] = useState<Placement>('below');
    const popupWidth = Math.min(240, windowW - MARGIN * 2);

    const fraction = useSharedValue(0);
    const alpha = useSharedValue(0);
    const dim = useSharedValue(0);

    const onPopupLayout = useCallback((e: LayoutChangeEvent) => {
        setPopupHeight(e.nativeEvent.layout.height);
    }, []);

    // Positioning (miuix dropdownPositionProvider): End-aligned → popup right
    // edge = anchor right edge, coerced on-screen.
    const pos =
        anchor != null ? computePosition({ anchor, placement, popupHeight, popupWidth, windowW, windowH }) : { top: 0, left: 0, maxHeight: 0 };

    useEffect(() => {
        if (visible) {
            setRendered(true);
            fraction.value = withSpring(1, menuFraction);
            alpha.value = withTiming(1, menuAlphaIn);
            dim.value = withTiming(1, menuDimIn);
        } else if (rendered) {
            fraction.value = withSpring(0, menuFraction);
            dim.value = withTiming(0, menuDimOut);
            alpha.value = withTiming(0, menuAlphaOut, (finished) => {
                if (finished) runOnJS(setRendered)(false);
            });
        }
    }, [visible, rendered, fraction, alpha, dim]);

    // Decide below / above / middle once the popup has been measured.
    useEffect(() => {
        if (!rendered || !anchor) return;
        const spaceBelow = windowH - (anchor.y + anchor.height);
        const spaceAbove = anchor.y;
        if (spaceBelow > popupHeight) setPlacement('below');
        else if (spaceAbove > popupHeight) setPlacement('above');
        else setPlacement('middle');
    }, [rendered, anchor, popupHeight, windowH]);

    const popupStyle = useAnimatedStyle(() => ({
        transform: [{ scale: SCALE_HIDDEN + 0.85 * fraction.value }],
        opacity: alpha.value,
    }));

    const dimStyle = useAnimatedStyle(() => ({
        opacity: dim.value,
        backgroundColor: theme.colors.windowDimming,
    }));

    const origin =
        placement === 'below' ? 'top right' : placement === 'above' ? 'bottom right' : 'right center';

    const handleClose = useCallback(() => {
        onClose?.();
    }, [onClose]);

    return (
        <Modal transparent statusBarTranslucent animationType="none" visible={rendered} onRequestClose={handleClose}>
            <Animated.View style={[{ flex: 1 }, dimStyle]}>
                <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
                {anchor != null && (
                    <Animated.View
                        onLayout={onPopupLayout}
                        style={[
                            {
                                position: 'absolute',
                                top: pos.top,
                                left: pos.left,
                                width: popupWidth,
                                maxHeight: pos.maxHeight,
                                borderRadius: theme.radius.component,
                                backgroundColor: theme.colors.surfaceContainer,
                                overflow: 'hidden',
                                shadowColor: '#000000',
                                shadowOpacity: 0.18,
                                shadowRadius: 40,
                                shadowOffset: { width: 0, height: 10 },
                                elevation: 8,
                                transformOrigin: origin,
                            },
                            popupStyle,
                        ]}
                    >
                        {items.map((item, index) => {
                            const it = typeof item === 'string' ? { label: item } : item;
                            const selected = index === selectedIndex;
                            return (
                                <MenuItemRow
                                    key={index}
                                    item={it}
                                    first={index === 0}
                                    last={index === items.length - 1}
                                    selected={selected}
                                    onSelect={() => {
                                        if (it.disabled) return;
                                        it.onPress?.();
                                        handleClose();
                                    }}
                                />
                            );
                        })}
                    </Animated.View>
                )}
            </Animated.View>
        </Modal>
    );
}

function MenuItemRow({
    item,
    first,
    last,
    selected,
    onSelect,
}: {
    item: AppMenuItem;
    first: boolean;
    last: boolean;
    selected: boolean;
    onSelect: () => void;
}) {
    const theme = useTheme();
    const pressed = useSharedValue(0);
    const interactive = !item.disabled;

    const titleColor = item.disabled
        ? theme.colors.disabledOnSecondaryVariant
        : selected
            ? theme.colors.primary
            : theme.colors.onSurfaceContainer;
    const summaryColor = item.disabled
        ? theme.colors.disabledOnSecondaryVariant
        : selected
            ? theme.colors.primary
            : theme.colors.onSurfaceVariantSummary;

    return (
        <Pressable
            accessibilityRole="menuitem"
            accessibilityState={{ disabled: !interactive, selected }}
            onPress={onSelect}
            onPressIn={interactive ? () => (pressed.value = 1) : undefined}
            onPressOut={interactive ? () => (pressed.value = 0) : undefined}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: ITEM_PADDING_HORIZONTAL,
                paddingTop: first ? ITEM_PADDING_VERTICAL_EDGE : ITEM_PADDING_VERTICAL_MIDDLE,
                paddingBottom: last ? ITEM_PADDING_VERTICAL_EDGE : ITEM_PADDING_VERTICAL_MIDDLE,
                backgroundColor: theme.colors.surfaceContainer,
            }}
        >
            {interactive && <PressIndication pressed={pressed} color={theme.colors.onBackground} />}
            <View style={{ flex: 1, minWidth: 0, maxWidth: 216 }}>
                <Text type="body1" weight="medium" color={titleColor} numberOfLines={1}>
                    {item.label}
                </Text>
                {item.summary != null && (
                    <Text type="body2" color={summaryColor} numberOfLines={1}>
                        {item.summary}
                    </Text>
                )}
            </View>
            <View style={{ width: 20, marginLeft: 12, alignItems: 'center', justifyContent: 'center', opacity: selected ? 1 : 0 }}>
                <Icon name="check" size={20} color={theme.colors.primary} />
            </View>
        </Pressable>
    );
}

function computePosition({
    anchor,
    placement,
    popupHeight,
    popupWidth,
    windowW,
    windowH,
}: {
    anchor: { x: number; y: number; width: number; height: number };
    placement: Placement;
    popupHeight: number;
    popupWidth: number;
    windowW: number;
    windowH: number;
}) {
    const anchorRight = anchor.x + anchor.width;
    const left = Math.min(
        Math.max(anchorRight - popupWidth, MARGIN),
        Math.max(windowW - popupWidth - MARGIN, MARGIN),
    );
    let top = 0;
    let maxHeight = 0;
    if (placement === 'below') {
        top = anchor.y + anchor.height + MARGIN;
        maxHeight = Math.max(windowH - anchor.y - anchor.height - MARGIN * 2, 0);
    } else if (placement === 'above') {
        top = anchor.y - popupHeight - MARGIN;
        maxHeight = Math.max(anchor.y - MARGIN * 2, 0);
    } else {
        top = Math.min(Math.max(anchor.y + anchor.height / 2 - popupHeight / 2, MARGIN), Math.max(windowH - popupHeight - MARGIN, MARGIN));
        maxHeight = Math.max(windowH - MARGIN * 2, 0);
    }
    return { top, left, maxHeight };
}

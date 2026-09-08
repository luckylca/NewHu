import { useStoreHydrated } from '@/src/hooks/useStoreHydrated';
import { useLaterReadStore, type LaterReadItem } from '@/src/stores/useLaterReadStore';
import { BottomSheet, Button, Divider, Icon, ListRow } from '@/src/ui';
import { PressIndication, Text } from '@/src/ui/primitives';
import { useTheme } from '@/src/ui/theme';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BUBBLE_SIZE = 58;
const BUBBLE_MARGIN = 8;
const DEFAULT_BOTTOM_OFFSET = 156;

function clamp(value: number, min: number, max: number) {
    'worklet';
    return Math.min(Math.max(value, min), Math.max(min, max));
}

function getTypeLabel(type: LaterReadItem['type']) {
    return type === 'answer' ? '回答' : '文章';
}

function formatAddedAt(timestamp: number) {
    const date = new Date(timestamp);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' });
}

export function LaterReadFloatingBubble() {
    const theme = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { width: windowW, height: windowH } = useWindowDimensions();
    const hydrated = useStoreHydrated(useLaterReadStore);
    const items = useLaterReadStore((state) => state.items);
    const bubblePosition = useLaterReadStore((state) => state.bubblePosition);
    const panelOpenRequest = useLaterReadStore((state) => state.panelOpenRequest);
    const setBubblePosition = useLaterReadStore((state) => state.setBubblePosition);
    const removeItem = useLaterReadStore((state) => state.removeItem);
    const clearItems = useLaterReadStore((state) => state.clearItems);

    const [panelVisible, setPanelVisible] = useState(false);
    const handledOpenRequestRef = React.useRef(panelOpenRequest);

    const defaultX = Math.max(BUBBLE_MARGIN, windowW - BUBBLE_SIZE - 18);
    const defaultY = Math.max(BUBBLE_MARGIN + insets.top, windowH - insets.bottom - DEFAULT_BOTTOM_OFFSET);
    const x = useSharedValue(bubblePosition?.x ?? defaultX);
    const y = useSharedValue(bubblePosition?.y ?? defaultY);
    const startX = useSharedValue(0);
    const startY = useSharedValue(0);
    const pressed = useSharedValue(0);

    useEffect(() => {
        const nextX = clamp(bubblePosition?.x ?? defaultX, BUBBLE_MARGIN, windowW - BUBBLE_SIZE - BUBBLE_MARGIN);
        const nextY = clamp(bubblePosition?.y ?? defaultY, BUBBLE_MARGIN + insets.top, windowH - BUBBLE_SIZE - insets.bottom - BUBBLE_MARGIN);
        x.value = withSpring(nextX);
        y.value = withSpring(nextY);
    }, [bubblePosition?.x, bubblePosition?.y, defaultX, defaultY, insets.bottom, insets.top, windowH, windowW, x, y]);

    useEffect(() => {
        if (handledOpenRequestRef.current === panelOpenRequest) return;
        handledOpenRequestRef.current = panelOpenRequest;
        if (items.length > 0) setPanelVisible(true);
    }, [items.length, panelOpenRequest]);

    useEffect(() => {
        if (items.length === 0) setPanelVisible(false);
    }, [items.length]);

    const saveBubblePosition = useCallback((nextX: number, nextY: number) => {
        setBubblePosition({ x: Math.round(nextX), y: Math.round(nextY) });
    }, [setBubblePosition]);

    const openItem = useCallback((item: LaterReadItem) => {
        setPanelVisible(false);
        setTimeout(() => {
            router.push({
                pathname: '/item/[type]/[id]',
                params: {
                    type: item.type,
                    id: item.id,
                    needToGet: 'true',
                },
            });
        }, 120);
    }, [router]);

    const panGesture = useMemo(() => Gesture.Pan()
        .minDistance(8)
        .onBegin(() => {
            pressed.value = 1;
            startX.value = x.value;
            startY.value = y.value;
        })
        .onUpdate((event) => {
            x.value = clamp(startX.value + event.translationX, BUBBLE_MARGIN, windowW - BUBBLE_SIZE - BUBBLE_MARGIN);
            y.value = clamp(startY.value + event.translationY, BUBBLE_MARGIN + insets.top, windowH - BUBBLE_SIZE - insets.bottom - BUBBLE_MARGIN);
        })
        .onFinalize(() => {
            pressed.value = 0;
            runOnJS(saveBubblePosition)(x.value, y.value);
        }), [insets.bottom, insets.top, pressed, saveBubblePosition, startX, startY, windowH, windowW, x, y]);

    const tapGesture = useMemo(() => Gesture.Tap()
        .maxDistance(8)
        .onBegin(() => {
            pressed.value = 1;
        })
        .onEnd((_event, success) => {
            if (success) runOnJS(setPanelVisible)(true);
        })
        .onFinalize(() => {
            pressed.value = 0;
        }), [pressed]);

    const gesture = useMemo(() => Gesture.Exclusive(panGesture, tapGesture), [panGesture, tapGesture]);

    const bubbleStyle = useAnimatedStyle(() => ({
        left: x.value,
        top: y.value,
        transform: [{ scale: withSpring(pressed.value === 1 ? 0.94 : 1) }],
    }));

    const listMaxHeight = Math.min(520, windowH * 0.62);

    if (!hydrated || items.length === 0) return null;

    return (
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            <GestureDetector gesture={gesture}>
                <Animated.View
                    accessibilityRole="button"
                    accessibilityLabel={`稍后阅读，${items.length} 篇`}
                    style={[
                        {
                            position: 'absolute',
                            width: BUBBLE_SIZE,
                            height: BUBBLE_SIZE,
                            borderRadius: theme.radius.full,
                            backgroundColor: theme.colors.primary,
                            alignItems: 'center',
                            justifyContent: 'center',
                            shadowColor: '#000000',
                            shadowOpacity: 0.18,
                            shadowRadius: 16,
                            shadowOffset: { width: 0, height: 8 },
                            elevation: 9,
                            overflow: 'visible',
                            zIndex: 20,
                        },
                        bubbleStyle,
                    ]}
                >
                    <View style={{ width: BUBBLE_SIZE, height: BUBBLE_SIZE, borderRadius: theme.radius.full, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="bookmark-multiple-outline" size={28} color={theme.colors.onPrimary} />
                        <PressIndication pressed={pressed} color={theme.colors.onPrimary} radius={theme.radius.full} />
                    </View>
                    <View
                        style={{
                            position: 'absolute',
                            right: -2,
                            top: -4,
                            minWidth: 22,
                            height: 22,
                            paddingHorizontal: 6,
                            borderRadius: 11,
                            backgroundColor: theme.colors.error,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: 2,
                            borderColor: theme.colors.surface,
                        }}
                    >
                        <Text type="footnote2" weight="bold" color={theme.colors.onError}>
                            {items.length > 99 ? '99+' : items.length}
                        </Text>
                    </View>
                </Animated.View>
            </GestureDetector>

            <BottomSheet
                visible={panelVisible}
                title="稍后阅读"
                onClose={() => setPanelVisible(false)}
                endAction={(
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="清空稍后阅读"
                        onPress={clearItems}
                        hitSlop={8}
                        style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}
                    >
                        <Icon name="trash-can-outline" size={21} color={theme.colors.onSurfaceVariantActions} />
                    </Pressable>
                )}
            >
                <View style={{ paddingBottom: theme.spacing.lg }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.md }}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                            <Text type="body2" color={theme.colors.onSurfaceVariantSummary}>
                                像浏览器多页面一样暂存当前想读的回答和文章。
                            </Text>
                        </View>
                        <View
                            style={{
                                minHeight: 30,
                                paddingHorizontal: 10,
                                borderRadius: 15,
                                backgroundColor: theme.colors.secondaryVariant,
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginLeft: theme.spacing.md,
                            }}
                        >
                            <Text type="footnote1" color={theme.colors.onSecondaryVariant}>{items.length} 页</Text>
                        </View>
                    </View>
                    <Divider />
                    <FlatList
                        data={items}
                        keyExtractor={(item) => item.key}
                        style={{ maxHeight: listMaxHeight }}
                        contentContainerStyle={{ paddingTop: theme.spacing.sm, paddingBottom: theme.spacing.sm }}
                        showsVerticalScrollIndicator={false}
                        ItemSeparatorComponent={() => <View style={{ height: theme.spacing.xs }} />}
                        renderItem={({ item, index }) => (
                            <LaterReadPageRow
                                item={item}
                                pageNumber={index + 1}
                                onOpen={() => openItem(item)}
                                onRemove={() => removeItem(item.key)}
                            />
                        )}
                    />
                    <Button
                        type="default"
                        onPress={() => setPanelVisible(false)}
                        style={{ marginTop: theme.spacing.md, alignSelf: 'stretch' }}
                    >
                        收起小球
                    </Button>
                </View>
            </BottomSheet>
        </View>
    );
}

function LaterReadPageRow({ item, pageNumber, onOpen, onRemove }: {
    item: LaterReadItem;
    pageNumber: number;
    onOpen: () => void;
    onRemove: () => void;
}) {
    const theme = useTheme();
    const typeLabel = getTypeLabel(item.type);
    const summary = `${typeLabel} · ${item.authorName} · ${formatAddedAt(item.addedAt)}`;

    return (
        <View style={{ borderRadius: theme.radius.component, backgroundColor: theme.colors.surfaceContainer, overflow: 'hidden' }}>
            <ListRow
                title={item.title}
                summary={summary}
                summaryNumberOfLines={1}
                icon={(
                    <View
                        style={{
                            width: 38,
                            height: 38,
                            borderRadius: theme.radius.tab,
                            backgroundColor: theme.colors.tertiaryContainer,
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Text type="headline2" weight="bold" color={theme.colors.onTertiaryContainer}>{pageNumber}</Text>
                    </View>
                )}
                trailing={(
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="移除"
                            onPress={onRemove}
                            hitSlop={8}
                            style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginRight: theme.spacing.xs }}
                        >
                            <Icon name="close" size={20} color={theme.colors.onSurfaceVariantActions} />
                        </Pressable>
                        <Icon name="chevron-right" size={22} color={theme.colors.onSurfaceVariantActions} />
                    </View>
                )}
                onPress={onOpen}
                style={{ paddingHorizontal: theme.spacing.md }}
            />
            {item.summary ? (
                <Text
                    type="body2"
                    color={theme.colors.onSurfaceVariantSummary}
                    numberOfLines={2}
                    style={{ paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.md, marginTop: -theme.spacing.xs }}
                >
                    {item.summary}
                </Text>
            ) : null}
        </View>
    );
}

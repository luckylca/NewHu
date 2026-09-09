import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import {
    getLaterReadRuntimeStates,
    markLaterReadCompleted,
    type LaterReadTarget,
} from '@/src/db/repositories/laterReadRepository';
import { cacheBodyOnlyFromId } from '@/src/services/offlineCacheService';
import {
    useLaterReadStore,
    type LaterReadItem,
    type LaterReadSortMode,
} from '@/src/stores/useLaterReadStore';
import { notify } from '@/src/stores/useNotificationStore';
import { Button, Icon, TopAppBar } from '@/src/ui';
import { Text } from '@/src/ui/primitives';
import { useTheme } from '@/src/ui/theme';
import {
    formatLaterReadProgress,
    sortLaterReadItems,
    type LaterReadRuntimeStateMap,
} from '@/src/utils/laterRead';

const SORT_OPTIONS: { value: LaterReadSortMode; label: string }[] = [
    { value: 'added_desc', label: '最近加入' },
    { value: 'added_asc', label: '最早加入' },
    { value: 'unread_first', label: '未读优先' },
    { value: 'title', label: '标题' },
];

function toTarget(item: LaterReadItem): LaterReadTarget {
    return {
        key: item.key,
        contentId: item.id,
        contentType: item.type,
    };
}

export default function LaterReadManagementScreen() {
    const theme = useTheme();
    const items = useLaterReadStore((state) => state.items);
    const sortMode = useLaterReadStore((state) => state.sortMode);
    const setSortMode = useLaterReadStore((state) => state.setSortMode);
    const removeItems = useLaterReadStore((state) => state.removeItems);

    const [runtimeStates, setRuntimeStates] = useState<LaterReadRuntimeStateMap>({});
    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
    const [selectionMode, setSelectionMode] = useState(false);
    const [busy, setBusy] = useState(false);

    const refreshStates = useCallback(async () => {
        try {
            const next = await getLaterReadRuntimeStates(items.map(toTarget));
            setRuntimeStates(next);
        } catch (error) {
            console.warn('刷新稍后阅读状态失败', error);
        }
    }, [items]);

    useFocusEffect(useCallback(() => {
        void refreshStates();
    }, [refreshStates]));

    const sortedItems = useMemo(
        () => sortLaterReadItems(items, sortMode, runtimeStates),
        [items, runtimeStates, sortMode],
    );

    const selectedItems = useMemo(
        () => items.filter((item) => selectedKeys.has(item.key)),
        [items, selectedKeys],
    );

    const exitSelection = useCallback(() => {
        setSelectionMode(false);
        setSelectedKeys(new Set());
    }, []);

    const toggleSelection = useCallback((key: string) => {
        setSelectionMode(true);
        setSelectedKeys((current) => {
            const next = new Set(current);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }, []);

    const toggleSelectAll = useCallback(() => {
        setSelectionMode(true);
        setSelectedKeys((current) => (
            current.size === items.length
                ? new Set()
                : new Set(items.map((item) => item.key))
        ));
    }, [items]);

    const openItem = useCallback((item: LaterReadItem) => {
        router.push({
            pathname: '/item/[type]/[id]',
            params: {
                type: item.type,
                id: item.id,
                needToGet: 'true',
            },
        });
    }, []);

    const saveOffline = useCallback(async (targetItems: LaterReadItem[]) => {
        if (!targetItems.length || busy) return;
        setBusy(true);
        let success = 0;
        let failed = 0;
        try {
            const pending = targetItems.filter((item) => !runtimeStates[item.key]?.offline);
            if (!pending.length) {
                notify('所选内容已保存离线正文');
                return;
            }

            for (const item of pending) {
                try {
                    await cacheBodyOnlyFromId(item.id, item.type);
                    success += 1;
                } catch (error) {
                    failed += 1;
                    console.warn('稍后阅读离线正文保存失败', item.key, error);
                }
            }
            await refreshStates();
            if (failed) notify(`已保存 ${success} 篇，${failed} 篇失败`);
            else notify(`已保存 ${success} 篇离线正文`);
        } finally {
            setBusy(false);
        }
    }, [busy, refreshStates, runtimeStates]);

    const markCompleted = useCallback(async () => {
        if (!selectedItems.length || busy) return;
        setBusy(true);
        try {
            await markLaterReadCompleted(selectedItems.map(toTarget));
            await refreshStates();
            notify(`已将 ${selectedItems.length} 篇标为已读`);
            exitSelection();
        } catch (error) {
            console.error('批量标记已读失败', error);
            notify('标记已读失败，请稍后重试');
        } finally {
            setBusy(false);
        }
    }, [busy, exitSelection, refreshStates, selectedItems]);

    const removeSelected = useCallback(() => {
        if (!selectedItems.length || busy) return;
        removeItems(selectedItems.map((item) => item.key));
        notify(`已移除 ${selectedItems.length} 篇`);
        exitSelection();
    }, [busy, exitSelection, removeItems, selectedItems]);

    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
            <TopAppBar
                title="稍后阅读"
                subtitle={items.length > 0 ? `${items.length} 篇` : undefined}
                back={() => router.back()}
                actions={items.length > 0 ? (
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={selectionMode ? '退出批量管理' : '批量管理'}
                        onPress={() => {
                            if (selectionMode) exitSelection();
                            else setSelectionMode(true);
                        }}
                        hitSlop={8}
                        style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Icon
                            name={selectionMode ? 'close' : 'checkbox-multiple-marked-outline'}
                            size={22}
                            color={theme.colors.onBackground}
                        />
                    </Pressable>
                ) : null}
            />

            {items.length === 0 ? (
                <View style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: theme.spacing.xl,
                }}>
                    <Icon name="bookmark-multiple-outline" size={42} color={theme.colors.onSurfaceVariantActions} />
                    <Text type="title3" weight="medium" style={{ marginTop: theme.spacing.md }}>
                        暂无稍后阅读
                    </Text>
                    <Text
                        type="body2"
                        color={theme.colors.onSurfaceVariantSummary}
                        style={{ marginTop: theme.spacing.sm, textAlign: 'center' }}
                    >
                        在回答或文章详情页中选择“稍后阅读”，内容会出现在这里。
                    </Text>
                </View>
            ) : (
                <>
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={{
                            paddingHorizontal: theme.spacing.lg,
                            paddingBottom: selectionMode ? 112 : theme.spacing.xxl,
                        }}
                    >
                        <Text
                            type="footnote1"
                            color={theme.colors.onSurfaceVariantSummary}
                            style={{ marginTop: theme.spacing.sm, marginBottom: theme.spacing.sm }}
                        >
                            排序
                        </Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.lg }}
                        >
                            {SORT_OPTIONS.map((option) => {
                                const selected = sortMode === option.value;
                                return (
                                    <Pressable
                                        key={option.value}
                                        accessibilityRole="button"
                                        accessibilityState={{ selected }}
                                        onPress={() => setSortMode(option.value)}
                                        style={{
                                            minHeight: 36,
                                            paddingHorizontal: theme.spacing.md,
                                            borderRadius: theme.radius.full,
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            backgroundColor: selected
                                                ? theme.colors.primary
                                                : theme.colors.secondaryVariant,
                                        }}
                                    >
                                        <Text
                                            type="footnote1"
                                            weight={selected ? 'bold' : 'medium'}
                                            color={selected ? theme.colors.onPrimary : theme.colors.onSecondaryVariant}
                                        >
                                            {option.label}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </ScrollView>

                        {selectionMode ? (
                            <View style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                marginBottom: theme.spacing.md,
                            }}>
                                <Text type="body2" color={theme.colors.onSurfaceVariantSummary} style={{ flex: 1 }}>
                                    已选择 {selectedItems.length} / {items.length}
                                </Text>
                                <Pressable accessibilityRole="button" onPress={toggleSelectAll} hitSlop={8}>
                                    <Text type="button" color={theme.colors.primary}>
                                        {selectedItems.length === items.length ? '取消全选' : '全选'}
                                    </Text>
                                </Pressable>
                            </View>
                        ) : null}

                        <View style={{ gap: theme.spacing.sm }}>
                            {sortedItems.map((item) => {
                                const runtime = runtimeStates[item.key];
                                const selected = selectedKeys.has(item.key);
                                return (
                                    <LaterReadManagementRow
                                        key={item.key}
                                        item={item}
                                        runtime={runtime}
                                        selectionMode={selectionMode}
                                        selected={selected}
                                        busy={busy}
                                        onPress={() => {
                                            if (selectionMode) toggleSelection(item.key);
                                            else openItem(item);
                                        }}
                                        onToggleSelection={() => toggleSelection(item.key)}
                                        onSaveOffline={() => void saveOffline([item])}
                                    />
                                );
                            })}
                        </View>
                    </ScrollView>

                    {selectionMode ? (
                        <View style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            bottom: 0,
                            paddingHorizontal: theme.spacing.lg,
                            paddingTop: theme.spacing.sm,
                            paddingBottom: theme.spacing.lg,
                            backgroundColor: theme.colors.surface,
                            borderTopWidth: 1,
                            borderTopColor: theme.colors.dividerLine,
                        }}>
                            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                                <Button
                                    type="default"
                                    disabled={!selectedItems.length || busy}
                                    onPress={() => void markCompleted()}
                                    style={{ flex: 1 }}
                                >
                                    标为已读
                                </Button>
                                <Button
                                    type="default"
                                    disabled={!selectedItems.length || busy}
                                    onPress={() => void saveOffline(selectedItems)}
                                    style={{ flex: 1 }}
                                >
                                    离线正文
                                </Button>
                                <Button
                                    type="primary"
                                    disabled={!selectedItems.length || busy}
                                    onPress={removeSelected}
                                    style={{ flex: 1 }}
                                >
                                    移除
                                </Button>
                            </View>
                        </View>
                    ) : null}
                </>
            )}
        </View>
    );
}

function LaterReadManagementRow({
    item,
    runtime,
    selectionMode,
    selected,
    busy,
    onPress,
    onToggleSelection,
    onSaveOffline,
}: {
    item: LaterReadItem;
    runtime?: LaterReadRuntimeStateMap[string];
    selectionMode: boolean;
    selected: boolean;
    busy: boolean;
    onPress: () => void;
    onToggleSelection: () => void;
    onSaveOffline: () => void;
}) {
    const theme = useTheme();
    const typeLabel = item.type === 'answer' ? '回答' : '文章';

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={item.title}
            accessibilityState={selectionMode ? { selected } : undefined}
            onPress={onPress}
            style={{
                borderRadius: theme.radius.component,
                backgroundColor: selected
                    ? theme.colors.primaryContainer
                    : theme.colors.surfaceContainer,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.md,
            }}
        >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                {selectionMode ? (
                    <Pressable
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: selected }}
                        onPress={(event) => {
                            event.stopPropagation();
                            onToggleSelection();
                        }}
                        hitSlop={8}
                        style={{
                            width: 34,
                            height: 34,
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: theme.spacing.sm,
                        }}
                    >
                        <Icon
                            name={selected ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                            size={23}
                            color={selected ? theme.colors.primary : theme.colors.onSurfaceVariantActions}
                        />
                    </Pressable>
                ) : null}

                <View style={{ flex: 1, minWidth: 0 }}>
                    <Text type="headline1" weight="medium" numberOfLines={2}>
                        {item.title}
                    </Text>
                    <Text
                        type="body2"
                        color={theme.colors.onSurfaceVariantSummary}
                        numberOfLines={1}
                        style={{ marginTop: 3 }}
                    >
                        {typeLabel} · {item.authorName}
                    </Text>
                    <View style={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        gap: theme.spacing.xs,
                        marginTop: theme.spacing.sm,
                    }}>
                        <StatusBadge label={formatLaterReadProgress(runtime)} />
                        {runtime?.offline ? <StatusBadge label="已离线" emphasized /> : null}
                    </View>
                </View>

                {!selectionMode ? (
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={runtime?.offline ? '已保存离线正文' : '保存离线正文'}
                        disabled={busy || runtime?.offline}
                        onPress={(event) => {
                            event.stopPropagation();
                            onSaveOffline();
                        }}
                        hitSlop={8}
                        style={{
                            minWidth: 40,
                            height: 40,
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginLeft: theme.spacing.sm,
                            opacity: busy ? 0.45 : 1,
                        }}
                    >
                        <Icon
                            name={runtime?.offline ? 'check-circle-outline' : 'download-outline'}
                            size={22}
                            color={runtime?.offline ? theme.colors.primary : theme.colors.onSurfaceVariantActions}
                        />
                    </Pressable>
                ) : null}
            </View>

            {item.summary ? (
                <Text
                    type="body2"
                    color={theme.colors.onSurfaceVariantSummary}
                    numberOfLines={2}
                    style={{ marginTop: theme.spacing.sm, lineHeight: 20 }}
                >
                    {item.summary}
                </Text>
            ) : null}
        </Pressable>
    );
}

function StatusBadge({ label, emphasized = false }: { label: string; emphasized?: boolean }) {
    const theme = useTheme();
    return (
        <View style={{
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: theme.radius.full,
            backgroundColor: emphasized
                ? theme.colors.primaryContainer
                : theme.colors.secondaryVariant,
        }}>
            <Text
                type="footnote2"
                weight="medium"
                color={emphasized
                    ? theme.colors.onPrimaryContainer
                    : theme.colors.onSecondaryVariant}
            >
                {label}
            </Text>
        </View>
    );
}

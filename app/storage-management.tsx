import StorageDonut from '@/src/components/StorageDonut';
import type { StorageSegment } from '@/src/components/StorageDonut';
import { listOfflineCacheItems, getCacheSummary } from '@/src/db/repositories/offlineCacheRepository';
import type { OfflineCacheListItem } from '@/src/db/repositories/offlineCacheRepository';
import { cleanupTransientCache } from '@/src/services/cacheCleanupService';
import { removeCachedContents } from '@/src/services/offlineCacheService';
import {
    getProductV1RuntimeStorageStatus,
    removeProductV1RuntimeAssets,
    resetProductV1Runtime,
} from '@/src/product-v1';
import { notify } from '@/src/stores/useNotificationStore';
import { Button, Card, Dialog, Divider, Icon, TopAppBar } from '@/src/ui';
import { Text } from '@/src/ui/primitives';
import type { IconName } from '@/src/ui/primitives';
import { useTheme } from '@/src/ui/theme';
import { storageManage } from '@/src/ui/motion';
import { router } from 'expo-router';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, InteractionManager, Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

type CacheSummary = Awaited<ReturnType<typeof getCacheSummary>>;
type RuntimeAssetStatus = ReturnType<typeof getProductV1RuntimeStorageStatus>;

const EMPTY_SUMMARY: CacheSummary = {
    transientBytes: 0,
    pinnedBytes: 0,
    modelBytes: 0,
    readingBytes: 0,
    managedBytes: 0,
    commentCount: 0,
    outboxCount: 0,
    pinnedCount: 0,
    modelCount: 0,
    readingCount: 0,
};

const EMPTY_RUNTIME_ASSETS: RuntimeAssetStatus = { bytes: 0, fileCount: 0, installed: false };

function formatBytes(bytes: number) {
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
    return `${Math.max(0, Math.round(bytes))} B`;
}

export default function StorageManagementScreen() {
    const theme = useTheme();
    const [items, setItems] = useState<OfflineCacheListItem[]>([]);
    const [summary, setSummary] = useState<CacheSummary>(EMPTY_SUMMARY);
    const [runtimeAssets, setRuntimeAssets] = useState<RuntimeAssetStatus>(EMPTY_RUNTIME_ASSETS);
    const [loading, setLoading] = useState(true);
    const [cleaning, setCleaning] = useState(false);
    const [managing, setManaging] = useState(false);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [confirmVisible, setConfirmVisible] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [runtimeDeleteVisible, setRuntimeDeleteVisible] = useState(false);
    const [runtimeDeleteArmed, setRuntimeDeleteArmed] = useState(false);
    const [runtimeDeleting, setRuntimeDeleting] = useState(false);
    const manageProgress = useSharedValue(0);

    const reload = useCallback(async () => {
        try {
            const [nextItems, nextSummary] = await Promise.all([
                listOfflineCacheItems(),
                getCacheSummary(),
            ]);
            setItems(nextItems);
            setSummary(nextSummary);
            setRuntimeAssets(getProductV1RuntimeStorageStatus());
            setSelected((current) => {
                const available = new Set(nextItems.map((item) => `${item.contentType}:${item.contentId}`));
                return new Set([...current].filter((key) => available.has(key)));
            });
        } catch (error) {
            notify(error instanceof Error ? error.message : '存储信息读取失败，请稍后重试');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // Database result delivery during the native screen transition makes
        // the transition and the first list layout compete for the UI thread.
        const task = InteractionManager.runAfterInteractions(() => void reload());
        return () => task.cancel();
    }, [reload]);

    useEffect(() => {
        manageProgress.value = withSpring(managing ? 1 : 0, storageManage);
    }, [manageProgress, managing]);

    useEffect(() => {
        if (!runtimeDeleteVisible) {
            setRuntimeDeleteArmed(false);
            return;
        }
        const timer = setTimeout(() => setRuntimeDeleteArmed(true), 350);
        return () => clearTimeout(timer);
    }, [runtimeDeleteVisible]);

    const selectionHeaderStyle = useAnimatedStyle(() => ({
        opacity: manageProgress.value,
        transform: [{ translateX: (1 - manageProgress.value) * 12 }],
    }));
    const actionBarStyle = useAnimatedStyle(() => ({
        opacity: manageProgress.value,
        transform: [{ translateY: (1 - manageProgress.value) * 110 }],
    }));

    const allSelected = items.length > 0 && selected.size === items.length;
    const selectedBytes = useMemo(() => items.reduce((sum, item) => (
        selected.has(`${item.contentType}:${item.contentId}`) ? sum + item.bytes : sum
    ), 0), [items, selected]);

    const itemByKey = useMemo(() => new Map(
        items.map((item) => [`${item.contentType}:${item.contentId}`, item]),
    ), [items]);

    const clean = useCallback(async () => {
        if (cleaning || summary.transientBytes <= 0) return;
        setCleaning(true);
        try {
            const result = await cleanupTransientCache(0);
            await reload();
            notify(result.deletedBytes > 0 ? `已释放 ${formatBytes(result.deletedBytes)}` : '临时缓存已清理');
        } finally {
            setCleaning(false);
        }
    }, [cleaning, reload, summary.transientBytes]);

    const toggleManage = useCallback(() => {
        setManaging((current) => !current);
        setSelected(new Set());
    }, []);

    const toggleItem = (item: OfflineCacheListItem) => {
        const key = `${item.contentType}:${item.contentId}`;
        setSelected((current) => {
            const next = new Set(current);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    };

    const handleItemPress = useCallback((key: string) => {
        const item = itemByKey.get(key);
        if (!item) return;
        if (managing) toggleItem(item);
        else router.push({ pathname: '/item/[type]/[id]', params: { type: item.contentType, id: item.contentId } });
    }, [itemByKey, managing]);

    const toggleAll = useCallback(() => {
        setSelected(allSelected ? new Set() : new Set(items.map((item) => `${item.contentType}:${item.contentId}`)));
    }, [allSelected, items]);

    const removeSelected = async () => {
        if (deleting || selected.size === 0) return;
        setDeleting(true);
        try {
            const targets = items
                .filter((item) => selected.has(`${item.contentType}:${item.contentId}`))
                .map((item) => ({ contentId: item.contentId, contentType: item.contentType }));
            await removeCachedContents(targets);
            setConfirmVisible(false);
            setSelected(new Set());
            if (targets.length === items.length) setManaging(false);
            await reload();
            notify(`已删除 ${targets.length} 篇离线缓存`);
        } catch (error) {
            notify(error instanceof Error ? error.message : '删除失败，请稍后重试');
        } finally {
            setDeleting(false);
        }
    };

    const removeRuntimeAssets = async () => {
        if (runtimeDeleting || runtimeAssets.bytes <= 0) return;
        setRuntimeDeleting(true);
        try {
            resetProductV1Runtime();
            const deletedBytes = removeProductV1RuntimeAssets();
            setRuntimeDeleteVisible(false);
            await reload();
            notify(`已释放 ${formatBytes(deletedBytes)}，推荐资源可随时重新下载`);
        } catch (error) {
            notify(error instanceof Error ? error.message : '推荐资源删除失败');
        } finally {
            setRuntimeDeleting(false);
        }
    };

    const segments = useMemo(() => [
        { value: summary.transientBytes, color: '#FFB340' },
        { value: summary.pinnedBytes, color: theme.colors.primary },
        { value: summary.modelBytes + runtimeAssets.bytes, color: '#9A6CFF' },
        { value: summary.readingBytes, color: '#35B67A' },
    ], [runtimeAssets.bytes, summary.modelBytes, summary.pinnedBytes, summary.readingBytes, summary.transientBytes, theme.colors.primary]);

    const listHeader = useMemo(() => (
        <>
            <StorageOverview
                summary={summary}
                runtimeAssets={runtimeAssets}
                segments={segments}
                cleaning={cleaning}
                runtimeDeleting={runtimeDeleting}
                onClean={clean}
                onRemoveRuntimeAssets={() => setRuntimeDeleteVisible(true)}
            />

            <View style={{ marginTop: theme.spacing.xl, marginBottom: theme.spacing.sm, flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                    <Text type="headline2" weight="bold">离线缓存</Text>
                    <Text type="body2" color={theme.colors.onSurfaceVariantSummary} style={{ marginTop: 2 }}>
                        {loading ? '正在统计…' : `${items.length} 篇 · ${formatBytes(summary.pinnedBytes)}`}
                    </Text>
                </View>
                <Animated.View pointerEvents={managing ? 'auto' : 'none'} style={selectionHeaderStyle}>
                    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: allSelected }} onPress={toggleAll} hitSlop={10}>
                        <Text type="headline1" color={theme.colors.primary}>{allSelected ? '取消全选' : '全选'}</Text>
                    </Pressable>
                </Animated.View>
            </View>
        </>
    ), [allSelected, clean, cleaning, items.length, loading, managing, runtimeAssets, runtimeDeleting, segments, selectionHeaderStyle, summary, theme, toggleAll]);

    const renderItem = useCallback(({ item, index }: { item: OfflineCacheListItem; index: number }) => {
        const key = `${item.contentType}:${item.contentId}`;
        return (
            <OfflineItemRow
                item={item}
                checked={selected.has(key)}
                managing={managing}
                first={index === 0}
                last={index === items.length - 1}
                onPress={handleItemPress}
            />
        );
    }, [handleItemPress, items.length, managing, selected]);

    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <TopAppBar
                title="存储管理"
                back={() => router.back()}
                actions={items.length > 0 ? (
                    <Pressable accessibilityRole="button" onPress={toggleManage} hitSlop={10}>
                        <Text type="headline1" color={theme.colors.primary}>{managing ? '完成' : '管理'}</Text>
                    </Pressable>
                ) : null}
            />
            <FlatList
                data={items}
                keyExtractor={(item) => `${item.contentType}:${item.contentId}`}
                renderItem={renderItem}
                ItemSeparatorComponent={OfflineItemSeparator}
                ListHeaderComponent={listHeader}
                ListEmptyComponent={!loading ? (
                    <View style={{ paddingVertical: 42, alignItems: 'center' }}>
                        <Icon name="download-off-outline" size={34} color={theme.colors.onSurfaceVariantActions} />
                        <Text type="headline1" weight="medium" style={{ marginTop: theme.spacing.sm }}>还没有离线缓存</Text>
                        <Text type="body2" color={theme.colors.onSurfaceVariantSummary} style={{ marginTop: 4 }}>可在“离线缓存”页面批量下载</Text>
                    </View>
                ) : null}
                ListFooterComponent={<View style={{ height: theme.spacing.xl }} />}
                initialNumToRender={6}
                maxToRenderPerBatch={4}
                updateCellsBatchingPeriod={48}
                windowSize={3}
                removeClippedSubviews
                contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 122 }}
                showsVerticalScrollIndicator={false}
                style={{ flex: 1 }}
            />

            <Animated.View
                pointerEvents={managing ? 'auto' : 'none'}
                style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: theme.spacing.lg, paddingBottom: theme.spacing.xl, backgroundColor: theme.colors.background, borderTopWidth: 1, borderTopColor: theme.colors.dividerLine }, actionBarStyle]}
            >
                    <Button type="primary" disabled={selected.size === 0 || deleting} onPress={() => setConfirmVisible(true)}>
                        {selected.size > 0 ? `删除 ${selected.size} 篇 · ${formatBytes(selectedBytes)}` : '选择要删除的内容'}
                    </Button>
            </Animated.View>

            <Dialog
                visible={confirmVisible}
                title={`删除 ${selected.size} 篇离线缓存？`}
                summary={`将释放约 ${formatBytes(selectedBytes)}，离线后将无法阅读这些内容。推荐历史不会被删除。`}
                closeOnClickModal={!deleting}
                onClose={() => { if (!deleting) setConfirmVisible(false); }}
            >
                <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                    <Button type="default" disabled={deleting} onPress={() => setConfirmVisible(false)} style={{ flex: 1 }}>取消</Button>
                    <Button type="primary" disabled={deleting} onPress={() => void removeSelected()} style={{ flex: 1 }}>
                        {deleting ? '删除中…' : '删除'}
                    </Button>
                </View>
            </Dialog>

            <Dialog
                visible={runtimeDeleteVisible}
                title="删除在线推荐资源？"
                summary={`将释放 ${formatBytes(runtimeAssets.bytes)}。用户画像、reward、浏览记录和离线内容都会保留；再次使用本地推荐时可重新下载。`}
                closeOnClickModal={!runtimeDeleting}
                onClose={() => { if (!runtimeDeleting) setRuntimeDeleteVisible(false); }}
            >
                <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                    <Button type="default" disabled={runtimeDeleting} onPress={() => setRuntimeDeleteVisible(false)} style={{ flex: 1 }}>取消</Button>
                    <Button type="primary" disabled={runtimeDeleting || !runtimeDeleteArmed} onPress={() => void removeRuntimeAssets()} style={{ flex: 1 }}>
                        {runtimeDeleting ? '删除中…' : '删除资源'}
                    </Button>
                </View>
            </Dialog>
        </View>
    );
}

const StorageOverview = memo(function StorageOverview({ summary, runtimeAssets, segments, cleaning, runtimeDeleting, onClean, onRemoveRuntimeAssets }: {
    summary: CacheSummary;
    runtimeAssets: RuntimeAssetStatus;
    segments: StorageSegment[];
    cleaning: boolean;
    runtimeDeleting: boolean;
    onClean: () => void;
    onRemoveRuntimeAssets: () => void;
}) {
    const theme = useTheme();
    const modelBytes = summary.modelBytes + runtimeAssets.bytes;
    const modelSummary = runtimeAssets.bytes > 0
        ? `${runtimeAssets.installed ? '在线资源完整' : '在线资源不完整'} · ${runtimeAssets.fileCount} 个文件 · ${summary.modelCount} 条内容向量`
        : summary.modelCount > 0 ? `${summary.modelCount} 条内容向量` : '暂无本地推荐数据';
    return (
        <Card feedback="none" contentStyle={{ padding: theme.spacing.lg }}>
            <View style={{ alignItems: 'center' }}>
                <StorageDonut segments={segments} totalText={formatBytes(summary.managedBytes + runtimeAssets.bytes)} />
                <Text type="body2" color={theme.colors.onSurfaceVariantSummary} style={{ marginTop: theme.spacing.sm }}>
                    NewHU 在本机管理的数据
                </Text>
            </View>
            <View style={{ marginTop: theme.spacing.lg }}>
                <StorageTypeRow
                    icon="clock-outline"
                    color="#FFB340"
                    title="临时缓存"
                    summary="正文、评论和临时图片"
                    value={formatBytes(summary.transientBytes)}
                    action={summary.transientBytes > 0 ? (cleaning ? '清理中' : '清理') : undefined}
                    onAction={onClean}
                />
                <Divider style={{ marginLeft: 48 }} />
                <StorageTypeRow icon="download-circle-outline" color={theme.colors.primary} title="离线缓存" summary={`${summary.pinnedCount} 篇内容`} value={formatBytes(summary.pinnedBytes)} />
                <Divider style={{ marginLeft: 48 }} />
                <StorageTypeRow
                    icon="cube-outline"
                    color="#9A6CFF"
                    title="推荐数据"
                    summary={modelSummary}
                    value={formatBytes(modelBytes)}
                    action={runtimeAssets.bytes > 0 ? (runtimeDeleting ? '删除中' : '删除资源') : undefined}
                    onAction={onRemoveRuntimeAssets}
                />
                <Divider style={{ marginLeft: 48 }} />
                <StorageTypeRow icon="chart-box-outline" color="#35B67A" title="阅读统计" summary={`${summary.readingCount} 条阅读记录`} value={formatBytes(summary.readingBytes)} />
            </View>
        </Card>
    );
});

const StorageTypeRow = memo(function StorageTypeRow({ icon, color, title, summary, value, action, onAction }: {
    icon: IconName;
    color: string;
    title: string;
    summary: string;
    value: string;
    action?: string;
    onAction?: () => void;
}) {
    const theme = useTheme();
    return (
        <View style={{ minHeight: 66, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: `${color}1F`, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={icon} size={21} color={color} />
            </View>
            <View style={{ flex: 1, minWidth: 0, marginLeft: theme.spacing.md }}>
                <Text type="headline1" weight="medium">{title}</Text>
                <Text type="body2" color={theme.colors.onSurfaceVariantSummary} numberOfLines={1}>{summary}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', marginLeft: theme.spacing.sm }}>
                <Text type="headline1" weight="medium">{value}</Text>
                {action ? (
                    <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}>
                        <Text type="body2" color={theme.colors.primary}>{action}</Text>
                    </Pressable>
                ) : null}
            </View>
        </View>
    );
});

const OfflineItemRow = memo(function OfflineItemRow({ item, checked, managing, first, last, onPress }: {
    item: OfflineCacheListItem;
    checked: boolean;
    managing: boolean;
    first: boolean;
    last: boolean;
    onPress: (key: string) => void;
}) {
    const theme = useTheme();
    const commentText = item.rootCommentMode === 'none' ? '无评论' : `${item.commentCount} 条评论`;
    const key = `${item.contentType}:${item.contentId}`;
    return (
        <View style={{
            backgroundColor: theme.colors.surfaceContainer,
            borderTopLeftRadius: first ? theme.radius.component : 0,
            borderTopRightRadius: first ? theme.radius.component : 0,
            borderBottomLeftRadius: last ? theme.radius.component : 0,
            borderBottomRightRadius: last ? theme.radius.component : 0,
            overflow: first || last ? 'hidden' : 'visible',
        }}>
            <Pressable
                accessibilityRole={managing ? 'checkbox' : 'button'}
                accessibilityState={managing ? { checked } : undefined}
                onPress={() => onPress(key)}
                style={({ pressed }) => ({
                    minHeight: 82,
                    paddingHorizontal: theme.spacing.lg,
                    paddingVertical: theme.spacing.md,
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: pressed ? theme.colors.secondaryVariant : 'transparent',
                })}
            >
                <View style={{ flex: 1, minWidth: 0 }}>
                    <Text type="headline1" weight="medium" numberOfLines={2}>{item.title}</Text>
                    <Text type="body2" color={theme.colors.onSurfaceVariantSummary} numberOfLines={1} style={{ marginTop: 4 }}>
                        {item.contentType === 'answer' ? '回答' : '文章'} · {formatBytes(item.bytes)} · {commentText}{item.withImages ? ' · 含图片' : ''}
                    </Text>
                </View>
                <View style={{ width: 30, marginLeft: theme.spacing.sm, alignItems: 'center' }}>
                    {managing
                        ? <SelectionCircle checked={checked} />
                        : <Icon name="chevron-right" size={22} color={theme.colors.onSurfaceVariantActions} />}
                </View>
            </Pressable>
            {!last ? <Divider style={{ marginLeft: 18 }} /> : null}
        </View>
    );
}, (previous, next) => (
    previous.item === next.item
    && previous.checked === next.checked
    && previous.managing === next.managing
    && previous.first === next.first
    && previous.last === next.last
    && previous.onPress === next.onPress
));

function OfflineItemSeparator() {
    return null;
}

function SelectionCircle({ checked }: { checked: boolean }) {
    const theme = useTheme();
    return (
        <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: checked ? 0 : 2, borderColor: theme.colors.outline, backgroundColor: checked ? theme.colors.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            {checked ? <Icon name="check" size={17} color={theme.colors.onPrimary} /> : null}
        </View>
    );
}

import NumberWheel from '@/src/components/NumberWheel';
import ProgressIndicator from '@/src/components/ProgressIndicator';
import { getCacheSummary, listOfflineCacheItems } from '@/src/db/repositories/offlineCacheRepository';
import type { OfflineCacheListItem } from '@/src/db/repositories/offlineCacheRepository';
import { isOfflineCacheBatchRunning, startOfflineCacheBatch, useOfflineCacheBatchStore } from '@/src/services/offlineCacheBatchService';
import { notify } from '@/src/stores/useNotificationStore';
import { useNetworkStore } from '@/src/stores/useNetworkStore';
import { useSettingStore } from '@/src/stores/useSettingStore';
import { useUserStore } from '@/src/stores/useUserStore';
import { Button, BottomSheet, Card, Divider, ListRow, PageFlatList, PageScaffold, Switch, TopAppBar } from '@/src/ui';
import { Text } from '@/src/ui/primitives';
import { useTheme } from '@/src/ui/theme';
import {
    ensureOfflineCacheNotificationPermission,
    startOfflineCacheForeground,
    stopOfflineCacheForeground,
} from 'expo-download-storage';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, View } from 'react-native';

const MAX_CACHE_COUNT = 100;

function formatBytes(bytes: number) {
    return bytes >= 1024 * 1024
        ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
        : `${Math.round(bytes / 1024)} KB`;
}

function formatSpeed(bytesPerSecond: number) {
    if (bytesPerSecond <= 0) return '测速中…';
    return bytesPerSecond >= 1024 * 1024
        ? `${(bytesPerSecond / 1024 / 1024).toFixed(1)} MB/s`
        : `${Math.max(1, Math.round(bytesPerSecond / 1024))} KB/s`;
}

export default function OfflineCacheScreen() {
    const theme = useTheme();
    const networkStatus = useNetworkStore((state) => state.status);
    const cookies = useUserStore((state) => state.cookies);
    const filterAds = useSettingStore((state) => state.isAds);
    const filterPaid = useSettingStore((state) => state.isPaid);
    const deduplicateFeed = useSettingStore((state) => state.deduplicateFeed);
    const batch = useOfflineCacheBatchStore();
    const [cacheCount, setCacheCount] = useState(0);
    const [withImages, setWithImages] = useState(true);
    const [pickerVisible, setPickerVisible] = useState(false);
    const [items, setItems] = useState<OfflineCacheListItem[]>([]);
    const [summary, setSummary] = useState({ pinnedCount: 0, pinnedBytes: 0 });
    const [loading, setLoading] = useState(true);
    const [startPending, setStartPending] = useState(false);
    const startPendingRef = useRef(false);

    const refreshPageData = useCallback(async () => {
        try {
            const [nextItems, nextSummary] = await Promise.all([listOfflineCacheItems(), getCacheSummary()]);
            setItems(nextItems);
            setSummary({ pinnedCount: nextSummary.pinnedCount, pinnedBytes: nextSummary.pinnedBytes });
        } catch (error) {
            console.warn('[OfflineCache] unable to refresh cached content list', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void refreshPageData();
    }, [refreshPageData]);

    useEffect(() => {
        if (batch.done > 0 || batch.phase === 'finished') void refreshPageData();
    }, [batch.done, batch.phase, refreshPageData]);

    const openPicker = () => {
        if (batch.phase === 'fetching' || batch.phase === 'caching' || startPending) return;
        if (networkStatus !== 'online') {
            notify('当前无网络，无法请求推荐流');
            return;
        }
        setCacheCount(0);
        setPickerVisible(true);
    };

    const startCaching = async () => {
        if (startPendingRef.current || isOfflineCacheBatchRunning() || cacheCount === 0) return;
        startPendingRef.current = true;
        setStartPending(true);
        let foregroundStarted = false;
        try {
            const granted = await ensureOfflineCacheNotificationPermission();
            if (!granted) {
                notify({
                    message: '系统通知未开启，无法显示后台缓存进度。请到 NewHu 的通知设置中开启通知。',
                    duration: 5_000,
                    actionLabel: '打开设置',
                    onAction: () => { void Linking.openSettings(); },
                });
                return;
            }

            startOfflineCacheForeground(cacheCount);
            foregroundStarted = true;
            const started = startOfflineCacheBatch({
                count: cacheCount,
                cookie: cookies,
                filterAds,
                filterPaid,
                deduplicate: deduplicateFeed,
                withImages,
            });
            if (!started) {
                stopOfflineCacheForeground();
                foregroundStarted = false;
                notify('已有离线缓存任务正在运行');
                return;
            }
            foregroundStarted = false;
            setPickerVisible(false);
        } catch (error) {
            if (foregroundStarted) {
                try { stopOfflineCacheForeground(); } catch { /* the service may not have started */ }
            }
            console.error('[OfflineCache] failed to start background task', error);
            notify(error instanceof Error ? `无法启动后台缓存：${error.message}` : '无法启动后台缓存，请检查通知权限');
        } finally {
            startPendingRef.current = false;
            setStartPending(false);
        }
    };

    const caching = batch.phase === 'fetching' || batch.phase === 'caching';
    const progressText = batch.phase === 'fetching'
        ? `正在请求推荐流 · 已找到 ${batch.fetched}/${batch.total} 篇 · ${formatSpeed(batch.speedBytesPerSecond)}`
        : batch.phase === 'caching'
            ? `${batch.done}/${batch.total} · 成功 ${batch.success} · 失败 ${batch.failed} · ${formatSpeed(batch.speedBytesPerSecond)}`
            : batch.phase === 'finished'
                ? `${batch.done}/${batch.total} · 成功 ${batch.success} · 失败 ${batch.failed}`
                : '等待开始缓存';

    const listHeader = (
        <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
            <Card feedback="none" contentStyle={{ padding: theme.spacing.lg }}>
                <Text type="headline2" weight="bold">批量缓存内容</Text>
                <Text type="body2" color={theme.colors.onSurfaceVariantSummary} style={{ marginTop: 6 }}>
                    已缓存 {summary.pinnedCount} 篇 · 占用约 {formatBytes(summary.pinnedBytes)}
                </Text>
                <ListRow
                    title="缓存图片"
                    summary="正文图片、评论图片和作者头像"
                    onPress={() => setWithImages((current) => !current)}
                    trailing={<Switch value={withImages} interactive={false} />}
                    style={{ marginHorizontal: -theme.spacing.md, marginTop: theme.spacing.md }}
                />
                <Text type="footnote1" color={theme.colors.onSurfaceVariantSummary} style={{ marginTop: theme.spacing.sm }}>
                    请求按顺序执行，至少间隔 1.5 秒；遇到知乎限流或验证会自动暂停。开始后可离开本页，通知会显示后台进度。
                </Text>
                <Button type="primary" onPress={openPicker} disabled={caching || startPending} style={{ marginTop: theme.spacing.md }}>
                    {caching ? '后台缓存进行中' : '开始缓存'}
                </Button>
            </Card>

            {batch.phase !== 'idle' ? (
                <Card feedback="none" contentStyle={{ padding: theme.spacing.lg }}>
                    <Text type="headline2" weight="bold">
                        {batch.phase === 'fetching' ? '正在获取内容' : batch.phase === 'caching' ? '后台缓存中' : '最近一次缓存'}
                    </Text>
                    <ProgressIndicator progress={batch.overall} />
                    <Text type="body2" color={theme.colors.onSurfaceVariantSummary} style={{ marginTop: theme.spacing.sm }}>
                        {progressText}
                    </Text>
                    {batch.currentTitle && caching ? (
                        <Text type="footnote1" color={theme.colors.onSurfaceVariantSummary} style={{ marginTop: 4 }} numberOfLines={1}>
                            当前：{batch.currentTitle}
                        </Text>
                    ) : null}
                    {batch.message ? (
                        <Text type="footnote1" color={theme.colors.onSurfaceVariantSummary} style={{ marginTop: 4 }}>
                            {batch.message}
                        </Text>
                    ) : null}
                </Card>
            ) : null}

            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing.sm }}>
                <Text type="headline2" weight="bold">已缓存内容</Text>
                <Text type="body2" color={theme.colors.onSurfaceVariantSummary}>
                    {loading ? '正在读取…' : `${items.length} 篇`}
                </Text>
            </View>
        </View>
    );

    const renderItem = ({ item, index }: { item: OfflineCacheListItem; index: number }) => (
        <Card feedback="none" contentStyle={{ overflow: 'hidden' }}>
            <ListRow
                title={item.title}
                summary={`${item.contentType === 'answer' ? '回答' : '文章'}${item.authorName ? ` · ${item.authorName}` : ''} · ${item.commentCount} 条评论 · ${formatBytes(item.bytes)}`}
                summaryNumberOfLines={2}
                onPress={() => router.push({ pathname: '/item/[type]/[id]', params: { type: item.contentType, id: item.contentId } })}
            />
            {index < items.length - 1 ? <Divider style={{ marginLeft: theme.spacing.lg }} /> : null}
        </Card>
    );

    return (
        <PageScaffold topBar={<TopAppBar title="离线缓存" back={() => router.back()} />}>
            <PageFlatList
                data={items}
                keyExtractor={(item) => `${item.contentType}:${item.contentId}`}
                renderItem={renderItem}
                ListHeaderComponent={listHeader}
                ListEmptyComponent={!loading ? (
                    <Card feedback="none" contentStyle={{ padding: theme.spacing.xl, alignItems: 'center' }}>
                        <Text type="headline1" weight="medium">还没有缓存内容</Text>
                        <Text type="body2" color={theme.colors.onSurfaceVariantSummary} style={{ marginTop: theme.spacing.xs }}>
                            开始缓存后，文章和评论会显示在这里
                        </Text>
                    </Card>
                ) : null}
                ItemSeparatorComponent={() => <View style={{ height: theme.spacing.sm }} />}
                ListFooterComponent={<View style={{ height: theme.spacing.xl }} />}
                initialNumToRender={8}
                maxToRenderPerBatch={6}
                updateCellsBatchingPeriod={48}
                windowSize={5}
                removeClippedSubviews
                contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}
                showsVerticalScrollIndicator={false}
            />

            <BottomSheet
                visible={pickerVisible}
                title="批量缓存"
                allowDismiss
                onClose={() => setPickerVisible(false)}
            >
                <Card feedback="none" contentStyle={{ paddingBottom: theme.spacing.lg }}>
                    <Text type="headline1" weight="medium" align="center">选择缓存数量</Text>
                    <NumberWheel value={cacheCount} max={MAX_CACHE_COUNT} step={5} onChange={setCacheCount} />
                    <Text type="body2" color={theme.colors.onSurfaceVariantSummary} align="center">
                        预估磁盘占用：约 {(cacheCount * (withImages ? 1.5 : 0.6)).toFixed(1)} MB
                    </Text>
                    <Button
                        type="primary"
                        onPress={() => void startCaching()}
                        disabled={startPending || cacheCount === 0}
                        style={{ marginTop: theme.spacing.lg }}
                    >
                        {startPending ? '正在启动…' : `开始后台缓存 ${cacheCount} 篇`}
                    </Button>
                </Card>
            </BottomSheet>
        </PageScaffold>
    );
}

import MiuixNumberWheel from '@/src/components/MiuixNumberWheel';
import MiuixProgressIndicator from '@/src/components/MiuixProgressIndicator';
import { getApiInstance } from '@/src/api/ZhihuApi';
import { getCacheSummary } from '@/src/db/repositories/offlineCacheRepository';
import { cacheContentFromId } from '@/src/services/offlineCacheService';
import { fetchRecommendBatch } from '@/src/services/recommendFeedService';
import { notify } from '@/src/stores/useNotificationStore';
import { useNetworkStore } from '@/src/stores/useNetworkStore';
import { useSettingStore } from '@/src/stores/useSettingStore';
import { useUserStore } from '@/src/stores/useUserStore';
import { Button, BottomSheet, Card, ListRow, Switch, TopAppBar } from '@/src/ui';
import { Text } from '@/src/ui/primitives';
import { useTheme } from '@/src/ui/theme';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

const MAX_CACHE_COUNT = 100;
const FETCH_PROGRESS_WEIGHT = 0.15;
const CONTENT_CACHE_CONCURRENCY = 8;

type BatchPhase = 'idle' | 'fetching' | 'caching' | 'finished';

type BatchProgress = {
    phase: BatchPhase;
    fetched: number;
    done: number;
    total: number;
    success: number;
    failed: number;
    current: number;
    overall: number;
    speedBytesPerSecond: number;
};

const initialProgress: BatchProgress = {
    phase: 'idle',
    fetched: 0,
    done: 0,
    total: 0,
    success: 0,
    failed: 0,
    current: 0,
    overall: 0,
    speedBytesPerSecond: 0,
};

export default function OfflineCacheScreen() {
    const theme = useTheme();
    const networkStatus = useNetworkStore((state) => state.status);
    const cookies = useUserStore((state) => state.cookies);
    const filterAds = useSettingStore((state) => state.isAds);
    const filterPaid = useSettingStore((state) => state.isPaid);
    const deduplicateFeed = useSettingStore((state) => state.deduplicateFeed);
    const [cacheCount, setCacheCount] = useState(0);
    const [withImages, setWithImages] = useState(true);
    const [pickerVisible, setPickerVisible] = useState(false);
    const [caching, setCaching] = useState(false);
    const [progress, setProgress] = useState<BatchProgress>(initialProgress);
    const [summary, setSummary] = useState({ pinnedCount: 0, pinnedBytes: 0 });

    const refreshSummary = useCallback(async () => {
        const cacheSummary = await getCacheSummary();
        setSummary({ pinnedCount: cacheSummary.pinnedCount, pinnedBytes: cacheSummary.pinnedBytes });
    }, []);

    useEffect(() => {
        void refreshSummary();
    }, [refreshSummary]);

    const openPicker = () => {
        if (networkStatus !== 'online') {
            notify('当前无网络，无法请求推荐流');
            return;
        }
        setCacheCount(0);
        setProgress({ ...initialProgress });
        setPickerVisible(true);
    };

    const startCaching = async () => {
        if (caching || cacheCount === 0) return;

        setCaching(true);
        setProgress({ ...initialProgress, phase: 'fetching', total: cacheCount });

        let smoothedSpeed = 0;
        const reportNetworkSpeed = (speed: number) => {
            if (!Number.isFinite(speed) || speed <= 0) return;
            smoothedSpeed = smoothedSpeed > 0 ? smoothedSpeed * 0.65 + speed * 0.35 : speed;
            setProgress((previous) => ({ ...previous, speedBytesPerSecond: smoothedSpeed }));
        };
        const api = cookies ? getApiInstance(cookies) : null;
        api?.setTransferListener((bytes, durationMs) => {
            reportNetworkSpeed(bytes / Math.max(1, durationMs / 1000));
        });

        try {
            // The batch flow requests recommendation pages here. It does not
            // reuse the home list; the history filter follows the setting.
            const candidates = await fetchRecommendBatch({
                count: cacheCount,
                cookie: cookies,
                filterAds,
                filterPaid,
                deduplicate: deduplicateFeed,
                onProgress: ({ fetched }) => {
                    setProgress((previous) => ({
                        ...previous,
                        fetched,
                        overall: Math.min(FETCH_PROGRESS_WEIGHT, (fetched / cacheCount) * FETCH_PROGRESS_WEIGHT),
                    }));
                },
            });

            if (candidates.length === 0) {
                setCaching(false);
                setProgress((previous) => ({ ...previous, phase: 'finished', overall: 1, current: 0 }));
                notify(deduplicateFeed ? '推荐流内容均已历史去重，没有新的内容可缓存' : '推荐流没有返回可缓存内容');
                return;
            }

            setProgress({
                phase: 'caching',
                fetched: candidates.length,
                done: 0,
                total: candidates.length,
                success: 0,
                failed: 0,
                current: 0,
                overall: FETCH_PROGRESS_WEIGHT,
                speedBytesPerSecond: smoothedSpeed,
            });

            let success = 0;
            let failed = 0;
            let cursor = 0;
            let done = 0;
            const itemProgress = new Map<number, number>();
            const updateItemProgress = (index: number, current: number) => {
                const normalized = Math.max(0, Math.min(0.99, current));
                itemProgress.set(index, normalized);
                const aggregate = [...itemProgress.values()].reduce((sum, value) => sum + value, 0);
                setProgress((previous) => ({
                    ...previous,
                    current: normalized,
                    overall: FETCH_PROGRESS_WEIGHT + (aggregate / candidates.length) * (1 - FETCH_PROGRESS_WEIGHT),
                }));
            };
            const worker = async () => {
                while (cursor < candidates.length) {
                    const index = cursor;
                    cursor += 1;
                    const item = candidates[index];
                    try {
                        await cacheContentFromId(item.item.id, item.feedType, {
                            rootCommentMode: 'limit',
                            rootCommentLimit: 100,
                            childCommentLimit: 100,
                            withImages,
                            onProgress: (current) => updateItemProgress(index, current),
                            onNetworkSpeed: reportNetworkSpeed,
                        });
                        success += 1;
                    } catch (error) {
                        failed += 1;
                        console.warn('批量缓存失败', item.item.id, error);
                    }
                    itemProgress.set(index, 1);
                    done += 1;
                    const aggregate = [...itemProgress.values()].reduce((sum, value) => sum + value, 0);
                    setProgress({
                        phase: 'caching',
                        fetched: candidates.length,
                        done,
                        total: candidates.length,
                        success,
                        failed,
                        current: 0,
                        overall: FETCH_PROGRESS_WEIGHT + (aggregate / candidates.length) * (1 - FETCH_PROGRESS_WEIGHT),
                        speedBytesPerSecond: smoothedSpeed,
                    });
                }
            };
            await Promise.all(
                Array.from({ length: Math.min(CONTENT_CACHE_CONCURRENCY, candidates.length) }, () => worker()),
            );

            await refreshSummary();
            setCaching(false);
            setProgress((previous) => ({ ...previous, phase: 'finished', current: 0, overall: 1 }));
            notify(failed ? `完成 ${success} 篇，${failed} 篇失败` : `已完成 ${success} 篇离线缓存`);
        } catch (error) {
            setCaching(false);
            setProgress((previous) => ({ ...previous, phase: 'finished', current: 0 }));
            notify(error instanceof Error ? error.message : '请求推荐流失败，请稍后重试');
        } finally {
            api?.setTransferListener();
        }
    };

    const formatBytes = (bytes: number) =>
        bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
    const formatSpeed = (bytesPerSecond: number) => {
        if (bytesPerSecond <= 0) return '测速中…';
        return bytesPerSecond >= 1024 * 1024
            ? `${(bytesPerSecond / 1024 / 1024).toFixed(1)} MB/s`
            : `${Math.max(1, Math.round(bytesPerSecond / 1024))} KB/s`;
    };
    const estimatedBytesPerItem = withImages ? 1.5 * 1024 * 1024 : 0.6 * 1024 * 1024;
    const estimatedBytes = cacheCount * estimatedBytesPerItem;
    const finished = progress.phase === 'finished';
    const speedText = `当前网速 ${formatSpeed(progress.speedBytesPerSecond)}`;
    const progressText = progress.phase === 'fetching'
        ? `正在请求推荐流${progress.fetched > 0 ? ` · 已找到 ${progress.fetched} 篇` : '…'} · ${speedText}`
        : progress.phase === 'caching'
            ? `${progress.done}/${progress.total} · 成功 ${progress.success} · 失败 ${progress.failed} · ${speedText}`
            : progress.phase === 'finished' && progress.total > 0
                ? `${progress.done}/${progress.total} · 成功 ${progress.success} · 失败 ${progress.failed}`
                : '等待开始缓存';

    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <TopAppBar title="离线缓存" back={() => router.back()} />
            <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
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
                    <Button type="primary" onPress={openPicker} disabled={caching} style={{ marginTop: theme.spacing.md }}>
                        开始缓存
                    </Button>
                </Card>
            </ScrollView>

            <BottomSheet
                visible={pickerVisible}
                title="批量缓存"
                allowDismiss={!caching}
                onClose={() => {
                    if (!caching) setPickerVisible(false);
                }}
            >
                <Card feedback="none" contentStyle={{ paddingBottom: theme.spacing.lg }}>
                    <Text type="headline1" weight="medium" align="center">选择缓存数量</Text>
                    <MiuixNumberWheel value={cacheCount} max={MAX_CACHE_COUNT} step={5} onChange={setCacheCount} />
                    <Text type="body2" color={theme.colors.onSurfaceVariantSummary} align="center">
                        预估磁盘占用：约 {(estimatedBytes / 1024 / 1024).toFixed(1)} MB
                    </Text>
                    <View style={{ marginTop: theme.spacing.lg }}>
                        <MiuixProgressIndicator progress={progress.overall} />
                        <Text type="body2" color={theme.colors.onSurfaceVariantSummary} align="center" style={{ marginTop: theme.spacing.sm }}>
                            {progressText}
                        </Text>
                    </View>
                    <Button
                        type="primary"
                        onPress={() => void startCaching()}
                        disabled={caching || cacheCount === 0}
                        style={{ marginTop: theme.spacing.lg }}
                    >
                        {caching ? '缓存中…' : finished ? '再次缓存' : `开始缓存 ${cacheCount} 篇`}
                    </Button>
                    {finished ? (
                        <Button type="default" onPress={() => setPickerVisible(false)} style={{ marginTop: theme.spacing.sm }}>
                            完成
                        </Button>
                    ) : null}
                </Card>
            </BottomSheet>
        </View>
    );
}

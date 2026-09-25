import { HttpError } from '@/src/api/client';
import { getApiInstance } from '@/src/api/ZhihuApi';
import { cacheContentFromId } from '@/src/services/offlineCacheService';
import { fetchRecommendBatch } from '@/src/services/recommendFeedService';
import { notify } from '@/src/stores/useNotificationStore';
import {
    finishOfflineCacheForeground,
    updateOfflineCacheForeground,
} from 'expo-download-storage';
import { create } from 'zustand';
import { isOfflineCacheStopError } from './offlineCacheRequestPacer';

const FETCH_PROGRESS_WEIGHT = 0.15;

export type OfflineCacheBatchPhase = 'idle' | 'fetching' | 'caching' | 'finished';

export type OfflineCacheBatchState = {
    phase: OfflineCacheBatchPhase;
    fetched: number;
    done: number;
    total: number;
    success: number;
    failed: number;
    current: number;
    overall: number;
    speedBytesPerSecond: number;
    currentTitle: string;
    message: string;
};

const initialState: OfflineCacheBatchState = {
    phase: 'idle',
    fetched: 0,
    done: 0,
    total: 0,
    success: 0,
    failed: 0,
    current: 0,
    overall: 0,
    speedBytesPerSecond: 0,
    currentTitle: '',
    message: '',
};

export const useOfflineCacheBatchStore = create<OfflineCacheBatchState>(() => initialState);
let activeBatch: Promise<void> | null = null;

export function isOfflineCacheBatchRunning() {
    return activeBatch !== null;
}

function updateForeground(state: OfflineCacheBatchState, title: string, text: string) {
    try {
        updateOfflineCacheForeground({
            progress: state.overall,
            done: state.done,
            title,
            text,
        });
    } catch (error) {
        console.warn('[OfflineCache] unable to update foreground notification', error);
    }
}

function errorStatus(error: unknown) {
    if (error instanceof HttpError) return error.status;
    return Number((error as { status?: unknown } | null)?.status) || 0;
}

function rateLimitMessage(error: unknown) {
    const status = errorStatus(error);
    if (status === 429) return '知乎限制了请求频率，缓存已暂停。请稍后再继续。';
    if (status === 403) return '知乎拒绝了缓存请求，可能需要验证登录状态；缓存已暂停。';
    if (status === 401) return '知乎登录状态已失效，缓存已暂停。';
    return error instanceof Error ? error.message : '缓存请求失败，请稍后重试';
}

export function startOfflineCacheBatch(options: {
    count: number;
    cookie?: string;
    filterAds: boolean;
    filterPaid: boolean;
    deduplicate: boolean;
    withImages: boolean;
}) {
    if (activeBatch) return false;
    useOfflineCacheBatchStore.setState({
        ...initialState,
        phase: 'fetching',
        total: options.count,
        message: '正在获取推荐内容。离开页面后任务会继续运行。',
    });
    activeBatch = runBatch(options).finally(() => {
        activeBatch = null;
    });
    return true;
}

async function runBatch(options: {
    count: number;
    cookie?: string;
    filterAds: boolean;
    filterPaid: boolean;
    deduplicate: boolean;
    withImages: boolean;
}) {
    const api = options.cookie ? getApiInstance(options.cookie) : null;
    let smoothedSpeed = 0;
    let success = 0;
    let failed = 0;
    const reportNetworkSpeed = (speed: number) => {
        if (!Number.isFinite(speed) || speed <= 0) return;
        smoothedSpeed = smoothedSpeed > 0 ? smoothedSpeed * 0.65 + speed * 0.35 : speed;
        useOfflineCacheBatchStore.setState({ speedBytesPerSecond: smoothedSpeed });
    };

    api?.setTransferListener((bytes, durationMs) => {
        reportNetworkSpeed(bytes / Math.max(1, durationMs / 1000));
    });

    try {
        const candidates = await fetchRecommendBatch({
            count: options.count,
            cookie: options.cookie,
            filterAds: options.filterAds,
            filterPaid: options.filterPaid,
            deduplicate: options.deduplicate,
            onProgress: ({ fetched }) => {
                const overall = Math.min(FETCH_PROGRESS_WEIGHT, (fetched / options.count) * FETCH_PROGRESS_WEIGHT);
                const next = useOfflineCacheBatchStore.getState();
                const state = { ...next, fetched, overall };
                useOfflineCacheBatchStore.setState(state);
                updateForeground(state, '正在获取离线内容', `已找到 ${Math.min(fetched, options.count)}/${options.count} 篇`);
            },
        });

        if (candidates.length === 0) {
            const message = options.deduplicate
                ? '推荐流内容均已历史去重，没有新的内容可缓存'
                : '推荐流没有返回可缓存内容';
            useOfflineCacheBatchStore.setState({
                ...initialState,
                phase: 'finished',
                overall: 1,
                message,
            });
            finishForeground(0, 0, message);
            notify({ message, duration: 4_000 });
            return;
        }

        useOfflineCacheBatchStore.setState((state) => ({
            ...state,
            phase: 'caching',
            fetched: candidates.length,
            done: 0,
            total: candidates.length,
            success: 0,
            failed: 0,
            current: 0,
            overall: FETCH_PROGRESS_WEIGHT,
            message: '请求间隔至少 1.5 秒，缓存按顺序进行。离开页面后任务会继续运行。',
        }));
        updateForeground(useOfflineCacheBatchStore.getState(), '正在缓存离线内容', `0/${candidates.length} 篇`);

        let done = 0;
        let stopReason = '';
        const itemProgress = new Map<number, number>();
        const updateItemProgress = (index: number, current: number) => {
            const normalized = Math.max(0, Math.min(0.99, current));
            itemProgress.set(index, normalized);
            const aggregate = [...itemProgress.values()].reduce((sum, value) => sum + value, 0);
            const state = useOfflineCacheBatchStore.getState();
            const next = {
                ...state,
                current: normalized,
                overall: FETCH_PROGRESS_WEIGHT + (aggregate / candidates.length) * (1 - FETCH_PROGRESS_WEIGHT),
            };
            useOfflineCacheBatchStore.setState(next);
            updateForeground(next, '正在缓存离线内容', `${done}/${candidates.length} 篇 · 成功 ${success} · 失败 ${failed}`);
        };

        for (let index = 0; index < candidates.length; index += 1) {
            if (stopReason) break;
            const item = candidates[index];
            useOfflineCacheBatchStore.setState({ currentTitle: item.item.title || item.item.questionTitle || '无标题' });
            try {
                await cacheContentFromId(item.item.id, item.feedType, {
                    rootCommentMode: 'limit',
                    rootCommentLimit: 100,
                    childCommentLimit: 100,
                    withImages: options.withImages,
                    onProgress: (current) => updateItemProgress(index, current),
                    onNetworkSpeed: reportNetworkSpeed,
                });
                success += 1;
            } catch (error) {
                failed += 1;
                console.warn('[OfflineCache] item failed', item.item.id, error);
                if (isOfflineCacheStopError(error)) stopReason = rateLimitMessage(error);
            }

            itemProgress.set(index, 1);
            done += 1;
            const aggregate = [...itemProgress.values()].reduce((sum, value) => sum + value, 0);
            const state: OfflineCacheBatchState = {
                ...useOfflineCacheBatchStore.getState(),
                phase: 'caching',
                fetched: candidates.length,
                done,
                total: candidates.length,
                success,
                failed,
                current: 0,
                overall: FETCH_PROGRESS_WEIGHT + (aggregate / candidates.length) * (1 - FETCH_PROGRESS_WEIGHT),
                speedBytesPerSecond: smoothedSpeed,
            };
            useOfflineCacheBatchStore.setState(state);
            updateForeground(state, '正在缓存离线内容', `${done}/${candidates.length} 篇 · 成功 ${success} · 失败 ${failed}`);
        }

        const message = stopReason
            ? `${stopReason} 已处理 ${done}/${candidates.length} 篇。`
            : failed
                ? `完成 ${success} 篇，${failed} 篇失败`
                : `已完成 ${success} 篇离线缓存`;
        useOfflineCacheBatchStore.setState((state) => ({
            ...state,
            phase: 'finished',
            current: 0,
            overall: stopReason ? state.overall : 1,
            success,
            failed,
            message,
        }));
        finishForeground(success, failed, message);
        notify({ message, duration: 4_000 });
    } catch (error) {
        failed = Math.max(failed, 1);
        const message = rateLimitMessage(error);
        useOfflineCacheBatchStore.setState((state) => ({
            ...state,
            phase: 'finished',
            current: 0,
            success,
            failed,
            message,
        }));
        finishForeground(success, failed, message);
        notify({ message, duration: 4_500 });
    } finally {
        api?.setTransferListener();
    }
}

function finishForeground(success: number, failed: number, message: string) {
    try {
        finishOfflineCacheForeground(success, failed, message);
    } catch (error) {
        console.warn('[OfflineCache] unable to post completion notification', error);
    }
}

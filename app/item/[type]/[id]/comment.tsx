import { getChildComments, getRootComments } from '@/src/api/ZhihuApi';
import ChildComment from '@/src/components/ChildComment';
import { CommentInteractionHost, useCommentInteractionHost } from '@/src/components/CommentInteractionHost';
import CommentEdit from '@/src/components/CommentEdit';
import { CommentItem } from '@/src/components/CommentItem';
import type { CommentViewModel } from '@/src/components/CommentItem';
import { beginCommentRenderDiagnostics, recordCommentScreenRender, snapshotCommentRenderDiagnostics } from '@/src/components/commentRenderDiagnostics';
import { useDraftStore } from '@/src/stores/useDraftStore';
import { useNetworkStore } from '@/src/stores/useNetworkStore';
import { getCachedComments, getCachedCommentsForContent, getPageState, saveCommentPage } from '@/src/db/repositories/commentRepository';
import { getContent } from '@/src/db/repositories/contentRepository';
import { Icon, PageFlashList, PageFlatList, PageScaffold, Pressable, TopAppBar } from '@/src/ui';
import { Text } from '@/src/ui/primitives';
import { useTheme } from '@/src/ui/theme';
import { readCommentAuthorFlag, type CommentAuthorIdentity } from '@/src/utils/commentAuthor';
import {
    buildCommentInsightStats,
    filterCommentsByInsight,
    isContentAuthorComment,
    mergeUniqueComments,
    type CommentInsightFilter,
} from '@/src/utils/commentInsights';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { FlashListRef } from '@shopify/flash-list';
import { beginEffectiveScrollFpsSession, getGlassNativeEngine, getLiquidGlassPerformanceStats, setGlassNativeEngine, setLiquidGlassPerformanceTelemetryEnabled } from '@newhu/react-native-liquid-glass';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Modal, ScrollView, View } from 'react-native';
import type { FlatList } from 'react-native';

function normalizeComment(item: any): CommentViewModel | null {
    if (!item?.id) return null;
    const apiAuthorFlag = readCommentAuthorFlag(item);
    return {
        id: String(item.id),
        content: item.content ?? '',
        createdTime: Number(item.created_time || 0),
        authorUrlToken: item.author?.url_token,
        authorName: item.author?.name || '匿名用户',
        authorAvatar: item.author?.avatar_url,
        voteCount: Number(item.like_count || 0),
        isVote: Boolean(item.liked),
        isAuthor: apiAuthorFlag === true,
        isAuthorFromApi: apiAuthorFlag !== undefined,
        isHot: Boolean(item.hot),
        isTop: Boolean(item.top),
        childCommentCount: Number(item.child_comment_count || 0),
        replyToAuthorName: item.reply_to_author?.name,
    };
}

function nextOffset(next?: string) {
    if (!next) return '';
    try {
        return new URL(next).searchParams.get('offset') || '';
    } catch {
        return '';
    }
}

function commentIdFingerprint(rows: CommentViewModel[]) {
    let hash = 2166136261;
    for (const id of rows.map((row) => row.id).sort()) {
        for (let index = 0; index < id.length; index += 1) {
            hash ^= id.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

function summarizeCommentPerfNativeStats(stats: Record<string, number>) {
    const totalFields = [
        'displayRefreshRate', 'backdropRequestCount', 'backdropCaptureCount', 'backdropCapturedPixelCount',
        'sourceContentDirtyCount', 'consumerDrawCount', 'routeTreeTraversalCount', 'routeRenderNodeRecordCount',
        'sourceRenderNodeRecordCount', 'sourceRenderNodeReuseCount', 'routeScreenCompositeCount', 'routeScrollReuseCount',
        'descendantInvalidationReceivedCount', 'descendantInvalidationCoalescedCount', 'scrollEventsReceivedCount',
        'scrollOffsetUpdateCount', 'scrollOffsetIntervalCount', 'scrollOffsetIntervalUnder8Ms', 'scrollOffsetInterval8To12Ms',
        'scrollOffsetInterval12To17Ms', 'scrollOffsetIntervalOver17Ms', 'scrollFrameSampleCount', 'scrollFrameOffsetChangedCount',
        'scrollFrameRepeatedOffsetCount', 'scrollFrameIntervalUnder8Ms', 'scrollFrameInterval8To12Ms',
        'scrollFrameInterval12To17Ms', 'scrollFrameIntervalOver17Ms', 'scrollTouchDownEvents', 'scrollTouchMoveEvents',
        'scrollTouchUpEvents', 'sourceRerecordRequired', 'sourceRerecordAvoided', 'sourceRerecordExecuted',
        'consumerRefreshOnly', 'scrollReuseFrame', 'scrollSettleRerecord',
    ];
    const probeFields = [
        'identityHash', 'nativeViewId', 'scrollY', 'vsyncSamples', 'effectiveContentFrames', 'duplicateContentFrames',
        'effectiveScrollFps', 'activeScrollDurationMs', 'dragContentFps', 'dragOffsetIntervalP50Ms', 'dragOffsetIntervalP95Ms',
        'postTouchContentFps', 'postTouchOffsetIntervalP50Ms', 'postTouchOffsetIntervalP95Ms', 'touchMoveEventCount',
        'touchMoveEventFps', 'touchMoveDispatchCount', 'touchMoveDispatchFps', 'touchMoveDispatchIntervalP50Ms',
        'touchMoveDispatchIntervalP95Ms', 'nativeScrollChangeCount', 'nativeScrollEventFps', 'nativeDragScrollEventFps',
        'nativePostTouchScrollEventFps', 'postUpScrollerCaptured', 'postUpScrollerPresent', 'postUpScrollerDistancePx',
        'postUpScrollerVelocityPxPerSec', 'contentIntervalCount', 'contentIntervalP50Ms', 'contentIntervalP95Ms',
        'contentIntervalP99Ms', 'contentIntervalWithinOneVsyncRatio', 'interval16_67msPlusRatio', 'interval33_3msPlusRatio',
        'maxContentStallMs', 'drawEffectiveFps', 'drawContentIntervalP95Ms', 'drawMaxContentStallMs',
        'windowFrameEffectiveFps', 'windowFrameContentIntervalP95Ms', 'windowFrameMaxContentStallMs',
    ];
    const effectiveScrollProbe = Object.fromEntries(Object.entries(stats).filter(([key]) => (
        key.startsWith('effectiveScrollProbe.') && !/effectiveScrollProbe\.target\d+\./.test(key)
    )));
    const targetCount = Math.round(stats['effectiveScrollProbe.targetCount'] ?? 0);
    const targets = Array.from({ length: targetCount }, (_, index) => {
        const prefix = `effectiveScrollProbe.target${index}.`;
        return Object.fromEntries(probeFields.flatMap((field) => {
            const value = stats[prefix + field];
            return value === undefined ? [] : [[field, value]];
        }));
    });
    const providers = Object.fromEntries(Object.entries(stats).flatMap(([key, value]) => {
        if (!key.startsWith('provider.')) return [];
        const field = ['sourceRerecordRequired', 'sourceRerecordAvoided', 'sourceRerecordExecuted', 'consumerRefreshOnly', 'scrollReuseFrame', 'scrollDirtyReceived', 'paintDirtyReceived']
            .find((name) => key.endsWith(`.${name}`));
        return field && value !== 0 ? [[key, value]] : [];
    }));
    return {
        totals: Object.fromEntries(totalFields.flatMap((field) => stats[field] === undefined ? [] : [[field, stats[field]]])),
        effectiveScrollProbe,
        targets,
        providers,
    };
}

const INSIGHT_FILTERS: { value: CommentInsightFilter; label: string }[] = [
    { value: 'all', label: '全部' },
    { value: 'author', label: '作者' },
    { value: 'high_like', label: '高赞' },
    { value: 'controversial', label: '争议' },
    { value: 'serious', label: '认真讨论' },
];

function InsightChip({ label, count, selected, onPress }: { label: string; count: number; selected: boolean; onPress: () => void }) {
    const theme = useTheme();
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={onPress}
            style={{
                minHeight: 34,
                paddingHorizontal: theme.spacing.md,
                borderRadius: 17,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: selected ? theme.colors.primary : theme.colors.secondaryVariant,
            }}
        >
            <Text type="footnote1" weight={selected ? 'bold' : 'medium'} color={selected ? theme.colors.onPrimary : theme.colors.onSecondaryVariant}>
                {label} {count}
            </Text>
        </Pressable>
    );
}

export default function CommentScreen() {
    return (
        <CommentInteractionHost>
            <CommentScreenContent />
        </CommentInteractionHost>
    );
}

function CommentScreenContent() {
    recordCommentScreenRender();
    const params = useLocalSearchParams<{ id?: string; type?: string; draftId?: string; authorName?: string; authorUrlToken?: string; perfRunId?: string; perfDurationMs?: string; perfMode?: string; perfExpectedRows?: string; perfGlassEngine?: string; perfListEngine?: string }>();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const type = Array.isArray(params.type) ? params.type[0] : params.type;
    const draftId = Array.isArray(params.draftId) ? params.draftId[0] : params.draftId;
    const routeAuthorName = Array.isArray(params.authorName) ? params.authorName[0] : params.authorName;
    const routeAuthorUrlToken = Array.isArray(params.authorUrlToken) ? params.authorUrlToken[0] : params.authorUrlToken;
    const perfRunId = Array.isArray(params.perfRunId) ? params.perfRunId[0] : params.perfRunId;
    const perfModeParam = Array.isArray(params.perfMode) ? params.perfMode[0] : params.perfMode;
    const perfMode = __DEV__ && ['full-cache', 'network-page', 'append-only'].includes(perfModeParam ?? '') ? perfModeParam : '';
    const expectedRowsParam = Array.isArray(params.perfExpectedRows) ? params.perfExpectedRows[0] : params.perfExpectedRows;
    const perfExpectedRows = __DEV__ ? Number.parseInt(expectedRowsParam ?? '', 10) || 0 : 0;
    const perfGlassEngineParam = Array.isArray(params.perfGlassEngine) ? params.perfGlassEngine[0] : params.perfGlassEngine;
    const perfGlassEngine = __DEV__ && perfGlassEngineParam === 'core' ? 'core' : '';
    const perfListEngineParam = Array.isArray(params.perfListEngine) ? params.perfListEngine[0] : params.perfListEngine;
    const perfListEngine = __DEV__ && perfRunId && perfListEngineParam === 'flatlist' ? 'flatlist' : 'flashlist';
    const perfDurationValue = Array.isArray(params.perfDurationMs) ? params.perfDurationMs[0] : params.perfDurationMs;
    const perfDurationMs = Math.max(1_000, Math.min(Number.parseInt(perfDurationValue ?? '', 10) || 12_000, 60_000));
    const contentType = type === 'answer' ? 'answer' : 'article';
    const normalizedType = contentType === 'answer' ? 'answers' : 'articles';
    useEffect(() => {
        if (__DEV__) console.info(`[COMMENTS_ROUTE_DATA] contentId=${id ?? ''} contentType=${contentType}`);
    }, [contentType, id]);
    const networkStatus = useNetworkStore((state) => state.status);
    const theme = useTheme();
    const router = useRouter();
    const [contentAuthor, setContentAuthor] = useState<CommentAuthorIdentity>(() => ({
        name: routeAuthorName,
        urlToken: routeAuthorUrlToken,
    }));

    const [comments, setComments] = useState<CommentViewModel[]>([]);
    const commentsLengthRef = useRef(0);
    const [commentCount, setCommentCount] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    const [sort, setSort] = useState('score');
    const [insightFilter, setInsightFilter] = useState<CommentInsightFilter>('all');
    const [authorReplies, setAuthorReplies] = useState<CommentViewModel[]>([]);
    const [authorLoading, setAuthorLoading] = useState(false);
    const commentInteractionHost = useCommentInteractionHost();
    const [childId, setChildId] = useState('');
    const [reply, setReply] = useState<{ id: string; name: string; rootCommentId: string; fromDraft?: boolean } | null>(null);
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const [pendingFocus, setPendingFocus] = useState<{ rootCommentId: string; commentId: string } | null>(null);
    const [childFocusId, setChildFocusId] = useState('');

    const menuButtonRef = useRef<View>(null);
    const flatListRef = useRef<FlatList<CommentViewModel>>(null);
    const flashListRef = useRef<FlashListRef<CommentViewModel>>(null);
    const scrollToCommentIndex = useCallback((index: number, animated = true) => {
        if (perfListEngine === 'flashlist') {
            void flashListRef.current?.scrollToIndex({ index, animated, viewPosition: 0.45 }).catch(() => {
                flashListRef.current?.scrollToOffset({ offset: index * 220, animated });
            });
        } else {
            flatListRef.current?.scrollToIndex({ index, animated, viewPosition: 0.45 });
        }
    }, [perfListEngine]);
    const scrollToCommentOffset = useCallback((offset: number, animated = true) => {
        if (perfListEngine === 'flashlist') {
            flashListRef.current?.scrollToOffset({ offset, animated });
        } else {
            flatListRef.current?.scrollToOffset({ offset, animated });
        }
    }, [perfListEngine]);
    const offsetRef = useRef('');
    const inFlightRef = useRef(false);
    const hasMoreRef = useRef(true);
    const perfCachedRowsRef = useRef<CommentViewModel[]>([]);
    const perfCachedIndexRef = useRef(0);
    const perfNativeBaselineRef = useRef<Record<string, number> | null>(null);
    const perfPendingCommitRef = useRef<{ source: string; queuedAt: number; addedRows: number } | null>(null);
    const openedDraftRef = useRef('');
    const authorProbeRef = useRef(new Set<string>());

    useEffect(() => {
        commentsLengthRef.current = comments.length;
        const pending = perfPendingCommitRef.current;
        if (__DEV__ && perfRunId && pending) {
            console.info(`[COMMENTS_PERF_REACT_COMMIT] ${JSON.stringify({ runId: perfRunId, source: pending.source, addedRows: pending.addedRows, totalRows: comments.length, ids: commentIdFingerprint(comments), stateToEffectMs: Date.now() - pending.queuedAt })}`);
            perfPendingCommitRef.current = null;
        }
    }, [comments, perfRunId]);

    useEffect(() => {
        if (!perfRunId || perfGlassEngine !== 'core') return;
        const previousEngine = getGlassNativeEngine();
        setGlassNativeEngine('core');
        console.info(`[COMMENTS_PERF_ENGINE] runId=${perfRunId} active=core restored=${previousEngine}`);
        return () => setGlassNativeEngine(previousEngine);
    }, [perfGlassEngine, perfRunId]);

    useEffect(() => {
        if (!__DEV__ || !perfRunId) return;
        beginCommentRenderDiagnostics();
        setLiquidGlassPerformanceTelemetryEnabled(true);
        beginEffectiveScrollFpsSession('comments');
        let active = true;
        let snapshotTimer: ReturnType<typeof setTimeout> | undefined;
        let startTimer: ReturnType<typeof setTimeout> | undefined;
        console.info(`[COMMENTS_PERF_ROUTE] ${JSON.stringify({ runId: perfRunId, contentId: id ?? '', mode: perfMode || 'production-path', listEngine: perfListEngine, durationMs: perfDurationMs, networkStatus })}`);
        startTimer = setTimeout(() => {
            void getLiquidGlassPerformanceStats().then((stats) => {
                if (!active || !stats) return;
                perfNativeBaselineRef.current = stats;
                console.info(`[COMMENTS_PERF_READY] runId=${perfRunId} at=${Date.now()}`);
                snapshotTimer = setTimeout(() => {
                    void getLiquidGlassPerformanceStats().then((current) => {
                        if (!active) return;
                        const baseline = perfNativeBaselineRef.current;
                        const delta = current && baseline
                            ? Object.fromEntries(Object.entries(current).map(([key, value]) => [
                                key,
                                key === 'displayRefreshRate' || key.startsWith('effectiveScrollProbe.') ? value : value - (baseline[key] ?? 0),
                            ]))
                            : current;
                        console.info(`[COMMENTS_PERF_NATIVE_DELTA] ${JSON.stringify({ runId: perfRunId, ...summarizeCommentPerfNativeStats(delta ?? {}) })}`);
                        console.info(`[COMMENTS_RENDER_DIAGNOSTICS] ${JSON.stringify({ runId: perfRunId, ...snapshotCommentRenderDiagnostics() })}`);
                        setLiquidGlassPerformanceTelemetryEnabled(false);
                    });
                }, perfDurationMs);
            });
        }, 1_000);
        return () => {
            active = false;
            if (startTimer) clearTimeout(startTimer);
            if (snapshotTimer) clearTimeout(snapshotTimer);
            setLiquidGlassPerformanceTelemetryEnabled(false);
        };
    }, [id, networkStatus, perfDurationMs, perfListEngine, perfMode, perfRunId]);

    useEffect(() => {
        let active = true;
        setContentAuthor({ name: routeAuthorName, urlToken: routeAuthorUrlToken });
        if (!id) return () => { active = false; };

        void getContent(id, contentType).then((cached) => {
            if (!active || !cached) return;
            setContentAuthor((current) => ({
                name: current.name || cached.authorName,
                urlToken: current.urlToken || cached.authorUrlToken,
            }));
        }).catch(() => {
            // The API author flag still works when no local content record exists.
        });

        return () => { active = false; };
    }, [contentType, id, routeAuthorName, routeAuthorUrlToken]);

    useEffect(() => {
        const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
        const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
        return () => {
            show.remove();
            hide.remove();
        };
    }, []);

    useEffect(() => {
        if (!draftId || openedDraftRef.current === draftId) return;
        const draft = useDraftStore.getState().drafts.find((item) => item.id === draftId);
        if (!draft) return;
        openedDraftRef.current = draftId;
        setReply({
            id: draft.target.replyCommentId,
            name: draft.target.replyName,
            rootCommentId: draft.target.rootCommentId || draft.target.replyCommentId,
            fromDraft: true,
        });
    }, [draftId]);

    const loadComments = useCallback(async (refresh = false) => {
        if (!id || !normalizedType || inFlightRef.current || (!refresh && !hasMoreRef.current)) return;
        inFlightRef.current = true;
        if (refresh) {
            setRefreshing(true);
            offsetRef.current = '';
            hasMoreRef.current = true;
        }

        try {
            if (networkStatus !== 'online' && perfMode === 'network-page') {
                console.warn(`[COMMENTS_PERF_INVALID] runId=${perfRunId ?? ''} reason=network-offline`);
                hasMoreRef.current = false;
                return;
            }
            if (networkStatus !== 'online') {
                // Offline cache fetches root comments by score. If the user
                // changed the online sort to time before losing connectivity,
                // don't show an empty list just because that second index was
                // never cached.
                let cached = await getCachedComments(id, contentType, null, sort);
                let page = await getPageState(id, contentType, null, sort);
                if (!cached.length && sort !== 'score') {
                    cached = await getCachedComments(id, contentType, null, 'score');
                    page = await getPageState(id, contentType, null, 'score');
                }
                if (!cached.length && sort === 'score') {
                    cached = await getCachedComments(id, contentType, null, 'ts');
                    page = await getPageState(id, contentType, null, 'ts');
                }
                setComments(cached);
                setCommentCount(page?.totalCount || cached.length);
                offsetRef.current = page?.nextOffset || '';
                hasMoreRef.current = Boolean(page && !page.isEnd && page.nextOffset);
                return;
            }
            const requestOffset = refresh ? '' : offsetRef.current;
            const requestStartedAt = Date.now();
            const response = await getRootComments(id, normalizedType, requestOffset, sort);
            const responseAt = Date.now();
            const next = nextOffset(response?.paging?.next);
            const hasNextPage = Boolean(next)
                && next !== requestOffset
                && response?.paging?.is_end !== true;
            offsetRef.current = hasNextPage ? next : '';
            hasMoreRef.current = hasNextPage;
            setCommentCount(Number(response?.counts?.total_counts || 0));
            const incoming = (response?.data ?? []).map(normalizeComment).filter(Boolean) as CommentViewModel[];
            if (__DEV__ && perfRunId) {
                console.info(`[COMMENTS_PERF_PAGE] ${JSON.stringify({ runId: perfRunId, mode: perfMode || 'production-path', page: requestOffset ? 'next' : 'first', rows: incoming.length, ids: commentIdFingerprint(incoming), apiMs: responseAt - requestStartedAt, hasNextPage, currentRows: commentsLengthRef.current, cacheWrite: perfMode === 'network-page' ? 'skipped' : 'async' })}`);
            }
            perfPendingCommitRef.current = { source: 'network-page', queuedAt: Date.now(), addedRows: incoming.length };
            setComments((current) => {
                if (refresh) return incoming;
                const merged = [...current, ...incoming];
                const seenIds = new Set<string>();
                return merged.filter((item) => {
                    if (seenIds.has(item.id)) return false;
                    seenIds.add(item.id);
                    return true;
                });
            });
            if (perfMode !== 'network-page') void saveCommentPage({
                contentId: id,
                contentType,
                parentCommentId: null,
                orderBy: sort,
                comments: incoming,
                nextOffset: next,
                isEnd: !next || response?.paging?.is_end === true,
                totalCount: Number(response?.counts?.total_counts || 0),
            }).catch((error) => console.warn('评论写入本地缓存失败', error));
        } catch (error) {
            console.error('加载评论失败:', error);
        } finally {
            inFlightRef.current = false;
            setRefreshing(false);
        }
    }, [contentType, id, networkStatus, normalizedType, perfMode, perfRunId, sort]);

    useEffect(() => {
        setComments([]);
        if (__DEV__ && (perfMode === 'full-cache' || perfMode === 'append-only')) {
            inFlightRef.current = true;
            void Promise.all([
                getCachedComments(id ?? '', contentType, null, sort),
                getPageState(id ?? '', contentType, null, sort),
            ]).then(([cached, page]) => {
                perfCachedRowsRef.current = cached;
                const initial = perfMode === 'append-only' ? cached.slice(0, 10) : cached;
                perfCachedIndexRef.current = initial.length;
                offsetRef.current = '';
                hasMoreRef.current = perfMode === 'append-only' && cached.length > initial.length;
                setCommentCount(page?.totalCount || cached.length);
                perfPendingCommitRef.current = { source: 'cache-seed', queuedAt: Date.now(), addedRows: initial.length };
                setComments(initial);
                const cacheComplete = perfExpectedRows > 0
                    ? cached.length === perfExpectedRows
                    : Boolean(page?.isEnd && !page.nextOffset);
                console.info(`[COMMENTS_PERF_CACHE_READY] ${JSON.stringify({ runId: perfRunId ?? '', mode: perfMode, rows: cached.length, expectedRows: perfExpectedRows || null, totalCount: page?.totalCount ?? cached.length, isEnd: page?.isEnd ?? false, hasNextOffset: Boolean(page?.nextOffset), cacheComplete, ids: commentIdFingerprint(cached), initialRows: initial.length })}`);
                if (!cacheComplete) console.warn(`[COMMENTS_PERF_INVALID] runId=${perfRunId ?? ''} reason=cache-not-complete cachedRows=${cached.length} expectedRows=${perfExpectedRows || 'pageState'}`);
            }).catch((error) => {
                console.error(`[COMMENTS_PERF_CACHE_ERROR] runId=${perfRunId ?? ''}`, error);
            }).finally(() => {
                inFlightRef.current = false;
            });
            return;
        }
        loadComments(true);
    }, [contentType, id, loadComments, perfExpectedRows, perfMode, perfRunId, sort]);

    const handleEndReached = useCallback(() => {
        if (__DEV__ && perfMode === 'append-only') {
            const start = perfCachedIndexRef.current;
            const end = Math.min(start + 10, perfCachedRowsRef.current.length);
            if (end <= start || inFlightRef.current) return;
            inFlightRef.current = true;
            const appendStartedAt = Date.now();
            const appended = perfCachedRowsRef.current.slice(start, end);
            perfPendingCommitRef.current = { source: 'memory-append', queuedAt: appendStartedAt, addedRows: appended.length };
            setComments((current) => current.concat(appended));
            perfCachedIndexRef.current = end;
            hasMoreRef.current = end < perfCachedRowsRef.current.length;
            console.info(`[COMMENTS_PERF_APPEND] ${JSON.stringify({ runId: perfRunId ?? '', source: 'memory', rows: appended.length, totalRows: end, ids: commentIdFingerprint(appended), stateEnqueueMs: Date.now() - appendStartedAt, apiMs: 0, cacheWriteMs: 0, hasMore: hasMoreRef.current })}`);
            requestAnimationFrame(() => { inFlightRef.current = false; });
            return;
        }
        loadComments(false);
    }, [loadComments, perfMode, perfRunId]);

    useEffect(() => {
        if (insightFilter !== 'author' || !id) return;
        let active = true;

        const aggregateAuthorReplies = async () => {
            setAuthorLoading(true);
            try {
                const cached = await getCachedCommentsForContent(id, contentType);
                let aggregate: CommentViewModel[] = cached.filter((comment) => (
                    isContentAuthorComment(comment, contentAuthor)
                ));
                if (active) setAuthorReplies(aggregate);

                if (networkStatus !== 'online') return;

                const roots = comments
                    .filter((comment) => (
                        comment.childCommentCount > 0
                        && !authorProbeRef.current.has(comment.id)
                    ))
                    .slice(0, 8);

                for (const root of roots) {
                    authorProbeRef.current.add(root.id);
                    try {
                        const response = await getChildComments(root.id, '', 'ts');
                        const incoming = (response?.data ?? [])
                            .map(normalizeComment)
                            .filter(Boolean) as CommentViewModel[];
                        const next = nextOffset(response?.paging?.next);
                        void saveCommentPage({
                            contentId: id,
                            contentType,
                            parentCommentId: root.id,
                            orderBy: 'ts',
                            comments: incoming,
                            nextOffset: next,
                            isEnd: !next || response?.paging?.is_end === true,
                            totalCount: Number(response?.counts?.total_counts || incoming.length),
                            rootComment: root,
                        }).catch((error) => console.warn('作者回复写入缓存失败', error));

                        aggregate = mergeUniqueComments(
                            aggregate,
                            incoming.filter((comment) => (
                                isContentAuthorComment(comment, contentAuthor)
                            )),
                        ) as CommentViewModel[];
                        if (active) setAuthorReplies(aggregate);
                    } catch (error) {
                        console.warn('作者回复聚合失败', root.id, error);
                    }
                }
            } finally {
                if (active) setAuthorLoading(false);
            }
        };

        void aggregateAuthorReplies();
        return () => {
            active = false;
        };
    }, [comments, contentAuthor, contentType, id, insightFilter, networkStatus]);

    const insightSource = useMemo(
        () => mergeUniqueComments(comments, authorReplies) as CommentViewModel[],
        [authorReplies, comments],
    );
    const insightStats = useMemo(() => {
        const rootStats = buildCommentInsightStats(comments, contentAuthor);
        return {
            ...rootStats,
            author: filterCommentsByInsight(
                insightSource,
                'author',
                contentAuthor,
            ).length,
        };
    }, [comments, contentAuthor, insightSource]);
    const visibleComments = useMemo(
        () => filterCommentsByInsight(
            insightFilter === 'author' ? insightSource : comments,
            insightFilter,
            contentAuthor,
        ) as CommentViewModel[],
        [comments, contentAuthor, insightFilter, insightSource],
    );

    const renderComment = useCallback(({ item }: { item: CommentViewModel }) => (
        <CommentItem
            item={item}
            contentAuthor={contentAuthor}
            onOpenReplies={item.childCommentCount > 0 ? setChildId : undefined}
            onReply={(commentId) => setReply({ id: commentId, name: item.authorName || '', rootCommentId: item.id })}
        />
    ), [contentAuthor]);

    const closeReply = useCallback(() => {
        if (reply?.fromDraft && reply.rootCommentId) {
            setInsightFilter('all');
            setPendingFocus({ rootCommentId: reply.rootCommentId, commentId: reply.id });
        }
        setReply(null);
    }, [reply]);

    useEffect(() => {
        if (!pendingFocus) return;
        const index = comments.findIndex((item) => item.id === pendingFocus.rootCommentId);
        if (index >= 0) {
            scrollToCommentIndex(index);
            if (pendingFocus.commentId && pendingFocus.commentId !== pendingFocus.rootCommentId) {
                const timer = setTimeout(() => {
                    setChildFocusId(pendingFocus.commentId);
                    setChildId(pendingFocus.rootCommentId);
                }, 280);
                setPendingFocus(null);
                return () => clearTimeout(timer);
            }
            setPendingFocus(null);
            return;
        }
        if (comments.length > 0 && hasMoreRef.current) {
            const timer = setTimeout(() => loadComments(false), 120);
            return () => clearTimeout(timer);
        }
    }, [comments, loadComments, pendingFocus, scrollToCommentIndex]);

    const openHeaderMenu = useCallback(() => {
        menuButtonRef.current?.measureInWindow((x, y, width, height) => {
            commentInteractionHost?.openMenu(
                { x, y, width, height },
                [
                    { label: '按热度排序', onPress: () => setSort('score') },
                    { label: '按时间排序', onPress: () => setSort('ts') },
                    { label: '发表评论', onPress: () => setReply({ id: '', name: '', rootCommentId: '' }) },
                ],
                sort === 'score' ? 0 : 1,
            );
        });
    }, [commentInteractionHost, setReply, setSort, sort]);

    const insightFilterHeader = (
        <View style={{ paddingTop: theme.spacing.sm }}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.sm }}
            >
                {INSIGHT_FILTERS.map((option) => {
                    const count = option.value === 'all'
                        ? insightStats.total
                        : option.value === 'author'
                            ? insightStats.author
                            : option.value === 'high_like'
                                ? insightStats.highLike
                                : option.value === 'controversial'
                                    ? insightStats.controversial
                                    : insightStats.serious;
                    return (
                        <InsightChip
                            key={option.value}
                            label={option.label}
                            count={count}
                            selected={insightFilter === option.value}
                            onPress={() => setInsightFilter(option.value)}
                        />
                    );
                })}
            </ScrollView>

            {insightFilter === 'controversial' ? (
                <Text type="footnote2" color={theme.colors.onSurfaceVariantSummary} style={{ paddingBottom: theme.spacing.sm }}>
                    “争议”按回复数与点赞数的结构比例筛选，不代表情绪或立场判断。
                </Text>
            ) : null}

            {insightFilter === 'author' && authorLoading ? (
                <Text type="footnote2" color={theme.colors.onSurfaceVariantSummary} style={{ paddingBottom: theme.spacing.sm }}>
                    正在聚合已加载范围内的作者回复…
                </Text>
            ) : null}
        </View>
    );

    return (
        <PageScaffold topBar={
            <TopAppBar
                title={`评论 (${commentCount})`}
                back={() => router.back()}
                actions={
                    <View ref={menuButtonRef} collapsable={false}>
                        <Pressable onPress={openHeaderMenu} hitSlop={8} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 }}>
                            <Icon name="dots-vertical" size={24} color={theme.colors.onBackground} />
                        </Pressable>
                    </View>
                }
            />
        }>

            {perfListEngine === 'flashlist' ? <PageFlashList
                listRef={flashListRef}
                data={visibleComments}
                keyExtractor={(item) => item.id}
                renderItem={renderComment}
                contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xl, flexGrow: 1 }}
                ListHeaderComponent={insightFilterHeader}
                refreshing={refreshing}
                onRefresh={() => loadComments(true)}
                onEndReached={handleEndReached}
                onEndReachedThreshold={0.35}
                showsVerticalScrollIndicator={false}
                onLoad={({ elapsedTimeInMs }) => {
                    if (__DEV__ && perfRunId) console.info(`[COMMENTS_PERF_FLASHLIST_LOAD] runId=${perfRunId} elapsedMs=${elapsedTimeInMs}`);
                }}
                ListEmptyComponent={!refreshing ? (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xl }}>
                        <Text type="body1" color={theme.colors.onSurfaceVariantSummary}>
                            {insightFilter !== 'all'
                                ? authorLoading && insightFilter === 'author'
                                    ? '正在聚合作者回复…'
                                    : '当前筛选下没有评论'
                                : commentCount > 0
                                    ? '评论暂时无法加载'
                                    : '还没有评论'}
                        </Text>
                    </View>
                ) : null}
            /> : <PageFlatList
                listRef={flatListRef}
                data={visibleComments}
                keyExtractor={(item) => item.id}
                renderItem={renderComment}
                contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xl, flexGrow: 1 }}
                ListHeaderComponent={insightFilterHeader}
                refreshing={refreshing}
                onRefresh={() => loadComments(true)}
                onEndReached={handleEndReached}
                onEndReachedThreshold={0.35}
                initialNumToRender={5}
                maxToRenderPerBatch={5}
                updateCellsBatchingPeriod={32}
                windowSize={5}
                removeClippedSubviews
                showsVerticalScrollIndicator={false}
                onScrollToIndexFailed={({ index }) => {
                    scrollToCommentOffset(index * 220);
                }}
                ListEmptyComponent={!refreshing ? (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xl }}>
                        <Text type="body1" color={theme.colors.onSurfaceVariantSummary}>
                            {insightFilter !== 'all'
                                ? authorLoading && insightFilter === 'author'
                                    ? '正在聚合作者回复…'
                                    : '当前筛选下没有评论'
                                : commentCount > 0
                                    ? '评论暂时无法加载'
                                    : '还没有评论'}
                        </Text>
                    </View>
                ) : null}
            />}

            <ChildComment
                visible={Boolean(childId)}
                id={childId}
                contentId={id || ''}
                contentType={contentType}
                contentAuthor={contentAuthor}
                initialFocusId={childFocusId}
                onClose={() => {
                    setChildId('');
                    setChildFocusId('');
                }}
                onReply={(commentId, name) => {
                    const rootCommentId = childId;
                    setChildId('');
                    setTimeout(() => {
                        setReply({ id: commentId, name: name || '', rootCommentId });
                    }, 240);
                }}
            />
            <Modal
                visible={Boolean(reply)}
                animationType="slide"
                statusBarTranslucent={false}
                onRequestClose={() => {
                    if (keyboardVisible) {
                        Keyboard.dismiss();
                    } else {
                        closeReply();
                    }
                }}
            >
                <CommentEdit
                    visible={Boolean(reply)}
                    name={reply?.name || ''}
                    contentType={type || ''}
                    contentId={id || ''}
                    replyCommentId={reply?.id || ''}
                    rootCommentId={reply?.rootCommentId || ''}
                    onClose={closeReply}
                    onSubmitted={() => loadComments(true)}
                />
            </Modal>
        </PageScaffold>
    );
}

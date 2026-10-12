import { BottomSheet, Button, Dialog, GlassSurface, ListRow, Text, TopAppBar, useTheme } from '@/src/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSettingStore } from '@/src/stores/useSettingStore';
import {
    getLiquidGlassPerformanceStats,
    beginEffectiveScrollFpsSession,
    GlassTabBar,
    getGlassNativeEngine,
    setLiquidGlassPerformanceTelemetryEnabled,
    setGlassNativeEngine,
    getSurfaceRendererPolicyOverride,
    setSurfaceRendererPolicyOverride,
    getSurfaceRendererPolicy,
    getLocalGlassTelemetry,
    setLocalGlassTelemetryEnabled,
} from '@newhu/react-native-liquid-glass';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text as NativeText, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { beginPageRenderDiagnostics, snapshotPageRenderDiagnostics } from '@/src/components/feed/pageRenderDiagnostics';
import { beginCommentRenderDiagnostics, snapshotCommentRenderDiagnostics } from '@/src/components/commentRenderDiagnostics';

const ROWS = Array.from({ length: 160 }, (_, index) => index + 1);
const TABS = [{ label: '推荐' }, { label: '关注' }, { label: '热榜' }];
const RUN_DURATION_MS = 12_000;
const SNAPSHOT_FIELDS = [
    'displayRefreshRate',
    'routeTreeTraversalCount',
    'routeRenderNodeRecordCount',
    'sourceRenderNodeReuseCount',
    'scrollWindowRefreshCount',
    'scrollWindowReuseFrameCount',
    'routeScreenCompositeCount',
    'routeScrollReuseCount',
    'descendantInvalidationReceivedCount',
    'paintDirtyReceived',
    'structureDirtyReceived',
    'sourceGeometryDirtyReceived',
    'consumerGeometryDirtyReceived',
    'scrollDirtyReceived',
    'scrollTouchDownEvents',
    'scrollTouchMoveEvents',
    'scrollTouchUpEvents',
    'scrollTouchCancelEvents',
    'scrollOffsetUpdateCount',
    'scrollOffsetIntervalCount',
    'scrollOffsetIntervalUnder8Ms',
    'scrollOffsetInterval8To12Ms',
    'scrollOffsetInterval12To17Ms',
    'scrollOffsetIntervalOver17Ms',
    'scrollTouchToOffsetLatencyCount',
    'scrollTouchToOffsetLatencySumMs',
    'scrollTouchToOffsetLatencyMaxMs',
    'scrollDragOffsetUpdateCount',
    'scrollFrameSampleCount',
    'scrollFrameOffsetChangedCount',
    'scrollFrameRepeatedOffsetCount',
    'scrollFrameIntervalUnder8Ms',
    'scrollFrameInterval8To12Ms',
    'scrollFrameInterval12To17Ms',
    'scrollFrameIntervalOver17Ms',
    'scrollDragFrameSampleCount',
    'scrollDragFrameOffsetChangedCount',
    'scrollDragFrameRepeatedOffsetCount',
    'sourceRerecordRequired',
    'sourceRerecordAvoided',
    'consumerRefreshOnly',
    'sourceRerecordExecuted',
    'sourceRerecordByStructure',
    'sourceRerecordByGeometry',
    'sourceRerecordByRevision',
    'sourceRerecordByInitialCapture',
    'scrollReuseFrame',
    'scrollSettleRerecord',
];

function compactNativeSnapshot(stats: Record<string, number>) {
    const providerFields = SNAPSHOT_FIELDS.filter((field) => field.startsWith('paint') || field.startsWith('scroll') || [
        'structureDirtyReceived', 'sourceGeometryDirtyReceived', 'consumerGeometryDirtyReceived',
        'scrollDirtyReceived', 'sourceRerecordRequired', 'sourceRerecordAvoided', 'consumerRefreshOnly',
        'sourceRerecordExecuted', 'sourceRerecordByStructure', 'sourceRerecordByGeometry',
        'sourceRerecordByRevision', 'sourceRerecordByInitialCapture', 'scrollReuseFrame',
        'scrollSettleRerecord',
    ].includes(field));
    const providers = new Map<string, Record<string, number>>();
    const scrollViews = new Map<string, Record<string, number>>();
    for (const [key, value] of Object.entries(stats)) {
        if (key.startsWith('provider.')) {
            const field = providerFields.find((candidate) => key.endsWith(`.${candidate}`));
            if (!field) continue;
            const id = key.slice('provider.'.length, -field.length - 1);
            const counters = providers.get(id) ?? {};
            counters[field] = value;
            providers.set(id, counters);
        } else if (key.startsWith('scrollView.')) {
            const parts = key.split('.');
            if (parts.length !== 4) continue;
            const id = `${parts[1]}:${parts[2]}`;
            const counters = scrollViews.get(id) ?? {};
            counters[parts[3]] = value;
            scrollViews.set(id, counters);
        }
    }
    return {
        totals: Object.fromEntries(SNAPSHOT_FIELDS.filter((key) => key in stats).map((key) => [key, stats[key]])),
        providers: Object.fromEntries([...providers.entries()].filter(([, counters]) => Object.values(counters).some(Boolean))),
        scrollViews: Object.fromEntries([...scrollViews.entries()].filter(([, counters]) => Object.values(counters).some(Boolean))),
    };
}

function logGlassSnapshot(
    label: string,
    metadata: Record<string, string | null>,
    stats: Record<string, number>,
    localGlass: Awaited<ReturnType<typeof getLocalGlassTelemetry>>,
) {
    const compact = compactNativeSnapshot(stats);
    const effectiveScrollProbe = Object.fromEntries(
        Object.entries(stats).filter(([key]) => key.startsWith('effectiveScrollProbe.')),
    );
    // Keep the single-line Android log below logcat's per-record limit. The full
    // numeric map remains in the benchmark snapshot; this line is the compact,
    // auditable summary with drag input and post-touch motion separated.
    const probeTargetFields = [
        'identityHash', 'nativeViewId', 'vsyncSamples', 'effectiveContentFrames',
        'duplicateContentFrames', 'effectiveScrollFps', 'activeScrollDurationMs',
        'dragContentFps', 'dragOffsetIntervalCount', 'dragOffsetIntervalP50Ms', 'dragOffsetIntervalP95Ms',
        'postTouchContentFps', 'postTouchOffsetIntervalCount', 'postTouchOffsetIntervalP50Ms',
        'postTouchOffsetIntervalP95Ms', 'touchMoveEventCount', 'touchMoveEventFps',
        'touchMoveIntervalP50Ms', 'touchMoveIntervalP95Ms', 'touchMoveMaxIntervalMs',
        'touchMoveDispatchCount', 'touchMoveDispatchFps', 'touchMoveDispatchIntervalP50Ms',
        'touchMoveDispatchIntervalP95Ms', 'touchHistoricalSampleCount',
        'nativeScrollChangeCount', 'nativeScrollEventFps', 'nativeScrollEventIntervalP50Ms',
        'nativeScrollEventIntervalP95Ms', 'nativeDragScrollEventFps',
        'nativeDragScrollEventIntervalP50Ms', 'nativeDragScrollEventIntervalP95Ms',
        'nativePostTouchScrollEventFps', 'nativePostTouchScrollEventIntervalP50Ms',
        'nativePostTouchScrollEventIntervalP95Ms',
        'postUpScrollerCaptured', 'postUpScrollerPresent', 'postUpScrollerFinished',
        'postUpScrollerCurrentY', 'postUpScrollerFinalY', 'postUpScrollerDistancePx',
        'postUpScrollerVelocityPxPerSec', 'postUpMaxScrollY', 'postUpViewScrollY',
        'postTouchScrollerFrameSamples', 'postTouchScrollerActiveFrameSamples',
        'postTouchScrollerFirstCurrentY', 'postTouchScrollerLastCurrentY',
        'postTouchScrollerLastFinalY', 'postTouchScrollerMaxCurrentDeltaPx',
        'postTouchViewFirstY', 'postTouchViewLastY',
        'contentIntervalP50Ms', 'contentIntervalP95Ms', 'contentIntervalP99Ms',
        'contentIntervalWithinOneVsyncRatio', 'interval16_67msPlusRatio', 'interval33_3msPlusRatio',
        'interval50msPlusRatio', 'interval100msPlusRatio', 'maxContentStallMs',
        'drawEffectiveFps', 'drawContentIntervalP95Ms', 'drawMaxContentStallMs',
        'windowFrameEffectiveFps', 'windowFrameContentIntervalP95Ms', 'windowFrameMaxContentStallMs',
    ];
    const targetCount = Math.round(effectiveScrollProbe['effectiveScrollProbe.targetCount'] ?? 0);
    const scrollTargets = Array.from({ length: targetCount }, (_, index) => {
        const prefix = `effectiveScrollProbe.target${index}.`;
        return Object.fromEntries(probeTargetFields.flatMap((field) => {
            const value = effectiveScrollProbe[prefix + field];
            return value === undefined ? [] : [[field, value]];
        }));
    });
    console.info(`[EFFECTIVE_SCROLL_PROBE_SUMMARY] ${JSON.stringify({
        ...metadata,
        displayRefreshHz: stats.displayRefreshRate ?? effectiveScrollProbe['effectiveScrollProbe.displayRefreshHz'] ?? 0,
        estimatedDisplayVsyncFrames: effectiveScrollProbe['effectiveScrollProbe.vsyncSamples'] ?? 0,
        estimatedDisplayVsyncFps: effectiveScrollProbe['effectiveScrollProbe.vsyncFps'] ?? 0,
        estimatedMissedVsyncSlots: effectiveScrollProbe['effectiveScrollProbe.missedVsyncSlots'] ?? 0,
        choreographerCallbackSamples: effectiveScrollProbe['effectiveScrollProbe.choreographerCallbackSamples'] ?? 0,
        choreographerCallbackFps: effectiveScrollProbe['effectiveScrollProbe.choreographerCallbackFps'] ?? 0,
        choreographerCallbackIntervalP50Ms: effectiveScrollProbe['effectiveScrollProbe.choreographerCallbackIntervalP50Ms'] ?? 0,
        choreographerCallbackIntervalP95Ms: effectiveScrollProbe['effectiveScrollProbe.choreographerCallbackIntervalP95Ms'] ?? 0,
        windowFrameSamples: effectiveScrollProbe['effectiveScrollProbe.windowFrameSamples'] ?? 0,
        windowFrameFps: effectiveScrollProbe['effectiveScrollProbe.windowFrameFps'] ?? 0,
        windowFrameProbeAttached: effectiveScrollProbe['effectiveScrollProbe.windowFrameProbeAttached'] ?? 0,
        windowFrameDroppedCallbacks: effectiveScrollProbe['effectiveScrollProbe.windowFrameDroppedCallbacks'] ?? 0,
        windowFrameIntervalP50Ms: effectiveScrollProbe['effectiveScrollProbe.windowFrameIntervalP50Ms'] ?? 0,
        windowFrameIntervalP95Ms: effectiveScrollProbe['effectiveScrollProbe.windowFrameIntervalP95Ms'] ?? 0,
        elapsedMs: effectiveScrollProbe['effectiveScrollProbe.elapsedMs'] ?? 0,
        targets: scrollTargets,
    })}`);
    console.info(`[${label}_TOTALS] ${JSON.stringify({ ...metadata, totals: compact.totals, scrollViews: compact.scrollViews, effectiveScrollProbe, localGlass })}`);
    for (const [providerId, counters] of Object.entries(compact.providers)) {
        console.info(`[${label}_PROVIDER] ${JSON.stringify({ ...metadata, providerId, counters })}`);
    }
}

function subtractNativeSnapshot(
    current: NonNullable<Awaited<ReturnType<typeof getLiquidGlassPerformanceStats>>>,
    baseline: NonNullable<Awaited<ReturnType<typeof getLiquidGlassPerformanceStats>>> | null,
) {
    if (!baseline) return current;
    const delta: Record<string, number> = {};
    for (const [key, value] of Object.entries(current)) {
        delta[key] = key === 'displayRefreshRate' || key.startsWith('effectiveScrollProbe.')
            ? value
            : value - (baseline[key] ?? 0);
    }
    return delta;
}

const BenchmarkRow = memo(function BenchmarkRow({ id }: { id: number }) {
    return <ListRow title={`Benchmark row ${id}`} summary="固定原生行；滚动期间父级不更新" />;
});

function NativeTelemetryOverlay() {
    const [metrics, setMetrics] = useState({ displayHz: 0, uiFps: 0, jsFps: 0, captureRate: 0, glassDrawRate: 0, jsP95: 0, jsJank: 0 });
    const jsSamples = useRef<number[]>([]);
    const jsCounters = useRef({ frames: 0, windowStart: 0, fps: 0 });
    const lastJsFrame = useRef(0);

    useEffect(() => {
        let active = true;
        let frameId = 0;
        let pollPending = false;
        let previous: Awaited<ReturnType<typeof getLiquidGlassPerformanceStats>> = null;
        let previousAt = 0;

        const onAnimationFrame = (time: number) => {
            const counters = jsCounters.current;
            if (counters.windowStart === 0) counters.windowStart = time;
            if (lastJsFrame.current > 0) {
                jsSamples.current.push(time - lastJsFrame.current);
                if (jsSamples.current.length > 180) jsSamples.current.shift();
            }
            lastJsFrame.current = time;
            counters.frames += 1;
            if (time - counters.windowStart >= 500) {
                counters.fps = counters.frames * 1000 / (time - counters.windowStart);
                counters.frames = 0;
                counters.windowStart = time;
            }
            frameId = requestAnimationFrame(onAnimationFrame);
        };
        frameId = requestAnimationFrame(onAnimationFrame);

        const timer = setInterval(() => {
            if (pollPending) return;
            pollPending = true;
            void getLiquidGlassPerformanceStats().then((current) => {
                if (!active || !current) return;
                const now = Date.now();
                const elapsed = previousAt > 0 ? Math.max((now - previousAt) / 1000, 0.001) : 0.5;
                const rate = (key: 'uiFrameCount' | 'backdropCaptureCount' | 'consumerDrawCount') => {
                    if (!previous) return 0;
                    return Math.max(0, current[key] - previous[key]) / elapsed;
                };
                const intervals = [...jsSamples.current].sort((a, b) => a - b);
                const at = (fraction: number) => intervals.length
                    ? intervals[Math.floor((intervals.length - 1) * fraction)]
                    : 0;
                const p95 = intervals.length ? intervals[Math.floor((intervals.length - 1) * 0.95)] : 0;
                const hz = current.displayRefreshRate || 60;
                const jank = intervals.length
                    ? intervals.filter((interval) => interval > 1000 / hz).length * 100 / intervals.length
                    : 0;
                setMetrics({
                    displayHz: hz,
                    uiFps: rate('uiFrameCount'),
                    jsFps: jsCounters.current.fps,
                    captureRate: rate('backdropCaptureCount'),
                    glassDrawRate: rate('consumerDrawCount'),
                    jsP95: p95,
                    jsJank: jank,
                });
                if (__DEV__) {
                    console.info(
                        `[GLASS_JS] hz=${hz.toFixed(0)} fps=${jsCounters.current.fps.toFixed(1)} ` +
                        `p50=${at(0.50).toFixed(2)}ms p90=${at(0.90).toFixed(2)}ms ` +
                        `p95=${at(0.95).toFixed(2)}ms p99=${at(0.99).toFixed(2)}ms ` +
                        `jank=${jank.toFixed(1)}%`,
                    );
                }
                previous = current;
                previousAt = now;
            }).finally(() => {
                pollPending = false;
            });
        }, 500);

        return () => {
            active = false;
            cancelAnimationFrame(frameId);
            clearInterval(timer);
        };
    }, []);

    return (
        <View pointerEvents="none" style={styles.telemetry}>
            <NativeText style={styles.telemetryText}>
                {`Display ${metrics.displayHz.toFixed(0)}Hz · UI ${metrics.uiFps.toFixed(0)} · JS ${metrics.jsFps.toFixed(0)}fps\n` +
                    `Capture ${metrics.captureRate.toFixed(0)}/s · Glass ${metrics.glassDrawRate.toFixed(0)}/s\n` +
                    `JS P95 ${metrics.jsP95.toFixed(1)}ms · JS jank ${metrics.jsJank.toFixed(1)}%`}
            </NativeText>
        </View>
    );
}

export default function PerformanceBenchmark() {
    const { scene: rawScene, case: runCase, run, telemetry, nativeTelemetry, wallpaper, engine, surfaceRole, localRenderer, homeMode: homeModeParam, questionId: questionIdParam, questionRuntime: questionRuntimeParam, settingsRuntime: settingsRuntimeParam, routeCapture: routeCaptureParam, urlToken: urlTokenParam, contentId: contentIdParam, contentType: contentTypeParam, durationMs: durationMsParam, directComments: directCommentsParam, commentPerfMode: commentPerfModeParam, commentsExpectedRows: commentsExpectedRowsParam, commentListEngine: commentListEngineParam } = useLocalSearchParams<{
        scene?: string;
        case?: string;
        run?: string;
        telemetry?: string;
        nativeTelemetry?: string;
        wallpaper?: string;
        engine?: string;
        surfaceRole?: string;
        localRenderer?: string;
        homeMode?: string;
        questionRuntime?: string | string[];
        settingsRuntime?: string | string[];
        routeCapture?: string | string[];
        questionId?: string | string[];
        urlToken?: string | string[];
        contentId?: string | string[];
        contentType?: string | string[];
        durationMs?: string | string[];
        directComments?: string | string[];
        commentPerfMode?: string | string[];
        commentsExpectedRows?: string | string[];
        commentListEngine?: string | string[];
    }>();
    const router = useRouter();
    const scene = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].includes(rawScene ?? '') ? rawScene! : 'B';
    const durationValue = Array.isArray(durationMsParam) ? durationMsParam[0] : durationMsParam;
    const parsedDurationMs = Number.parseInt(durationValue ?? '', 10);
    const runDurationMs = Number.isFinite(parsedDurationMs)
        ? Math.max(RUN_DURATION_MS, Math.min(parsedDurationMs, 60_000))
        : RUN_DURATION_MS;
    const homeModeValue = Array.isArray(homeModeParam) ? homeModeParam[0] : homeModeParam;
    const requestedHomeMode = __DEV__ && (homeModeValue === 'normal' || homeModeValue === 'card' || homeModeValue === 'waterfall')
        ? homeModeValue
        : null;
    const theme = useTheme();
    const setThemeName = useSettingStore((state) => state.setThemeName);
    const setWallpaperUri = useSettingStore((state) => state.setWallpaperUri);
    const scrollRef = useRef<ScrollView>(null);
    const openedScenarioForSnapshot = useRef(false);
    const telemetryBaseline = useRef<Awaited<ReturnType<typeof getLiquidGlassPerformanceStats>>>(null);
    const previousGlassEngine = useRef(getGlassNativeEngine());
    const [selectedTab, setSelectedTab] = useState(0);
    const [dialogVisible, setDialogVisible] = useState(false);
    const [sheetVisible, setSheetVisible] = useState(false);
    const insets = useSafeAreaInsets();

    useEffect(() => {
        const restoreEngine = previousGlassEngine.current;
        setGlassNativeEngine(engine === 'core' ? 'core' : 'legacy');
        return () => setGlassNativeEngine(restoreEngine);
    }, [engine]);

    useEffect(() => {
        const role = surfaceRole === 'staticGroup' || surfaceRole === 'recycledCard' ? surfaceRole : null;
        const renderer = localRenderer === 'native' || localRenderer === 'skia' ? localRenderer : null;
        if (!role || !renderer) return;
        const previous = getSurfaceRendererPolicyOverride(role);
        setSurfaceRendererPolicyOverride(role, renderer);
        return () => setSurfaceRendererPolicyOverride(role, previous);
    }, [localRenderer, surfaceRole]);

    useEffect(() => {
        const enabled = telemetry === '1' || nativeTelemetry === '1';
        setLiquidGlassPerformanceTelemetryEnabled(enabled);
        setLocalGlassTelemetryEnabled(enabled);
        console.info(
            `[GLASS_BENCH_CONFIG] runtime=${getGlassNativeEngine()} staticGroup=${getSurfaceRendererPolicy('staticGroup')} ` +
            `recycledCard=${getSurfaceRendererPolicy('recycledCard')} telemetry=${enabled}`,
        );
        return () => {
            setLiquidGlassPerformanceTelemetryEnabled(false);
            setLocalGlassTelemetryEnabled(false);
        };
    }, [nativeTelemetry, run, telemetry]);

    useEffect(() => {
        const state = useSettingStore.getState();
        const previousTheme = state.themeName;
        const previousWallpaper = state.wallpaperUri;
        const nextTheme = scene === 'A' ? 'hyperos' : 'liquidGlass';
        setThemeName(nextTheme);
        if (wallpaper === 'on') {
            const source = Image.resolveAssetSource(require('../../assets/images/react-logo.png'));
            setWallpaperUri(source?.uri ?? null);
        } else if (wallpaper === 'off') {
            setWallpaperUri(null);
        }
        return () => {
            if (nextTheme !== previousTheme) setThemeName(previousTheme);
            if (wallpaper === 'on' || wallpaper === 'off') setWallpaperUri(previousWallpaper);
        };
    }, [scene, setThemeName, setWallpaperUri, wallpaper]);

    useEffect(() => {
        if (runCase === 'settings') {
            if (openedScenarioForSnapshot.current) return;
            let snapshotTimer: ReturnType<typeof setTimeout> | undefined;
            let active = true;
            const transition = setTimeout(() => {
                beginEffectiveScrollFpsSession('settings');
                void getLiquidGlassPerformanceStats().then((stats) => {
                    if (!active) return;
                    telemetryBaseline.current = stats;
                    openedScenarioForSnapshot.current = true;
                    console.info(`[GLASS_SETTINGS_TELEMETRY] action=open-settings engine=${getGlassNativeEngine()} stats=${JSON.stringify(stats)}`);
                    const settingsRuntime = Array.isArray(settingsRuntimeParam) ? settingsRuntimeParam[0] : settingsRuntimeParam;
                    const routeCapture = Array.isArray(routeCaptureParam) ? routeCaptureParam[0] : routeCaptureParam;
                    router.push({ pathname: '/settings', params: { runtime: settingsRuntime ?? '', routeCapture: routeCapture ?? '' } });
                    snapshotTimer = setTimeout(() => {
                        void Promise.all([getLiquidGlassPerformanceStats(), getLocalGlassTelemetry()]).then(([current, localGlass]) => {
                            if (!active || !current) return;
                            const delta = subtractNativeSnapshot(current, telemetryBaseline.current);
                            logGlassSnapshot('GLASS_SETTINGS_SNAPSHOT', { route: 'settings' }, delta, localGlass);
                        });
                    }, runDurationMs + 750);
                });
            }, 1_200);
            return () => {
                active = false;
                clearTimeout(transition);
                if (snapshotTimer) clearTimeout(snapshotTimer);
            };
        }
        if (runCase === 'home' || runCase === 'question' || runCase === 'people' || runCase === 'comments') {
            if (openedScenarioForSnapshot.current) return;
            let snapshotTimer: ReturnType<typeof setTimeout> | undefined;
            let active = true;
            let previousHomeMode: 'normal' | 'card' | 'waterfall' | null = null;
            const restoreHomeMode = () => {
                if (previousHomeMode == null) return;
                useSettingStore.getState().setMode(previousHomeMode);
                console.info(`[GLASS_BENCH_HOME_MODE] restored=${previousHomeMode}`);
                previousHomeMode = null;
            };
            const transition = setTimeout(() => {
                if (runCase === 'home' || runCase === 'question') beginPageRenderDiagnostics();
                if (runCase === 'comments') beginCommentRenderDiagnostics();
                beginEffectiveScrollFpsSession(runCase);
                void getLiquidGlassPerformanceStats().then((stats) => {
                    if (!active || !stats) return;
                    telemetryBaseline.current = stats;
                    openedScenarioForSnapshot.current = true;
                    const questionId = Array.isArray(questionIdParam) ? questionIdParam[0] : questionIdParam;
                    const urlToken = Array.isArray(urlTokenParam) ? urlTokenParam[0] : urlTokenParam;
                    const contentId = Array.isArray(contentIdParam) ? contentIdParam[0] : contentIdParam;
                    const contentType = Array.isArray(contentTypeParam) ? contentTypeParam[0] : contentTypeParam;
                    const directComments = Array.isArray(directCommentsParam) ? directCommentsParam[0] : directCommentsParam;
                    const commentPerfMode = Array.isArray(commentPerfModeParam) ? commentPerfModeParam[0] : commentPerfModeParam;
                    const commentsExpectedRows = Array.isArray(commentsExpectedRowsParam) ? commentsExpectedRowsParam[0] : commentsExpectedRowsParam;
                    const commentListEngine = Array.isArray(commentListEngineParam) ? commentListEngineParam[0] : commentListEngineParam;
                    const questionRuntime = Array.isArray(questionRuntimeParam) ? questionRuntimeParam[0] : questionRuntimeParam;
                    const target = runCase === 'question'
                        ? { pathname: '/question' as const, params: { id: questionId ?? '', questionRuntime: questionRuntime ?? '' } }
                            : runCase === 'people'
                                ? { pathname: '/people' as const, params: { urlToken: urlToken ?? '' } }
                                : runCase === 'comments'
                                    ? { pathname: '/item/[type]/[id]/comment' as const, params: { id: contentId ?? '', type: contentType === 'article' ? 'article' : 'answer', perfRunId: run ?? 'adhoc', perfDurationMs: String(runDurationMs), perfMode: commentPerfMode ?? '', perfExpectedRows: commentsExpectedRows ?? '', perfGlassEngine: engine === 'core' ? 'core' : '', perfListEngine: commentListEngine === 'flashlist' ? 'flashlist' : 'flatlist' } }
                                    : '/(tabs)' as const;
                    if ((runCase === 'question' && !questionId) || (runCase === 'people' && !urlToken) || (runCase === 'comments' && !contentId)) {
                        console.error(`[GLASS_SCENARIO] missing target parameter for ${runCase}`);
                        return;
                    }
                    if (runCase === 'home' && requestedHomeMode) {
                        previousHomeMode = useSettingStore.getState().mode;
                        useSettingStore.getState().setMode(requestedHomeMode);
                        console.info(`[GLASS_BENCH_HOME_MODE] previous=${previousHomeMode} selected=${requestedHomeMode}`);
                    }
                    console.info(`[GLASS_SCENARIO] action=open route=${runCase} questionId=${questionId ?? ''} urlToken=${urlToken ?? ''}`);
                    if (runCase === 'comments' && directComments === '1') router.replace(target);
                    else router.push(target);
                    snapshotTimer = setTimeout(() => {
                        void Promise.all([getLiquidGlassPerformanceStats(), getLocalGlassTelemetry()]).then(([current, localGlass]) => {
                            if (!active || !current) return;
                            const delta = subtractNativeSnapshot(current, telemetryBaseline.current);
                            logGlassSnapshot('GLASS_SCENARIO_SNAPSHOT', { route: runCase, questionId: questionId ?? null, urlToken: urlToken ?? null, contentId: contentId ?? null, contentType: contentType ?? null }, delta, localGlass);
                            if (runCase === 'comments') {
                                console.info(`[COMMENTS_RENDER_DIAGNOSTICS] ${JSON.stringify(snapshotCommentRenderDiagnostics())}`);
                            }
                            if (runCase === 'home' || runCase === 'question') {
                                console.info(`[PAGE_RENDER_DIAGNOSTICS] route=${runCase} ${JSON.stringify(snapshotPageRenderDiagnostics())}`);
                            }
                            restoreHomeMode();
                        });
                    }, runDurationMs + 750);
                });
            }, 1_200);
            return () => {
                active = false;
                clearTimeout(transition);
                if (snapshotTimer) clearTimeout(snapshotTimer);
                restoreHomeMode();
            };
        }
        if (runCase === 'route') {
            let step = 0;
            let transition: ReturnType<typeof setTimeout> | undefined;
            const navigate = () => {
                if (step >= 10) return;
                const action = step % 2 === 0 ? 'push' : 'back';
                console.info(`[GLASS_ROUTE_BENCH] action=${action} step=${step + 1} at=${Date.now()}`);
                if (action === 'push') router.push('/settings');
                else router.back();
                step += 1;
                transition = setTimeout(navigate, 1_200);
            };
            transition = setTimeout(navigate, 1_500);
            return () => {
                if (transition) clearTimeout(transition);
            };
        }
        if (runCase !== 'scroll' && runCase !== 'dialog' && runCase !== 'sheet' && runCase !== 'tab') return;
        let tick = 0;
        let phase = false;
        let interval: ReturnType<typeof setInterval> | undefined;
        let finish: ReturnType<typeof setTimeout> | undefined;
        const start = setTimeout(() => {
            if (runCase === 'sheet') {
                tick = 1;
                console.info(`[GLASS_SHEET_BENCH] action=open at=${Date.now()}`);
                setSheetVisible(true);
                finish = setTimeout(() => {
                    console.info(`[GLASS_SHEET_BENCH] action=close at=${Date.now()}`);
                    setSheetVisible(false);
                    console.info(`[GLASS_BENCH] scene=${scene} case=${runCase} run=${run ?? '0'} durationMs=${RUN_DURATION_MS} actions=${tick}`);
                }, RUN_DURATION_MS);
                return;
            }
            interval = setInterval(() => {
                tick += 1;
                if (runCase === 'scroll') {
                    const maxY = Math.max(0, ROWS.length * 96 - 1_600);
                    scrollRef.current?.scrollTo({ y: (tick * 420) % maxY, animated: true });
                } else if (runCase === 'tab') {
                    setSelectedTab(tick % TABS.length);
                } else if (runCase === 'dialog') {
                    phase = !phase;
                    setDialogVisible(phase);
                } else {
                    phase = !phase;
                    setSheetVisible(phase);
                }
            }, runCase === 'scroll' ? 250 : runCase === 'tab' ? 320 : 600);
            finish = setTimeout(() => {
                if (interval) clearInterval(interval);
                setDialogVisible(false);
                setSheetVisible(false);
                if (__DEV__) {
                    console.info(`[GLASS_BENCH] scene=${scene} case=${runCase} run=${run ?? '0'} durationMs=${RUN_DURATION_MS} actions=${tick}`);
                }
            }, RUN_DURATION_MS);
        }, 2_000);
        return () => {
            clearTimeout(start);
            if (interval) clearInterval(interval);
            if (finish) clearTimeout(finish);
        };
    }, [runCase, run, scene, router, engine, questionIdParam, questionRuntimeParam, settingsRuntimeParam, routeCaptureParam, urlTokenParam, contentIdParam, contentTypeParam, durationMsParam, directCommentsParam, commentPerfModeParam, commentsExpectedRowsParam, commentListEngineParam, runDurationMs, requestedHomeMode]);

    const rowContent = useMemo(() => ROWS.map((id) => <BenchmarkRow key={id} id={id} />), []);
    const noOp = useCallback(() => {}, []);
    const hasScrollScene = scene === 'A' || scene === 'C' || scene === 'D' || scene === 'E' || scene === 'F' || scene === 'G';

    return (
        <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
            {scene !== 'C' ? (
                <View style={[styles.titleBlock, { paddingTop: insets.top + 10 }]}>
                    <Text type="title4" weight="medium">Liquid Glass 性能场景 {scene}</Text>
                    <Text type="footnote2" color={theme.colors.onSurfaceVariantSummary}>
                        {`case=${runCase ?? 'idle'} · ${wallpaper === 'on' ? 'wallpaper on' : 'wallpaper off'}`}
                    </Text>
                </View>
            ) : null}

            {scene === 'C' ? <TopAppBar title="Fixed Glass TopAppBar" back={noOp} /> : null}

            {scene === 'B' ? (
                <View style={styles.staticScene}>
                    <View style={styles.colorField} />
                    <GlassSurface
                        variant="card"
                        positioning="floating"
                        sampling="backdrop"
                        style={styles.singleGlass}
                        placeholderChildren={<View style={styles.singleGlass} />}
                    >
                        <View style={styles.glassLabel}><Text type="headline1" weight="medium">One static GlassSurface</Text></View>
                    </GlassSurface>
                </View>
            ) : null}

            {scene === 'E' ? (
                <View style={styles.threeGlassRow}>
                    {[1, 2, 3].map((id) => (
                        <GlassSurface
                            key={id}
                            variant="card"
                            positioning="floating"
                            sampling="backdrop"
                            style={styles.smallGlass}
                            placeholderChildren={<View style={styles.smallGlass} />}
                        >
                            <View style={styles.glassLabel}><Text type="footnote1" weight="medium">Glass {id}</Text></View>
                        </GlassSurface>
                    ))}
                </View>
            ) : null}

            {scene === 'H' ? (
                <View style={styles.tabScene}>
                    <GlassTabBar
                        items={TABS}
                        selected={selectedTab}
                        onSelect={setSelectedTab}
                        onSelectFromDrag={setSelectedTab}
                        presentation="inline"
                        width="100%"
                        height={76}
                    />
                    <Text type="footnote2" color={theme.colors.onSurfaceVariantSummary}>
                        在此条形区域左右快拖 Lens；query case=tab 仅用于记录场景
                    </Text>
                </View>
            ) : null}

            {scene === 'D' ? (
                <View style={styles.scrollScene}>
                    <ScrollView
                        key={scene}
                        ref={scrollRef}
                        style={styles.scroll}
                        contentContainerStyle={styles.rows}
                        showsVerticalScrollIndicator={false}
                    >
                        {rowContent}
                    </ScrollView>
                    <GlassSurface
                        variant="floating"
                        positioning="floating"
                        sampling="backdrop"
                        pointerEvents="none"
                        style={styles.scrollGlass}
                        placeholderChildren={<View style={styles.scrollGlass} />}
                    />
                </View>
            ) : null}

            {hasScrollScene && scene !== 'D' ? (
                <ScrollView
                    key={scene}
                    ref={scrollRef}
                    style={styles.scroll}
                    contentContainerStyle={styles.rows}
                    showsVerticalScrollIndicator={false}
                >
                    {rowContent}
                </ScrollView>
            ) : null}

            {scene === 'F' ? (
                <View style={styles.actions}>
                    <Button onPress={() => setDialogVisible(true)}>Open Dialog</Button>
                </View>
            ) : null}
            {scene === 'G' ? (
                <View style={styles.actions}>
                    <Button onPress={() => setSheetVisible(true)}>Open BottomSheet</Button>
                </View>
            ) : null}

            <Dialog visible={dialogVisible} onClose={() => setDialogVisible(false)} title="Glass Dialog" summary="Backdrop stays cached while this glass animates.">
                <Button onPress={() => setDialogVisible(false)}>Close</Button>
            </Dialog>
            <BottomSheet visible={sheetVisible} onClose={() => setSheetVisible(false)} title="Glass BottomSheet">
                <Button onPress={() => setSheetVisible(false)}>Close</Button>
            </BottomSheet>

            {telemetry === '1' ? <NativeTelemetryOverlay /> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    titleBlock: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, gap: 3 },
    scroll: { flex: 1 },
    rows: { paddingHorizontal: 16, paddingBottom: 64 },
    staticScene: { flex: 1, margin: 16, minHeight: 280, justifyContent: 'center' },
    colorField: { ...StyleSheet.absoluteFillObject, borderRadius: 28, backgroundColor: '#5778b5' },
    singleGlass: { width: '88%', height: 160, alignSelf: 'center', borderRadius: 28 },
    glassLabel: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    threeGlassRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 12 },
    smallGlass: { flex: 1, height: 72, borderRadius: 18 },
    tabScene: { paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
    scrollScene: { flex: 1 },
    scrollGlass: { position: 'absolute', left: 18, right: 18, top: 160, height: 250, borderRadius: 28 },
    actions: { paddingHorizontal: 16, paddingBottom: 28 },
    telemetry: { position: 'absolute', top: 120, right: 10, zIndex: 9999, padding: 8, borderRadius: 8, backgroundColor: '#07111ddd' },
    telemetryText: { color: '#fff', fontSize: 11, lineHeight: 16, fontVariant: ['tabular-nums'] },
});

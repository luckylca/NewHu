import { BottomSheet, Button, Dialog, GlassSurface, ListRow, Text, TopAppBar, useTheme } from '@/src/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSettingStore } from '@/src/stores/useSettingStore';
import {
    getLiquidGlassPerformanceStats,
    GlassTabBar,
    getGlassNativeEngine,
    setLiquidGlassPerformanceTelemetryEnabled,
    setGlassNativeEngine,
} from '@newhu/react-native-liquid-glass';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text as NativeText, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ROWS = Array.from({ length: 160 }, (_, index) => index + 1);
const TABS = [{ label: '推荐' }, { label: '关注' }, { label: '热榜' }];
const RUN_DURATION_MS = 12_000;

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
    const { scene: rawScene, case: runCase, run, telemetry, nativeTelemetry, wallpaper, engine } = useLocalSearchParams<{
        scene?: string;
        case?: string;
        run?: string;
        telemetry?: string;
        nativeTelemetry?: string;
        wallpaper?: string;
        engine?: string;
    }>();
    const router = useRouter();
    const scene = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].includes(rawScene ?? '') ? rawScene! : 'B';
    const theme = useTheme();
    const setThemeName = useSettingStore((state) => state.setThemeName);
    const setWallpaperUri = useSettingStore((state) => state.setWallpaperUri);
    const scrollRef = useRef<ScrollView>(null);
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
        const enabled = telemetry === '1' || nativeTelemetry === '1';
        setLiquidGlassPerformanceTelemetryEnabled(enabled);
        return () => setLiquidGlassPerformanceTelemetryEnabled(false);
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
    }, [runCase, run, scene, router]);

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

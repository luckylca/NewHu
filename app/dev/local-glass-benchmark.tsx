import { BottomSheet, Card, useTheme } from '@/src/ui';
import { CommentInteractionHost } from '@/src/components/CommentInteractionHost';
import { CommentItem } from '@/src/components/CommentItem';
import type { CommentViewModel } from '@/src/components/CommentItem';
import { useSettingStore } from '@/src/stores/useSettingStore';
import { getGlassRuntime, getLocalGlassTelemetry, setGlassRuntime, setLiquidGlassPerformanceTelemetryEnabled, setLocalGlassHardwareLayerExperimentEnabled, setLocalGlassTelemetryEnabled, setLocalGlassVisibleItemCount } from '@newhu/react-native-liquid-glass';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useLocalSearchParams } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text as NativeText, View, useWindowDimensions } from 'react-native';

const DEFAULT_COUNT = 40;
const RUN_DURATION_MS = 12_000;
type Scene = 'normal' | 'card' | 'waterfall' | 'comments' | 'child' | 'sheet';

type BenchItem = {
    id: string;
    index: number;
    height: number;
    comment: CommentViewModel;
};

const BenchmarkFeedCard = memo(function BenchmarkFeedCard({ item, mode }: { item: BenchItem; mode: Scene }) {
    const theme = useTheme();
    return (
        <Card
            feedback="sink"
            glassVariant="preferencePanel"
            style={mode === 'waterfall' ? styles.waterfallCard : undefined}
            contentStyle={[
                styles.feedCard,
                { minHeight: item.height, padding: mode === 'waterfall' ? 12 : 16 },
                mode === 'card' ? styles.cardMode : undefined,
            ]}
        >
            <NativeText numberOfLines={2} style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
                {`本地玻璃性能样本 ${item.index + 1}`}
            </NativeText>
            <NativeText numberOfLines={mode === 'waterfall' ? 4 : 5} style={[styles.cardBody, { color: theme.colors.onSurfaceVariantSummary }]}>
                {`固定的列表内容用于比较同一 Local Glass renderer。滚动时此子树和材质参数保持不变。${item.index % 2 ? ' 内容高度略有变化，用来覆盖自然列表尺寸。' : ''}`}
            </NativeText>
        </Card>
    );
});

const CommentRow = memo(function CommentRow({ item }: { item: BenchItem }) {
    return <CommentItem item={item.comment} onOpenReplies={() => {}} onReply={() => {}} />;
});

function makeItems(count: number, scene: Scene): BenchItem[] {
    return Array.from({ length: count }, (_, index) => {
        const height = scene === 'card' ? 360 : scene === 'waterfall' ? 150 + (index % 4) * 28 : 230 + (index % 3) * 38;
        const comment: CommentViewModel = {
            id: `local:glass-benchmark-${scene}-${index}`,
            content: `固定评论样本 ${index + 1}。${'用于采样 Local Glass 评论材质、真实 CommentItem 内容树和 Swipeable 列表挂载路径。'.repeat(index % 3 === 0 ? 2 : 1)}`,
            createdTime: 1_750_000_000 - index * 60,
            authorName: index % 5 === 0 ? '内容作者' : `测试用户 ${index + 1}`,
            voteCount: index % 87,
            isVote: false,
            isAuthor: index % 5 === 0,
            isAuthorFromApi: true,
            isHot: index % 11 === 0,
            isTop: index === 0,
            childCommentCount: index % 4 === 0 ? 3 : 0,
        };
        return { id: `${scene}-${index}`, index, height, comment };
    });
}

export default function LocalGlassBenchmark() {
    const params = useLocalSearchParams<{ scene?: string; count?: string; run?: string; startDelayMs?: string; telemetry?: string; hardwareLayer?: string; theme?: string; renderer?: string; engine?: string; list?: string }>();
    const focused = useIsFocused();
    const rawScene = params.scene ?? 'normal';
    const scene: Scene = ['normal', 'card', 'waterfall', 'comments', 'child', 'sheet'].includes(rawScene) ? rawScene as Scene : 'normal';
    const parsedCount = Number.parseInt(params.count ?? '', 10);
    const count = Number.isFinite(parsedCount) ? Math.min(80, Math.max(5, parsedCount)) : DEFAULT_COUNT;
    const parsedStartDelay = Number.parseInt(params.startDelayMs ?? '', 10);
    const startDelayMs = Number.isFinite(parsedStartDelay) ? Math.min(10_000, Math.max(0, parsedStartDelay)) : 1800;
    // Native counters independently verify FLAG_DEBUGGABLE; requiring __DEV__
    // here hid telemetry when using a debuggable APK with a bundled JS entry.
    const telemetry = params.telemetry === '1';
    const targetThemeName = params.theme === 'hyperos' ? 'hyperos' : 'liquidGlass';
    const theme = useTheme();
    const setThemeName = useSettingStore((state) => state.setThemeName);
    const setWallpaperUri = useSettingStore((state) => state.setWallpaperUri);
    const setMode = useSettingStore((state) => state.setMode);
    const listRef = useRef<FlatList<BenchItem>>(null);
    const flashListRef = useRef<FlashListRef<BenchItem>>(null);
    const scrollRef = useRef<ScrollView>(null);
    const finish = useRef<ReturnType<typeof setTimeout> | null>(null);
    const scrollInterval = useRef<ReturnType<typeof setInterval> | null>(null);
    const { height: screenHeight, width: screenWidth } = useWindowDimensions();
    const [ready, setReady] = useState(false);
    const [sheetVisible, setSheetVisible] = useState(false);
    const [waterfallWindow, setWaterfallWindow] = useState(() => ({ start: 0, end: screenHeight * 3 }));
    const waterfallOffset = useRef(0);
    const items = useMemo(() => makeItems(count, scene), [count, scene]);
    const previous = useRef({
        theme: useSettingStore.getState().themeName,
        wallpaper: useSettingStore.getState().wallpaperUri,
        mode: useSettingStore.getState().mode,
        runtime: getGlassRuntime(),
    });
    useEffect(() => {
        const restore = previous.current;
        const requestedRuntime = params.engine ?? params.renderer;
        setGlassRuntime({ engine: requestedRuntime === 'core' ? 'core' : 'legacy' });
        setThemeName(targetThemeName);
        setWallpaperUri(null);
        setMode(scene === 'card' ? 'card' : scene === 'waterfall' ? 'waterfall' : 'normal');
        setReady(true);
        return () => {
            setThemeName(restore.theme);
            setWallpaperUri(restore.wallpaper);
            setMode(restore.mode);
            setGlassRuntime(restore.runtime);
        };
    }, [params.engine, params.hardwareLayer, params.renderer, scene, setMode, setThemeName, setWallpaperUri, targetThemeName, telemetry]);

    useEffect(() => {
        if (!ready || !focused || !telemetry) return;
        const timer = setTimeout(() => {
            console.info(`[LOCAL_GLASS_BENCHMARK_READY] scene=${scene} count=${count}`);
        }, 1200);
        return () => clearTimeout(timer);
    }, [count, focused, ready, scene, telemetry]);

    useEffect(() => {
        const active = ready && focused && telemetry;
        setLocalGlassTelemetryEnabled(active);
        setLocalGlassHardwareLayerExperimentEnabled(active && params.hardwareLayer === '1');
        setLiquidGlassPerformanceTelemetryEnabled(active);
        if (!active) return;
        const timer = setInterval(() => {
            void getLocalGlassTelemetry().then((stats) => {
                if (stats) console.info(`[LOCAL_GLASS_COUNTS] scene=${scene} count=${count} run=${params.run ?? 'idle'} ${JSON.stringify(stats)}`);
            });
        }, 1000);
        return () => {
            clearInterval(timer);
            setLocalGlassTelemetryEnabled(false);
            setLocalGlassHardwareLayerExperimentEnabled(false);
            setLiquidGlassPerformanceTelemetryEnabled(false);
        };
    }, [count, focused, params.hardwareLayer, params.run, ready, scene, telemetry]);

    useEffect(() => {
        if (!ready || params.run === undefined) return;
        let tick = 0;
        const maxOffset = Math.max(1, count * (scene === 'card' ? 360 : scene === 'waterfall' ? 190 : 270) - screenHeight);
        const start = setTimeout(() => {
            if (telemetry) {
                setLocalGlassTelemetryEnabled(true);
                setLiquidGlassPerformanceTelemetryEnabled(true);
            }
            console.info(`[LOCAL_GLASS_BENCHMARK_START] scene=${scene} count=${count} run=${params.run ?? 'idle'}`);
            scrollInterval.current = setInterval(() => {
                tick += 1;
                const offset = (tick * 420) % maxOffset;
                if (scene === 'waterfall') scrollRef.current?.scrollTo({ y: offset, animated: true });
                else if (params.list === 'flash') flashListRef.current?.scrollToOffset({ offset, animated: true });
                else listRef.current?.scrollToOffset({ offset, animated: true });
            }, 250);
            finish.current = setTimeout(() => {
                if (scrollInterval.current) clearInterval(scrollInterval.current);
                scrollInterval.current = null;
            }, RUN_DURATION_MS);
        }, startDelayMs);
        return () => {
            clearTimeout(start);
            if (finish.current) clearTimeout(finish.current);
            if (scrollInterval.current) clearInterval(scrollInterval.current);
        };
    }, [count, params.list, params.run, ready, scene, screenHeight, startDelayMs, telemetry]);

    useEffect(() => {
        setSheetVisible(false);
        if (!ready || scene !== 'sheet') return;
        // Let opt-in native telemetry finish its setup before the one-shot
        // route snapshot is requested by the sheet.
        const timer = setTimeout(() => setSheetVisible(true), 700);
        return () => clearTimeout(timer);
    }, [ready, scene]);

    const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: { isViewable: boolean }[] }) => {
        setLocalGlassVisibleItemCount(viewableItems.filter((entry) => entry.isViewable).length);
    }).current;
    const renderCard = useCallback(({ item }: { item: BenchItem }) => <BenchmarkFeedCard item={item} mode={scene} />, [scene]);
    const renderComment = useCallback(({ item }: { item: BenchItem }) => <CommentRow item={item} />, []);

    const waterfallPlacements = useMemo(() => {
        const gap = 12;
        const cardWidth = (screenWidth - 36) / 2;
        const y = [0, 0];
        return items.map((item) => {
            const column = y[0] <= y[1] ? 0 : 1;
            const top = y[column];
            y[column] += item.height + gap;
            return { item, column, top, width: cardWidth };
        });
    }, [items, screenWidth]);
    const waterfallHeight = waterfallPlacements.reduce((height, placement) => Math.max(height, placement.top + placement.item.height), 0);

    const updateWaterfallWindow = useCallback((offset: number) => {
        waterfallOffset.current = offset;
        const next = { start: Math.max(0, offset - screenHeight * 1.5), end: offset + screenHeight * 3 };
        setLocalGlassVisibleItemCount(waterfallPlacements.filter(({ top, item }) => (
            top + item.height >= offset && top <= offset + screenHeight
        )).length);
        setWaterfallWindow((current) => (
            Math.abs(next.start - current.start) < screenHeight * 0.45 && Math.abs(next.end - current.end) < screenHeight * 0.45
                ? current
                : next
        ));
    }, [screenHeight, waterfallPlacements]);

    useEffect(() => {
        if (ready && scene === 'waterfall') updateWaterfallWindow(waterfallOffset.current);
    }, [ready, scene, updateWaterfallWindow]);

    if (!ready) return <View style={[styles.root, { backgroundColor: theme.colors.background }]} />;

    const content = (
        <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
            <View style={styles.header}>
                <NativeText style={[styles.headerTitle, { color: theme.colors.onSurface }]}>
                    Local Glass 基准 · {scene} · {count}
                </NativeText>
                <NativeText style={[styles.headerSubtitle, { color: theme.colors.onSurfaceVariantSummary }]}> 
                    {`run=${params.run ?? 'idle'} list=${params.list === 'flash' ? 'flash' : 'flat'} telemetry=${telemetry ? 'on' : 'off'} engine=${params.engine === 'core' ? 'core' : 'legacy'} renderer=${params.renderer === 'core' ? 'core' : 'legacy'} layer=${params.hardwareLayer === '1' ? 'on' : 'off'} · ${theme.name}`}
                </NativeText>
            </View>

            {scene === 'waterfall' ? (
                <ScrollView
                    ref={scrollRef}
                    onScroll={(event) => updateWaterfallWindow(event.nativeEvent.contentOffset.y)}
                    scrollEventThrottle={100}
                    contentContainerStyle={{ height: waterfallHeight + 24 }}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={{ position: 'relative', width: '100%', height: waterfallHeight }}>
                        {waterfallPlacements.filter(({ top, item }) => top + item.height >= waterfallWindow.start && top <= waterfallWindow.end).map(({ item, column, top, width }) => (
                            <View key={item.id} style={{ position: 'absolute', top, left: 12 + column * (width + 12), width }}>
                                <BenchmarkFeedCard item={item} mode="waterfall" />
                            </View>
                        ))}
                    </View>
                </ScrollView>
            ) : (
                <>
                    {params.list === 'flash' ? (
                        <FlashList
                            ref={flashListRef}
                            data={items}
                            renderItem={scene === 'comments' || scene === 'child' ? renderComment : renderCard}
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={scene === 'card' ? styles.cardList : styles.listContent}
                            onViewableItemsChanged={onViewableItemsChanged}
                            viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
                            showsVerticalScrollIndicator={false}
                        />
                    ) : (
                        <FlatList
                            ref={listRef}
                            data={items}
                            renderItem={scene === 'comments' || scene === 'child' ? renderComment : renderCard}
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={scene === 'card' ? styles.cardList : styles.listContent}
                            snapToInterval={scene === 'card' ? 360 : undefined}
                            decelerationRate={scene === 'card' ? 0.96 : 'normal'}
                            initialNumToRender={scene === 'card' ? 2 : scene === 'comments' || scene === 'child' ? 5 : 4}
                            maxToRenderPerBatch={scene === 'card' ? 3 : scene === 'comments' || scene === 'child' ? 5 : 4}
                            windowSize={scene === 'card' ? 3 : 5}
                            updateCellsBatchingPeriod={scene === 'card' ? 80 : 48}
                            removeClippedSubviews
                            onViewableItemsChanged={onViewableItemsChanged}
                            viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
                            showsVerticalScrollIndicator={false}
                        />
                    )}
                    {scene === 'sheet' ? (
                        <BottomSheet visible={sheetVisible} title="AI 分析" onClose={() => {}}>
                            <ScrollView style={{ maxHeight: screenHeight * 0.58 }} contentContainerStyle={{ gap: 16, paddingBottom: 20 }}>
                                {Array.from({ length: 7 }, (_, index) => (
                                    <View key={index} style={{ gap: 6 }}>
                                        <NativeText style={[styles.cardTitle, { color: theme.colors.onGlass }]}>
                                            {index === 0 ? '一句话总结' : `分析区块 ${index + 1}`}
                                        </NativeText>
                                        <NativeText style={[styles.cardBody, { color: theme.colors.onGlassSecondary }]}>
                                            {'稳定的主题背景采样可以保留玻璃边缘和折射质感，同时避免把文章正文模糊成高对比色块。'.repeat(index % 2 ? 2 : 1)}
                                        </NativeText>
                                    </View>
                                ))}
                            </ScrollView>
                        </BottomSheet>
                    ) : null}
                </>
            )}
        </View>
    );

    return scene === 'comments' || scene === 'child'
        ? <CommentInteractionHost>{content}</CommentInteractionHost>
        : content;
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    header: { paddingTop: 54, paddingHorizontal: 16, paddingBottom: 8 },
    headerTitle: { fontSize: 16, fontWeight: '600' },
    headerSubtitle: { fontSize: 12, marginTop: 4 },
    listContent: { paddingHorizontal: 12, paddingBottom: 48, gap: 8 },
    cardList: { alignItems: 'center', paddingTop: 24, paddingBottom: 24, gap: 8 },
    feedCard: { width: '100%', borderRadius: 18, gap: 10 },
    cardMode: { width: '92%', minHeight: 336, justifyContent: 'center' },
    waterfallCard: { width: '100%' },
    cardTitle: { fontSize: 16, fontWeight: '600' },
    cardBody: { fontSize: 14, lineHeight: 21 },
});

import { AI_TEXT_SENSITIVITY_THRESHOLDS, type AiTextDetectionSensitivity } from '@/src/services/aiTextDetectorCore';
import { useSettingStore } from '@/src/stores/useSettingStore';
import { useAiAnalysisStore } from '@/src/stores/useAiAnalysisStore';
import { useUserStore } from '@/src/stores/useUserStore';
import { Divider, Icon, ListRow, PageScaffold, PageScrollView, PageSettingsList, PreferenceGroup, Switch, TopAppBar } from '@/src/ui';
import { Text } from '@/src/ui/primitives';
import type { IconName } from '@/src/ui/primitives';
import { useTheme } from '@/src/ui/theme';
import { getGlassNativeEngine } from '@newhu/react-native-liquid-glass';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import type { ReactNode } from 'react';
import { FlatList, View } from 'react-native';

const SETTINGS_BENCHMARK_SCROLL_DISTANCE = 640;
const SETTINGS_BENCHMARK_DEFAULT_DURATION_MS = 12_000;

type SettingsBenchmarkScrollTarget = { scrollTo: (offset: number, animated: boolean) => void };

export default function SettingsScreen() {
    const { settingsBenchCase, settingsBenchRun, settingsBenchDurationMs } = useLocalSearchParams<{ settingsBenchCase?: string; settingsBenchRun?: string; settingsBenchDurationMs?: string }>();
    const benchmarkCase = settingsBenchCase?.toUpperCase();
    const benchmarkEnabled = ['A', 'B', 'C', 'D', 'E', 'F', 'F0', 'F1', 'F2', 'F3', 'F4'].includes(benchmarkCase ?? '');
    const benchmarkScrollTarget = React.useRef<SettingsBenchmarkScrollTarget | null>(null);
    const benchmarkContentHeight = React.useRef(0);
    const benchmarkViewportHeight = React.useRef(0);
    const theme = useTheme();
    const requestedDuration = Number(settingsBenchDurationMs);
    const benchmarkDurationMs = Number.isFinite(requestedDuration) && requestedDuration >= 1000
        ? requestedDuration
        : SETTINGS_BENCHMARK_DEFAULT_DURATION_MS;
    const isLoggedIn = useUserStore((state) => state.isLoggedIn);
    const username = useUserStore((state) => state.username);
    const filterAds = useSettingStore((state) => state.isAds);
    const filterPaid = useSettingStore((state) => state.isPaid);
    const setFilterAds = useSettingStore((state) => state.setAds);
    const setFilterPaid = useSettingStore((state) => state.setPaid);
    const deduplicateFeed = useSettingStore((state) => state.deduplicateFeed);
    const setDeduplicateFeed = useSettingStore((state) => state.setDeduplicateFeed);
    const browseAndSaveOfflineEnabled = useSettingStore((state) => state.browseAndSaveOfflineEnabled);
    const setBrowseAndSaveOfflineEnabled = useSettingStore((state) => state.setBrowseAndSaveOfflineEnabled);
    const browseAndSaveWithImages = useSettingStore((state) => state.browseAndSaveWithImages);
    const setBrowseAndSaveWithImages = useSettingStore((state) => state.setBrowseAndSaveWithImages);
    const aiTextDetectionEnabled = useSettingStore((state) => state.aiTextDetectionEnabled);
    const setAiTextDetectionEnabled = useSettingStore((state) => state.setAiTextDetectionEnabled);
    const aiSensitivity = useSettingStore((state) => state.aiTextDetectionSensitivity);
    const aiAnalysisEnabled = useAiAnalysisStore((state) => state.enabled);
    const aiAnalysisModel = useAiAnalysisStore((state) => state.model);
    const setAiSensitivity = useSettingStore((state) => state.setAiTextDetectionSensitivity);
    const trailingChevron = React.useMemo(
        () => <Icon name="chevron-right" size={22} color={theme.colors.onSurfaceVariantActions} />,
        [theme.colors.onSurfaceVariantActions],
    );

    const settingsSections = React.useMemo(() => [
        {
            key: 'account',
            node: (
                <PreferenceGroup title="账号">
                    <SettingRow
                        icon="account-circle-outline"
                        title="账号管理"
                        summary={isLoggedIn ? `已登录 · ${username}` : '未登录'}
                        trailing={trailingChevron}
                        onPress={() => router.push(isLoggedIn ? '/userinfo' : '/webview')}
                    />
                </PreferenceGroup>
            ),
        },
        {
            key: 'content',
            node: (
                <PreferenceGroup title="内容">
                    <SettingRow
                        icon="advertisements-off"
                        title="过滤推广内容"
                        summary="隐藏推荐流中的广告"
                        trailing={<Switch value={filterAds} interactive={false} />}
                        onPress={() => setFilterAds(!filterAds)}
                    />
                    <Divider style={{ marginLeft: 60 }} />
                    <SettingRow
                        icon="lock-outline"
                        title="隐藏付费内容"
                        summary="过滤需要付费阅读的内容"
                        trailing={<Switch value={filterPaid} interactive={false} />}
                        onPress={() => setFilterPaid(!filterPaid)}
                    />
                    <Divider style={{ marginLeft: 60 }} />
                    <SettingRow
                        icon="content-duplicate"
                        title="去除重复推送"
                        summary="不再展示已经推送过的文章和回答"
                        trailing={<Switch value={deduplicateFeed} interactive={false} />}
                        onPress={() => setDeduplicateFeed(!deduplicateFeed)}
                    />
                    <Divider style={{ marginLeft: 60 }} />
                    <SettingRow
                        icon="download-outline"
                        title="边看边存"
                        summary={`刷新时额外获取一页，缓存正文、最多 100 条根评论及每条最多 100 条子评论${browseAndSaveWithImages ? '和图片' : '（不含图片）'}`}
                        summaryNumberOfLines={3}
                        trailing={<Switch value={browseAndSaveOfflineEnabled} interactive={false} />}
                        onPress={() => setBrowseAndSaveOfflineEnabled(!browseAndSaveOfflineEnabled)}
                    />
                    {browseAndSaveOfflineEnabled ? (
                        <>
                            <Divider style={{ marginLeft: 60 }} />
                            <SettingRow
                                icon="image-outline"
                                title="缓存图片"
                                summary="保存正文、评论图片及作者头像"
                                trailing={<Switch value={browseAndSaveWithImages} interactive={false} />}
                                onPress={() => setBrowseAndSaveWithImages(!browseAndSaveWithImages)}
                            />
                        </>
                    ) : null}
                    <Divider style={{ marginLeft: 60 }} />
                    <SettingRow
                        icon="robot-outline"
                        title="AI 内容检测"
                        summary="在本机检测回答和文章中的 AI 写作特征"
                        trailing={<Switch value={aiTextDetectionEnabled} interactive={false} />}
                        onPress={() => setAiTextDetectionEnabled(!aiTextDetectionEnabled)}
                    />
                    {aiTextDetectionEnabled ? (
                        <>
                            <Divider style={{ marginLeft: 60 }} />
                            <SettingRow
                                icon="tune"
                                title="检测灵敏度"
                                summary={AI_SENSITIVITY_OPTIONS[aiSensitivity].summary}
                                trailing={(
                                    <Text type="body2" color={theme.colors.primary}>
                                        {AI_SENSITIVITY_OPTIONS[aiSensitivity].label}
                                    </Text>
                                )}
                                onPress={() => setAiSensitivity(nextAiSensitivity(aiSensitivity))}
                            />
                        </>
                    ) : null}
                    <Divider style={{ marginLeft: 60 }} />
                    <SettingRow
                        icon="robot-outline"
                        title="AI 分析面板"
                        summary={aiAnalysisEnabled
                            ? `已开启 · ${aiAnalysisModel || '待选择模型'}`
                            : '配置外部 OpenAI 兼容 API，对文章和回答做总结与评价'}
                        trailing={trailingChevron}
                        onPress={() => router.push('/ai-analysis-settings' as any)}
                    />
                </PreferenceGroup>
            ),
        },
        {
            key: 'appearance',
            node: (
                <PreferenceGroup title="外观与体验">
                    <SettingRow icon="palette-outline" title="主题与壁纸" summary="颜色、壁纸、透明度和模糊" trailing={trailingChevron} onPress={() => router.push('/themeSet')} />
                    <Divider style={{ marginLeft: 60 }} />
                    <SettingRow
                        icon="animation-play-outline"
                        title="动画设置"
                        summary="抽屉与全局动画"
                        trailing={trailingChevron}
                        onPress={() => router.push('/animationSettings')}
                    />
                    <Divider style={{ marginLeft: 60 }} />
                    <SettingRow icon="tune-variant" title="高级设置" summary="Cookie 和调试选项" trailing={trailingChevron} onPress={() => router.push('/devmode')} />
                </PreferenceGroup>
            ),
        },
        {
            key: 'app',
            node: (
                <PreferenceGroup title="应用">
                    <SettingRow icon="shield-account-outline" title="隐私与个性化" summary="本地 AI、兴趣画像与协议" trailing={trailingChevron} onPress={() => router.push('/privacy-personalization' as any)} />
                    <Divider style={{ marginLeft: 60 }} />
                    <SettingRow icon="database-outline" title="存储管理" summary="空间占用与离线内容管理" trailing={trailingChevron} onPress={() => router.push('/storage-management' as any)} />
                    <Divider style={{ marginLeft: 60 }} />
                    <SettingRow icon="information-outline" title="关于 NewHU" summary="版本信息与检查更新" trailing={trailingChevron} onPress={() => router.push('/about')} />
                </PreferenceGroup>
            ),
        },
    ], [
        aiAnalysisEnabled,
        aiAnalysisModel,
        aiSensitivity,
        aiTextDetectionEnabled,
        browseAndSaveOfflineEnabled,
        browseAndSaveWithImages,
        deduplicateFeed,
        filterAds,
        filterPaid,
        isLoggedIn,
        setAiSensitivity,
        setAiTextDetectionEnabled,
        setBrowseAndSaveOfflineEnabled,
        setBrowseAndSaveWithImages,
        setDeduplicateFeed,
        setFilterAds,
        setFilterPaid,
        theme.colors.primary,
        trailingChevron,
        username,
    ]);

    React.useEffect(() => {
        if (!benchmarkEnabled) return;
        const run = settingsBenchRun ?? '0';
        let startTimer: ReturnType<typeof setTimeout> | undefined;
        let motionTimer: ReturnType<typeof setInterval> | undefined;
        let finishTimer: ReturnType<typeof setTimeout> | undefined;
        const readyTimer = setTimeout(() => {
            const maxOffset = Math.max(0, benchmarkContentHeight.current - benchmarkViewportHeight.current);
            const distance = Math.min(SETTINGS_BENCHMARK_SCROLL_DISTANCE, maxOffset);
            console.info(`[SETTINGS_ISOLATION_READY] case=${benchmarkCase} run=${run} distance=${distance} content=${benchmarkContentHeight.current} viewport=${benchmarkViewportHeight.current} theme=${theme.name} glass=${theme.glass.enabled} engine=${getGlassNativeEngine()}`);
            startTimer = setTimeout(() => {
                console.info(`[SETTINGS_ISOLATION_START] case=${benchmarkCase} run=${run}`);
                const maxOffset = Math.max(0, benchmarkContentHeight.current - benchmarkViewportHeight.current);
                const distance = Math.min(SETTINGS_BENCHMARK_SCROLL_DISTANCE, maxOffset);
                let offset = 0;
                let direction = 1;
                benchmarkScrollTarget.current?.scrollTo(offset, false);
                motionTimer = setInterval(() => {
                    const nextOffset = offset + direction * Math.min(120, distance);
                    if (nextOffset >= distance || nextOffset <= 0) direction *= -1;
                    offset = Math.max(0, Math.min(distance, nextOffset));
                    benchmarkScrollTarget.current?.scrollTo(offset, true);
                }, 250);
                finishTimer = setTimeout(() => {
                    if (motionTimer) clearInterval(motionTimer);
                    benchmarkScrollTarget.current?.scrollTo(0, false);
                    console.info(`[SETTINGS_ISOLATION_DONE] case=${benchmarkCase} run=${run} durationMs=${benchmarkDurationMs}`);
                }, benchmarkDurationMs);
            }, 2_500);
        }, 3_500);
        return () => {
            clearTimeout(readyTimer);
            if (startTimer) clearTimeout(startTimer);
            if (motionTimer) clearInterval(motionTimer);
            if (finishTimer) clearTimeout(finishTimer);
        };
    }, [benchmarkCase, benchmarkDurationMs, benchmarkEnabled, settingsBenchRun, theme.glass.enabled, theme.name]);

    const selectedSections = React.useMemo(() => {
        if (benchmarkCase === 'F0') return [];
        if (benchmarkCase === 'F1') return settingsSections.slice(0, 1);
        if (benchmarkCase === 'F2') return settingsSections.slice(0, 2);
        if (benchmarkCase === 'F3') return settingsSections.slice(0, 3);
        if (benchmarkCase === 'F4') return settingsSections;
        return settingsSections;
    }, [benchmarkCase, settingsSections]);
    const benchmarkContentStyle = React.useMemo(() => ({
        minHeight: 1600,
        paddingHorizontal: theme.spacing.lg,
        paddingBottom: theme.spacing.xxl,
    }), [theme.spacing.lg, theme.spacing.xxl]);

    const onBenchmarkLayout = React.useCallback((event: { nativeEvent: { layout: { height: number } } }) => {
        benchmarkViewportHeight.current = event.nativeEvent.layout.height;
    }, []);
    const onBenchmarkContentSizeChange = React.useCallback((_width: number, height: number) => {
        benchmarkContentHeight.current = height;
    }, []);

    const topBar = <TopAppBar title="设置" back={() => router.back()} opticalBackingEnabled={benchmarkCase !== 'B'} />;
    const diagnosticSections = selectedSections.map((section) => benchmarkCase === 'C'
        ? { ...section, node: React.cloneElement(section.node as React.ReactElement<{ materialOverride?: 'solid' }>, { materialOverride: 'solid' }) }
        : section);

    return (
        <PageScaffold topBar={topBar}>
            <View style={{ flex: 1 }} onLayout={benchmarkEnabled ? onBenchmarkLayout : undefined}>
                {benchmarkCase === 'F' ? (
                    <PageScrollView
                        pageScrollRef={(instance) => { benchmarkScrollTarget.current = instance ? { scrollTo: (offset, animated) => instance.scrollTo({ y: offset, animated }) } : null; }}
                        onContentSizeChange={onBenchmarkContentSizeChange}
                        contentContainerStyle={benchmarkContentStyle}
                        showsVerticalScrollIndicator={false}
                    >
                        <Text>Minimal Settings content benchmark</Text>
                    </PageScrollView>
                ) : benchmarkCase === 'E' ? (
                    <PageScrollView
                        pageScrollRef={(instance) => { benchmarkScrollTarget.current = instance ? { scrollTo: (offset, animated) => instance.scrollTo({ y: offset, animated }) } : null; }}
                        onContentSizeChange={onBenchmarkContentSizeChange}
                        contentContainerStyle={benchmarkContentStyle}
                        showsVerticalScrollIndicator={false}
                    >
                        {diagnosticSections.map((section) => <React.Fragment key={section.key}>{section.node}</React.Fragment>)}
                    </PageScrollView>
                ) : (
                    <PageSettingsList
                        listRef={(instance: FlatList<{ key: string; node: ReactNode }> | null) => { benchmarkScrollTarget.current = instance ? { scrollTo: (offset, animated) => instance.scrollToOffset({ offset, animated }) } : null; }}
                        sections={diagnosticSections}
                        contentContainerStyle={benchmarkEnabled ? benchmarkContentStyle : { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}
                        onContentSizeChange={benchmarkEnabled ? onBenchmarkContentSizeChange : undefined}
                        showsVerticalScrollIndicator={false}
                    />
                )}
            </View>
        </PageScaffold>
    );
}

const AI_SENSITIVITY_OPTIONS: Record<AiTextDetectionSensitivity, { label: string; summary: string }> = {
    conservative: {
        label: '保守',
        summary: `阈值 ${AI_TEXT_SENSITIVITY_THRESHOLDS.conservative.toFixed(3)} · 内部测试真人误报约 1.00%`,
    },
    balanced: {
        label: '平衡',
        summary: `阈值 ${AI_TEXT_SENSITIVITY_THRESHOLDS.balanced.toFixed(3)} · 内部测试真人误报约 1.85%`,
    },
    sensitive: {
        label: '高召回',
        summary: `阈值 ${AI_TEXT_SENSITIVITY_THRESHOLDS.sensitive.toFixed(3)} · 内部测试真人误报约 4.85%`,
    },
};

const AI_SENSITIVITY_ORDER: AiTextDetectionSensitivity[] = ['conservative', 'balanced', 'sensitive'];

function nextAiSensitivity(current: AiTextDetectionSensitivity): AiTextDetectionSensitivity {
    const index = AI_SENSITIVITY_ORDER.indexOf(current);
    return AI_SENSITIVITY_ORDER[(index + 1) % AI_SENSITIVITY_ORDER.length];
}

function SettingRow({ icon, ...props }: { icon: IconName; title: string; summary: string; summaryNumberOfLines?: number; trailing?: ReactNode; onPress: () => void; onPressIn?: () => void }) {
    const theme = useTheme();
    return (
        <ListRow
            {...props}
            icon={
                <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: theme.colors.secondaryContainer, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={icon} size={21} color={theme.colors.primary} />
                </View>
            }
        />
    );
}

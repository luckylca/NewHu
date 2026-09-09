import { analyzeContentWithAi } from '@/src/services/aiAnalysisService';
import type { AiAnalysisMetric, AiAnalysisResult } from '@/src/services/aiAnalysisCore';
import { useAiAnalysisStore } from '@/src/stores/useAiAnalysisStore';
import { Button, BottomSheet, Card, Icon } from '@/src/ui';
import { getBadgeColorsByIndex } from '@/src/ui/badgePalette';
import { Text } from '@/src/ui/primitives';
import { useTheme } from '@/src/ui/theme';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

export function ContentAiAnalysisLauncher({
    contentKey,
    contentType,
    title,
    authorName,
    text,
}: {
    contentKey: string;
    contentType: 'answer' | 'article';
    title: string;
    authorName?: string;
    text: string;
}) {
    const theme = useTheme();
    const enabled = useAiAnalysisStore((state) => state.enabled);
    const baseUrl = useAiAnalysisStore((state) => state.baseUrl);
    const apiKey = useAiAnalysisStore((state) => state.apiKey);
    const model = useAiAnalysisStore((state) => state.model);

    const [visible, setVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<AiAnalysisResult | null>(null);
    const [error, setError] = useState('');
    const requestRef = useRef<AbortController | null>(null);

    const configured = Boolean(baseUrl.trim() && model.trim() && text.trim());

    useEffect(() => {
        requestRef.current?.abort();
        requestRef.current = null;
        setVisible(false);
        setLoading(false);
        setResult(null);
        setError('');
    }, [contentKey]);

    useEffect(() => () => {
        requestRef.current?.abort();
    }, []);

    const runAnalysis = useCallback(async () => {
        if (!configured || loading) return;
        requestRef.current?.abort();
        const controller = new AbortController();
        requestRef.current = controller;
        setLoading(true);
        setError('');
        try {
            const next = await analyzeContentWithAi(
                { baseUrl, apiKey, model },
                { contentType, title, authorName, text },
                controller.signal,
            );
            if (!controller.signal.aborted) setResult(next);
        } catch (analysisError) {
            if (!controller.signal.aborted) {
                setError(analysisError instanceof Error ? analysisError.message : 'AI 分析失败');
            }
        } finally {
            if (!controller.signal.aborted) setLoading(false);
        }
    }, [apiKey, authorName, baseUrl, configured, contentType, loading, model, text, title]);

    const open = useCallback(() => {
        setVisible(true);
        if (configured && !result && !loading) {
            setTimeout(() => void runAnalysis(), 50);
        }
    }, [configured, loading, result, runAnalysis]);

    if (!enabled) return null;

    return (
        <>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel="打开 AI 分析"
                onPress={open}
                style={({ pressed }) => ({
                    position: 'absolute',
                    right: 18,
                    bottom: 88,
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: theme.colors.primary,
                    borderWidth: 2,
                    borderColor: theme.colors.onPrimary,
                    opacity: pressed ? 0.72 : 1,
                    shadowColor: '#000000',
                    shadowOpacity: theme.dark ? 0.35 : 0.18,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: 8,
                    zIndex: 30,
                })}
            >
                <Icon name="robot-outline" size={23} color={theme.colors.onPrimary} />
                <Text type="footnote2" weight="bold" color={theme.colors.onPrimary} style={{ marginTop: -1 }}>
                    AI
                </Text>
            </Pressable>

            <BottomSheet
                visible={visible}
                onClose={() => setVisible(false)}
                title="AI 分析"
                allowDismiss={!loading}
                closeOnClickModal={!loading}
            >
                <ScrollView
                    style={{ maxHeight: 660 }}
                    contentContainerStyle={{
                        paddingBottom: theme.spacing.xl,
                        gap: theme.spacing.md,
                    }}
                    showsVerticalScrollIndicator={false}
                >
                    <View>
                        <Text type="footnote1" color={theme.colors.onSurfaceVariantSummary}>
                            模型 · {model || '未配置'}
                        </Text>
                        <Text
                            type="footnote2"
                            color={theme.colors.onSurfaceVariantSummary}
                            style={{ marginTop: theme.spacing.xs, lineHeight: 17 }}
                        >
                            内容会发送到你在设置中配置的 API。AI 写作特征风险只描述文本特征，不代表作者一定使用了 AI。
                        </Text>
                    </View>

                    {!configured ? (
                        <Card feedback="none" contentStyle={{ padding: theme.spacing.lg }}>
                            <Text type="headline1" weight="medium" color={theme.colors.onBackground}>
                                AI 分析还没有配置完成
                            </Text>
                            <Text
                                type="body2"
                                color={theme.colors.onSurfaceVariantSummary}
                                style={{ marginTop: theme.spacing.sm, lineHeight: 20 }}
                            >
                                请先填写 Base URL，并选择或填写一个模型。API Key 可按你的服务要求填写。
                            </Text>
                            <Button
                                type="primary"
                                style={{ marginTop: theme.spacing.md }}
                                onPress={() => {
                                    setVisible(false);
                                    setTimeout(() => router.push('/ai-analysis-settings' as any), 120);
                                }}
                            >
                                去配置
                            </Button>
                        </Card>
                    ) : loading ? (
                        <Card feedback="none" contentStyle={{ padding: theme.spacing.xl, alignItems: 'center' }}>
                            <ActivityIndicator color={theme.colors.primary} />
                            <Text
                                type="body2"
                                color={theme.colors.onSurfaceVariantSummary}
                                style={{ marginTop: theme.spacing.md }}
                            >
                                正在分析当前{contentType === 'answer' ? '回答' : '文章'}…
                            </Text>
                        </Card>
                    ) : error ? (
                        <Card feedback="none" contentStyle={{ padding: theme.spacing.lg }}>
                            <Text type="headline1" weight="medium" color={theme.colors.error}>
                                分析失败
                            </Text>
                            <Text
                                type="body2"
                                color={theme.colors.onSurfaceVariantSummary}
                                style={{ marginTop: theme.spacing.sm, lineHeight: 20 }}
                            >
                                {error}
                            </Text>
                            <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
                                <Button
                                    style={{ flex: 1 }}
                                    onPress={() => {
                                        setVisible(false);
                                        setTimeout(() => router.push('/ai-analysis-settings' as any), 120);
                                    }}
                                >
                                    检查配置
                                </Button>
                                <Button type="primary" style={{ flex: 1 }} onPress={() => void runAnalysis()}>
                                    重试
                                </Button>
                            </View>
                        </Card>
                    ) : result ? (
                        <>
                            <AnalysisTextCard title="正文总结" text={result.summary || '模型没有返回总结'} />
                            {result.keywords.length ? (
                                <KeywordCard keywords={result.keywords} />
                            ) : null}
                            {result.corePoints.length ? (
                                <ListCard title="核心观点" items={result.corePoints} />
                            ) : null}

                            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                                <MetricCard title="信息密度" metric={result.informationDensity} paletteIndex={5} />
                                <MetricCard title="收藏价值" metric={result.collectionValue} paletteIndex={3} />
                            </View>
                            <MetricCard title="AI 写作特征风险" metric={result.aiWritingRisk} paletteIndex={2} fullWidth />

                            <AnalysisTextCard title="综合评价" text={result.evaluation || '模型没有返回综合评价'} />
                            {result.cautions.length ? (
                                <ListCard title="需要核实" items={result.cautions} />
                            ) : null}

                            <Button type="primary" disabled={loading} onPress={() => void runAnalysis()}>
                                重新分析
                            </Button>
                        </>
                    ) : (
                        <Button type="primary" onPress={() => void runAnalysis()}>
                            开始分析
                        </Button>
                    )}
                </ScrollView>
            </BottomSheet>
        </>
    );
}

function AnalysisTextCard({ title, text }: { title: string; text: string }) {
    const theme = useTheme();
    return (
        <Card feedback="none" contentStyle={{ padding: theme.spacing.lg }}>
            <Text type="headline1" weight="medium" color={theme.colors.onBackground}>{title}</Text>
            <Text
                type="body2"
                color={theme.colors.onBackground}
                style={{ marginTop: theme.spacing.sm, lineHeight: 22 }}
            >
                {text}
            </Text>
        </Card>
    );
}

function KeywordCard({ keywords }: { keywords: string[] }) {
    const theme = useTheme();
    return (
        <Card feedback="none" contentStyle={{ padding: theme.spacing.lg }}>
            <Text type="headline1" weight="medium" color={theme.colors.onBackground}>关键词</Text>
            <View style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: theme.spacing.sm,
                marginTop: theme.spacing.md,
            }}>
                {keywords.map((keyword, index) => {
                    const colors = getBadgeColorsByIndex(index, theme.dark);
                    return (
                        <View
                            key={keyword}
                            style={{
                                paddingHorizontal: 10,
                                paddingVertical: 5,
                                borderRadius: theme.radius.full,
                                backgroundColor: colors.background,
                                borderWidth: 1,
                                borderColor: colors.border,
                            }}
                        >
                            <Text type="footnote1" weight="bold" color={colors.foreground}>{keyword}</Text>
                        </View>
                    );
                })}
            </View>
        </Card>
    );
}

function ListCard({ title, items }: { title: string; items: string[] }) {
    const theme = useTheme();
    return (
        <Card feedback="none" contentStyle={{ padding: theme.spacing.lg }}>
            <Text type="headline1" weight="medium" color={theme.colors.onBackground}>{title}</Text>
            <View style={{ marginTop: theme.spacing.sm, gap: theme.spacing.sm }}>
                {items.map((item, index) => (
                    <View key={String(index) + ':' + item} style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                        <Text type="body2" weight="bold" color={theme.colors.primary}>{index + 1}.</Text>
                        <Text type="body2" color={theme.colors.onBackground} style={{ flex: 1, lineHeight: 21 }}>
                            {item}
                        </Text>
                    </View>
                ))}
            </View>
        </Card>
    );
}

function MetricCard({
    title,
    metric,
    paletteIndex,
    fullWidth = false,
}: {
    title: string;
    metric: AiAnalysisMetric;
    paletteIndex: number;
    fullWidth?: boolean;
}) {
    const theme = useTheme();
    const colors = getBadgeColorsByIndex(paletteIndex, theme.dark);
    return (
        <Card
            feedback="none"
            style={fullWidth ? undefined : { flex: 1 }}
            contentStyle={{
                padding: theme.spacing.md,
                backgroundColor: colors.background,
                borderWidth: 1,
                borderColor: colors.border,
            }}
        >
            <Text type="footnote1" weight="bold" color={colors.foreground}>{title}</Text>
            <Text type="title3" weight="bold" color={colors.foreground} style={{ marginTop: theme.spacing.xs }}>
                {metric.score}/100
            </Text>
            {metric.reason ? (
                <Text type="footnote1" color={colors.foreground} style={{ marginTop: theme.spacing.xs, lineHeight: 18 }}>
                    {metric.reason}
                </Text>
            ) : null}
        </Card>
    );
}

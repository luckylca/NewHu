import { fetchAiAnalysisModels } from '@/src/services/aiAnalysisService';
import { useAiAnalysisStore } from '@/src/stores/useAiAnalysisStore';
import { notify } from '@/src/stores/useNotificationStore';
import { Button, Card, Input, Switch, TopAppBar } from '@/src/ui';
import { Text } from '@/src/ui/primitives';
import { useTheme } from '@/src/ui/theme';
import { router } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

export default function AiAnalysisSettingsScreen() {
    const theme = useTheme();
    const enabled = useAiAnalysisStore((state) => state.enabled);
    const setEnabled = useAiAnalysisStore((state) => state.setEnabled);
    const baseUrl = useAiAnalysisStore((state) => state.baseUrl);
    const setBaseUrl = useAiAnalysisStore((state) => state.setBaseUrl);
    const apiKey = useAiAnalysisStore((state) => state.apiKey);
    const setApiKey = useAiAnalysisStore((state) => state.setApiKey);
    const model = useAiAnalysisStore((state) => state.model);
    const setModel = useAiAnalysisStore((state) => state.setModel);

    const [models, setModels] = useState<string[]>([]);
    const [loadingModels, setLoadingModels] = useState(false);

    const refreshModels = useCallback(async (silent = false) => {
        if (loadingModels) return;
        setLoadingModels(true);
        try {
            const next = await fetchAiAnalysisModels({ baseUrl, apiKey });
            setModels(next);
            if (!model || !next.includes(model)) setModel(next[0] ?? '');
            if (!silent) notify('已获取 ' + next.length + ' 个模型');
        } catch (error) {
            if (!silent) {
                notify(error instanceof Error ? error.message : '获取模型失败');
            }
        } finally {
            setLoadingModels(false);
        }
    }, [apiKey, baseUrl, loadingModels, model, setModel]);

    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <TopAppBar title="AI 分析" back={() => router.back()} />
            <ScrollView
                contentContainerStyle={{
                    padding: theme.spacing.lg,
                    paddingBottom: theme.spacing.xxl,
                    gap: theme.spacing.md,
                }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <Card feedback="none" contentStyle={{ padding: theme.spacing.lg }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                        <View style={{ flex: 1 }}>
                            <Text type="headline1" weight="medium" color={theme.colors.onBackground}>
                                启用文章 / 回答 AI 分析
                            </Text>
                            <Text
                                type="body2"
                                color={theme.colors.onSurfaceVariantSummary}
                                style={{ marginTop: theme.spacing.xs, lineHeight: 20 }}
                            >
                                开启后，详情页右下角会出现 AI 小球。只有点开并执行分析时，才会把当前正文发送到你配置的 API。
                            </Text>
                        </View>
                        <Switch value={enabled} onValueChange={setEnabled} />
                    </View>
                </Card>

                {enabled ? (
                    <>
                        <Card feedback="none" contentStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
                            <Text type="headline1" weight="medium" color={theme.colors.onBackground}>
                                OpenAI 兼容 API
                            </Text>
                            <Text type="body2" color={theme.colors.onSurfaceVariantSummary} style={{ lineHeight: 20 }}>
                                Base URL 例如 https://api.example.com/v1。模型列表通过 /models 获取，分析通过 /chat/completions 调用。
                            </Text>

                            <Input
                                label="Base URL"
                                value={baseUrl}
                                onChangeText={(value) => {
                                    setModels([]);
                                    setBaseUrl(value);
                                    setModel('');
                                }}
                                inputProps={{
                                    autoCapitalize: 'none',
                                    autoCorrect: false,
                                    keyboardType: 'url',
                                    placeholder: 'https://api.example.com/v1',
                                }}
                            />

                            <Input
                                label="API Key"
                                value={apiKey}
                                onChangeText={(value) => {
                                    setModels([]);
                                    setApiKey(value);
                                    setModel('');
                                }}
                                inputProps={{
                                    autoCapitalize: 'none',
                                    autoCorrect: false,
                                    secureTextEntry: true,
                                    placeholder: 'sk-…',
                                }}
                            />

                            <Input
                                label="模型"
                                value={model}
                                onChangeText={setModel}
                                inputProps={{
                                    autoCapitalize: 'none',
                                    autoCorrect: false,
                                    placeholder: '可自动获取，也可手动填写',
                                }}
                            />

                            <Button
                                type="primary"
                                disabled={loadingModels || !baseUrl.trim()}
                                onPress={() => void refreshModels(false)}
                            >
                                {loadingModels ? '正在获取模型…' : '自动获取模型'}
                            </Button>

                            <Text type="footnote1" color={theme.colors.onSurfaceVariantSummary}>
                                API Key 使用系统安全存储保存，不写入普通 AsyncStorage。
                            </Text>
                        </Card>

                        {models.length ? (
                            <Card feedback="none" contentStyle={{ padding: theme.spacing.lg }}>
                                <Text type="body2" weight="medium" color={theme.colors.onBackground}>
                                    选择模型 · {models.length} 个
                                </Text>
                                <View style={{
                                    flexDirection: 'row',
                                    flexWrap: 'wrap',
                                    gap: theme.spacing.sm,
                                    marginTop: theme.spacing.md,
                                }}>
                                    {models.map((item) => {
                                        const selected = item === model;
                                        return (
                                            <Pressable
                                                key={item}
                                                accessibilityRole="button"
                                                accessibilityState={{ selected }}
                                                onPress={() => setModel(item)}
                                                style={{
                                                    maxWidth: '100%',
                                                    minHeight: 36,
                                                    justifyContent: 'center',
                                                    paddingHorizontal: theme.spacing.md,
                                                    borderRadius: theme.radius.full,
                                                    backgroundColor: selected
                                                        ? theme.colors.primary
                                                        : theme.colors.secondaryVariant,
                                                }}
                                            >
                                                <Text
                                                    type="footnote1"
                                                    weight={selected ? 'bold' : 'medium'}
                                                    color={selected ? theme.colors.onPrimary : theme.colors.onSecondaryVariant}
                                                    numberOfLines={1}
                                                >
                                                    {item}
                                                </Text>
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            </Card>
                        ) : null}

                        <Card feedback="none" contentStyle={{ padding: theme.spacing.lg }}>
                            <Text type="body2" weight="medium" color={theme.colors.onBackground}>
                                分析会包含
                            </Text>
                            <Text
                                type="body2"
                                color={theme.colors.onSurfaceVariantSummary}
                                style={{ marginTop: theme.spacing.xs, lineHeight: 20 }}
                            >
                                正文总结、关键词、核心观点、信息密度、收藏价值、AI 写作特征风险、综合评价和需要核实的点。AI 写作风险只分析文本特征，不代表作者一定使用了 AI。
                            </Text>
                        </Card>
                    </>
                ) : null}
            </ScrollView>
        </View>
    );
}

import { AI_TEXT_SENSITIVITY_THRESHOLDS, type AiTextDetectionSensitivity } from '@/src/services/aiTextDetectorCore';
import { useSettingStore } from '@/src/stores/useSettingStore';
import { useAiAnalysisStore } from '@/src/stores/useAiAnalysisStore';
import { useUserStore } from '@/src/stores/useUserStore';
import { Card, Divider, Icon, ListRow, Switch, TopAppBar } from '@/src/ui';
import { Text } from '@/src/ui/primitives';
import type { IconName } from '@/src/ui/primitives';
import { useTheme } from '@/src/ui/theme';
import { router } from 'expo-router';
import React from 'react';
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

export default function SettingsScreen() {
    const theme = useTheme();
    const user = useUserStore();
    const filterAds = useSettingStore((state) => state.isAds);
    const filterPaid = useSettingStore((state) => state.isPaid);
    const setFilterAds = useSettingStore((state) => state.setAds);
    const setFilterPaid = useSettingStore((state) => state.setPaid);
    const deduplicateFeed = useSettingStore((state) => state.deduplicateFeed);
    const setDeduplicateFeed = useSettingStore((state) => state.setDeduplicateFeed);
    const aiTextDetectionEnabled = useSettingStore((state) => state.aiTextDetectionEnabled);
    const setAiTextDetectionEnabled = useSettingStore((state) => state.setAiTextDetectionEnabled);
    const aiSensitivity = useSettingStore((state) => state.aiTextDetectionSensitivity);
    const aiAnalysisEnabled = useAiAnalysisStore((state) => state.enabled);
    const aiAnalysisModel = useAiAnalysisStore((state) => state.model);
    const setAiSensitivity = useSettingStore((state) => state.setAiTextDetectionSensitivity);
    const trailingChevron = <Icon name="chevron-right" size={22} color={theme.colors.onSurfaceVariantActions} />;

    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <TopAppBar title="设置" back={() => router.back()} />
            <ScrollView contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }} showsVerticalScrollIndicator={false}>
                <SettingsGroup title="账号">
                    <SettingRow
                        icon="account-circle-outline"
                        title="账号管理"
                        summary={user.isLoggedIn ? `已登录 · ${user.username}` : '未登录'}
                        trailing={trailingChevron}
                        onPress={() => router.push(user.isLoggedIn ? '/userinfo' : '/webview')}
                    />
                </SettingsGroup>

                <SettingsGroup title="内容">
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
                </SettingsGroup>

                <SettingsGroup title="外观与体验">
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
                </SettingsGroup>

                <SettingsGroup title="应用">
                    <SettingRow icon="shield-account-outline" title="隐私与个性化" summary="本地 AI、兴趣画像与协议" trailing={trailingChevron} onPress={() => router.push('/privacy-personalization' as any)} />
                    <Divider style={{ marginLeft: 60 }} />
                    <SettingRow icon="database-outline" title="存储管理" summary="空间占用与离线内容管理" trailing={trailingChevron} onPress={() => router.push('/storage-management' as any)} />
                    <Divider style={{ marginLeft: 60 }} />
                    <SettingRow icon="information-outline" title="关于 NewHU" summary="版本信息与检查更新" trailing={trailingChevron} onPress={() => router.push('/about')} />
                </SettingsGroup>
            </ScrollView>
        </View>
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

function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
    const theme = useTheme();
    return (
        <View style={{ marginTop: theme.spacing.lg }}>
            <Card feedback="none" contentStyle={{ overflow: 'hidden' }}>
                <View style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.xs }}>
                    <Text type="footnote1" weight="bold" color={theme.colors.primary}>{title}</Text>
                </View>
                {children}
            </Card>
        </View>
    );
}

function SettingRow({ icon, ...props }: { icon: IconName; title: string; summary: string; trailing?: ReactNode; onPress: () => void; onPressIn?: () => void }) {
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

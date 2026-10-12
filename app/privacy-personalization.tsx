import { clearProductV1Personalization } from '@/src/product-v1';
import { useConsentStore } from '@/src/stores/useConsentStore';
import { useNotificationStore } from '@/src/stores/useNotificationStore';
import { Button, Dialog, Divider, ListRow, SettingsSection, StaticSettingsPage, Switch, Text } from '@/src/ui';
import { toggle } from '@/src/utils/haptics';
import { useTheme } from '@/src/ui/theme';
import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

export default function PrivacyPersonalizationScreen() {
    const theme = useTheme();
    const enabled = useConsentStore((state) => state.aiInterestAnalysisEnabled);
    const setEnabled = useConsentStore((state) => state.setAiInterestAnalysisEnabled);
    const notify = useNotificationStore((state) => state.show);
    const [confirmClear, setConfirmClear] = React.useState(false);

    const setAnalysis = React.useCallback((next: boolean) => {
        setEnabled(next);
        toggle();
    }, [setEnabled]);

    const clearProfile = async () => {
        try {
            await clearProductV1Personalization();
            setConfirmClear(false);
            notify('本地兴趣画像已清除');
        } catch (error) {
            console.error('清除兴趣画像失败', error);
            notify('清除失败，请稍后重试');
        }
    };

    const sections = React.useMemo(() => [
        {
            key: 'local-ai',
            node: (
                <SettingsSection title="本地 AI">
                        <ListRow
                            title="本地 AI 兴趣分析"
                            summary="在本机处理推荐反馈与兴趣画像，可随时关闭"
                            trailing={<Switch value={enabled} interactive={false} />}
                            onPress={() => setAnalysis(!enabled)}
                        />
                        <Divider style={{ marginLeft: theme.spacing.lg }} />
                        <ListRow
                            title="Native512 推荐"
                            summary="兴趣比例、运行模式与在线 512D 资源状态"
                            onPress={() => router.push('/product-v1' as any)}
                        />
                        <Divider style={{ marginLeft: theme.spacing.lg }} />
                        <ListRow title="清除兴趣画像" summary="删除本地阅读事件与模型数据" onPress={() => setConfirmClear(true)} />
                </SettingsSection>
            ),
        },
        {
            key: 'legal',
            node: (
                <SettingsSection title="协议">
                        <ListRow title="隐私政策" onPress={() => router.push({ pathname: '/legal', params: { type: 'privacy' } })} />
                        <Divider style={{ marginLeft: theme.spacing.lg }} />
                        <ListRow title="用户协议" onPress={() => router.push({ pathname: '/legal', params: { type: 'terms' } })} />
                </SettingsSection>
            ),
        },
    ], [enabled, setAnalysis, theme.spacing.lg]);

    const footer = React.useMemo(() => (
        <Text type="footnote1" color={theme.colors.onSurfaceVariantSummary} style={{ margin: theme.spacing.lg, lineHeight: 20 }}>
                    开启后仅在本机处理曝光、打开、阅读进度、点赞、收藏与不喜欢信号；不会分析评论内容，也不会调用外部大模型。
        </Text>
    ), [theme.colors.onSurfaceVariantSummary, theme.spacing.lg]);

    return (
        <StaticSettingsPage
            title="隐私与个性化"
            back={() => router.back()}
            footer={footer}
            contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}
            overlays={(
            <Dialog visible={confirmClear} onClose={() => setConfirmClear(false)} title="清除兴趣画像？" summary="阅读事件和本地模型数据将被删除，离线缓存与浏览内容不受影响。">
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: theme.spacing.sm }}>
                    <Button onPress={() => setConfirmClear(false)}>取消</Button>
                    <Button type="primary" onPress={() => void clearProfile()}>清除</Button>
                </View>
            </Dialog>
            )}
            testID="privacy-personalization"
        >
            {sections.map((section) => <React.Fragment key={section.key}>{section.node}</React.Fragment>)}
        </StaticSettingsPage>
    );
}

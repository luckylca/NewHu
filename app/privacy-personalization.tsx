import { clearInterestProfile } from '@/src/db/repositories/userEventRepository';
import { useConsentStore } from '@/src/stores/useConsentStore';
import { useNotificationStore } from '@/src/stores/useNotificationStore';
import { Button, Card, Dialog, Divider, ListRow, Switch, Text, TopAppBar } from '@/src/ui';
import { toggle } from '@/src/utils/haptics';
import { useTheme } from '@/src/ui/theme';
import { router } from 'expo-router';
import React from 'react';
import { ScrollView, View } from 'react-native';

export default function PrivacyPersonalizationScreen() {
    const theme = useTheme();
    const enabled = useConsentStore((state) => state.aiInterestAnalysisEnabled);
    const setEnabled = useConsentStore((state) => state.setAiInterestAnalysisEnabled);
    const notify = useNotificationStore((state) => state.show);
    const [confirmClear, setConfirmClear] = React.useState(false);

    const setAnalysis = (next: boolean) => {
        setEnabled(next);
        toggle();
    };

    const clearProfile = async () => {
        try {
            await clearInterestProfile();
            setConfirmClear(false);
            notify('本地兴趣画像已清除');
        } catch (error) {
            console.error('清除兴趣画像失败', error);
            notify('清除失败，请稍后重试');
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <TopAppBar title="隐私与个性化" back={() => router.back()} />
            <ScrollView contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
                <View style={{ marginTop: theme.spacing.lg }}>
                    <Card feedback="none" contentStyle={{ overflow: 'hidden' }}>
                        <View style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.xs }}>
                            <Text type="footnote1" weight="bold" color={theme.colors.primary}>本地 AI</Text>
                        </View>
                        <ListRow
                            title="本地 AI 兴趣分析"
                            summary="只在本机记录打开过的内容，可随时关闭"
                            trailing={<Switch value={enabled} interactive={false} />}
                            onPress={() => setAnalysis(!enabled)}
                        />
                        <Divider style={{ marginLeft: theme.spacing.lg }} />
                        <ListRow title="清除兴趣画像" summary="删除本地阅读事件与模型数据" onPress={() => setConfirmClear(true)} />
                    </Card>
                </View>
                <View style={{ marginTop: theme.spacing.lg }}>
                    <Card feedback="none" contentStyle={{ overflow: 'hidden' }}>
                        <View style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.xs }}>
                            <Text type="footnote1" weight="bold" color={theme.colors.primary}>协议</Text>
                        </View>
                        <ListRow title="隐私政策" onPress={() => router.push({ pathname: '/legal', params: { type: 'privacy' } })} />
                        <Divider style={{ marginLeft: theme.spacing.lg }} />
                        <ListRow title="用户协议" onPress={() => router.push({ pathname: '/legal', params: { type: 'terms' } })} />
                    </Card>
                </View>
                <Text type="footnote1" color={theme.colors.onSurfaceVariantSummary} style={{ margin: theme.spacing.lg, lineHeight: 20 }}>
                    当前版本不会记录停留时间、搜索词、评论内容、点赞或收藏；不开启也不影响正常阅读。
                </Text>
            </ScrollView>
            <Dialog visible={confirmClear} onClose={() => setConfirmClear(false)} title="清除兴趣画像？" summary="阅读事件和本地模型数据将被删除，离线缓存与浏览内容不受影响。">
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: theme.spacing.sm }}>
                    <Button onPress={() => setConfirmClear(false)}>取消</Button>
                    <Button type="primary" onPress={() => void clearProfile()}>清除</Button>
                </View>
            </Dialog>
        </View>
    );
}

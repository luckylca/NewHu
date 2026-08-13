import { Card, SegmentedControl, Text, TopAppBar } from '@/src/ui';
import { useTheme } from '@/src/ui/theme';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ScrollView, View } from 'react-native';

type LegalType = 'privacy' | 'terms';

const COPY: Record<LegalType, { title: string; sections: Array<{ title: string; body: string }> }> = {
    privacy: {
        title: '隐私政策',
        sections: [
            { title: '我们在本机保存什么', body: '账号 Cookie、应用设置、推荐去重记录、离线内容和阅读记录会保存在你的设备中，用于登录、个性化设置、离线浏览和存储管理。' },
            { title: '本地兴趣分析', body: '此功能默认关闭。开启后，当前版本只在设备本地记录你打开过哪些文章或回答，供后续本地兴趣分析使用。当前不会采集停留时间、搜索词、评论内容、点赞或收藏，也不会上传兴趣画像。' },
            { title: '网络请求', body: '在线浏览、搜索、评论与账号操作需要访问内容服务。关闭本地兴趣分析不影响这些基础阅读功能。' },
            { title: '你的控制权', body: '你可以在“设置 → 隐私与个性化”随时关闭本地兴趣分析并清除本地兴趣画像。卸载应用也会移除应用沙盒内的数据。' },
        ],
    },
    terms: {
        title: '用户协议',
        sections: [
            { title: '服务说明', body: 'NewHU 是用于浏览内容和管理本地离线数据的客户端。你应遵守适用法律法规及内容服务本身的使用规则。' },
            { title: '账号与内容', body: '登录凭据仅供本应用在你的设备上发起已授权请求。请妥善保管设备和账号，不要利用本应用发布违法、侵权或骚扰性内容。' },
            { title: '离线数据', body: '离线缓存仅用于个人阅读。内容可能因来源更新、网络状态或权限变化而不可用；请勿将缓存内容用于未获授权的传播。' },
            { title: '功能调整', body: '应用功能可能在后续版本调整。若隐私政策或协议发生实质变化，应用会通过版本化授权流程再次提示确认。' },
        ],
    },
};

export default function LegalScreen() {
    const theme = useTheme();
    const params = useLocalSearchParams<{ type?: string }>();
    const [type, setType] = React.useState<LegalType>(params.type === 'terms' ? 'terms' : 'privacy');
    const copy = COPY[type];

    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <TopAppBar title={copy.title} back={() => router.back()} />
            <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl }} showsVerticalScrollIndicator={false}>
                <SegmentedControl
                    tabs={['隐私政策', '用户协议']}
                    selected={type === 'privacy' ? 0 : 1}
                    onSelect={(index) => setType(index === 0 ? 'privacy' : 'terms')}
                />
                <Card feedback="none" contentStyle={{ padding: theme.spacing.xl, marginTop: theme.spacing.lg, gap: theme.spacing.xl }}>
                    {copy.sections.map((section) => (
                        <View key={section.title} style={{ gap: theme.spacing.sm }}>
                            <Text type="title4" weight="bold">{section.title}</Text>
                            <Text type="body1" color={theme.colors.onSurfaceSecondary} style={{ lineHeight: 25 }}>{section.body}</Text>
                        </View>
                    ))}
                </Card>
                <Text type="footnote1" color={theme.colors.onSurfaceVariantSummary} style={{ marginTop: theme.spacing.lg, textAlign: 'center' }}>
                    当前版本：2026-08-13
                </Text>
            </ScrollView>
        </View>
    );
}

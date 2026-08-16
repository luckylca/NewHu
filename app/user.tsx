import { useUserStore } from "@/src/stores/useUserStore";
import { useSettingStore } from "@/src/stores/useSettingStore";
import { getApiInstance } from '@/src/api/ZhihuApi';
import { notify } from '@/src/stores/useNotificationStore';
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Image, ScrollView, View } from 'react-native';
import { Card, Divider, Icon, ListRow, SegmentedControl } from '@/src/ui';
import { Text } from '@/src/ui/primitives';
import { useTheme } from '@/src/ui/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDraftStore } from '@/src/stores/useDraftStore';

const UserScreen = ({ navigation }: any) => {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const userStore = useUserStore();
    const mode = useSettingStore((state) => state.mode);
    const setMode = useSettingStore((state) => state.setMode);
    const draftCount = useDraftStore((state) => state.drafts.length);

    const metaColor = theme.colors.onSurfaceSecondary;

    const modeUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const modeToIndex = (value: 'normal' | 'card' | 'waterfall') => value === 'normal' ? 0 : value === 'card' ? 1 : 2;
    const [selectedMode, setSelectedMode] = useState(() => modeToIndex(mode));

    useEffect(() => {
        setSelectedMode(modeToIndex(mode));
    }, [mode]);

    useEffect(() => () => {
        if (modeUpdateTimerRef.current) clearTimeout(modeUpdateTimerRef.current);
    }, []);

    const handleModeSelect = useCallback((index: number) => {
        setSelectedMode(index);
        if (modeUpdateTimerRef.current) clearTimeout(modeUpdateTimerRef.current);
        const nextMode = index === 0 ? 'normal' : index === 1 ? 'card' : 'waterfall';
        modeUpdateTimerRef.current = setTimeout(() => {
            setMode(nextMode);
            modeUpdateTimerRef.current = null;
        }, 220);
    }, [setMode]);

    const handlePress = async () => {
        if (!userStore.isLoggedIn) {
            router.push('/webview');
            return;
        }

        let urlToken = userStore.urlToken;
        if (!urlToken && userStore.cookies) {
            try {
                const data = await getApiInstance(userStore.cookies).getMe();
                urlToken = String(data?.url_token ?? data?.urlToken ?? '');
                if (urlToken) userStore.setUrlToken(urlToken);
            } catch (error) {
                console.error('获取个人主页信息失败:', error);
            }
        }

        if (urlToken) {
            router.push({ pathname: '/people', params: { urlToken } });
        } else {
            notify('暂时无法获取个人主页，请重新登录');
        }
    }

    return (
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + theme.spacing.sm, paddingBottom: theme.spacing.xxl, backgroundColor: theme.colors.surface }}>
            <Card
                feedback="none"
                showIndication
                onPress={handlePress}
                style={{ margin: theme.spacing.lg }}
                contentStyle={{ padding: theme.spacing.lg, flexDirection: 'row', alignItems: 'center' }}
            >
                <Image
                    source={{ uri: userStore.avatar }}
                    style={{ width: 68, height: 68, borderRadius: theme.radius.full, backgroundColor: theme.colors.surfaceContainerHigh }}
                />
                <View style={{ flex: 1, marginLeft: theme.spacing.lg }}>
                    <Text type="title3" weight="bold">{userStore.username || '请登录'}</Text>
                    <Text type="body2" color={metaColor} style={{ marginTop: theme.spacing.xs }}>
                        {userStore.isLoggedIn ? '查看个人资料' : '登录后同步收藏与历史'}
                    </Text>
                </View>
                <Icon name="chevron-right" size={24} color={theme.colors.onSurfaceVariantActions} />
            </Card>

            <View style={{ marginBottom: theme.spacing.lg, marginHorizontal: theme.spacing.lg }}>
                <SegmentedControl
                    tabs={['普通模式', '滑动模式', '瀑布流']}
                    selected={selectedMode}
                    onSelect={handleModeSelect}
                />
            </View>

            {/* 设置入口组 —— ListRow + Divider，Miuix 设置列表 */}
            <View style={{ marginBottom: theme.spacing.xl, marginHorizontal: theme.spacing.lg, borderRadius: theme.radius.component, backgroundColor: theme.colors.surfaceContainer, overflow: 'hidden' }}>
                <ListRow title="草稿箱" summary={draftCount > 0 ? `${draftCount} 条草稿` : '暂无草稿'} onPress={() => router.push('/drafts')} />
                <Divider style={{ marginLeft: theme.spacing.lg }} />
                <ListRow title="收藏列表" summary="查看保存的回答和文章" onPress={() => router.push('/like')} />
                <Divider style={{ marginLeft: theme.spacing.lg }} />
                <ListRow title="浏览历史" summary="查看最近浏览过的内容" onPress={() => router.push('/history')} />
                <Divider style={{ marginLeft: theme.spacing.lg }} />
                <ListRow title="离线缓存" summary="批量获取内容并保存到本地" onPress={() => router.push('/offline-cache')} />
                <Divider style={{ marginLeft: theme.spacing.lg }} />
                <ListRow title="设置" summary="管理账号、主题与应用偏好" onPress={() => router.push('/settings')} />
            </View>
        </ScrollView>
    );
}

export default UserScreen;

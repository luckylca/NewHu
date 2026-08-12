import { useSettingStore } from '@/src/stores/useSettingStore';
import { useUserStore } from '@/src/stores/useUserStore';
import { Card, Divider, Icon, ListRow, Switch, TopAppBar } from '@/src/ui';
import { Text } from '@/src/ui/primitives';
import type { IconName } from '@/src/ui/primitives';
import { useTheme } from '@/src/ui/theme';
import { router } from 'expo-router';
import React, { useEffect } from 'react';
import type { ReactNode } from 'react';
import { InteractionManager, ScrollView, View } from 'react-native';

export default function SettingsScreen() {
    const theme = useTheme();
    const user = useUserStore();
    const filterAds = useSettingStore((state) => state.isAds);
    const filterPaid = useSettingStore((state) => state.isPaid);
    const setFilterAds = useSettingStore((state) => state.setAds);
    const setFilterPaid = useSettingStore((state) => state.setPaid);
    const deduplicateFeed = useSettingStore((state) => state.deduplicateFeed);
    const setDeduplicateFeed = useSettingStore((state) => state.setDeduplicateFeed);
    const trailingChevron = <Icon name="chevron-right" size={22} color={theme.colors.onSurfaceVariantActions} />;

    useEffect(() => {
        // Storage management is the heaviest destination on this page. Mount
        // it while Settings is idle so its first native layout and local-data
        // query don't land inside the navigation transition.
        const task = InteractionManager.runAfterInteractions(() => {
            router.prefetch('/storage-management' as any);
        });
        return () => task.cancel();
    }, []);

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
                        onPressIn={() => router.prefetch(user.isLoggedIn ? '/userinfo' : '/webview')}
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
                </SettingsGroup>

                <SettingsGroup title="外观与体验">
                    <SettingRow icon="palette-outline" title="主题与壁纸" summary="颜色、壁纸、透明度和模糊" trailing={trailingChevron} onPressIn={() => router.prefetch('/themeSet')} onPress={() => router.push('/themeSet')} />
                    <Divider style={{ marginLeft: 60 }} />
                    <SettingRow
                        icon="animation-play-outline"
                        title="动画设置"
                        summary="抽屉与全局动画"
                        trailing={trailingChevron}
                        onPressIn={() => router.prefetch('/animationSettings')}
                        onPress={() => router.push('/animationSettings')}
                    />
                    <Divider style={{ marginLeft: 60 }} />
                    <SettingRow icon="tune-variant" title="高级设置" summary="Cookie 和调试选项" trailing={trailingChevron} onPressIn={() => router.prefetch('/devmode')} onPress={() => router.push('/devmode')} />
                </SettingsGroup>

                <SettingsGroup title="应用">
                    <SettingRow icon="database-outline" title="存储管理" summary="空间占用与离线内容管理" trailing={trailingChevron} onPressIn={() => router.prefetch('/storage-management' as any)} onPress={() => router.push('/storage-management' as any)} />
                    <Divider style={{ marginLeft: 60 }} />
                    <SettingRow icon="information-outline" title="关于 NewHU" summary="版本信息与检查更新" trailing={trailingChevron} onPressIn={() => router.prefetch('/about')} onPress={() => router.push('/about')} />
                </SettingsGroup>
            </ScrollView>
        </View>
    );
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

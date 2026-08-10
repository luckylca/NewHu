import { notify } from '@/src/stores/useNotificationStore';
import { useSettingStore } from '@/src/stores/useSettingStore';
import { useUserStore } from '@/src/stores/useUserStore';
import { Button, Card, Dialog, Divider, Icon, ListRow, Switch, TopAppBar } from '@/src/ui';
import { Text } from '@/src/ui/primitives';
import type { IconName } from '@/src/ui/primitives';
import { useTheme } from '@/src/ui/theme';
import { router } from 'expo-router';
import React, { useState } from 'react';
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

const CURRENT_VERSION = 'v1.0.0';

export default function SettingsScreen() {
    const theme = useTheme();
    const user = useUserStore();
    const filterAds = useSettingStore((state) => state.isAds);
    const filterPaid = useSettingStore((state) => state.isPaid);
    const setFilterAds = useSettingStore((state) => state.setAds);
    const setFilterPaid = useSettingStore((state) => state.setPaid);
    const [updateVisible, setUpdateVisible] = useState(false);
    const [update, setUpdate] = useState({ loading: false, version: '' });

    const checkUpdate = async () => {
        setUpdateVisible(true);
        setUpdate({ loading: true, version: '' });
        try {
            const response = await fetch('https://api.github.com/repos/luckylca/GirlVideo_ByReactNative/releases/latest');
            const data = await response.json();
            setUpdate({ loading: false, version: data?.tag_name || '' });
        } catch (error) {
            console.error('检查更新失败:', error);
            setUpdateVisible(false);
            notify('检查更新失败，请稍后重试');
        }
    };

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
                        trailing={<Switch value={filterAds} onValueChange={setFilterAds} />}
                        onPress={() => setFilterAds(!filterAds)}
                    />
                    <Divider style={{ marginLeft: 60 }} />
                    <SettingRow
                        icon="lock-outline"
                        title="隐藏付费内容"
                        summary="过滤需要付费阅读的内容"
                        trailing={<Switch value={filterPaid} onValueChange={setFilterPaid} />}
                        onPress={() => setFilterPaid(!filterPaid)}
                    />
                </SettingsGroup>

                <SettingsGroup title="外观与体验">
                    <SettingRow icon="palette-outline" title="主题与壁纸" summary="颜色、壁纸、透明度和模糊" trailing={trailingChevron} onPress={() => router.push('/themeSet')} />
                    <Divider style={{ marginLeft: 60 }} />
                    <SettingRow icon="tune-variant" title="高级设置" summary="动画和调试选项" trailing={trailingChevron} onPress={() => router.push('/devmode')} />
                </SettingsGroup>

                <SettingsGroup title="应用">
                    <SettingRow icon="cloud-download-outline" title="检查更新" summary={`当前版本 ${CURRENT_VERSION}`} trailing={trailingChevron} onPress={checkUpdate} />
                    <Divider style={{ marginLeft: 60 }} />
                    <SettingRow icon="broom" title="清理临时缓存" summary="保留账号、收藏和主题设置" trailing={trailingChevron} onPress={() => notify('当前没有需要清理的临时文件')} />
                    <Divider style={{ marginLeft: 60 }} />
                    <SettingRow icon="information-outline" title="关于 NewHu" summary="简洁的知乎阅读体验" trailing={trailingChevron} onPress={() => notify(`NewHu ${CURRENT_VERSION}`)} />
                </SettingsGroup>
            </ScrollView>

            <Dialog visible={updateVisible} onClose={() => setUpdateVisible(false)} title="检查更新">
                <Text type="body1" color={theme.colors.onBackground}>
                    {update.loading
                        ? '正在检查最新版本…'
                        : update.version && update.version !== CURRENT_VERSION
                            ? `发现新版本 ${update.version}，当前版本为 ${CURRENT_VERSION}。`
                            : `当前已是最新版本 ${CURRENT_VERSION}。`}
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: theme.spacing.lg }}>
                    <Button type="primary" onPress={() => setUpdateVisible(false)} disabled={update.loading}>知道了</Button>
                </View>
            </Dialog>
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

function SettingRow({ icon, ...props }: { icon: IconName; title: string; summary: string; trailing?: ReactNode; onPress: () => void }) {
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

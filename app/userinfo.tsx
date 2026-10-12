import { notify } from '@/src/stores/useNotificationStore';
import { useUserStore } from '@/src/stores/useUserStore';
import { Button, Card, Dialog, Icon, ListRow, SettingsSection, StaticSettingsPage } from '@/src/ui';
import { Text } from '@/src/ui/primitives';
import { useTheme } from '@/src/ui/theme';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Image, View } from 'react-native';
import { clearAllCookies } from 'expo-cookie-storage';

export default function UserInfoScreen() {
    const theme = useTheme();
    const avatar = useUserStore((state) => state.avatar);
    const username = useUserStore((state) => state.username);
    const isLoggedIn = useUserStore((state) => state.isLoggedIn);
    const logOut = useUserStore((state) => state.logOut);
    const [logoutVisible, setLogoutVisible] = useState(false);

    const logout = async () => {
        logOut();
        try {
            await clearAllCookies();
        } catch {
            // The persisted credential and API singleton are already cleared.
        }
        setLogoutVisible(false);
        router.back();
        notify('已退出登录');
    };

    const sections = React.useMemo(() => [
        {
            key: 'profile',
            node: (
                <Card feedback="none" contentStyle={{ padding: theme.spacing.xl, alignItems: 'center' }}>
                    {avatar ? (
                        <Image source={{ uri: avatar }} style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: theme.colors.surfaceContainerHigh }} />
                    ) : (
                        <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: theme.colors.secondaryContainer, alignItems: 'center', justifyContent: 'center' }}>
                            <Icon name="account" size={44} color={theme.colors.primary} />
                        </View>
                    )}
                    <Text type="title3" weight="bold" style={{ marginTop: theme.spacing.md }}>{username || '知乎用户'}</Text>
                    <Text type="body2" color={theme.colors.onSurfaceVariantSummary} style={{ marginTop: 4 }}>
                        {isLoggedIn ? '账号已连接' : '当前未登录'}
                    </Text>
                </Card>
            ),
        },
        {
            key: 'status',
            node: (
                <SettingsSection title="账号">
                    <ListRow
                        title="登录状态"
                        summary={isLoggedIn ? 'Cookie 已安全保存在本机' : '登录后可同步账号内容'}
                        icon={<Icon name="shield-check-outline" size={24} color={theme.colors.primary} />}
                    />
                </SettingsSection>
            ),
        },
    ], [avatar, isLoggedIn, theme.colors, theme.spacing.md, theme.spacing.xl, username]);

    return (
        <StaticSettingsPage
            title="账号管理"
            back={() => router.back()}
            contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}
            footer={isLoggedIn ? (
                <Button onPress={() => setLogoutVisible(true)} style={{ marginTop: theme.spacing.xl }}>退出登录</Button>
            ) : (
                <Button type="primary" onPress={() => router.replace('/webview')} style={{ marginTop: theme.spacing.xl }}>登录知乎</Button>
            )}
            overlays={(
            <Dialog visible={logoutVisible} onClose={() => setLogoutVisible(false)} title="退出登录？">
                <Text type="body1" color={theme.colors.onBackground}>本地主题和浏览设置会保留，账号 Cookie 将被清除。</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
                    <Button onPress={() => setLogoutVisible(false)}>取消</Button>
                    <Button type="primary" onPress={() => void logout()}>退出</Button>
                </View>
            </Dialog>
            )}
            testID="userinfo"
        >
            {sections.map((section) => <React.Fragment key={section.key}>{section.node}</React.Fragment>)}
        </StaticSettingsPage>
    );
}

import { notify } from '@/src/stores/useNotificationStore';
import { useUserStore } from '@/src/stores/useUserStore';
import { Button, Card, Dialog, Icon, ListRow, TopAppBar } from '@/src/ui';
import { Text } from '@/src/ui/primitives';
import { useTheme } from '@/src/ui/theme';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Image, ScrollView, View } from 'react-native';

export default function UserInfoScreen() {
    const theme = useTheme();
    const user = useUserStore();
    const [logoutVisible, setLogoutVisible] = useState(false);

    const logout = () => {
        user.logOut();
        setLogoutVisible(false);
        router.back();
        notify('已退出登录');
    };

    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <TopAppBar title="账号管理" back={() => router.back()} />
            <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
                <Card feedback="none" contentStyle={{ padding: theme.spacing.xl, alignItems: 'center' }}>
                    {user.avatar ? (
                        <Image source={{ uri: user.avatar }} style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: theme.colors.surfaceContainerHigh }} />
                    ) : (
                        <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: theme.colors.secondaryContainer, alignItems: 'center', justifyContent: 'center' }}>
                            <Icon name="account" size={44} color={theme.colors.primary} />
                        </View>
                    )}
                    <Text type="title3" weight="bold" style={{ marginTop: theme.spacing.md }}>{user.username || '知乎用户'}</Text>
                    <Text type="body2" color={theme.colors.onSurfaceVariantSummary} style={{ marginTop: 4 }}>
                        {user.isLoggedIn ? '账号已连接' : '当前未登录'}
                    </Text>
                </Card>

                <Card feedback="none" style={{ marginTop: theme.spacing.lg }}>
                    <ListRow
                        title="登录状态"
                        summary={user.isLoggedIn ? 'Cookie 已安全保存在本机' : '登录后可同步账号内容'}
                        icon={<Icon name="shield-check-outline" size={24} color={theme.colors.primary} />}
                    />
                </Card>

                {user.isLoggedIn ? (
                    <Button onPress={() => setLogoutVisible(true)} style={{ marginTop: theme.spacing.xl }}>退出登录</Button>
                ) : (
                    <Button type="primary" onPress={() => router.replace('/webview')} style={{ marginTop: theme.spacing.xl }}>登录知乎</Button>
                )}
            </ScrollView>

            <Dialog visible={logoutVisible} onClose={() => setLogoutVisible(false)} title="退出登录？">
                <Text type="body1" color={theme.colors.onBackground}>本地主题和浏览设置会保留，账号 Cookie 将被清除。</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
                    <Button onPress={() => setLogoutVisible(false)}>取消</Button>
                    <Button type="primary" onPress={logout}>退出</Button>
                </View>
            </Dialog>
        </View>
    );
}

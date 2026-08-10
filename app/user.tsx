import { useUserStore } from "@/src/stores/useUserStore";
import { useSettingStore } from "@/src/stores/useSettingStore";
import { router } from "expo-router";
import React from "react";
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
    const settingStore = useSettingStore();
    const draftCount = useDraftStore((state) => state.drafts.length);

    const metaColor = theme.colors.onSurfaceSecondary;

    const isCardMode = settingStore.mode === 'card';

    const handlePress = () => {
        if(userStore.isLoggedIn){
            router.push('/userinfo');
        } else {
            router.push('/webview');
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
                    tabs={['普通模式', '滑动模式']}
                    selected={isCardMode ? 1 : 0}
                    onSelect={(i) => settingStore.setMode(i === 1 ? 'card' : 'normal')}
                />
            </View>

            {/* 设置入口组 —— ListRow + Divider，Miuix 设置列表 */}
            <View style={{ marginBottom: theme.spacing.xl, marginHorizontal: theme.spacing.lg, borderRadius: theme.radius.component, backgroundColor: theme.colors.surfaceContainer, overflow: 'hidden' }}>
                <ListRow title="草稿箱" summary={draftCount > 0 ? `${draftCount} 条草稿` : '暂无草稿'} onPress={() => router.push('/drafts')} />
                <Divider style={{ marginLeft: theme.spacing.lg }} />
                <ListRow title="收藏列表" onPress={() => router.push('/like')} />
                <Divider style={{ marginLeft: theme.spacing.lg }} />
                <ListRow title="浏览历史" onPress={() => router.push('/history')} />
                <Divider style={{ marginLeft: theme.spacing.lg }} />
                <ListRow title="设置" onPress={() => router.push('/settings')} />
            </View>
        </ScrollView>
    );
}

export default UserScreen;

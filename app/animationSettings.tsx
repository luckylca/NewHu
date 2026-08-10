import { useSettingStore } from '@/src/stores/useSettingStore';
import { Card, Divider, ListRow, Switch, Text, TopAppBar } from '@/src/ui';
import { useTheme } from '@/src/ui/theme';
import { router } from 'expo-router';
import React from 'react';
import { ScrollView, View } from 'react-native';

export default function AnimationSettingsScreen() {
    const theme = useTheme();
    const drawerAnimation = useSettingStore((state) => state.commentDrawerAnimation);
    const setDrawerAnimation = useSettingStore((state) => state.setCommentDrawerAnimation);
    const disableAnimations = useSettingStore((state) => state.disableAnimations);
    const setDisableAnimations = useSettingStore((state) => state.setDisableAnimations);

    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <TopAppBar title="动画设置" back={() => router.back()} />
            <ScrollView contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
                <SectionCard title="抽屉与全局动画">
                    <ListRow
                        title="子评论抽屉动画"
                        summary="关闭后直接显示或收起"
                        onPress={() => setDrawerAnimation(!drawerAnimation)}
                        trailing={<Switch value={drawerAnimation} interactive={false} />}
                    />
                    <Divider style={{ marginLeft: theme.spacing.lg }} />
                    <ListRow
                        title="减少界面动画"
                        summary="开启后会停用卡片下沉与抽屉过渡"
                        onPress={() => setDisableAnimations(!disableAnimations)}
                        trailing={<Switch value={disableAnimations} interactive={false} />}
                    />
                </SectionCard>
            </ScrollView>
        </View>
    );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
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

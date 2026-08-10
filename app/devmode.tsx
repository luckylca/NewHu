import { notify } from '@/src/stores/useNotificationStore';
import { useSettingStore } from '@/src/stores/useSettingStore';
import { Button, Card, Dialog, Divider, Icon, Input, ListRow, TopAppBar } from '@/src/ui';
import { Text } from '@/src/ui/primitives';
import { useTheme } from '@/src/ui/theme';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';

export default function AdvancedSettingsScreen() {
    const theme = useTheme();
    const cookie = useSettingStore((state) => state.cookie);
    const setCookie = useSettingStore((state) => state.setCookie);
    const [dialogVisible, setDialogVisible] = useState(false);
    const [draft, setDraft] = useState(cookie);

    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <TopAppBar title="高级设置" back={() => router.back()} />
            <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
                <Card feedback="none" style={{ marginTop: theme.spacing.lg }}>
                    <View style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.xs }}>
                        <Text type="footnote1" weight="bold" color={theme.colors.primary}>调试</Text>
                    </View>
                    <ListRow
                        title="自定义 Cookie"
                        summary={cookie ? '已配置，仅用于接口调试' : '未配置'}
                        icon={<Icon name="cookie-cog-outline" size={24} color={theme.colors.primary} />}
                        trailing={<Icon name="chevron-right" size={22} color={theme.colors.onSurfaceVariantActions} />}
                        onPress={() => { setDraft(cookie); setDialogVisible(true); }}
                    />
                    <Divider style={{ marginLeft: 56 }} />
                    <ListRow
                        title="设计系统预览"
                        summary="查看当前主题下的所有基础组件"
                        icon={<Icon name="view-dashboard-outline" size={24} color={theme.colors.primary} />}
                        trailing={<Icon name="chevron-right" size={22} color={theme.colors.onSurfaceVariantActions} />}
                        onPress={() => router.push('/dev/design-system')}
                    />
                    <Divider style={{ marginLeft: 56 }} />
                    <ListRow
                        title="动态柔光预览"
                        summary="查看粉蓝白 HyperOS 风格柔光组件"
                        icon={<Icon name="blur" size={24} color={theme.colors.primary} />}
                        trailing={<Icon name="chevron-right" size={22} color={theme.colors.onSurfaceVariantActions} />}
                        onPress={() => router.push('/dev/hyper-glow')}
                    />
                </Card>
            </ScrollView>

            <Dialog visible={dialogVisible} onClose={() => setDialogVisible(false)} title="自定义 Cookie">
                <Input
                    value={draft}
                    onChangeText={setDraft}
                    singleLine={false}
                    placeholder="粘贴完整 Cookie"
                    inputProps={{ textAlignVertical: 'top', style: { minHeight: 130 } }}
                />
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
                    <Button onPress={() => setDialogVisible(false)}>取消</Button>
                    <Button type="primary" onPress={() => { setCookie(draft.trim()); setDialogVisible(false); notify('Cookie 已保存'); }}>保存</Button>
                </View>
            </Dialog>
        </View>
    );
}

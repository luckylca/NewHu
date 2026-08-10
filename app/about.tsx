import { notify } from '@/src/stores/useNotificationStore';
import { Button, Card, Dialog, Divider, Icon, Text, TopAppBar } from '@/src/ui';
import { useTheme } from '@/src/ui/theme';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Image, ScrollView, View } from 'react-native';

const CURRENT_VERSION = `v${Constants.expoConfig?.version ?? '1.0.0'}`;

export default function AboutScreen() {
    const theme = useTheme();
    const [updateVisible, setUpdateVisible] = useState(false);
    const [update, setUpdate] = useState({ loading: false, version: '' });

    const checkUpdate = async () => {
        setUpdateVisible(true);
        setUpdate({ loading: true, version: '' });
        try {
            const response = await fetch('https://api.github.com/repos/luckylca/NewHu/releases/latest');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            setUpdate({ loading: false, version: data?.tag_name || '' });
        } catch (error) {
            console.error('检查更新失败:', error);
            setUpdateVisible(false);
            notify('检查更新失败，请稍后重试');
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <TopAppBar title="关于 NewHU" back={() => router.back()} />
            <ScrollView
                contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.xxl }}
                showsVerticalScrollIndicator={false}
            >
                <Card
                    feedback="tilt"
                    showIndication
                    contentStyle={{ padding: theme.spacing.xl, alignItems: 'center' }}
                >
                    <Image
                        source={require('../assets/images/icon.png')}
                        style={{ width: 88, height: 88, borderRadius: 22, marginBottom: theme.spacing.lg }}
                    />
                    <Text type="title1" weight="bold" color={theme.colors.onSurfaceContainer}>NewHU</Text>
                    <Text type="body2" color={theme.colors.onSurfaceVariantSummary} style={{ marginTop: theme.spacing.xs }}>
                        {CURRENT_VERSION}
                    </Text>
                    <Divider style={{ width: '100%', marginVertical: theme.spacing.lg }} />
                    <Text type="body1" color={theme.colors.onSurfaceVariantSummary} style={{ textAlign: 'center', lineHeight: 24 }}>
                        一个专注于内容与阅读体验的知乎客户端。
                    </Text>
                </Card>

                <Button
                    onPress={checkUpdate}
                    disabled={update.loading}
                    style={{ width: '100%', marginTop: theme.spacing.lg }}
                    contentStyle={{ gap: theme.spacing.sm }}
                >
                    <Icon name="cloud-download-outline" size={21} color={theme.colors.onSecondaryVariant} />
                    <Text type="button" color={theme.colors.onSecondaryVariant}>
                        {update.loading ? '正在检查…' : '检查更新'}
                    </Text>
                </Button>
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

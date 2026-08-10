import { HyperGlowBackground } from '@/src/components/effects/HyperGlowBackground';
import { notify } from '@/src/stores/useNotificationStore';
import { Button, Card, Dialog, Divider, Icon, Text, TopAppBar } from '@/src/ui';
import { useTheme } from '@/src/ui/theme';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, View } from 'react-native';

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
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                <Card
                    feedback="tilt"
                    showIndication
                    style={styles.heroCard}
                    contentStyle={styles.heroContent}
                >
                    <HyperGlowBackground intensity={0.92} />
                    <View style={styles.heroBody}>
                        <Text type="footnote1" weight="medium" color="rgba(28,28,30,0.52)">ABOUT NEWHU</Text>
                        <View style={styles.brand}>
                            <Image
                                source={require('../assets/images/icon.png')}
                                style={styles.logo}
                            />
                            <Text type="title1" weight="bold" color="#1C1C1E">NewHU</Text>
                            <Text type="body2" color="rgba(28,28,30,0.58)" style={{ marginTop: theme.spacing.xs }}>
                                {CURRENT_VERSION}
                            </Text>
                        </View>
                        <View style={styles.cardFooter}>
                            <Divider style={styles.heroDivider} />
                            <Text type="body1" color="rgba(28,28,30,0.66)" style={styles.description}>
                                一个专注于内容与阅读体验的知乎客户端。
                            </Text>
                        </View>
                    </View>
                </Card>

                <Card
                    feedback={update.loading ? "none" : "sink"}
                    showIndication={!update.loading}
                    onPress={update.loading ? undefined : checkUpdate}
                    style={styles.updateCard}
                    contentStyle={styles.updateContent}
                >
                    <View style={[styles.updateIcon, { backgroundColor: theme.colors.tertiaryContainer }] }>
                        <Icon name="cloud-download-outline" size={25} color={theme.colors.primary} />
                    </View>
                    <View style={styles.updateText}>
                        <Text type="headline1" weight="bold" color={theme.colors.onSurfaceContainer}>
                            {update.loading ? '正在检查更新' : '检查更新'}
                        </Text>
                        <Text type="body2" color={theme.colors.onSurfaceVariantSummary} style={styles.updateSummary}>
                            当前版本 {CURRENT_VERSION}
                        </Text>
                    </View>
                    {update.loading ? (
                        <ActivityIndicator size="small" color={theme.colors.primary} />
                    ) : (
                        <Icon name="chevron-right" size={24} color={theme.colors.onSurfaceVariantActions} />
                    )}
                </Card>
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

const styles = StyleSheet.create({
    content: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 32,
        alignItems: 'center',
    },
    heroCard: {
        width: '92%',
        maxWidth: 420,
        aspectRatio: 0.74,
    },
    heroContent: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    heroBody: {
        flex: 1,
        padding: 28,
        alignItems: 'center',
    },
    brand: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logo: {
        width: 96,
        height: 96,
        borderRadius: 24,
        marginBottom: 18,
    },
    cardFooter: {
        width: '100%',
        alignItems: 'center',
    },
    heroDivider: {
        width: '100%',
        marginBottom: 18,
        backgroundColor: 'rgba(28,28,30,0.12)',
    },
    description: {
        textAlign: 'center',
        lineHeight: 24,
    },
    updateCard: {
        width: '92%',
        maxWidth: 420,
        marginTop: 16,
    },
    updateContent: {
        minHeight: 76,
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
    },
    updateIcon: {
        width: 44,
        height: 44,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
    },
    updateText: {
        flex: 1,
        minWidth: 0,
        marginHorizontal: 14,
    },
    updateSummary: {
        marginTop: 3,
    },
});

import { useSettingStore } from '@/src/stores/useSettingStore';
import { notify } from '@/src/stores/useNotificationStore';
import { Button, Card, Icon, ListRow, SegmentedControl, Switch, Text, TopAppBar } from '@/src/ui';
import { getWallpaperBlurRadius, getWallpaperScrim, type WallpaperBlurLevel, useTheme, wallpaperConfig } from '@/src/ui/theme';
import { File, Paths } from 'expo-file-system';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { launchImageLibrary } from 'react-native-image-picker';

const BLUR_LEVELS: Exclude<WallpaperBlurLevel, 'off'>[] = ['low', 'medium', 'high'];

const ThemeSetScreen = () => {
    const router = useRouter();
    const theme = useTheme();

    const followSystemTheme = useSettingStore((state) => state.followSystemTheme);
    const setFollowSystemTheme = useSettingStore((state) => state.setFollowSystemTheme);
    const isDarkMode = useSettingStore((state) => state.isDarkMode);
    const setDarkMode = useSettingStore((state) => state.setDarkMode);
    const wallpaperUri = useSettingStore((state) => state.wallpaperUri);
    const setWallpaperUri = useSettingStore((state) => state.setWallpaperUri);
    const wallpaperBlurLevel = useSettingStore((state) => state.wallpaperBlurLevel);
    const setWallpaperBlurLevel = useSettingStore((state) => state.setWallpaperBlurLevel);

    const [isPicking, setIsPicking] = useState(false);

    const removeStoredWallpaper = (uri: string | null) => {
        if (!uri || !uri.startsWith(Paths.document.uri) || !uri.includes('/newhu-wallpaper-')) return;
        const file = new File(uri);
        if (file.exists) file.delete();
    };

    const importWallpaper = async () => {
        setIsPicking(true);
        try {
            const result = await launchImageLibrary({
                mediaType: 'photo',
                selectionLimit: 1,
                maxWidth: 2400,
                maxHeight: 2400,
                quality: 0.9,
            });

            if (result.didCancel) return;
            if (result.errorCode) throw new Error(result.errorMessage ?? result.errorCode);

            const asset = result.assets?.[0];
            if (!asset?.uri) throw new Error('没有读取到图片');

            const matchedExtension = asset.fileName?.match(/\.([a-zA-Z0-9]+)$/)?.[1];
            const extension = matchedExtension ?? (asset.type === 'image/png' ? 'png' : 'jpg');
            const target = new File(Paths.document, `newhu-wallpaper-${Date.now()}.${extension}`);
            new File(asset.uri).copy(target);

            const previousUri = wallpaperUri;
            setWallpaperUri(target.uri);
            removeStoredWallpaper(previousUri);
            notify('壁纸已应用');
        } catch (error) {
            console.error('导入壁纸失败', error);
            notify('导入失败，请换一张图片重试');
        } finally {
            setIsPicking(false);
        }
    };

    const clearWallpaper = () => {
        removeStoredWallpaper(wallpaperUri);
        setWallpaperUri(null);
        notify('已恢复默认背景');
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <TopAppBar title="主题设置" back={() => router.back()} />

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.section}>
                    <Card contentStyle={styles.groupCard}>
                        <CardSectionTitle>外观</CardSectionTitle>
                        <ListRow
                            title="跟随系统"
                            summary="自动切换白天与黑夜模式"
                            onPress={() => setFollowSystemTheme(!followSystemTheme)}
                            trailing={<Switch value={followSystemTheme} interactive={false} />}
                        />
                        <View style={[styles.divider, { backgroundColor: theme.colors.dividerLine }]} />
                        <ListRow
                            title="黑夜模式"
                            summary={followSystemTheme ? '当前由系统外观控制' : '使用深色背景与浅色文字'}
                            onPress={followSystemTheme ? undefined : () => setDarkMode(!isDarkMode)}
                            disabled={followSystemTheme}
                            trailing={<Switch value={isDarkMode} disabled={followSystemTheme} interactive={false} />}
                        />
                    </Card>
                </View>

                <View style={styles.section}>
                    <Card contentStyle={styles.wallpaperCard}>
                        <CardSectionTitle>底层壁纸</CardSectionTitle>
                        <View style={styles.wallpaperContent}>
                            <View style={[styles.preview, { backgroundColor: theme.colors.surfaceContainerHigh }]}>
                                {wallpaperUri ? (
                                    <Image
                                        source={{ uri: wallpaperUri }}
                                        resizeMode="cover"
                                        blurRadius={getWallpaperBlurRadius(wallpaperBlurLevel)}
                                        style={[StyleSheet.absoluteFill, { opacity: wallpaperConfig.opacity }]}
                                    />
                                ) : (
                                    <View style={styles.emptyPreview}>
                                        <Icon name="image-outline" size={38} color={theme.colors.onSurfaceContainerHigh} />
                                        <Text type="body2" color={theme.colors.onSurfaceContainerHigh}>还没有选择壁纸</Text>
                                    </View>
                                )}
                                {wallpaperUri ? (
                                    <View
                                        pointerEvents="none"
                                        style={[StyleSheet.absoluteFill, { backgroundColor: getWallpaperScrim(theme.dark) }]}
                                    />
                                ) : null}
                                <View
                                    style={[
                                        styles.previewSample,
                                        {
                                            backgroundColor: theme.dark
                                                ? 'rgba(28,28,28,0.82)'
                                                : 'rgba(255,255,255,0.84)',
                                        },
                                    ]}
                                >
                                    <Text type="headline1" weight="medium" color={theme.colors.onBackground}>壁纸预览</Text>
                                    <Text type="body2" color={theme.colors.onSurfaceVariantSummary}>主题蒙层与卡片保持内容清晰</Text>
                                </View>
                            </View>

                            <View style={styles.actions}>
                                <Button type="primary" onPress={importWallpaper} disabled={isPicking} style={styles.primaryAction}>
                                    {isPicking ? '正在读取…' : wallpaperUri ? '更换图片' : '导入图片'}
                                </Button>
                                {wallpaperUri ? <Button onPress={clearWallpaper}>移除</Button> : null}
                            </View>

                            <ListRow
                                title="背景模糊"
                                summary={wallpaperBlurLevel === 'off' ? '已关闭' : '仅模糊底层壁纸'}
                                onPress={wallpaperUri
                                    ? () => setWallpaperBlurLevel(wallpaperBlurLevel === 'off' ? 'medium' : 'off')
                                    : undefined}
                                disabled={!wallpaperUri}
                                trailing={
                                    <Switch
                                        value={wallpaperBlurLevel !== 'off'}
                                        disabled={!wallpaperUri}
                                        interactive={false}
                                    />
                                }
                            />
                            <View
                                pointerEvents={wallpaperUri && wallpaperBlurLevel !== 'off' ? 'auto' : 'none'}
                                style={[styles.blurLevel, (!wallpaperUri || wallpaperBlurLevel === 'off') && styles.disabled]}
                            >
                                <Text type="body1" weight="medium" color={theme.colors.onBackground}>模糊程度</Text>
                                <SegmentedControl
                                    tabs={['低', '中', '高']}
                                    selected={wallpaperBlurLevel === 'off' ? 1 : BLUR_LEVELS.indexOf(wallpaperBlurLevel)}
                                    onSelect={(index) => setWallpaperBlurLevel(BLUR_LEVELS[index])}
                                />
                            </View>
                        </View>
                    </Card>
                </View>

                <Text type="footnote1" color={theme.colors.onBackgroundVariant} style={styles.hint}>
                    图片会保存在应用目录中。全局主题蒙层会保持正文清晰，文字颜色不会根据图片内容动态变化。
                </Text>
            </ScrollView>

        </View>
    );
};

function CardSectionTitle({ children }: { children: React.ReactNode }) {
    const theme = useTheme();
    return (
        <View style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.xs }}>
            <Text type="footnote1" weight="bold" color={theme.colors.primary}>{children}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        paddingHorizontal: 16,
        paddingBottom: 36,
    },
    section: {
        marginTop: 18,
    },
    groupCard: {
        paddingVertical: 2,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        marginHorizontal: 16,
    },
    wallpaperCard: {
        padding: 0,
    },
    wallpaperContent: {
        padding: 12,
        gap: 14,
    },
    preview: {
        height: 210,
        borderRadius: 13,
        overflow: 'hidden',
        justifyContent: 'flex-end',
        padding: 12,
    },
    emptyPreview: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    previewSample: {
        borderRadius: 13,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    actions: {
        flexDirection: 'row',
        gap: 10,
    },
    primaryAction: {
        flex: 1,
    },
    blurLevel: {
        paddingHorizontal: 16,
        paddingBottom: 6,
        gap: 10,
    },
    disabled: {
        opacity: 0.5,
    },
    hint: {
        marginTop: 12,
        marginHorizontal: 4,
        lineHeight: 19,
    },
});

export default ThemeSetScreen;

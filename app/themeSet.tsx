import { useSettingStore } from '@/src/stores/useSettingStore';
import { notify } from '@/src/stores/useNotificationStore';
import { Button, Card, Icon, ListRow, SegmentedControl, Switch, Text, TopAppBar } from '@/src/ui';
import { getWallpaperBlurRadius, getWallpaperScrim, type WallpaperBlurLevel, useTheme, wallpaperConfig } from '@/src/ui/theme';
import { File, Paths } from 'expo-file-system';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { launchImageLibrary } from 'react-native-image-picker';

const BLUR_LEVELS: Exclude<WallpaperBlurLevel, 'off'>[] = ['low', 'medium', 'high'];

const ThemeSetScreen = () => {
    const router = useRouter();
    const theme = useTheme();

    const followSystemTheme = useSettingStore((state) => state.followSystemTheme);
    const setFollowSystemTheme = useSettingStore((state) => state.setFollowSystemTheme);
    const themeName = useSettingStore((state) => state.themeName);
    const setThemeName = useSettingStore((state) => state.setThemeName);
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
                    <Text type="title4" weight="medium" color={theme.colors.onBackground} style={styles.sectionHeading}>主题风格</Text>
                    <View style={styles.themeChoices}>
                        <ThemeStyleCard
                            name="hyperos"
                            title="HyperOS"
                            summary="轻快、清晰的系统表面"
                            selected={themeName === 'hyperos'}
                            onPress={() => setThemeName('hyperos')}
                        />
                        <ThemeStyleCard
                            name="liquidGlass"
                            title="Liquid Glass"
                            summary="折射、柔焦与边缘高光"
                            selected={themeName === 'liquidGlass'}
                            onPress={() => setThemeName('liquidGlass')}
                        />
                    </View>
                </View>

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

function ThemeStyleCard({
    name,
    title,
    summary,
    selected,
    onPress,
}: {
    name: 'hyperos' | 'liquidGlass';
    title: string;
    summary: string;
    selected: boolean;
    onPress: () => void;
}) {
    const theme = useTheme();
    const glass = name === 'liquidGlass';
    const previewBase = glass ? (theme.dark ? '#202A39' : '#DDE8F5') : (theme.dark ? '#303030' : '#E9EDF3');
    const sample = glass ? (theme.dark ? 'rgba(125,158,205,0.48)' : 'rgba(255,255,255,0.78)') : theme.colors.surfaceContainer;

    return (
        <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={onPress}
            style={[
                styles.themeChoice,
                {
                    borderColor: selected ? theme.colors.primary : theme.colors.outline,
                    backgroundColor: theme.colors.surfaceContainer,
                },
            ]}
        >
            <View style={[styles.themePreview, { backgroundColor: previewBase }]}>
                <View style={[styles.previewHeader, { backgroundColor: glass ? (theme.dark ? 'rgba(227,238,255,0.18)' : 'rgba(255,255,255,0.56)') : sample }]}>
                    <View style={[styles.previewDot, { backgroundColor: theme.colors.primary }]} />
                    <View style={[styles.previewLine, { width: '45%', backgroundColor: theme.colors.onSurface }]} />
                    <View style={[styles.previewLine, { width: '20%', backgroundColor: theme.colors.onSurfaceVariantSummary }]} />
                </View>
                <View style={styles.previewContent}>
                    <View style={[styles.previewCard, { backgroundColor: sample, borderColor: glass ? 'rgba(255,255,255,0.62)' : theme.colors.outline }]}>
                        <View style={[styles.previewLine, { width: '72%', backgroundColor: theme.colors.onSurface }]} />
                        <View style={[styles.previewLine, { width: '48%', backgroundColor: theme.colors.onSurfaceVariantSummary }]} />
                    </View>
                </View>
                <View style={[styles.previewBar, { backgroundColor: glass ? 'rgba(245,249,255,0.34)' : sample, borderColor: glass ? 'rgba(255,255,255,0.78)' : theme.colors.outline }]}>
                    <View style={[styles.previewLine, { width: '40%', backgroundColor: theme.colors.onSurface }]} />
                    <View style={[styles.previewLine, { width: '18%', backgroundColor: theme.colors.onSurfaceVariantSummary }]} />
                </View>
            </View>
            <View style={styles.themeChoiceText}>
                <View style={{ flex: 1 }}>
                    <Text type="headline2" weight="medium" color={theme.colors.onSurface}>{title}</Text>
                    <Text type="footnote2" color={theme.colors.onSurfaceVariantSummary} numberOfLines={2}>{summary}</Text>
                </View>
                <View style={[styles.selectionMark, { backgroundColor: selected ? theme.colors.primary : 'transparent', borderColor: selected ? theme.colors.primary : theme.colors.outline }]}>
                    {selected ? <Text type="footnote2" weight="bold" color={theme.colors.onPrimary}>✓</Text> : null}
                </View>
            </View>
        </Pressable>
    );
}

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
    sectionHeading: {
        marginBottom: 10,
        marginHorizontal: 2,
    },
    themeChoices: {
        flexDirection: 'row',
        gap: 10,
    },
    themeChoice: {
        flex: 1,
        borderWidth: 1.5,
        borderRadius: 18,
        padding: 9,
        gap: 10,
    },
    themePreview: {
        height: 116,
        borderRadius: 13,
        overflow: 'hidden',
        padding: 8,
        justifyContent: 'space-between',
    },
    previewHeader: {
        height: 22,
        borderRadius: 9,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        gap: 5,
    },
    previewDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
    },
    previewLine: {
        height: 4,
        borderRadius: 4,
        opacity: 0.72,
    },
    previewContent: {
        flex: 1,
        justifyContent: 'center',
    },
    previewCard: {
        height: 42,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 10,
        paddingHorizontal: 7,
        justifyContent: 'center',
        gap: 5,
    },
    previewBar: {
        height: 21,
        borderRadius: 9,
        borderWidth: StyleSheet.hairlineWidth,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
    },
    themeChoiceText: {
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    selectionMark: {
        width: 20,
        height: 20,
        borderWidth: 1,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
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

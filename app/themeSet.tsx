import { useSettingStore } from '@/src/stores/useSettingStore';
import { useMonetTextColor } from '@/src/hooks/useMonetTextColor';
import { notify } from '@/src/stores/useNotificationStore';
import { Button, Card, Icon, ListRow, Slider, Switch, Text, TopAppBar } from '@/src/ui';
import { useTheme } from '@/src/ui/theme';
import { File, Paths } from 'expo-file-system';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { launchImageLibrary } from 'react-native-image-picker';
import { getImageAverageColor } from '@/src/utils/imageColor';

const ThemeSetScreen = () => {
    const router = useRouter();
    const theme = useTheme();
    const wallpaperSecondaryText = useMonetTextColor(true);

    const followSystemTheme = useSettingStore((state) => state.followSystemTheme);
    const setFollowSystemTheme = useSettingStore((state) => state.setFollowSystemTheme);
    const isDarkMode = useSettingStore((state) => state.isDarkMode);
    const setDarkMode = useSettingStore((state) => state.setDarkMode);
    const wallpaperUri = useSettingStore((state) => state.wallpaperUri);
    const setWallpaperUri = useSettingStore((state) => state.setWallpaperUri);
    const setWallpaperColor = useSettingStore((state) => state.setWallpaperColor);
    const wallpaperOpacity = useSettingStore((state) => state.wallpaperOpacity);
    const setWallpaperOpacity = useSettingStore((state) => state.setWallpaperOpacity);
    const wallpaperBlur = useSettingStore((state) => state.wallpaperBlur);
    const setWallpaperBlur = useSettingStore((state) => state.setWallpaperBlur);
    const useMonetText = useSettingStore((state) => state.useMonetText);
    const setUseMonetText = useSettingStore((state) => state.setUseMonetText);

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
            getImageAverageColor(target.uri)
                .then((color) => {
                    if (useSettingStore.getState().wallpaperUri === target.uri) setWallpaperColor(color);
                })
                .catch((error) => console.warn('分析壁纸颜色失败', error));
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
                        <View style={[styles.divider, { backgroundColor: theme.colors.dividerLine }]} />
                        <ListRow
                            title="字体莫奈取色"
                            summary="根据壁纸明暗自动调整透明区域的文字"
                            onPress={() => setUseMonetText(!useMonetText)}
                            trailing={<Switch value={useMonetText} interactive={false} />}
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
                                        blurRadius={wallpaperBlur}
                                        style={[StyleSheet.absoluteFill, { opacity: wallpaperOpacity }]}
                                    />
                                ) : (
                                    <View style={styles.emptyPreview}>
                                        <Icon name="image-outline" size={38} color={theme.colors.onSurfaceContainerHigh} />
                                        <Text type="body2" color={theme.colors.onSurfaceContainerHigh}>还没有选择壁纸</Text>
                                    </View>
                                )}
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
                                    <Text type="body2" color={theme.colors.onSurfaceVariantSummary}>文字与卡片会自动保持清晰</Text>
                                </View>
                            </View>

                            <View style={styles.actions}>
                                <Button type="primary" onPress={importWallpaper} disabled={isPicking} style={styles.primaryAction}>
                                    {isPicking ? '正在读取…' : wallpaperUri ? '更换图片' : '导入图片'}
                                </Button>
                                {wallpaperUri ? <Button onPress={clearWallpaper}>移除</Button> : null}
                            </View>

                            <SliderSetting
                                label="壁纸透明度"
                                valueLabel={`${Math.round(wallpaperOpacity * 100)}%`}
                                value={wallpaperOpacity}
                                minimumValue={0.15}
                                maximumValue={1}
                                onValueChange={setWallpaperOpacity}
                                disabled={!wallpaperUri}
                            />
                            <SliderSetting
                                label="高斯模糊"
                                valueLabel={`${Math.round(wallpaperBlur)}`}
                                value={wallpaperBlur}
                                minimumValue={0}
                                maximumValue={30}
                                step={1}
                                onValueChange={setWallpaperBlur}
                                disabled={!wallpaperUri}
                            />
                        </View>
                    </Card>
                </View>

                <Text type="footnote1" color={wallpaperSecondaryText} style={styles.hint}>
                    图片会保存在应用目录中。调整壁纸时，白天模式会加入轻微亮色遮罩，黑夜模式会自动压暗，避免正文与背景混在一起。
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

interface SliderSettingProps {
    label: string;
    valueLabel: string;
    value: number;
    minimumValue: number;
    maximumValue: number;
    step?: number;
    disabled?: boolean;
    onValueChange: (value: number) => void;
}

function SliderSetting({ label, valueLabel, disabled, ...sliderProps }: SliderSettingProps) {
    const theme = useTheme();

    return (
        <View style={[styles.sliderRow, disabled && styles.disabled]}>
            <View style={styles.sliderHeader}>
                <Text type="body1" weight="medium" color={theme.colors.onBackground}>{label}</Text>
                <Text type="body2" color={theme.colors.primary}>{valueLabel}</Text>
            </View>
            <Slider
                {...sliderProps}
                disabled={disabled}
                accessibilityLabel={label}
                style={styles.slider}
            />
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
    sliderRow: {
        paddingHorizontal: 4,
    },
    sliderHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    slider: {
        width: '100%',
        marginTop: 8,
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

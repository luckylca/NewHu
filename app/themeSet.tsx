import { useSettingStore } from '@/src/stores/useSettingStore';
import { notify } from '@/src/stores/useNotificationStore';
import { Button, Card, Icon, ListRow, SegmentedControl, StaticSettingsPage, Switch, Text } from '@/src/ui';
import { getWallpaperBlurRadius, resolveBackdropSource, resolveBaseTheme, type AppTheme, type ThemeName, type WallpaperBlurLevel, useTheme, wallpaperConfig } from '../project/react-native-hyper-ui/src/theme';
import { GlassAppearanceProvider, GlassSurface } from '@newhu/react-native-liquid-glass';
import { TopAppBar } from '../project/react-native-hyper-ui/src/components/TopAppBar';
import {
    supportsNativeThemePreviewLiquidGlass,
    supportsNativeThemePreviewThumbnail,
    ThemePreviewLiquidGlass,
    ThemePreviewThumbnail,
} from 'expo-theme-preview';
import { DefaultAmbientBackdrop } from '@/src/components/background/DefaultAmbientBackdrop';
import { File, Paths } from 'expo-file-system';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';

const BLUR_LEVELS: Exclude<WallpaperBlurLevel, 'off'>[] = ['low', 'medium', 'high'];

const ThemeSetScreen = () => {
    const router = useRouter();
    const goBack = useCallback(() => router.back(), [router]);
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
    const backdropSource = resolveBackdropSource(theme, Boolean(wallpaperUri));
    const hasAmbientDefault = backdropSource === 'ambient';
    const currentBackgroundLabel = wallpaperUri
        ? '当前背景：自定义壁纸'
        : hasAmbientDefault
            ? '当前背景：Liquid Glass 默认背景'
            : '当前背景：主题默认背景';

    const [isPicking, setIsPicking] = useState(false);

    const removeStoredWallpaper = useCallback((uri: string | null) => {
        if (!uri || !uri.startsWith(Paths.document.uri) || !uri.includes('/newhu-wallpaper-')) return;
        const file = new File(uri);
        if (file.exists) file.delete();
    }, []);

    const importWallpaper = useCallback(async () => {
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
    }, [removeStoredWallpaper, setWallpaperUri, wallpaperUri]);

    const clearWallpaper = useCallback(() => {
        removeStoredWallpaper(wallpaperUri);
        setWallpaperUri(null);
        notify('已恢复默认背景');
    }, [removeStoredWallpaper, setWallpaperUri, wallpaperUri]);

    const sections = useMemo(() => [
        {
            key: 'themes',
            node: (
                <View style={styles.section}>
                    <Text type="title4" weight="medium" color={theme.colors.onBackground} style={styles.sectionHeading}>主题风格</Text>
                    <View style={styles.themeChoices}>
                        <ThemeStyleCard
                            name="hyperos"
                            title="HyperOS"
                            summary="轻快、清晰的系统表面"
                            previewTheme={resolveBaseTheme('hyperos', theme.dark)}
                            selected={themeName === 'hyperos'}
                            onPress={() => setThemeName('hyperos')}
                        />
                        <ThemeStyleCard
                            name="coloros"
                            title="ColorOS"
                            summary="ColorOS 兼容主题 · 当前继承 HyperOS 视觉"
                            previewTheme={resolveBaseTheme('coloros', theme.dark)}
                            selected={themeName === 'coloros'}
                            onPress={() => setThemeName('coloros')}
                        />
                        <ThemeStyleCard
                            name="liquidGlass"
                            title="Liquid Glass"
                            summary="折射、柔焦与边缘高光"
                            previewTheme={resolveBaseTheme('liquidGlass', theme.dark)}
                            selected={themeName === 'liquidGlass'}
                            onPress={() => setThemeName('liquidGlass')}
                        />
                    </View>
                </View>
            ),
        },
        {
            key: 'appearance',
            node: (
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
            ),
        },
        {
            key: 'wallpaper',
            node: (
                <View style={styles.section}>
                    <Card contentStyle={styles.wallpaperCard}>
                        <CardSectionTitle>当前背景</CardSectionTitle>
                        <Text type="footnote1" color={theme.colors.onSurfaceVariantSummary} style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.sm }}>
                            {currentBackgroundLabel}
                        </Text>
                        <View style={styles.wallpaperContent}>
                            <View style={[styles.preview, { backgroundColor: theme.dark ? theme.wallpaper.base.dark : theme.wallpaper.base.light }]}>
                                {wallpaperUri ? (
                                    <Image
                                        source={{ uri: wallpaperUri }}
                                        resizeMode="cover"
                                        blurRadius={getWallpaperBlurRadius(wallpaperBlurLevel)}
                                        style={[StyleSheet.absoluteFill, { opacity: wallpaperConfig.opacity }]}
                                    />
                                ) : hasAmbientDefault ? (
                                    <DefaultAmbientBackdrop dark={theme.dark} />
                                ) : (
                                    <View style={styles.emptyPreview}>
                                        <Icon name="palette-outline" size={34} color={theme.colors.onSurfaceVariantSummary} />
                                        <Text type="body2" color={theme.colors.onSurfaceVariantSummary}>使用当前主题默认背景</Text>
                                    </View>
                                )}
                                {wallpaperUri ? (
                                    <View
                                        pointerEvents="none"
                                        style={[StyleSheet.absoluteFill, { backgroundColor: theme.dark ? theme.wallpaper.scrim.dark : theme.wallpaper.scrim.light }]}
                                    />
                                ) : null}
                                <Card feedback="none" contentStyle={styles.previewSample}>
                                    <Text type="headline1" weight="medium" color={theme.presentation.content.cardMaterial === 'glass' ? theme.colors.onGlass : theme.colors.onSurfaceContainer}>壁纸预览</Text>
                                    <Text type="body2" color={theme.presentation.content.cardMaterial === 'glass' ? theme.colors.onGlassSecondary : theme.colors.onSurfaceVariantSummary}>主题蒙层与卡片保持内容清晰</Text>
                                </Card>
                            </View>

                            <View style={styles.actions}>
                                <Button type="primary" onPress={importWallpaper} disabled={isPicking} style={styles.primaryAction}>
                                    {isPicking ? '正在读取…' : wallpaperUri ? '更换图片' : themeName === 'liquidGlass' ? '自定义背景' : '设置壁纸'}
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
            ),
        },
        {
            key: 'hint',
            node: (
                <Text type="footnote1" color={theme.colors.onBackgroundVariant} style={styles.hint}>
                    图片会保存在应用目录中。全局主题蒙层会保持正文清晰，文字颜色不会根据图片内容动态变化。
                </Text>
            ),
        },
    ], [
        clearWallpaper,
        currentBackgroundLabel,
        followSystemTheme,
        hasAmbientDefault,
        importWallpaper,
        isDarkMode,
        isPicking,
        setDarkMode,
        setFollowSystemTheme,
        setThemeName,
        setWallpaperBlurLevel,
        theme,
        themeName,
        wallpaperBlurLevel,
        wallpaperUri,
    ]);

    return (
        <StaticSettingsPage
            title="主题设置"
            back={goBack}
            topBar={<TopAppBar title="主题设置" back={goBack} samplingSource="routeScene" />}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            testID="theme-settings"
        >
            {sections.map((section) => <React.Fragment key={section.key}>{section.node}</React.Fragment>)}
        </StaticSettingsPage>
    );
};

function ThemeStyleCard({
    name,
    title,
    summary,
    previewTheme,
    selected,
    onPress,
}: {
    name: ThemeName;
    title: string;
    summary: string;
    previewTheme: AppTheme;
    selected: boolean;
    onPress: () => void;
}) {
    const theme = previewTheme;
    const glass = theme.presentation.topBar.material === 'glass' && theme.glass.enabled;
    const previewBase = theme.dark ? theme.wallpaper.base.dark : theme.wallpaper.base.light;
    const primaryText = glass ? theme.colors.onGlass : theme.colors.onSurface;
    const secondaryText = glass ? theme.colors.onGlassSecondary : theme.colors.onSurfaceVariantSummary;
    const glassPreviewMaterials = useMemo(() => ({
        bar: resolvePreviewMaterial(theme, 'bar'),
        card: resolvePreviewMaterial(theme, 'card'),
        tabBar: resolvePreviewMaterial(theme, 'tabBar'),
    }), [theme]);

    return (
        <GlassAppearanceProvider tokens={theme.glass} dark={theme.dark}>
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
                    {!glass && supportsNativeThemePreviewThumbnail ? (
                        <ThemePreviewThumbnail
                            style={{ flex: 1 }}
                            surfaceColor={theme.colors.surfaceContainer}
                            outlineColor={theme.colors.outline}
                            primaryTextColor={primaryText}
                            secondaryTextColor={secondaryText}
                            dotColor={theme.colors.primary}
                        />
                    ) : (
                        <>
                            {theme.wallpaper.defaultBackdrop === 'ambient' ? <DefaultAmbientBackdrop dark={theme.dark} /> : null}

                            {glass && supportsNativeThemePreviewLiquidGlass ? (
                                <ThemePreviewLiquidGlass
                                    style={styles.previewGlassComposite}
                                    pointerEvents="none"
                                    barMaterial={glassPreviewMaterials.bar}
                                    cardMaterial={glassPreviewMaterials.card}
                                    tabBarMaterial={glassPreviewMaterials.tabBar}
                                    outlineColor={theme.colors.outline}
                                    primaryTextColor={primaryText}
                                    secondaryTextColor={secondaryText}
                                    dotColor={theme.colors.primary}
                                />
                            ) : (
                                <>

                            {glass ? (
                                <GlassSurface
                                    variant="bar"
                                    positioning="floating"
                                    sampling="local"
                                    style={[styles.previewHeader, { backgroundColor: 'transparent' }]}
                                    contentStyle={styles.previewLineRow}
                                >
                                    <View style={[styles.previewDot, { backgroundColor: theme.colors.primary }]} />
                                    <View style={[styles.previewLine, { width: '45%', backgroundColor: primaryText }]} />
                                    <View style={[styles.previewLine, { width: '20%', backgroundColor: secondaryText }]} />
                                </GlassSurface>
                            ) : (
                                <View style={[styles.previewHeader, { backgroundColor: theme.colors.surfaceContainer }]}>
                                    <View style={styles.previewLineRow}>
                                        <View style={[styles.previewDot, { backgroundColor: theme.colors.primary }]} />
                                        <View style={[styles.previewLine, { width: '45%', backgroundColor: primaryText }]} />
                                        <View style={[styles.previewLine, { width: '20%', backgroundColor: secondaryText }]} />
                                    </View>
                                </View>
                            )}

                            <View style={styles.previewContent}>
                                {glass ? (
                                    <GlassSurface
                                        variant="card"
                                        positioning="inFlow"
                                        sampling="local"
                                        style={[styles.previewCard, { backgroundColor: 'transparent', borderColor: theme.colors.outline }]}
                                    >
                                        <View style={{ gap: 5 }}>
                                            <View style={[styles.previewLine, { width: '72%', backgroundColor: primaryText }]} />
                                            <View style={[styles.previewLine, { width: '48%', backgroundColor: secondaryText }]} />
                                        </View>
                                    </GlassSurface>
                                ) : (
                                    <View style={[styles.previewCard, { backgroundColor: theme.colors.surfaceContainer, borderColor: theme.colors.outline }]}>
                                        <View style={{ gap: 5 }}>
                                            <View style={[styles.previewLine, { width: '72%', backgroundColor: primaryText }]} />
                                            <View style={[styles.previewLine, { width: '48%', backgroundColor: secondaryText }]} />
                                        </View>
                                    </View>
                                )}
                            </View>

                            {glass ? (
                                <GlassSurface
                                    variant="tabBar"
                                    positioning="floating"
                                    sampling="local"
                                    style={[styles.previewBar, { backgroundColor: 'transparent', borderColor: theme.colors.outline }]}
                                    contentStyle={styles.previewLineRow}
                                >
                                    <View style={[styles.previewLine, { width: '40%', backgroundColor: primaryText }]} />
                                    <View style={[styles.previewLine, { width: '18%', backgroundColor: secondaryText }]} />
                                </GlassSurface>
                            ) : (
                                <View style={[styles.previewBar, { backgroundColor: theme.colors.surfaceContainer, borderColor: theme.colors.outline }]}>
                                    <View style={styles.previewLineRow}>
                                        <View style={[styles.previewLine, { width: '40%', backgroundColor: primaryText }]} />
                                        <View style={[styles.previewLine, { width: '18%', backgroundColor: secondaryText }]} />
                                    </View>
                                </View>
                            )}
                                </>
                            )}
                        </>
                    )}
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
        </GlassAppearanceProvider>
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

type PreviewGlassVariant = 'bar' | 'card' | 'tabBar';

function resolvePreviewMaterial(theme: AppTheme, variant: PreviewGlassVariant) {
    const material = theme.glass.materials[variant];
    const mode = theme.dark ? 'dark' : 'light';
    const colors = [
        theme.glass.procedural.baseTint[mode],
        (material.accentTint ?? theme.glass.procedural.accentTint)[mode],
        theme.glass.procedural.highlightTint[mode],
        theme.glass.procedural.innerShade[mode],
    ];
    return [
        ...colors.flatMap(parseGlassRgba),
        material.refractionAmount,
        material.chromaticAberration,
        material.highlightAlpha,
        theme.glass.procedural.noiseStrength,
        material.opacity ?? 1,
        material.radius,
    ];
}

function parseGlassRgba(value: string): number[] {
    const functional = value.match(/rgba?\(([^)]+)\)/i);
    if (functional) {
        const parts = functional[1].split(',').map((part) => Number.parseFloat(part.trim()));
        if (parts.length >= 3 && parts.slice(0, 3).every(Number.isFinite)) {
            return [parts[0] / 255, parts[1] / 255, parts[2] / 255, parts[3] ?? 1];
        }
    }
    const hex = value.replace('#', '').trim();
    if (/^[0-9a-f]{3}$/i.test(hex)) {
        return [...hex].map((digit) => Number.parseInt(`${digit}${digit}`, 16) / 255).concat(1);
    }
    if (/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(hex)) {
        return [
            Number.parseInt(hex.slice(0, 2), 16) / 255,
            Number.parseInt(hex.slice(2, 4), 16) / 255,
            Number.parseInt(hex.slice(4, 6), 16) / 255,
            hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1,
        ];
    }
    return [1, 1, 1, 0.2];
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
        flexWrap: 'wrap',
        gap: 10,
    },
    themeChoice: {
        flex: 1,
        minWidth: 160,
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
    previewLineRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
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
    previewGlassComposite: {
        position: 'absolute',
        left: 8,
        right: 8,
        top: 8,
        bottom: 8,
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

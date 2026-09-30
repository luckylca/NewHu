import { GlassMaterialProvider, GlassSurface } from '@newhu/react-native-liquid-glass';
import type { GlassMaterialTokens } from '@newhu/react-native-liquid-glass';
import { PageScaffold, PageScrollView, Slider, TopAppBar } from '@/src/ui';
import { Text } from '@/src/ui/primitives';
import { useTheme } from '@/src/ui/theme';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const LENS_WIDTH = 252;
const LENS_HEIGHT = 88;
const LENS_TOP = 64;

type OpticalKey = 'refractionBodyAmount' | 'refractionAmount' | 'refractionHeight' |
    'chromaticAberration' | 'highlightAlpha' | 'specularStrength' | 'fresnelStrength' | 'innerShadowStrength' | 'tintAlpha';

function clamp(value: number, low: number, high: number) {
    'worklet';
    return Math.max(low, Math.min(high, value));
}

function PatternBackdrop({ width, height, dark }: { width: number; height: number; dark: boolean }) {
    const cells = Math.ceil(width / 18) * Math.ceil(height / 18);
    const foreground = dark ? '#F5F8FF' : '#14263D';
    return (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: dark ? '#152033' : '#E7EEF7' }]}>
            <View style={styles.checker}>
                {Array.from({ length: cells }, (_, index) => (
                    <View key={index} style={{
                        width: 18,
                        height: 18,
                        backgroundColor: index % 2
                            ? (dark ? '#344966' : '#FFFFFF')
                            : (dark ? '#101827' : '#9FB1C7'),
                    }} />
                ))}
            </View>
            <View style={styles.patternText}>
                <Text style={[styles.glyphLine, { color: foreground }]}>ABCDEFGHJKLMNPQRSTUVWXYZ</Text>
                <Text style={[styles.glyphLine, styles.smallGlyphs, { color: foreground }]}>0123456789 文字边缘 / RGB / AGSL</Text>
                <Text style={[styles.glyphLine, { color: foreground }]}>||||||||||||||||||||||||||</Text>
                <Text style={[styles.glyphLine, styles.blockGlyphs, { color: foreground }]}>████████████████████████</Text>
                <Text style={[styles.glyphLine, styles.smallGlyphs, { color: foreground }]}>checkerboard  ·  SDF  ·  refract</Text>
            </View>
            <View style={[styles.verticalRule, { left: '25%', backgroundColor: foreground }]} />
            <View style={[styles.verticalRule, { left: '50%', backgroundColor: foreground }]} />
            <View style={[styles.verticalRule, { left: '75%', backgroundColor: foreground }]} />
            <View style={[styles.horizontalRule, { top: '34%', backgroundColor: foreground }]} />
            <View style={[styles.horizontalRule, { top: '68%', backgroundColor: foreground }]} />
        </View>
    );
}

function OpticalControl({
    title,
    value,
    minimumValue,
    maximumValue,
    format,
    onChange,
}: {
    title: string;
    value: number;
    minimumValue: number;
    maximumValue: number;
    format?: (value: number) => string;
    onChange: (value: number) => void;
}) {
    const theme = useTheme();
    return (
        <View style={styles.control}>
            <View style={styles.controlHeading}>
                <Text type="body2" weight="medium">{title}</Text>
                <Text type="footnote2" color={theme.colors.onSurfaceVariantSummary}>
                    {format ? format(value) : value.toFixed(1)}
                </Text>
            </View>
            <Slider value={value} minimumValue={minimumValue} maximumValue={maximumValue} onValueChange={onChange} />
        </View>
    );
}

function GlassLensDebugContent({
    tokens,
    initialDisplacementOnly,
    initialOptics,
}: {
    tokens: ReturnType<typeof useTheme>['glass'];
    initialDisplacementOnly: boolean;
    initialOptics: Partial<GlassMaterialTokens>;
}) {
    const theme = useTheme();
    const { width: windowWidth } = useWindowDimensions();
    const stageWidth = Math.max(windowWidth - 32, 1);
    const lensWidth = Math.min(LENS_WIDTH, stageWidth - 16);
    const initialLeft = Math.max(8, (stageWidth - lensWidth) / 2);
    const [stageHeight, setStageHeight] = useState(356);
    const [captureContinuous, setCaptureContinuous] = useState(false);
    const [displacementOnly, setDisplacementOnly] = useState(initialDisplacementOnly);
    const [optics, setOptics] = useState<Partial<GlassMaterialTokens>>(() => ({
        ...tokens.materials.tabSelectionLens,
        ...initialOptics,
    }));
    const opticalProgress = useSharedValue(0);
    const lensX = useSharedValue(initialLeft);
    const lensY = useSharedValue(LENS_TOP);
    const velocityX = useSharedValue(0);
    const velocityY = useSharedValue(0);
    const width = useSharedValue(stageWidth);
    const height = useSharedValue(stageHeight);

    useEffect(() => {
        if (Object.keys(initialOptics).length === 0) return;
        setOptics((current) => ({ ...current, ...initialOptics }));
    }, [initialOptics]);

    useEffect(() => {
        width.value = stageWidth;
        lensX.value = clamp(lensX.value, 8, Math.max(8, stageWidth - lensWidth - 8));
    }, [lensWidth, lensX, stageWidth, width]);

    const updateOpticalValue = useCallback((key: OpticalKey, value: number) => {
        setOptics((current) => ({ ...current, [key]: value }));
    }, []);

    const setCaptureOn = useCallback((enabled: boolean) => setCaptureContinuous(enabled), []);

    const gesture = useMemo(() => Gesture.Pan()
        .activateAfterLongPress(300)
        .onStart(() => {
            opticalProgress.value = withTiming(1, { duration: 130 });
            runOnJS(setCaptureOn)(true);
        })
        .onUpdate((event) => {
            lensX.value = clamp(event.x - lensWidth / 2, 8, Math.max(8, width.value - lensWidth - 8));
            lensY.value = clamp(event.y - LENS_HEIGHT / 2, 8, Math.max(8, height.value - LENS_HEIGHT - 8));
            velocityX.value = event.velocityX;
            velocityY.value = event.velocityY;
        })
        .onEnd(() => {
            opticalProgress.value = withTiming(0, { duration: 180 }, (finished) => {
                if (finished) runOnJS(setCaptureOn)(false);
            });
            velocityX.value = withTiming(0, { duration: 160 });
            velocityY.value = withTiming(0, { duration: 160 });
        }), [height, lensWidth, lensX, lensY, opticalProgress, setCaptureOn, velocityX, velocityY, width]);

    const animatedLensStyle = useAnimatedStyle(() => ({
        width: lensWidth + opticalProgress.value * 18,
        height: LENS_HEIGHT + opticalProgress.value * 10,
        borderRadius: 28 + opticalProgress.value * 6,
        transform: [
            { translateX: lensX.value - initialLeft },
            { translateY: lensY.value - LENS_TOP },
        ],
    }), [initialLeft, lensWidth]);

    const fallbackVisible = Platform.OS !== 'android';
    return (
        <PageScaffold topBar={<TopAppBar title="Glass Lens Debug" back={() => router.back()} />}>
            <PageScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.intro}>
                    <Text type="body2" weight="medium">SDF → 高度场 → 背景重采样</Text>
                    <Text type="footnote2" color={theme.colors.onSurfaceVariantSummary}>
                        长按测试区 300ms 后拖动镜片。文字、竖线与棋盘格应在镜片内发生位移。
                    </Text>
                </View>
                <GestureDetector gesture={gesture}>
                    <View
                        style={[styles.stage, { height: stageHeight }]}
                        onLayout={(event) => {
                            const nextHeight = event.nativeEvent.layout.height;
                            setStageHeight(nextHeight);
                            height.value = nextHeight;
                        }}
                    >
                        <PatternBackdrop width={stageWidth} height={stageHeight} dark={theme.dark} />
                        <View pointerEvents="none" style={styles.stageLabel}>
                            <Text type="footnote2" weight="bold" color={theme.dark ? '#F5F8FF' : '#243A56'}>
                                HOLD + DRAG THE LENS
                            </Text>
                        </View>
                        <GlassSurface
                            variant="tabSelectionLens"
                            positioning="floating"
                            sampling="backdrop"
                            continuous={captureContinuous}
                            opticalProgress={opticalProgress}
                            opticalMotionX={velocityX}
                            opticalMotionY={velocityY}
                            materialOverrides={optics}
                            displacementOnlyDebug={displacementOnly}
                            style={{
                                position: 'absolute',
                                left: initialLeft,
                                top: LENS_TOP,
                                width: lensWidth,
                                height: LENS_HEIGHT,
                                borderRadius: 28,
                            }}
                            animatedStyle={animatedLensStyle}
                            placeholderChildren={<View style={{ width: lensWidth, height: LENS_HEIGHT }} />}
                        />
                    </View>
                </GestureDetector>

                <View style={styles.stats}>
                    <Text type="footnote2" color={theme.colors.onSurfaceVariantSummary}>
                        {fallbackVisible ? '当前平台未启用 Android AGSL。' : '空闲：内容 dirty 时裁剪采样；拖动：连续采样，裁剪框为 Lens + 28dp。'}
                    </Text>
                    <Pressable
                        accessibilityRole="switch"
                        accessibilityState={{ checked: displacementOnly }}
                        onPress={() => setDisplacementOnly((enabled) => !enabled)}
                        style={[styles.debugToggle, { borderColor: theme.colors.outline, backgroundColor: displacementOnly ? theme.colors.primaryContainer : theme.colors.surfaceContainer }]}
                    >
                        <Text type="footnote1" weight="medium" color={displacementOnly ? theme.colors.onPrimaryContainer : theme.colors.onSurface}>
                            {displacementOnly ? 'Displacement Only: ON' : 'Displacement Only: OFF'}
                        </Text>
                    </Pressable>
                </View>

                <Text type="title4" weight="medium" style={styles.controlsTitle}>光学参数</Text>
                <OpticalControl title="Body displacement" value={optics.refractionBodyAmount ?? 1.5} minimumValue={0} maximumValue={6} format={(value) => `${value.toFixed(1)} dp`} onChange={(value) => updateOpticalValue('refractionBodyAmount', value)} />
                <OpticalControl title="Edge displacement" value={optics.refractionAmount ?? 5.5} minimumValue={0} maximumValue={12} format={(value) => `${value.toFixed(1)} dp`} onChange={(value) => updateOpticalValue('refractionAmount', value)} />
                <OpticalControl title="Lens profile depth" value={optics.refractionHeight ?? 12} minimumValue={4} maximumValue={24} format={(value) => `${value.toFixed(1)} dp`} onChange={(value) => updateOpticalValue('refractionHeight', value)} />
                <OpticalControl title="RGB dispersion" value={optics.chromaticAberration ?? 0.2} minimumValue={0} maximumValue={0.8} onChange={(value) => updateOpticalValue('chromaticAberration', value)} />
                <OpticalControl title="Specular" value={optics.specularStrength ?? 0.9} minimumValue={0} maximumValue={1.8} onChange={(value) => updateOpticalValue('specularStrength', value)} />
                <OpticalControl title="Fresnel edge" value={optics.fresnelStrength ?? 1.12} minimumValue={0} maximumValue={2} onChange={(value) => updateOpticalValue('fresnelStrength', value)} />
                <OpticalControl title="Inner compression shade" value={optics.innerShadowStrength ?? 0.3} minimumValue={0} maximumValue={1} onChange={(value) => updateOpticalValue('innerShadowStrength', value)} />
                <OpticalControl title="Tint alpha" value={optics.tintAlpha ?? 0.24} minimumValue={0} maximumValue={1} onChange={(value) => updateOpticalValue('tintAlpha', value)} />
            </PageScrollView>
        </PageScaffold>
    );
}

export default function GlassLensDebugScreen() {
    const theme = useTheme();
    const { displacementOnly: displacementOnlyParam, body, edge, depth } = useLocalSearchParams<{
        displacementOnly?: string;
        body?: string;
        edge?: string;
        depth?: string;
    }>();
    const initialOptics = useMemo<Partial<GlassMaterialTokens>>(() => {
        const parsedBody = Number(body);
        const parsedEdge = Number(edge);
        const parsedDepth = Number(depth);
        return {
            ...(Number.isFinite(parsedBody) ? { refractionBodyAmount: parsedBody } : {}),
            ...(Number.isFinite(parsedEdge) ? { refractionAmount: parsedEdge } : {}),
            ...(Number.isFinite(parsedDepth) ? { refractionHeight: parsedDepth } : {}),
        };
    }, [body, depth, edge]);
    const tokens = useMemo(() => ({ ...theme.glass, enabled: true, quality: 'high' as const }), [theme.glass]);
    return (
        <GlassMaterialProvider tokens={tokens} dark={theme.dark}>
            <GlassLensDebugContent
                tokens={tokens}
                initialDisplacementOnly={displacementOnlyParam === 'true'}
                initialOptics={initialOptics}
            />
        </GlassMaterialProvider>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 36, gap: 12 },
    intro: { gap: 4 },
    stage: { borderRadius: 24, overflow: 'hidden', position: 'relative' },
    checker: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', flexWrap: 'wrap' },
    patternText: { position: 'absolute', top: 20, left: 8, right: 8, gap: 28 },
    glyphLine: { fontFamily: 'monospace', fontSize: 19, lineHeight: 24, fontWeight: '700', letterSpacing: 0.35 },
    smallGlyphs: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
    blockGlyphs: { fontSize: 15, lineHeight: 20, letterSpacing: 1 },
    verticalRule: { position: 'absolute', top: 0, bottom: 0, width: 1, opacity: 0.42 },
    horizontalRule: { position: 'absolute', left: 0, right: 0, height: 1, opacity: 0.42 },
    stageLabel: { position: 'absolute', right: 12, bottom: 10, padding: 5, backgroundColor: 'rgba(255,255,255,0.4)' },
    stats: { gap: 8 },
    debugToggle: { minHeight: 42, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
    controlsTitle: { marginTop: 6 },
    control: { gap: 4 },
    controlHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});

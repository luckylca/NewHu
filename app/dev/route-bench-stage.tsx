import { PageFlatList, PageScaffold, PageScrollView, Text as UiText, TopAppBar, useTheme } from '@/src/ui';
import type { ParamListBase } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef } from 'react';
import { Image, View, useWindowDimensions } from 'react-native';
import RenderHtml from 'react-native-render-html';

const STAGES = ['minimal', 'topbar', 'text', 'list', 'html', 'media', 'full'] as const;
type RouteBenchStageName = typeof STAGES[number];
const LOCAL_IMAGE = require('../../assets/images/icon.png');
const BODY = Array.from({ length: 24 }, (_, index) => (
    `<h3>Article section ${index + 1}</h3><p>Stable synthetic content for route mount profiling. This paragraph exercises text wrapping, native text layout, HTML parsing and document block composition without starting a network request or business effect.</p>`
)).join('');

function RouteBenchBody({ stage }: { stage: RouteBenchStageName }) {
    const theme = useTheme();
    const { width } = useWindowDimensions();
    const rows = useMemo(() => Array.from({ length: 80 }, (_, index) => ({ id: `row-${index}`, index })), []);
    const showText = stage === 'text' || stage === 'full';
    const showHtml = stage === 'html' || stage === 'full';
    const showMedia = stage === 'media' || stage === 'full';

    if (stage === 'list') {
        return (
            <PageFlatList
                data={rows}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ gap: 12, paddingHorizontal: 20, paddingBottom: 40 }}
                renderItem={({ item }) => (
                    <View style={{ minHeight: 76, justifyContent: 'center', padding: 16, borderRadius: 16, backgroundColor: theme.colors.surfaceContainer }}>
                        <UiText type="body1">Synthetic route row {item.index + 1}</UiText>
                        <UiText type="body2" color={theme.colors.onSurfaceVariantSummary}>Mount and layout sample · {item.id}</UiText>
                    </View>
                )}
            />
        );
    }

    return (
        <PageScrollView contentContainerStyle={{ gap: 16, paddingHorizontal: 20, paddingBottom: 48 }}>
            {showText ? Array.from({ length: 16 }, (_, index) => (
                <UiText key={`text-${index}`} type="body1">
                    Route benchmark text block {index + 1}. A repeated but stable paragraph exercises React elements and Yoga text layout.
                </UiText>
            )) : null}
            {showHtml ? <RenderHtml contentWidth={width - 40} source={{ html: BODY }} /> : null}
            {showMedia ? Array.from({ length: 12 }, (_, index) => (
                <Image key={`media-${index}`} source={LOCAL_IMAGE} resizeMode="cover" style={{ width: '100%', height: 180, borderRadius: 16 }} />
            )) : null}
            {stage === 'topbar' || stage === 'minimal' ? (
                <UiText type="body2" color={theme.colors.onSurfaceVariantSummary}>Theme backdrop only; no synthetic business side effects.</UiText>
            ) : null}
        </PageScrollView>
    );
}

export default function RouteBenchStage() {
    const params = useLocalSearchParams<{ stage?: string; round?: string }>();
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>();
    const router = useRouter();
    const hasBackScheduled = useRef(false);
    const stage = STAGES.includes(params.stage as RouteBenchStageName) ? params.stage as RouteBenchStageName : 'minimal';
    const round = params.round ?? '0';
    const hasTopBar = stage !== 'minimal';

    useEffect(() => {
        hasBackScheduled.current = false;
        let backTimer: ReturnType<typeof setTimeout> | null = null;
        const unsubscribe = navigation.addListener('transitionEnd', () => {
            if (hasBackScheduled.current) return;
            hasBackScheduled.current = true;
            console.info(`[ROUTE_BENCH_SETTLED] stage=${stage} round=${round}`);
            backTimer = setTimeout(() => {
                console.info(`[ROUTE_BENCH_BACK] stage=${stage} round=${round}`);
                router.back();
            }, 1_200);
        });
        return () => {
            unsubscribe();
            if (backTimer) clearTimeout(backTimer);
        };
    }, [navigation, round, router, stage]);

    return (
        <PageScaffold topBar={hasTopBar ? <TopAppBar title={`Route Bench · ${stage}`} back={() => router.back()} /> : undefined}>
            <RouteBenchBody stage={stage} />
        </PageScaffold>
    );
}

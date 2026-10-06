import { PageContent, PageScaffold, TopAppBar, useTheme } from '@/src/ui';
import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { Text } from '@/src/ui/primitives';

const STAGES = ['minimal', 'topbar', 'text', 'list', 'html', 'media', 'full'] as const;
type RouteBenchStage = typeof STAGES[number];
const ROUTE_TARGETS = {
    settings: '/settings',
    theme: '/themeSet',
    animation: '/animationSettings',
    advanced: '/devmode',
    privacy: '/privacy-personalization',
    storage: '/storage-management',
    ai: '/ai-analysis-settings',
    about: '/about',
    account: '/userinfo',
    webview: '/webview',
} as const;
type RouteBenchTarget = keyof typeof ROUTE_TARGETS;

export default function RouteBenchRunner() {
    const params = useLocalSearchParams<{ stage?: string; target?: string; rounds?: string; startDelayMs?: string }>();
    const router = useRouter();
    const theme = useTheme();
    const focused = useIsFocused();
    const roundRef = useRef(0);
    const backTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const stage = STAGES.includes(params.stage as RouteBenchStage) ? params.stage as RouteBenchStage : 'minimal';
    const target = params.target && params.target in ROUTE_TARGETS ? params.target as RouteBenchTarget : null;
    const parsedRounds = Number.parseInt(params.rounds ?? '', 10);
    const rounds = Number.isFinite(parsedRounds) ? Math.min(10, Math.max(1, parsedRounds)) : 5;
    const parsedDelay = Number.parseInt(params.startDelayMs ?? '', 10);
    const startDelayMs = Number.isFinite(parsedDelay) ? Math.min(10_000, Math.max(0, parsedDelay)) : 8_000;

    useEffect(() => () => {
        if (backTimerRef.current) clearTimeout(backTimerRef.current);
    }, []);

    useEffect(() => {
        if (!focused) return;
        if (roundRef.current >= rounds) {
            if (roundRef.current === rounds) {
                console.info(`[ROUTE_BENCH_DONE] target=${target ?? 'stage:' + stage} rounds=${rounds}`);
                roundRef.current += 1;
            }
            return;
        }

        const delay = roundRef.current === 0 ? startDelayMs : 1_000;
        const timer = setTimeout(() => {
            roundRef.current += 1;
            console.info(`[ROUTE_BENCH_PUSH] target=${target ?? 'stage:' + stage} round=${roundRef.current}`);
            if (target) {
                router.push(ROUTE_TARGETS[target]);
                backTimerRef.current = setTimeout(() => {
                    console.info(`[ROUTE_BENCH_BACK] target=${target} round=${roundRef.current}`);
                    router.back();
                }, 1_800);
            } else {
                router.push({
                    pathname: '/dev/route-bench-stage',
                    params: { stage, round: String(roundRef.current) },
                });
            }
        }, delay);
        return () => clearTimeout(timer);
    }, [focused, router, rounds, stage, startDelayMs, target]);

    return (
        <PageScaffold topBar={<TopAppBar title="Route Bench Runner" />}>
            <PageContent style={{ flex: 1, padding: 24, backgroundColor: theme.colors.background }}>
                <View style={{ gap: 12 }}>
                    <Text type="title3">Native Stack push/back benchmark</Text>
                <Text type="body2">target={target ?? `stage:${stage}`} · rounds={rounds}</Text>
                </View>
            </PageContent>
        </PageScaffold>
    );
}

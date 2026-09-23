import { Card, Checkbox, ListRow, NavigationBar, NumberWheel, ProgressIndicator, SegmentedControl, Slider, Text, useTheme } from '@/src/ui';
import { useLocalSearchParams } from 'expo-router';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

const ROWS = Array.from({ length: 120 }, (_, index) => index + 1);
const NAV_ITEMS = [{ label: '首页' }, { label: '发现' }, { label: '我的' }];
const SEGMENT_TABS = ['推荐', '关注', '热榜'];
const FIXED_SUMMARY = '固定 props；观察父级更新时行组件的重复渲染';

type MeasuredRowProps = { id: number; renderCount: MutableRefObject<number> };

const MemoMeasuredHyperRow = memo(function MemoMeasuredHyperRow({ id, renderCount }: MeasuredRowProps) {
    renderCount.current += 1;
    return <ListRow title={`Hyper UI row ${id}`} summary={FIXED_SUMMARY} />;
});

/** Same ListRow native tree without the library's React.memo boundary. */
function UnmemoizedReferenceRow({ id, renderCount }: MeasuredRowProps) {
    'use no memo';
    renderCount.current += 1;
    const theme = useTheme();
    const tokens = theme.components.preference;
    const pressed = useSharedValue(0);
    void pressed;

    return (
        <Pressable
            accessibilityState={{ disabled: false }}
            style={[{ minHeight: tokens.minHeight, padding: tokens.padding, justifyContent: 'center' }]}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.gap }}>
                <View style={{ flex: 1, minWidth: 0, flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center' }}>
                    <Text type="headline1" weight="medium" color={theme.colors.onBackground} numberOfLines={1}>
                        {`Hyper UI row ${id}`}
                    </Text>
                    <Text type="body2" color={theme.colors.onSurfaceVariantSummary} numberOfLines={1}>
                        {FIXED_SUMMARY}
                    </Text>
                </View>
            </View>
        </Pressable>
    );
}

/** Temporary, deterministic Hyper UI stress screen for device frame profiling. */
export default function HyperPerformanceBenchmark() {
    'use no memo';
    const { case: requestedCase, variant: requestedVariant } = useLocalSearchParams<{ case?: string; variant?: string }>();
    const testCase = requestedCase ?? 'updates';
    const variant = requestedVariant === 'plain' ? 'plain' : 'memo';
    const theme = useTheme();
    const scrollRef = useRef<ScrollView>(null);
    const rowRenderCount = useRef(0);
    const [revision, setRevision] = useState(0);
    const [sliderValue, setSliderValue] = useState(40);
    const [wheelValue, setWheelValue] = useState(25);
    const [checkboxValue, setCheckboxValue] = useState(false);
    const [segment, setSegment] = useState(0);
    const [navIndex, setNavIndex] = useState(0);
    const [progressAnimating, setProgressAnimating] = useState(false);
    const [runStatus, setRunStatus] = useState('warmup');

    const onSliderChange = useCallback((value: number) => setSliderValue(value), []);
    const onWheelChange = useCallback((value: number) => setWheelValue(value), []);
    const onCheckboxChange = useCallback((value: boolean) => setCheckboxValue(value), []);
    const onSegmentSelect = useCallback((value: number) => setSegment(value), []);
    const onNavigationSelect = useCallback((value: number) => setNavIndex(value), []);

    const benchmarkRows = ROWS.map((id) => variant === 'plain'
        ? <UnmemoizedReferenceRow key={id} id={id} renderCount={rowRenderCount} />
        : <MemoMeasuredHyperRow key={id} id={id} renderCount={rowRenderCount} />);

    useEffect(() => {
        let interval: ReturnType<typeof setInterval> | undefined;
        const warmup = setTimeout(() => {
            setRunStatus('running');
            if (testCase === 'motion') setProgressAnimating(true);

            const startedAt = Date.now();
            let tick = 0;
            const targetTicks = testCase === 'updates' ? 120 : testCase === 'scroll' ? 16 : 80;
            const intervalMs = testCase === 'updates' ? 33 : testCase === 'scroll' ? 550 : 100;
            interval = setInterval(() => {
                tick += 1;

                if (testCase === 'updates') {
                    setRevision((value) => value + 1);
                } else if (testCase === 'scroll') {
                    const target = tick % 12;
                    scrollRef.current?.scrollTo({ y: target * 600, animated: true });
                    setRevision((value) => value + 1);
                } else if (testCase === 'controls' || testCase === 'motion') {
                    setSliderValue((value) => (value + 5) % 105);
                    setWheelValue((value) => (value + 5) % 105);
                    setCheckboxValue((value) => !value);
                    setSegment((value) => (value + 1) % 3);
                    setNavIndex((value) => (value + 1) % NAV_ITEMS.length);
                    setRevision((value) => value + 1);
                }

                if (tick >= targetTicks) {
                    if (interval) clearInterval(interval);
                    setProgressAnimating(false);
                    const elapsedMs = Date.now() - startedAt;
                    setRunStatus(`complete · ${variant} · rows ${rowRenderCount.current} · ${elapsedMs}ms`);
                    console.log(`[HYPER_PERF] case=${testCase} variant=${variant} ticks=${tick} rows=${rowRenderCount.current} elapsedMs=${elapsedMs}`);
                }
            }, intervalMs);
        }, 5000);

        return () => {
            clearTimeout(warmup);
            if (interval) clearInterval(interval);
        };
    }, [testCase, variant]);

    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
            <View style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12 }}>
                <Text type="title3" weight="medium">Hyper UI 性能测试</Text>
                <Text type="body2" color={theme.colors.onSurfaceVariantSummary}>
                    case={testCase} · {runStatus} · parent revision {revision}
                </Text>
            </View>
            <ScrollView ref={scrollRef} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48, gap: 16 }}>
                <Card>
                    <View style={{ padding: 16, gap: 12 }}>
                        <Text type="headline1" weight="medium">Hyper 控件负载</Text>
                        <Slider value={sliderValue} minimumValue={0} maximumValue={100} step={5} showKeyPoints onValueChange={onSliderChange} accessibilityLabel="测试滑块" />
                        <NumberWheel value={wheelValue} min={0} max={100} step={5} onChange={onWheelChange} />
                        <Checkbox value={checkboxValue} onValueChange={onCheckboxChange} accessibilityLabel="测试复选框" />
                        <ProgressIndicator progress={sliderValue / 100} indeterminate={progressAnimating} />
                        <SegmentedControl tabs={SEGMENT_TABS} selected={segment} onSelect={onSegmentSelect} />
                        <NavigationBar items={NAV_ITEMS} selected={navIndex} onSelect={onNavigationSelect} />
                    </View>
                </Card>
                {benchmarkRows}
            </ScrollView>
        </View>
    );
}

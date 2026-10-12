import React, { createContext, useContext, useEffect } from 'react';
import type { LayoutChangeEvent } from 'react-native';

export interface PageBenchmarkConfig {
    runId: string;
    scrollDistanceDp: number;
    durationMs: number;
    feedRenderer: 'flatList' | 'flashList';
}

export interface PageScrollHandle {
    scrollTo(offset: number, animated: boolean): void;
    maxOffset?(): number;
}

interface PageScrollableListRef {
    scrollToOffset(options: { offset: number; animated?: boolean }): void;
}

const PageBenchmarkContext = createContext<PageBenchmarkConfig | null>(null);

export function PageBenchmarkProvider({ config, children }: { config: PageBenchmarkConfig | null; children: React.ReactNode }) {
    return <PageBenchmarkContext.Provider value={config}>{children}</PageBenchmarkContext.Provider>;
}

export function usePageBenchmarkConfig() {
    return useContext(PageBenchmarkContext);
}

export function usePageBenchmarkDriver(scrollHandle: PageScrollHandle | null, testID?: string) {
    const config = usePageBenchmarkConfig();

    useEffect(() => {
        if (!config || !scrollHandle || !testID) return;

        let offset = 0;
        let direction = 1;
        let readyTimer: ReturnType<typeof setTimeout> | undefined;
        let startTimer: ReturnType<typeof setTimeout> | undefined;
        let motionTimer: ReturnType<typeof setInterval> | undefined;
        let finishTimer: ReturnType<typeof setTimeout> | undefined;

        scrollHandle.scrollTo(0, false);
        readyTimer = setTimeout(() => {
            const actualDistance = Math.min(
                config.scrollDistanceDp,
                Math.max(0, scrollHandle.maxOffset?.() ?? config.scrollDistanceDp),
            );
            console.info(`[PAGE_BENCHMARK_READY] run=${config.runId} testID=${testID} requestedDistanceDp=${config.scrollDistanceDp} actualDistanceDp=${actualDistance} durationMs=${config.durationMs}`);
            startTimer = setTimeout(() => {
                console.info(`[PAGE_BENCHMARK_START] run=${config.runId} testID=${testID}`);
                if (actualDistance > 0) {
                    motionTimer = setInterval(() => {
                        const step = Math.min(120, actualDistance);
                        const nextOffset = offset + direction * step;
                        if (nextOffset >= actualDistance || nextOffset <= 0) direction *= -1;
                        offset = Math.max(0, Math.min(actualDistance, nextOffset));
                        scrollHandle.scrollTo(offset, true);
                    }, 250);
                }
                finishTimer = setTimeout(() => {
                    if (motionTimer) clearInterval(motionTimer);
                    scrollHandle.scrollTo(0, false);
                    console.info(`[PAGE_BENCHMARK_DONE] run=${config.runId} testID=${testID} durationMs=${config.durationMs}`);
                }, config.durationMs);
            }, 2_000);
        }, 2_500);

        return () => {
            if (readyTimer) clearTimeout(readyTimer);
            if (startTimer) clearTimeout(startTimer);
            if (motionTimer) clearInterval(motionTimer);
            if (finishTimer) clearTimeout(finishTimer);
        };
    }, [config, scrollHandle, testID]);
}

export function usePageBenchmarkList(testID?: string) {
    const config = usePageBenchmarkConfig();
    const listRef = React.useRef<PageScrollableListRef | null>(null);
    const geometry = React.useRef({ contentHeight: 0, viewportHeight: 0 });
    const [scrollHandle, setScrollHandle] = React.useState<PageScrollHandle | null>(null);
    const handle = React.useMemo<PageScrollHandle>(() => ({
        scrollTo: (offset, animated) => {
            const { contentHeight, viewportHeight } = geometry.current;
            const maxOffset = Math.max(0, contentHeight - viewportHeight);
            listRef.current?.scrollToOffset({ offset: Math.max(0, Math.min(offset, maxOffset)), animated });
        },
        maxOffset: () => Math.max(0, geometry.current.contentHeight - geometry.current.viewportHeight),
    }), []);
    const attachList = React.useCallback((instance: PageScrollableListRef | null) => {
        listRef.current = instance;
        if (config) setScrollHandle(instance ? handle : null);
    }, [config, handle]);
    const onLayout = React.useCallback((event: LayoutChangeEvent) => {
        geometry.current.viewportHeight = event.nativeEvent.layout.height;
    }, []);
    const onContentSizeChange = React.useCallback((_width: number, height: number) => {
        geometry.current.contentHeight = height;
    }, []);

    usePageBenchmarkDriver(scrollHandle, testID);

    return { listRef: attachList, onLayout, onContentSizeChange };
}

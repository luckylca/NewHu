import React, { useEffect } from 'react';

type PageTag = 'home' | 'question';
type CounterName = 'screenRenders' | 'headerRenders' | 'renderItemRenders' | 'cellMounts' | 'cellUnmounts';
type PageCounters = Record<CounterName, number>;

const emptyCounters = (): PageCounters => ({
    screenRenders: 0,
    headerRenders: 0,
    renderItemRenders: 0,
    cellMounts: 0,
    cellUnmounts: 0,
});

let enabled = false;
let counters: Record<PageTag, PageCounters> = {
    home: emptyCounters(),
    question: emptyCounters(),
};

export function beginPageRenderDiagnostics() {
    counters = { home: emptyCounters(), question: emptyCounters() };
    enabled = __DEV__;
}

export function isPageRenderDiagnosticsEnabled() {
    return __DEV__ && enabled;
}

export function recordPageRenderDiagnostic(page: PageTag, counter: CounterName) {
    if (!isPageRenderDiagnosticsEnabled()) return;
    counters[page][counter] += 1;
}

export function snapshotPageRenderDiagnostics() {
    const snapshot = JSON.parse(JSON.stringify(counters)) as Record<PageTag, PageCounters>;
    enabled = false;
    return snapshot;
}

export function DiagnosticListCell({ page, children }: { page: PageTag; children: React.ReactNode }) {
    useEffect(() => {
        recordPageRenderDiagnostic(page, 'cellMounts');
        return () => recordPageRenderDiagnostic(page, 'cellUnmounts');
    }, [page]);

    return <>{children}</>;
}

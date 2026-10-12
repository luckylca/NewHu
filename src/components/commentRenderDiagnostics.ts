type CommentRenderSnapshot = {
    screenRenderCount: number;
    rowRenderCount: number;
    rowMountCount: number;
    rowUnmountCount: number;
    commentTextRenderCount: number;
    commentTextParseCount: number;
    commentTextParseTotalMs: number;
    commentTextParseMaxMs: number;
    commentTextTokenCount: number;
};

const emptySnapshot = (): CommentRenderSnapshot => ({
    screenRenderCount: 0,
    rowRenderCount: 0,
    rowMountCount: 0,
    rowUnmountCount: 0,
    commentTextRenderCount: 0,
    commentTextParseCount: 0,
    commentTextParseTotalMs: 0,
    commentTextParseMaxMs: 0,
    commentTextTokenCount: 0,
});

let enabled = false;
let counters = emptySnapshot();

export function beginCommentRenderDiagnostics() {
    if (!__DEV__) return;
    counters = emptySnapshot();
    enabled = true;
}

export function isCommentRenderDiagnosticsEnabled() {
    return __DEV__ && enabled;
}

export function recordCommentScreenRender() {
    if (isCommentRenderDiagnosticsEnabled()) counters.screenRenderCount += 1;
}

export function recordCommentRowRender() {
    if (isCommentRenderDiagnosticsEnabled()) counters.rowRenderCount += 1;
}

export function recordCommentRowMount() {
    if (isCommentRenderDiagnosticsEnabled()) counters.rowMountCount += 1;
}

export function recordCommentRowUnmount() {
    if (isCommentRenderDiagnosticsEnabled()) counters.rowUnmountCount += 1;
}

export function recordCommentTextRender() {
    if (isCommentRenderDiagnosticsEnabled()) counters.commentTextRenderCount += 1;
}

export function recordCommentTextParse(durationMs: number, tokenCount: number) {
    if (!isCommentRenderDiagnosticsEnabled()) return;
    counters.commentTextParseCount += 1;
    counters.commentTextParseTotalMs += durationMs;
    counters.commentTextParseMaxMs = Math.max(counters.commentTextParseMaxMs, durationMs);
    counters.commentTextTokenCount += tokenCount;
}

export function snapshotCommentRenderDiagnostics() {
    enabled = false;
    return { ...counters };
}

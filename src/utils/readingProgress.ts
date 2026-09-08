export const READING_COMPLETION_RATIO = 0.94;
export const READING_BOTTOM_TOLERANCE_PX = 96;
export const READING_RESUME_MIN_OFFSET_PX = 80;
export const READING_RESUME_MIN_RATIO = 0.03;

export type ReadingProgressSnapshot = {
    scrollOffset: number;
    scrollRatio: number;
    maxScrollRatio: number;
    completed: boolean;
    contentHeight: number;
    viewportHeight: number;
};

function finiteNonNegative(value: number) {
    return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function clamp01(value: number) {
    return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function createReadingProgressSnapshot(options: {
    scrollOffset: number;
    contentHeight: number;
    viewportHeight: number;
    previousMaxScrollRatio?: number;
    wasCompleted?: boolean;
}): ReadingProgressSnapshot {
    const contentHeight = finiteNonNegative(options.contentHeight);
    const viewportHeight = finiteNonNegative(options.viewportHeight);
    const scrollable = Math.max(0, contentHeight - viewportHeight);
    const scrollOffset = Math.min(scrollable, finiteNonNegative(options.scrollOffset));
    const scrollRatio = scrollable <= 1 ? 1 : clamp01(scrollOffset / scrollable);
    const maxScrollRatio = Math.max(clamp01(options.previousMaxScrollRatio ?? 0), scrollRatio);
    const distanceToBottom = Math.max(0, scrollable - scrollOffset);
    const completed = Boolean(options.wasCompleted)
        || scrollable <= 1
        || maxScrollRatio >= READING_COMPLETION_RATIO
        || distanceToBottom <= READING_BOTTOM_TOLERANCE_PX;

    return {
        scrollOffset,
        scrollRatio,
        maxScrollRatio,
        completed,
        contentHeight,
        viewportHeight,
    };
}

export function getReadingResumeOffset(
    progress: Pick<ReadingProgressSnapshot, 'scrollOffset' | 'scrollRatio' | 'completed'>,
    currentContentHeight: number,
    currentViewportHeight: number,
) {
    if (progress.completed) return 0;

    const scrollable = Math.max(
        0,
        finiteNonNegative(currentContentHeight) - finiteNonNegative(currentViewportHeight),
    );
    if (scrollable <= 1) return 0;

    const savedOffset = finiteNonNegative(progress.scrollOffset);
    const savedRatio = clamp01(progress.scrollRatio);
    if (savedOffset < READING_RESUME_MIN_OFFSET_PX && savedRatio < READING_RESUME_MIN_RATIO) {
        return 0;
    }

    if (savedRatio > 0) {
        return Math.min(scrollable, savedRatio * scrollable);
    }
    return Math.min(scrollable, savedOffset);
}

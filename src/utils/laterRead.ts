import type { LaterReadItem, LaterReadSortMode } from '@/src/stores/useLaterReadStore';

export type LaterReadRuntimeState = {
    completed: boolean;
    progress: number;
    offline: boolean;
};

export type LaterReadRuntimeStateMap = Record<string, LaterReadRuntimeState>;

export function sortLaterReadItems(
    items: LaterReadItem[],
    sortMode: LaterReadSortMode,
    runtimeStates: LaterReadRuntimeStateMap,
) {
    const sorted = [...items];
    sorted.sort((left, right) => {
        if (sortMode === 'added_asc') {
            return left.addedAt - right.addedAt || left.title.localeCompare(right.title);
        }
        if (sortMode === 'title') {
            return left.title.localeCompare(right.title, 'zh-CN') || right.addedAt - left.addedAt;
        }
        if (sortMode === 'unread_first') {
            const leftRead = runtimeStates[left.key]?.completed ? 1 : 0;
            const rightRead = runtimeStates[right.key]?.completed ? 1 : 0;
            return leftRead - rightRead || right.addedAt - left.addedAt;
        }
        return right.addedAt - left.addedAt || left.title.localeCompare(right.title);
    });
    return sorted;
}

export function formatLaterReadProgress(state?: LaterReadRuntimeState) {
    if (!state) return '未读';
    if (state.completed) return '已读完';
    const progress = Math.max(0, Math.min(1, state.progress || 0));
    if (progress < 0.01) return '未读';
    return `阅读 ${Math.max(1, Math.round(progress * 100))}%`;
}

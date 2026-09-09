import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { FeedType } from '@/src/types/zhihu';

export type LaterReadItem = {
    key: string;
    id: string;
    type: FeedType;
    title: string;
    summary: string;
    authorName: string;
    authorAvatar?: string;
    questionId?: string;
    updatedTime?: number;
    addedAt: number;
};

export type LaterReadSortMode = 'added_desc' | 'added_asc' | 'unread_first' | 'title';

type BubblePosition = {
    x: number;
    y: number;
};

type SaveLaterReadInput = Omit<LaterReadItem, 'key' | 'addedAt'> & {
    addedAt?: number;
};

type LaterReadState = {
    items: LaterReadItem[];
    bubblePosition: BubblePosition | null;
    panelOpenRequest: number;
    sortMode: LaterReadSortMode;
    addItem: (item: SaveLaterReadInput) => void;
    removeItem: (key: string) => void;
    removeItems: (keys: string[]) => void;
    clearItems: () => void;
    setBubblePosition: (position: BubblePosition) => void;
    setSortMode: (sortMode: LaterReadSortMode) => void;
    requestPanelOpen: () => void;
    isSaved: (type: FeedType, id: string | number) => boolean;
};

const MAX_LATER_READ_ITEMS = 50;

export function getLaterReadKey(type: FeedType, id: string | number) {
    return `${type}:${String(id)}`;
}

function normalizeLaterReadItem(input: SaveLaterReadInput): LaterReadItem {
    const title = input.title.trim() || '未命名内容';
    const summary = input.summary.trim() || '暂无摘要';
    const authorName = input.authorName.trim() || '匿名用户';

    return {
        ...input,
        id: String(input.id),
        key: getLaterReadKey(input.type, input.id),
        title,
        summary,
        authorName,
        addedAt: input.addedAt ?? Date.now(),
    };
}

export const useLaterReadStore = create<LaterReadState>()(
    persist(
        (set, get) => ({
            items: [],
            bubblePosition: null,
            panelOpenRequest: 0,
            sortMode: 'added_desc',
            addItem: (item) => set((state) => {
                const nextItem = normalizeLaterReadItem(item);
                const rest = state.items.filter((current) => current.key !== nextItem.key);
                return {
                    items: [nextItem, ...rest].slice(0, MAX_LATER_READ_ITEMS),
                };
            }),
            removeItem: (key) => set((state) => ({
                items: state.items.filter((item) => item.key !== key),
            })),
            removeItems: (keys) => set((state) => {
                const targetKeys = new Set(keys);
                return { items: state.items.filter((item) => !targetKeys.has(item.key)) };
            }),
            clearItems: () => set({ items: [] }),
            setBubblePosition: (position) => set({ bubblePosition: position }),
            setSortMode: (sortMode) => set({ sortMode }),
            requestPanelOpen: () => set((state) => ({ panelOpenRequest: state.panelOpenRequest + 1 })),
            isSaved: (type, id) => get().items.some((item) => item.key === getLaterReadKey(type, id)),
        }),
        {
            name: 'later-read-store',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                items: state.items,
                bubblePosition: state.bubblePosition,
                sortMode: state.sortMode,
            }),
        },
    ),
);

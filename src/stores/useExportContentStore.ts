import { create } from 'zustand';
import type { FeedType } from '@/src/types/zhihu';

export interface ExportContent {
    id: string;
    type: FeedType;
    title: string;
    authorName: string;
    updatedTime: number;
    htmlContent: string;
}

interface ExportContentState {
    pending: ExportContent | null;
    setPending: (content: ExportContent) => void;
    clearPending: () => void;
}

export const useExportContentStore = create<ExportContentState>((set) => ({
    pending: null,
    setPending: (content) => set({ pending: content }),
    clearPending: () => set({ pending: null }),
}));

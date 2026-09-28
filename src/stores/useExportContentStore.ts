import { create } from 'zustand';

export interface ExportContent {
    id: string;
    type: 'answer' | 'article';
    title: string;
    authorName: string;
    questionId?: string;
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

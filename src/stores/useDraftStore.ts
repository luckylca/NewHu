import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type CommentDraft = {
    id: string;
    kind: 'comment';
    title: string;
    content: string;
    updatedAt: number;
    target: {
        contentType: string;
        contentId: string;
        replyCommentId: string;
        replyName: string;
        rootCommentId: string;
    };
};

type DraftState = {
    drafts: CommentDraft[];
    saveCommentDraft: (draft: Omit<CommentDraft, 'kind' | 'updatedAt'>) => void;
    removeDraft: (id: string) => void;
};

export function getCommentDraftId(contentType: string, contentId: string, replyCommentId: string) {
    return `comment:${contentType}:${contentId}:${replyCommentId || 'root'}`;
}

export const useDraftStore = create<DraftState>()(
    persist(
        (set) => ({
            drafts: [],
            saveCommentDraft: (draft) => set((state) => ({
                drafts: [
                    {
                        ...draft,
                        kind: 'comment',
                        updatedAt: Date.now(),
                    },
                    ...state.drafts.filter((item) => item.id !== draft.id),
                ],
            })),
            removeDraft: (id) => set((state) => ({
                drafts: state.drafts.filter((item) => item.id !== id),
            })),
        }),
        {
            name: 'draft-store',
            storage: createJSONStorage(() => AsyncStorage),
        },
    ),
);

import type { FeedType } from './zhihu';

export type LocalSearchSource =
    | 'read'
    | 'favorite'
    | 'offline'
    | 'later'
    | 'annotation'
    | 'knowledge'
    | 'draft';

export type LocalSearchResultKind =
    | 'local-content'
    | 'local-annotation'
    | 'local-knowledge'
    | 'local-comment'
    | 'local-draft';

export type LocalSearchResult = {
    key: string;
    kind: LocalSearchResultKind;
    contentId: string;
    contentType: FeedType;
    title: string;
    snippet: string;
    author: string;
    sources: LocalSearchSource[];
    updatedAt: number;
    score: number;
    annotationId?: string;
    knowledgeCardId?: string;
    draftId?: string;
};

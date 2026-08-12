import type { FeedDetail, FeedItem, FeedType } from '@/src/types/zhihu';
import type { CommentViewModel } from '@/src/components/CommentItem';

export type CacheState = 'transient' | 'pinned';
export type RootCommentMode = 'none' | 'limit' | 'all';
export type CacheJobStatus = 'pending' | 'running' | 'paused' | 'completed' | 'partial' | 'failed' | 'cancelled';
export type OutboxStatus = 'pending' | 'syncing' | 'synced' | 'failed' | 'needs_user_action';

export type DbContent = FeedDetail & {
    type: FeedType;
    hasBody: boolean;
    bodyCacheState?: CacheState;
};

export type DbComment = CommentViewModel & {
    contentId: string;
    contentType: FeedType;
    parentCommentId: string | null;
    rootCommentId: string | null;
    cacheState: CacheState;
    syncStatus: 'synced' | 'pending' | 'failed' | 'needs_user_action';
    localOnly: boolean;
};

export type DbPageState = {
    contentId: string;
    contentType: FeedType;
    parentCommentId: string | null;
    orderBy: string;
    nextOffset: string;
    isEnd: boolean;
    totalCount: number;
    loadedCount: number;
    updatedAt: number;
};

export type OfflinePin = {
    contentId: string;
    contentType: FeedType;
    rootCommentMode: RootCommentMode;
    rootCommentLimit: number;
    childCommentLimit: number;
    withImages: boolean;
    createdAt: number;
    updatedAt: number;
    status: 'active' | 'removing';
};

export type CacheJob = {
    id: string;
    contentId: string;
    contentType: FeedType;
    status: CacheJobStatus;
    rootTarget: number | null;
    rootCached: number;
    childCached: number;
    imageTotal: number;
    imageCached: number;
    createdAt: number;
    updatedAt: number;
    lastError: string | null;
};

export type ResourceRecord = {
    id: string;
    remoteUrl: string;
    localUri: string | null;
    mimeType: string | null;
    fileSize: number;
    status: 'pending' | 'ready' | 'failed';
    createdAt: number;
    lastAccessedAt: number;
};

export type PendingAction = {
    id: string;
    actionType: 'SET_CONTENT_VOTE' | 'SET_COMMENT_VOTE' | 'CREATE_COMMENT' | 'CREATE_REPLY';
    targetType: FeedType | 'comment';
    targetId: string;
    payload: Record<string, unknown>;
    status: OutboxStatus;
    retryCount: number;
    dependsOnActionId: string | null;
    createdAt: number;
    updatedAt: number;
    lastAttemptAt: number | null;
    lastError: string | null;
};

export type UserEvent = {
    contentId: string;
    contentType: FeedType;
    eventType: string;
    valueReal?: number;
    valueText?: string;
};

export type ContentRepository = {
    upsertContent: (content: FeedItem | FeedDetail, type: FeedType, options?: { cacheState?: CacheState; voted?: boolean }) => Promise<void>;
    getContent: (id: string, type: FeedType) => Promise<DbContent | null>;
    touchContent: (id: string, type: FeedType) => Promise<void>;
};

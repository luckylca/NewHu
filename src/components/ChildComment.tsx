import { getChildComments } from '@/src/api/ZhihuApi';
import { getCachedComments, getCommentById, getPageState, saveCommentPage } from '@/src/db/repositories/commentRepository';
import type { FeedType } from '@/src/types/zhihu';
import { BottomSheet, Divider } from '@/src/ui';
import { Text } from '@/src/ui/primitives';
import { useTheme } from '@/src/ui/theme';
import { useSettingStore } from '@/src/stores/useSettingStore';
import { useNetworkStore } from '@/src/stores/useNetworkStore';
import { readCommentAuthorFlag, type CommentAuthorIdentity } from '@/src/utils/commentAuthor';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, InteractionManager, useWindowDimensions, View } from 'react-native';
import { CommentItem } from './CommentItem';
import type { CommentViewModel } from './CommentItem';

type ChildCommentProps = {
    visible: boolean;
    id: string;
    contentId: string;
    contentType: FeedType;
    onClose: () => void;
    onReply?: (id: string, name?: string) => void;
    initialFocusId?: string;
    contentAuthor?: CommentAuthorIdentity;
};

function normalizeComment(item: any): CommentViewModel | null {
    if (!item?.id) return null;
    const apiAuthorFlag = readCommentAuthorFlag(item);
    return {
        id: String(item.id),
        content: item.content ?? '',
        createdTime: Number(item.created_time || 0),
        authorUrlToken: item.author?.url_token,
        authorName: item.author?.name || '匿名用户',
        authorAvatar: item.author?.avatar_url,
        voteCount: Number(item.like_count || 0),
        isVote: Boolean(item.liked),
        isAuthor: apiAuthorFlag === true,
        isAuthorFromApi: apiAuthorFlag !== undefined,
        isHot: Boolean(item.hot),
        isTop: Boolean(item.top),
        childCommentCount: Number(item.child_comment_count || 0),
        replyToAuthorName: item.reply_to_author?.name,
    };
}

function readOffset(next?: string) {
    if (!next) return '';
    try {
        return new URL(next).searchParams.get('offset') || '';
    } catch {
        return '';
    }
}

export default function ChildComment({ visible, id, contentId, contentType, onClose, onReply, initialFocusId, contentAuthor }: ChildCommentProps) {
    const theme = useTheme();
    const drawerAnimation = useSettingStore((state) => state.commentDrawerAnimation);
    const disableAnimations = useSettingStore((state) => state.disableAnimations);
    const networkStatus = useNetworkStore((state) => state.status);
    const { height: windowHeight } = useWindowDimensions();
    const [comments, setComments] = useState<CommentViewModel[]>([]);
    const [rootComment, setRootComment] = useState<CommentViewModel | null>(null);
    const [count, setCount] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    const listRef = useRef<FlatList<CommentViewModel>>(null);
    const offsetRef = useRef('');
    const inFlightRef = useRef(false);
    const hasMoreRef = useRef(true);
    const visibleRef = useRef(visible);
    visibleRef.current = visible;

    const resetComments = useCallback(() => {
        setComments([]);
        setRootComment(null);
        setCount(0);
        setRefreshing(false);
        offsetRef.current = '';
        hasMoreRef.current = true;
    }, []);

    const load = useCallback(async (refresh = false) => {
        if (!visible || !id || inFlightRef.current || (!refresh && !hasMoreRef.current)) return;
        inFlightRef.current = true;
        if (refresh) {
            setRefreshing(true);
            offsetRef.current = '';
            hasMoreRef.current = true;
        }

        try {
            if (networkStatus !== 'online') {
                const [cached, page, cachedRoot] = await Promise.all([
                    getCachedComments(contentId, contentType, id, 'ts'),
                    getPageState(contentId, contentType, id, 'ts'),
                    getCommentById(id),
                ]);
                if (!visibleRef.current) return;
                if (refresh) {
                    setRootComment(cachedRoot);
                    setCount(page?.totalCount || cached.length);
                }
                setComments(cached);
                offsetRef.current = page?.nextOffset || '';
                hasMoreRef.current = Boolean(page && !page.isEnd && page.nextOffset);
                return;
            }
            const response = await getChildComments(id, refresh ? '' : offsetRef.current, 'ts');
            if (!visibleRef.current) return;
            const next = readOffset(response?.paging?.next);
            offsetRef.current = next;
            hasMoreRef.current = Boolean(next) && response?.paging?.is_end !== true;

            if (refresh) {
                setRootComment(normalizeComment(response?.root));
                setCount(Number(response?.counts?.total_counts || 0));
            }

            const incoming = (response?.data ?? []).map(normalizeComment).filter(Boolean) as CommentViewModel[];
            setComments((current) => {
                if (refresh) return incoming;
                const merged = [...current, ...incoming];
                return merged.filter((item, index) => merged.findIndex((candidate) => candidate.id === item.id) === index);
            });
            void saveCommentPage({
                contentId,
                contentType,
                parentCommentId: id,
                orderBy: 'ts',
                comments: incoming,
                nextOffset: next,
                isEnd: !next || response?.paging?.is_end === true,
                totalCount: Number(response?.counts?.total_counts || 0),
                rootComment: normalizeComment(response?.root),
            }).catch((error) => console.warn('回复写入本地缓存失败', error));
        } catch (error) {
            console.error('加载回复失败:', error);
        } finally {
            inFlightRef.current = false;
            setRefreshing(false);
        }
    }, [contentId, contentType, id, networkStatus, visible]);

    useEffect(() => {
        let interaction: ReturnType<typeof InteractionManager.runAfterInteractions> | undefined;

        if (visible) {
            setRefreshing(true);
            interaction = InteractionManager.runAfterInteractions(() => load(true));
        }

        return () => {
            interaction?.cancel();
        };
    }, [load, visible]);

    useEffect(() => {
        if (!visible || !initialFocusId || initialFocusId === rootComment?.id) return;
        const index = comments.findIndex((item) => item.id === initialFocusId);
        if (index >= 0) {
            const timer = setTimeout(() => {
                listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.45 });
            }, 180);
            return () => clearTimeout(timer);
        }
        if (comments.length > 0 && hasMoreRef.current) {
            const timer = setTimeout(() => load(false), 120);
            return () => clearTimeout(timer);
        }
    }, [comments, initialFocusId, load, rootComment?.id, visible]);

    const renderItem = useCallback(({ item }: { item: CommentViewModel }) => (
        <CommentItem
            item={item}
            contentAuthor={contentAuthor}
            onReply={(commentId) => onReply?.(commentId, item.authorName)}
            onNavigateAway={onClose}
        />
    ), [contentAuthor, onClose, onReply]);

    return (
        <BottomSheet
            visible={visible}
            onClose={onClose}
            onDismissed={resetComments}
            animationsEnabled={!disableAnimations && drawerAnimation}
            title={count > 0 ? `${count} 条回复` : '回复'}
        >
            <FlatList
                ref={listRef}
                style={{ height: Math.max(260, windowHeight - 150), maxHeight: windowHeight - 120 }}
                data={comments}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                refreshing={refreshing}
                onRefresh={() => load(true)}
                onEndReached={() => load(false)}
                onEndReachedThreshold={0.35}
                contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm, paddingBottom: theme.spacing.xl, flexGrow: 1 }}
                initialNumToRender={5}
                maxToRenderPerBatch={5}
                updateCellsBatchingPeriod={32}
                windowSize={5}
                removeClippedSubviews
                showsVerticalScrollIndicator={false}
                onScrollToIndexFailed={({ index }) => {
                    listRef.current?.scrollToOffset({ offset: index * 180, animated: true });
                }}
                ListHeaderComponent={rootComment ? (
                    <View>
                        <CommentItem
                            item={rootComment}
                            contentAuthor={contentAuthor}
                            onReply={(commentId) => onReply?.(commentId, rootComment.authorName)}
                            onNavigateAway={onClose}
                        />
                        <Divider style={{ marginVertical: theme.spacing.sm }} />
                    </View>
                ) : null}
                ListEmptyComponent={!refreshing ? (
                    <View style={{ padding: theme.spacing.xl, alignItems: 'center' }}>
                        <Text type="body1" color={theme.colors.onSurfaceVariantSummary}>暂无回复</Text>
                    </View>
                ) : null}
            />
        </BottomSheet>
    );
}

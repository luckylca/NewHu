import { getChildComments } from '@/src/api/ZhihuApi';
import { BottomSheet, Divider } from '@/src/ui';
import { Text } from '@/src/ui/primitives';
import { useTheme } from '@/src/ui/theme';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, View } from 'react-native';
import { CommentItem } from './CommentItem';
import type { CommentViewModel } from './CommentItem';

type ChildCommentProps = {
    visible: boolean;
    id: string;
    onClose: () => void;
    onReply?: (id: string, name?: string) => void;
};

function normalizeComment(item: any): CommentViewModel | null {
    if (!item?.id) return null;
    return {
        id: String(item.id),
        content: item.content ?? '',
        createdTime: Number(item.created_time || 0),
        authorUrlToken: item.author?.url_token,
        authorName: item.author?.name || '匿名用户',
        authorAvatar: item.author?.avatar_url,
        voteCount: Number(item.like_count || 0),
        isVote: Boolean(item.liked),
        isAuthor: Boolean(item.is_author),
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

export default function ChildComment({ visible, id, onClose, onReply }: ChildCommentProps) {
    const theme = useTheme();
    const [comments, setComments] = useState<CommentViewModel[]>([]);
    const [rootComment, setRootComment] = useState<CommentViewModel | null>(null);
    const [count, setCount] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    const offsetRef = useRef('');
    const inFlightRef = useRef(false);
    const hasMoreRef = useRef(true);

    const load = useCallback(async (refresh = false) => {
        if (!visible || !id || inFlightRef.current || (!refresh && !hasMoreRef.current)) return;
        inFlightRef.current = true;
        if (refresh) {
            setRefreshing(true);
            offsetRef.current = '';
            hasMoreRef.current = true;
        }

        try {
            const response = await getChildComments(id, refresh ? '' : offsetRef.current, 'ts');
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
        } catch (error) {
            console.error('加载回复失败:', error);
        } finally {
            inFlightRef.current = false;
            setRefreshing(false);
        }
    }, [id, visible]);

    useEffect(() => {
        if (visible) load(true);
        else {
            setComments([]);
            setRootComment(null);
            setCount(0);
            offsetRef.current = '';
            hasMoreRef.current = true;
        }
    }, [load, visible]);

    const renderItem = useCallback(({ item }: { item: CommentViewModel }) => (
        <CommentItem
            item={item}
            onOpenReplies={(commentId) => onReply?.(commentId, item.authorName)}
            onReply={(commentId) => onReply?.(commentId, item.authorName)}
            onNavigateAway={onClose}
        />
    ), [onClose, onReply]);

    return (
        <BottomSheet visible={visible} onClose={onClose} title={count > 0 ? `${count} 条回复` : '回复'}>
            <FlatList
                data={comments}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                refreshing={refreshing}
                onRefresh={() => load(true)}
                onEndReached={() => load(false)}
                onEndReachedThreshold={0.35}
                contentContainerStyle={{ paddingBottom: theme.spacing.xl, flexGrow: 1 }}
                initialNumToRender={5}
                maxToRenderPerBatch={5}
                updateCellsBatchingPeriod={32}
                windowSize={5}
                removeClippedSubviews
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={rootComment ? (
                    <View>
                        <CommentItem
                            item={rootComment}
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

import { getRootComments } from '@/src/api/ZhihuApi';
import ChildComment from '@/src/components/ChildComment';
import CommentEdit from '@/src/components/CommentEdit';
import { CommentItem } from '@/src/components/CommentItem';
import type { CommentViewModel } from '@/src/components/CommentItem';
import { Icon, Menu, TopAppBar } from '@/src/ui';
import { Text } from '@/src/ui/primitives';
import { useTheme } from '@/src/ui/theme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, View } from 'react-native';

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
    };
}

function nextOffset(next?: string) {
    if (!next) return '';
    try {
        return new URL(next).searchParams.get('offset') || '';
    } catch {
        return '';
    }
}

export default function CommentScreen() {
    const params = useLocalSearchParams<{ id?: string; type?: string }>();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const type = Array.isArray(params.type) ? params.type[0] : params.type;
    const normalizedType = type === 'answer' ? 'answers' : type === 'article' ? 'articles' : type;
    const theme = useTheme();
    const router = useRouter();

    const [comments, setComments] = useState<CommentViewModel[]>([]);
    const [commentCount, setCommentCount] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    const [sort, setSort] = useState('score');
    const [menuVisible, setMenuVisible] = useState(false);
    const [menuAnchor, setMenuAnchor] = useState({ x: 0, y: 0, width: 1, height: 1 });
    const [childId, setChildId] = useState('');
    const [reply, setReply] = useState<{ id: string; name: string } | null>(null);

    const menuButtonRef = useRef<View>(null);
    const offsetRef = useRef('');
    const inFlightRef = useRef(false);
    const hasMoreRef = useRef(true);

    const loadComments = useCallback(async (refresh = false) => {
        if (!id || !normalizedType || inFlightRef.current || (!refresh && !hasMoreRef.current)) return;
        inFlightRef.current = true;
        if (refresh) {
            setRefreshing(true);
            offsetRef.current = '';
            hasMoreRef.current = true;
        }

        try {
            const response = await getRootComments(id, normalizedType, refresh ? '' : offsetRef.current, sort);
            const next = nextOffset(response?.paging?.next);
            offsetRef.current = next;
            hasMoreRef.current = Boolean(next) && response?.paging?.is_end !== true;
            setCommentCount(Number(response?.counts?.total_counts || 0));
            const incoming = (response?.data ?? []).map(normalizeComment).filter(Boolean) as CommentViewModel[];
            setComments((current) => {
                if (refresh) return incoming;
                const merged = [...current, ...incoming];
                return merged.filter((item, index) => merged.findIndex((candidate) => candidate.id === item.id) === index);
            });
        } catch (error) {
            console.error('加载评论失败:', error);
        } finally {
            inFlightRef.current = false;
            setRefreshing(false);
        }
    }, [id, normalizedType, sort]);

    useEffect(() => {
        setComments([]);
        loadComments(true);
    }, [loadComments]);

    const renderComment = useCallback(({ item }: { item: CommentViewModel }) => (
        <CommentItem
            item={item}
            onOpenReplies={item.childCommentCount > 0 ? setChildId : undefined}
            onReply={(commentId) => setReply({ id: commentId, name: item.authorName || '' })}
        />
    ), []);

    const openHeaderMenu = useCallback(() => {
        menuButtonRef.current?.measureInWindow((x, y, width, height) => {
            setMenuAnchor({ x, y, width, height });
            setMenuVisible(true);
        });
    }, []);

    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
            <TopAppBar
                title={`评论 (${commentCount})`}
                back={() => router.back()}
                actions={
                    <View ref={menuButtonRef} collapsable={false}>
                        <Pressable onPress={openHeaderMenu} hitSlop={8} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 }}>
                            <Icon name="dots-vertical" size={24} color={theme.colors.onBackground} />
                        </Pressable>
                    </View>
                }
            />

            <Menu
                visible={menuVisible}
                onClose={() => setMenuVisible(false)}
                anchor={menuAnchor}
                selectedIndex={sort === 'score' ? 0 : 1}
                items={[
                    { label: '按热度排序', onPress: () => setSort('score') },
                    { label: '按时间排序', onPress: () => setSort('ts') },
                    { label: '发表评论', onPress: () => setReply({ id: '', name: '' }) },
                ]}
            />

            <FlatList
                data={comments}
                keyExtractor={(item) => item.id}
                renderItem={renderComment}
                contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm, paddingBottom: theme.spacing.xl, flexGrow: 1 }}
                refreshing={refreshing}
                onRefresh={() => loadComments(true)}
                onEndReached={() => loadComments(false)}
                onEndReachedThreshold={0.35}
                initialNumToRender={5}
                maxToRenderPerBatch={5}
                updateCellsBatchingPeriod={32}
                windowSize={5}
                removeClippedSubviews
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={!refreshing ? (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xl }}>
                        <Text type="body1" color={theme.colors.onSurfaceVariantSummary}>
                            {commentCount > 0 ? '评论暂时无法加载' : '还没有评论'}
                        </Text>
                    </View>
                ) : null}
            />

            <ChildComment
                visible={Boolean(childId)}
                id={childId}
                onClose={() => setChildId('')}
                onReply={(commentId, name) => {
                    setChildId('');
                    setTimeout(() => {
                        setReply({ id: commentId, name: name || '' });
                    }, 240);
                }}
            />
            <Modal
                visible={Boolean(reply)}
                animationType="slide"
                statusBarTranslucent={false}
                onRequestClose={() => setReply(null)}
            >
                <CommentEdit
                    visible={Boolean(reply)}
                    name={reply?.name || ''}
                    contentType={type || ''}
                    contentId={id || ''}
                    replyCommentId={reply?.id || ''}
                    onClose={() => setReply(null)}
                    onSubmitted={() => loadComments(true)}
                />
            </Modal>
        </View>
    );
}

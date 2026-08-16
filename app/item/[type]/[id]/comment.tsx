import { getRootComments } from '@/src/api/ZhihuApi';
import ChildComment from '@/src/components/ChildComment';
import CommentEdit from '@/src/components/CommentEdit';
import { CommentItem } from '@/src/components/CommentItem';
import type { CommentViewModel } from '@/src/components/CommentItem';
import { useDraftStore } from '@/src/stores/useDraftStore';
import { useNetworkStore } from '@/src/stores/useNetworkStore';
import { getCachedComments, getPageState, saveCommentPage } from '@/src/db/repositories/commentRepository';
import { getContent } from '@/src/db/repositories/contentRepository';
import { Icon, Menu, TopAppBar } from '@/src/ui';
import { Text } from '@/src/ui/primitives';
import { useTheme } from '@/src/ui/theme';
import { readCommentAuthorFlag, type CommentAuthorIdentity } from '@/src/utils/commentAuthor';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Keyboard, Modal, Pressable, View } from 'react-native';

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
    const params = useLocalSearchParams<{ id?: string; type?: string; draftId?: string; authorName?: string; authorUrlToken?: string }>();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const type = Array.isArray(params.type) ? params.type[0] : params.type;
    const draftId = Array.isArray(params.draftId) ? params.draftId[0] : params.draftId;
    const routeAuthorName = Array.isArray(params.authorName) ? params.authorName[0] : params.authorName;
    const routeAuthorUrlToken = Array.isArray(params.authorUrlToken) ? params.authorUrlToken[0] : params.authorUrlToken;
    const contentType = type === 'answer' ? 'answer' : 'article';
    const normalizedType = contentType === 'answer' ? 'answers' : 'articles';
    const networkStatus = useNetworkStore((state) => state.status);
    const theme = useTheme();
    const router = useRouter();
    const [contentAuthor, setContentAuthor] = useState<CommentAuthorIdentity>(() => ({
        name: routeAuthorName,
        urlToken: routeAuthorUrlToken,
    }));

    const [comments, setComments] = useState<CommentViewModel[]>([]);
    const [commentCount, setCommentCount] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    const [sort, setSort] = useState('score');
    const [menuVisible, setMenuVisible] = useState(false);
    const [menuAnchor, setMenuAnchor] = useState({ x: 0, y: 0, width: 1, height: 1 });
    const [childId, setChildId] = useState('');
    const [reply, setReply] = useState<{ id: string; name: string; rootCommentId: string; fromDraft?: boolean } | null>(null);
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const [pendingFocus, setPendingFocus] = useState<{ rootCommentId: string; commentId: string } | null>(null);
    const [childFocusId, setChildFocusId] = useState('');

    const menuButtonRef = useRef<View>(null);
    const listRef = useRef<FlatList<CommentViewModel>>(null);
    const offsetRef = useRef('');
    const inFlightRef = useRef(false);
    const hasMoreRef = useRef(true);
    const openedDraftRef = useRef('');

    useEffect(() => {
        let active = true;
        setContentAuthor({ name: routeAuthorName, urlToken: routeAuthorUrlToken });
        if (!id) return () => { active = false; };

        void getContent(id, contentType).then((cached) => {
            if (!active || !cached) return;
            setContentAuthor((current) => ({
                name: current.name || cached.authorName,
                urlToken: current.urlToken || cached.authorUrlToken,
            }));
        }).catch(() => {
            // The API author flag still works when no local content record exists.
        });

        return () => { active = false; };
    }, [contentType, id, routeAuthorName, routeAuthorUrlToken]);

    useEffect(() => {
        const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
        const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
        return () => {
            show.remove();
            hide.remove();
        };
    }, []);

    useEffect(() => {
        if (!draftId || openedDraftRef.current === draftId) return;
        const draft = useDraftStore.getState().drafts.find((item) => item.id === draftId);
        if (!draft) return;
        openedDraftRef.current = draftId;
        setReply({
            id: draft.target.replyCommentId,
            name: draft.target.replyName,
            rootCommentId: draft.target.rootCommentId || draft.target.replyCommentId,
            fromDraft: true,
        });
    }, [draftId]);

    const loadComments = useCallback(async (refresh = false) => {
        if (!id || !normalizedType || inFlightRef.current || (!refresh && !hasMoreRef.current)) return;
        inFlightRef.current = true;
        if (refresh) {
            setRefreshing(true);
            offsetRef.current = '';
            hasMoreRef.current = true;
        }

        try {
            if (networkStatus !== 'online') {
                // Offline cache fetches root comments by score. If the user
                // changed the online sort to time before losing connectivity,
                // don't show an empty list just because that second index was
                // never cached.
                let cached = await getCachedComments(id, contentType, null, sort);
                let page = await getPageState(id, contentType, null, sort);
                if (!cached.length && sort !== 'score') {
                    cached = await getCachedComments(id, contentType, null, 'score');
                    page = await getPageState(id, contentType, null, 'score');
                }
                if (!cached.length && sort === 'score') {
                    cached = await getCachedComments(id, contentType, null, 'ts');
                    page = await getPageState(id, contentType, null, 'ts');
                }
                setComments(cached);
                setCommentCount(page?.totalCount || cached.length);
                offsetRef.current = page?.nextOffset || '';
                hasMoreRef.current = Boolean(page && !page.isEnd && page.nextOffset);
                return;
            }
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
            void saveCommentPage({
                contentId: id,
                contentType,
                parentCommentId: null,
                orderBy: sort,
                comments: incoming,
                nextOffset: next,
                isEnd: !next || response?.paging?.is_end === true,
                totalCount: Number(response?.counts?.total_counts || 0),
            }).catch((error) => console.warn('评论写入本地缓存失败', error));
        } catch (error) {
            console.error('加载评论失败:', error);
        } finally {
            inFlightRef.current = false;
            setRefreshing(false);
        }
    }, [contentType, id, networkStatus, normalizedType, sort]);

    useEffect(() => {
        setComments([]);
        loadComments(true);
    }, [loadComments]);

    const renderComment = useCallback(({ item }: { item: CommentViewModel }) => (
        <CommentItem
            item={item}
            contentAuthor={contentAuthor}
            onOpenReplies={item.childCommentCount > 0 ? setChildId : undefined}
            onReply={(commentId) => setReply({ id: commentId, name: item.authorName || '', rootCommentId: item.id })}
        />
    ), [contentAuthor]);

    const closeReply = useCallback(() => {
        if (reply?.fromDraft && reply.rootCommentId) {
            setPendingFocus({ rootCommentId: reply.rootCommentId, commentId: reply.id });
        }
        setReply(null);
    }, [reply]);

    useEffect(() => {
        if (!pendingFocus) return;
        const index = comments.findIndex((item) => item.id === pendingFocus.rootCommentId);
        if (index >= 0) {
            listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.45 });
            if (pendingFocus.commentId && pendingFocus.commentId !== pendingFocus.rootCommentId) {
                const timer = setTimeout(() => {
                    setChildFocusId(pendingFocus.commentId);
                    setChildId(pendingFocus.rootCommentId);
                }, 280);
                setPendingFocus(null);
                return () => clearTimeout(timer);
            }
            setPendingFocus(null);
            return;
        }
        if (comments.length > 0 && hasMoreRef.current) {
            const timer = setTimeout(() => loadComments(false), 120);
            return () => clearTimeout(timer);
        }
    }, [comments, loadComments, pendingFocus]);

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
                    { label: '发表评论', onPress: () => setReply({ id: '', name: '', rootCommentId: '' }) },
                ]}
            />

            <FlatList
                ref={listRef}
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
                onScrollToIndexFailed={({ index }) => {
                    listRef.current?.scrollToOffset({ offset: index * 220, animated: true });
                }}
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
                contentId={id || ''}
                contentType={contentType}
                contentAuthor={contentAuthor}
                initialFocusId={childFocusId}
                onClose={() => {
                    setChildId('');
                    setChildFocusId('');
                }}
                onReply={(commentId, name) => {
                    const rootCommentId = childId;
                    setChildId('');
                    setTimeout(() => {
                        setReply({ id: commentId, name: name || '', rootCommentId });
                    }, 240);
                }}
            />
            <Modal
                visible={Boolean(reply)}
                animationType="slide"
                statusBarTranslucent={false}
                onRequestClose={() => {
                    if (keyboardVisible) {
                        Keyboard.dismiss();
                    } else {
                        closeReply();
                    }
                }}
            >
                <CommentEdit
                    visible={Boolean(reply)}
                    name={reply?.name || ''}
                    contentType={type || ''}
                    contentId={id || ''}
                    replyCommentId={reply?.id || ''}
                    rootCommentId={reply?.rootCommentId || ''}
                    onClose={closeReply}
                    onSubmitted={() => loadComments(true)}
                />
            </Modal>
        </View>
    );
}

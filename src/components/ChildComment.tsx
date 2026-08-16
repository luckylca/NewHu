import { getChildComments } from '@/src/api/ZhihuApi';
import { getCachedComments, getCommentById, getPageState, saveCommentPage } from '@/src/db/repositories/commentRepository';
import type { FeedType } from '@/src/types/zhihu';
import { Divider } from '@/src/ui';
import { Text } from '@/src/ui/primitives';
import { useTheme } from '@/src/ui/theme';
import { useSettingStore } from '@/src/stores/useSettingStore';
import { useNetworkStore } from '@/src/stores/useNetworkStore';
import { readCommentAuthorFlag, type CommentAuthorIdentity } from '@/src/utils/commentAuthor';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, FlatList, InteractionManager, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
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

// Miuix BottomSheet: folmeSpring(0.9, 0.38)，换算后约为 stiffness 273 / damping 30。
const DRAWER_SPRING = {
    stiffness: 273,
    damping: 30,
    mass: 1,
    overshootClamping: true,
    useNativeDriver: true,
} as const;

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
    const [rendered, setRendered] = useState(false);
    const animation = useRef(new Animated.Value(0)).current;
    const listRef = useRef<FlatList<CommentViewModel>>(null);
    const offsetRef = useRef('');
    const inFlightRef = useRef(false);
    const hasMoreRef = useRef(true);
    const renderedRef = useRef(false);
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
        let frame: number | undefined;
        let interaction: ReturnType<typeof InteractionManager.runAfterInteractions> | undefined;
        animation.stopAnimation();

        if (visible) {
            renderedRef.current = true;
            setRendered(true);
            setRefreshing(true);

            const startLoading = () => {
                interaction = InteractionManager.runAfterInteractions(() => load(true));
            };

            if (disableAnimations || !drawerAnimation) {
                animation.setValue(1);
                startLoading();
            } else {
                frame = requestAnimationFrame(() => {
                    Animated.spring(animation, {
                        ...DRAWER_SPRING,
                        toValue: 1,
                    }).start();
                    startLoading();
                });
            }
        } else if (renderedRef.current) {
            const finishClosing = () => {
                renderedRef.current = false;
                setRendered(false);
                resetComments();
            };

            if (disableAnimations || !drawerAnimation) {
                animation.setValue(0);
                finishClosing();
            } else {
                Animated.spring(animation, {
                    ...DRAWER_SPRING,
                    toValue: 0,
                }).start(({ finished }) => {
                    if (finished) finishClosing();
                });
            }
        }

        return () => {
            if (frame != null) cancelAnimationFrame(frame);
            interaction?.cancel();
        };
    }, [animation, disableAnimations, drawerAnimation, load, resetComments, visible]);

    useEffect(() => {
        if (!visible) return;
        const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
            onClose();
            return true;
        });
        return () => subscription.remove();
    }, [onClose, visible]);

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

    if (!rendered) return null;

    const pageBackground = theme.dark ? '#181818' : '#F7F7F7';

    return (
        <View style={[StyleSheet.absoluteFill, styles.layer]}>
            <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: animation }]}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
            </Animated.View>
            <Animated.View
                style={[
                    styles.sheet,
                    {
                        backgroundColor: pageBackground,
                        transform: [{
                            translateY: animation.interpolate({
                                inputRange: [0, 1],
                                outputRange: [windowHeight, 0],
                            }),
                        }],
                    },
                ]}
            >
                <View style={[styles.header, { borderBottomColor: theme.colors.dividerLine }]}>
                    <View style={[styles.handle, { backgroundColor: theme.colors.onSurfaceVariantSummary }]} />
                    <Text type="headline2" weight="bold">{count > 0 ? `${count} 条回复` : '回复'}</Text>
                </View>
            <FlatList
                ref={listRef}
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
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    layer: {
        zIndex: 1000,
    },
    backdrop: {
        backgroundColor: 'rgba(0,0,0,0.48)',
    },
    sheet: {
        flex: 1,
        marginTop: 92,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
    },
    header: {
        height: 58,
        alignItems: 'center',
        justifyContent: 'center',
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    handle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        marginBottom: 7,
        opacity: 0.35,
    },
});

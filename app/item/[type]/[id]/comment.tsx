//app/item/[id]/comment.tsx
import { cancelLikeComment, getRootComments, likeComment } from "@/src/api/ZhihuApi";
import CommentText from "@/src/components/CommentText";
import { EMOJI_URL_MAP } from "@/src/constants/emoji";
import { useSettingStore } from "@/src/stores/useSettingStore";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { memo, useCallback, useEffect } from "react";
import { Animated, FlatList, Pressable, View } from "react-native";
import { Appbar, Avatar, IconButton, Modal, Portal, Text, useTheme } from "react-native-paper";
import ChildComment from "../../../../src/components/ChildComment";
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const RenderCommentItem = memo(({
    item,
    theme,
    style,
    handleChildComment,
    id,
    disableAnimations,
}: {
    item: any;
    theme: any;
    style?: any;
    handleChildComment: (id: string) => void;
    id: string;
    disableAnimations: boolean;
}) => {
    const scale = React.useRef(new Animated.Value(1)).current;
    const [isLiked, setIsLiked] = React.useState(item.isVote);
    const handlePressIn = useCallback(() => {
        if (disableAnimations) return;
        Animated.spring(scale, {
            toValue: 0.95,
            useNativeDriver: true,
            speed: 20,
            bounciness: 10,
        }).start();
    }, [disableAnimations, scale]);

    const handlePressOut = useCallback(() => {
        if (disableAnimations) return;
        Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            speed: 20,
            bounciness: 10,
        }).start();
    }, [disableAnimations, scale]);
    
    const formatTime = (ts: number) => {
        const d = new Date(ts * 1000);
        return d.toLocaleString();
    };

    useEffect(() => {
        setIsLiked(item.isVote);
    }, [item.isVote]);
    
    useEffect(() => {
        if (isLiked) {
            likeComment(item.id).catch(() => {
                setIsLiked(false);
            });
        }else {
            cancelLikeComment(item.id).catch(() => {
                setIsLiked(true);
            });
        }
    }, [isLiked, item.id]);

    const Tag = ({
        label,
        bg,
        fg,
    }: {
        label: string;
        bg: string;
        fg: string;
    }) => (
        <View
            style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 999,
                alignSelf: "center",
                marginLeft: 8,
                backgroundColor: bg,
            }}
        >
            <Text variant="labelSmall" style={{ color: fg }}>
                {label}
            </Text>
        </View>
    );

    return (
        <AnimatedPressable
            onPress={() => { console.log("点击了评论:", item.id); handleChildComment(item.id); }}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            android_ripple={{ color: 'rgba(0,0,0,0.15)', foreground: true }}
            style={[{
                // 这里我暂时把 WindowWidth 注释掉了，如果你有全局变量请保留你的写法
                // width: WindowWidth * 0.9,
                // marginLeft: WindowWidth * 0.05,
                // marginRight: WindowWidth * 0.05,
                marginBottom: 10,
                borderRadius: 16,
                overflow: 'hidden',
                backgroundColor: '#F3EDF7'
            },
            { transform: [{ scale }] },
            style]}
        >
            <View style={{ paddingHorizontal: 12, paddingVertical: 12 }}>
                {/* Header */}
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Avatar.Image
                        size={36}
                        source={{ uri: item.authorAvatar }}
                        style={{
                            backgroundColor: theme.colors.surfaceVariant,
                            marginRight: 12,
                        }}
                    />

                    <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                            variant="titleSmall"
                            numberOfLines={1}
                            style={{ color: theme.colors.onSurface }}
                        >
                            {item.authorName}
                            {/* 如果存在 replyToAuthorName，则拼接 " 回复 XXX" */}
                            {item.replyToAuthorName && (
                                <Text style={{ color: theme.colors.onSurfaceVariant, fontWeight: 'normal' }}>
                                    {' 回复 '}
                                    <Text style={{ color: theme.colors.onSurface, fontWeight: 'bold' }}>
                                        {item.replyToAuthorName}
                                    </Text>
                                </Text>
                            )}
                        </Text>

                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                marginTop: 2,
                                flexWrap: "wrap",
                            }}
                        >
                            <Text
                                variant="labelSmall"
                                style={{ color: theme.colors.onSurfaceVariant }}
                            >
                                {formatTime(item.createdTime)}
                            </Text>

                            {item.isTop ? (
                                <Tag
                                    label="置顶"
                                    bg={theme.colors.tertiaryContainer}
                                    fg={theme.colors.onTertiaryContainer}
                                />
                            ) : null}

                            {item.isHot ? (
                                <Tag
                                    label="热"
                                    bg={theme.colors.secondaryContainer}
                                    fg={theme.colors.onSecondaryContainer}
                                />
                            ) : null}
                        </View>
                    </View>

                    {/* Actions */}
                    <View style={{ flexDirection: "row", alignItems: "center", marginLeft: 8 }}>
                        <IconButton
                            icon={item.isVote ? "thumb-up" : "thumb-up-outline"}
                            size={18}
                            onPress={() => { setIsLiked((prev: any) => !prev); item.isVote = !item.isVote; item.voteCount += item.isVote ? 1 : -1; }}
                            iconColor={
                                item.isVote ? theme.colors.primary : theme.colors.onSurfaceVariant
                            }
                            style={{ margin: 0 }}
                        />
                        <Text
                            variant="labelSmall"
                            style={{
                                color: theme.colors.onSurfaceVariant,
                                minWidth: 20,
                                textAlign: "right",
                            }}
                        >
                            {item.voteCount}
                        </Text>
                    </View>
                </View>

                {/* Body */}
                <View style={{ marginTop: 10 }}>
                    {/* 请确保 CommentText 和 EMOJI_URL_MAP 在你的文件里可以正常访问 */}
                    <CommentText content={item.content} emojiMap={EMOJI_URL_MAP} />
                </View>

                {/* Footer */}
                {item.childCommentCount > 0 ? (
                    <View style={{ marginTop: 10, flexDirection: "row", alignItems: "center" }}>
                        <Text variant="labelMedium" style={{ color: theme.colors.primary }}>
                            共 {item.childCommentCount} 条回复
                        </Text>
                    </View>
                ) : null}
            </View>
        </AnimatedPressable>
    );
}, (prevProps, nextProps) => {
    // 增加对 replyToAuthorName 的比较，防止热更新或数据变动时不渲染
    return prevProps.item.id === nextProps.item.id &&
        prevProps.item.replyToAuthorName === nextProps.item.replyToAuthorName &&
        prevProps.disableAnimations === nextProps.disableAnimations;
});

RenderCommentItem.displayName = "RenderCommentItem";


export default function Comment() {
    const p = useLocalSearchParams<{
        id?: string;
        type?: string;
        needToGet?: string;
    }>();

    const id = Array.isArray(p.id) ? p.id[0] : p.id;
    const type = Array.isArray(p.type) ? p.type[0] : p.type;
    const needToGet = Array.isArray(p.needToGet) ? p.needToGet[0] : p.needToGet;

    const [childVisible, setChildVisible] = React.useState(false);
    const [childId, setChildId] = React.useState("");

    const offsetRef = React.useRef("");
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [isLoadingMore, setIsLoadingMore] = React.useState(false);

    const theme = useTheme();
    const router = useRouter();
    const disableAnimations = useSettingStore((state) => state.disableAnimations);
    const [sort, setSort] = React.useState("score");
    const [isClosed, setIsClosed] = React.useState(false);
    const [comments, setComments] = React.useState<any[]>([]);
    const [commentCount, setCommentCount] = React.useState(0);
    const normalizedType = type === 'answer' ? 'answers' : type === 'article' ? 'articles' : type;


    useEffect(() => {
        if (!id || !normalizedType) {
            return;
        }
        loadComments();
    }, [id, normalizedType]);

    const rootCommentsClear = (item: any) => {
        return {
            id: item.id,
            content: item.content,
            createdTime: item.created_time,
            authorUrlToken: item.author.url_token,
            authorName: item.author.name,
            authorAvatar: item.author.avatar_url,
            voteCount: item.like_count,
            isVote: item.liked,
            isHot: item.hot,
            isTop: item.top,
            childCommentCount: item.child_comment_count,
        }
    }

    const loadComments = async (isRefresh: boolean = false) => {
        if (isRefresh) {
            setIsRefreshing(true);
            offsetRef.current = ""; // 下拉刷新重置 token
        } else {
            setIsLoadingMore(true);
        }

        try {
            console.log(id, normalizedType)
            const data = await getRootComments(id, normalizedType, offsetRef.current, sort);
            setCommentCount(data.counts.total_counts);
            const urlToken = data.paging.next
            const token = urlToken ? new URL(urlToken).searchParams.get('offset') : null;
            offsetRef.current = token || "";
            const clearedComments = data.data.map(rootCommentsClear);

            if (isRefresh) {
                setComments(clearedComments);
            } else {
                const mergedData = [...comments, ...clearedComments];
                const uniqueData = mergedData.filter((v, i, a) =>
                    a.findIndex(t => t.id === v.id) === i
                );
                setComments(uniqueData);
            }
        } catch (e) {
            console.error("加载评论失败:", e);
        } finally {
            if (isRefresh) {
                setIsRefreshing(false);
            } else {
                setIsLoadingMore(false);
            }
            if (commentCount > 0 && comments.length === 0) {
                console.log("评论加载完成:", comments.length, commentCount);
                setIsClosed(true);
            }
        }
    };

    const handleChildComment = useCallback((id: string) => {
        setChildId(id);
        setChildVisible(true);
    }, []);

    const renderCommentItem = useCallback(({ item }: { item: any }) => (
        <RenderCommentItem
            item={item}
            theme={theme}
            handleChildComment={handleChildComment}
            id={item.id}
            disableAnimations={disableAnimations}
        />
    ), [disableAnimations, handleChildComment, theme]);

    return (
        <View style={{ flex: 1 }}>
            <Portal>
                <Modal visible={childVisible} onDismiss={() => setChildVisible(false)} contentContainerStyle={{ flex: 1 }}>
                    <ChildComment visible={childVisible} id={childId} onClose={() => setChildVisible(false)}/>
                </Modal>
            </Portal>
            <Appbar.Header>
                <Appbar.BackAction onPress={() => { router.back() }} />
                <Appbar.Content title={`评论 (${commentCount})`} />
            </Appbar.Header>
            <FlatList
                data={comments}
                onEndReached={() => loadComments(false)}
                onEndReachedThreshold={0.8}
                onRefresh={() => loadComments(true)}
                refreshing={isRefreshing}
                scrollEnabled={true}
                keyExtractor={(item) => item.id}
                renderItem={renderCommentItem}
                initialNumToRender={6}
                maxToRenderPerBatch={8}
                windowSize={7}
                updateCellsBatchingPeriod={16}
                removeClippedSubviews={true}
                ListEmptyComponent={() => {
                    if (isClosed) {
                        return (
                            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                                <Text variant="titleMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                                    评论区已关闭
                                </Text>
                            </View>
                        )
                    }
                }}
            />
        </View>
    )
}
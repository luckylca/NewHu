//app/item/[id]/comment.tsx
import { cancelLikeComment, getRootComments, likeComment } from "@/src/api/ZhihuApi";
import CommentEdit from "@/src/components/CommentEdit";
import CommentText from "@/src/components/CommentText";
import { EMOJI_URL_MAP } from "@/src/constants/emoji";
import { useSettingStore } from "@/src/stores/useSettingStore";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { memo, useCallback, useEffect, useRef } from "react";
import { short } from "@/src/utils/haptics";
import { Animated, FlatList, Pressable, View } from "react-native";
import { Swipeable } from 'react-native-gesture-handler';
import { Appbar, Avatar, Icon, IconButton, Menu, Modal, Portal, Text, useTheme } from "react-native-paper";
import ChildComment from "../../../../src/components/ChildComment";


const CommentEditMemo = React.memo(({ visible, name, contentType, contentId, replyCommentId, onClose }: { visible: boolean; name: string; contentType: string; contentId: string; replyCommentId: string; onClose: () => void }) => 
    CommentEdit(visible, name, contentType, contentId, replyCommentId, onClose)
);

CommentEditMemo.displayName = "CommentEditMemo";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const RenderCommentItem = memo(({
    item,
    theme,
    style,
    handleChildComment,
    setChildVisible,
    id,
    disableAnimations,
    onReply
}: {
    item: any;
    theme: any;
    style?: any;
    handleChildComment: (id: string) => void;
    setChildVisible: (visible: boolean) => void;
    id: string;
    disableAnimations: boolean;
    onReply?: (id: string) => void;
}) => {
    const scale = React.useRef(new Animated.Value(1)).current;
    const [isLiked, setIsLiked] = React.useState(item.isVote);
    const [menuVisible, setMenuVisible] = React.useState(false);
    const [menuAnchor, setMenuAnchor] = React.useState({ x: 0, y: 0 });
    const swipeableRef = useRef<any>(null);
    const router = useRouter();
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

    const handleLongPress = useCallback((event: any) => {
        setMenuAnchor({ x: event.nativeEvent.pageX, y: event.nativeEvent.pageY });
        setMenuVisible(true);
    }, []);
    
    const formatTime = (ts: number) => {
        const d = new Date(ts * 1000);
        return d.toLocaleString();
    };

    const renderRightActions = (progress: any, dragX: any) => {
        const trans = dragX.interpolate({
            inputRange: [-80, 0],
            outputRange: [1, 0],
            extrapolate: 'clamp',
        });
        return (
            <View style={{ width: 80, justifyContent: 'center', alignItems: 'center' }}>
                <Animated.View style={{ transform: [{ translateX: trans }] }}>
                    <IconButton
                        icon="reply"
                        mode="contained"
                        size={28}
                        iconColor={theme.colors.onPrimary}
                        containerColor={theme.colors.primary}
                    />
                </Animated.View>
            </View>
        );
    };

    const handleSwipeableOpen = (direction: string) => {
        if (direction === 'right') {
            short();
            swipeableRef.current?.close(); // 马上合上
            if (onReply) onReply(item.id); // 触发回复逻辑
        }
    };

    useEffect(() => {
        setIsLiked(item.isVote);
    }, [item.isVote]);
    
    // 这里导致了严重的无限循环与初始发包：
    // 每当 setIsLiked 被触发或者第一次渲染组件时，useEffect 就会把 isLiked 视为发生变化（虽然只是初始化为 false/true）
    // 然后这里就不分青红皂白去调用 API (likeComment / cancelLikeComment)
    // 尤其是在列表渲染几十个 item 的时候，并发几十个请求被知乎反作弊拦截或者引起了死循环

    const handleToggleLike = async () => {
        const newIsLiked = !isLiked;
        setIsLiked(newIsLiked);
        item.isVote = newIsLiked;
        item.voteCount += newIsLiked ? 1 : -1;

        try {
            if (newIsLiked) {
                await likeComment(item.id);
            } else {
                await cancelLikeComment(item.id);
            }
        } catch (e) {
            // 如果请求失败了，悄悄把状态滚回去
            setIsLiked(!newIsLiked);
            item.isVote = !newIsLiked;
            item.voteCount += newIsLiked ? -1 : 1;
        }
    };

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
        <Swipeable
            ref={swipeableRef}
            renderRightActions={renderRightActions}
            friction={2}
            rightThreshold={100}
            onSwipeableWillOpen={handleSwipeableOpen}
        >
        <AnimatedPressable
            onPress={() => { console.log("点击了评论:", item.id); handleChildComment(item.id); }}
            onLongPress={handleLongPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            android_ripple={{ color: 'rgba(0,0,0,0.15)', foreground: true }}
            style={[{
                marginBottom: 10,
                borderRadius: 16,
                overflow: 'hidden',
                backgroundColor: '#F3EDF7'
            },
            { transform: [{ scale }] },
            style]}
        >
            <Portal>
                <Menu
                    visible={menuVisible}
                    onDismiss={() => setMenuVisible(false)}
                    anchor={menuAnchor}
                >
                    <Menu.Item 
                        onPress={() => { 
                            setMenuVisible(false); 
                            if (onReply) onReply(item.id);
                        }} 
                        title="回复" 
                        leadingIcon="reply"
                    />
                    <Menu.Item 
                        onPress={() => { 
                            setMenuVisible(false); 
                        }} 
                        title="复制" 
                        leadingIcon="content-copy"
                    />
                    <Menu.Item 
                        onPress={() => { 
                            setMenuVisible(false); 
                            handleToggleLike();
                        }} 
                        disabled={item.isAuthor} // 如果是自己发布的评论，长按菜单中的点赞也被禁用
                        title={item.isVote ? "取消点赞" : "点赞"} 
                        leadingIcon={item.isVote ? "thumb-down" : "thumb-up"}
                    />
                </Menu>
            </Portal>

            <View style={{ paddingHorizontal: 12, paddingVertical: 12 }}>
                {/* Header */}
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Pressable onPress={() => {router.push({ pathname: '/people', params: { urlToken: item.authorUrlToken } });setChildVisible(false);}}>
                        <Avatar.Image
                            size={36}
                            source={{ uri: item.authorAvatar }}
                            style={{
                                backgroundColor: theme.colors.surfaceVariant,
                                marginRight: 12,
                            }}
                        />
                    </Pressable>

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
                            onPress={handleToggleLike}
                            disabled={item.isAuthor} // 如果是自己发布的评论，禁止点赞
                            iconColor={
                                item.isAuthor 
                                  ? theme.colors.onSurfaceDisabled 
                                  : (item.isVote ? theme.colors.primary : theme.colors.onSurfaceVariant)
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
        </Swipeable>
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
    const [replyId, setReplyId] = React.useState(""); // 专门用于存储回复目标的 ID
    const [menuVisible, setMenuVisible] = React.useState(false);
    const [commentEditVisible, setCommentEditVisible] = React.useState(false);
    const [replyName, setReplyName] = React.useState("");
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
            isAuthor: item.is_author, // 获取是否为本人评论字段
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
            // 修改这里，如果 isRefresh 说明是从新拉取，此时即使 offsetRef 还没更新循环前也应该是空字符串
            const currentOffset = isRefresh ? "" : offsetRef.current;
            const data = await getRootComments(id, normalizedType, currentOffset, sort);
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

    const handleReply = useCallback((id: string, authorName?: string) => {
            setReplyId(id);
            // 如果是从子评论等地方传带名字上来，把它存下来传给评论框
            // 我们利用一个临时 ref 或状态存名字，这里更简单是在渲染时去列表里找，
            // 但子评论可能不在主 comments 列表里，所以我们更新一个特定的 replyName 状态
        setReplyName(authorName || "");
        setCommentEditVisible(true);
    }, []);

    const renderCommentItem = useCallback(({ item }: { item: any }) => (
        <RenderCommentItem
            item={item}
            theme={theme}
            handleChildComment={handleChildComment}
            setChildVisible={setChildVisible}
            id={item.id}
            disableAnimations={disableAnimations}
            // 主页列表回复直接传自己的 AuthorName
            onReply={(id) => handleReply(id, item.authorName)}
        />
    ), [disableAnimations, handleChildComment, handleReply, theme]);

    return (
        <View style={{ flex: 1 }}>
            <Portal>
                <Modal visible={childVisible} onDismiss={() => setChildVisible(false)} contentContainerStyle={{ flex: 1 }}>
                    <ChildComment visible={childVisible} id={childId} onClose={() => setChildVisible(false)} onReply={handleReply}/>
                </Modal>
                <Modal visible={commentEditVisible} onDismiss={() => setCommentEditVisible(false)} contentContainerStyle={{ flex: 1 }}>
                    {/* 直接传入上面存好的 replyName，找不到或者为空时再尝试从总 comments 找(兜底) */}
                    <CommentEditMemo visible={commentEditVisible} contentType={type} contentId={id} replyCommentId={replyId} name={replyName || comments.find(c => c.id === replyId)?.authorName || ''} onClose={() => setCommentEditVisible(false)} />
                </Modal>
            </Portal>
            <Appbar.Header>
                <Appbar.BackAction onPress={() => { router.back() }} />
                <Appbar.Content title={`评论 (${commentCount})`} />
                <Menu
                    visible={menuVisible}
                    onDismiss={() => {setMenuVisible(false)}}
                    anchor={<Appbar.Action icon="dots-vertical" onPress={() => setMenuVisible(true)} />}>
                    <Menu.Item
                        onPress={() => { setReplyId(""); setReplyName(""); setCommentEditVisible(true); setMenuVisible(false); console.log("点击了回复主文章") }}
                        title="回复"
                        leadingIcon={() => <Icon source="reply" size={16} color="#49454F" />}
                    />
                    <Menu.Item
                        onPress={() => {  }}
                        title="取消点赞"
                        leadingIcon={() => <Icon source="account-outline" size={16} color="#49454F" />}
                    />
                </Menu>
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
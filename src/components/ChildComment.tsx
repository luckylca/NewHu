import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, BackHandler, Dimensions, FlatList, Pressable, StyleSheet, View } from "react-native";
import { Divider, Text } from "@/src/components/ui";
import { useTheme } from "@/src/theme/ThemeProvider";
import { RenderCommentItem } from "../../app/item/[type]/[id]/comment";
import { getChildComments } from "../api/ZhihuApi";
import { useSettingStore } from "../stores/useSettingStore";
const { width: WindowWidth } = Dimensions.get("window");

export default function ChildComment({ visible, id, onClose, onReply }: { visible: boolean, id: string, onClose: () => void, onReply?: (id: string, name?: string) => void }) {
    const theme = useTheme();
    const disableAnimations = useSettingStore((state) => state.disableAnimations);

    const [childComments, setChildComments] = useState<any[]>([]);
    // 新增：保存父评论和总评论数
    const [rootComment, setRootComment] = useState<any>(null);
    const [totalCounts, setTotalCounts] = useState<number>(0);
    
    const [isRefreshing, setIsRefreshing] = useState(false);
    const offset = useRef("");

    const [isMounted, setIsMounted] = useState(false);
    const animValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
                onClose();
                return true;
            });
            return () => backHandler.remove();
        }
    }, [visible, onClose]);

    useEffect(() => {
        if (visible) {
            setIsMounted(true);
            refreshChildComments(true); 
            
            if (disableAnimations) {
                animValue.setValue(1);
            } else {
                Animated.timing(animValue, {
                    toValue: 1,
                    useNativeDriver: true,
                    duration: 300,
                }).start();
            }
        } else if (isMounted) {
            if (disableAnimations) {
                animValue.setValue(0);
                setIsMounted(false);
                resetState(); 
            } else {
                Animated.timing(animValue, {
                    toValue: 0,
                    useNativeDriver: true,
                    duration: 250,
                }).start(() => {
                    setIsMounted(false);
                    resetState(); 
                });
            }
        }
    }, [visible, disableAnimations]);

    const resetState = () => {
        setChildComments([]);
        setRootComment(null);
        setTotalCounts(0);
        offset.current = "";
    };

    // 优化清洗函数，增加对 reply_to_author 的支持
    const childCommentsClear = (item: any) => {
        if (!item) return null;
        return {
            id: item.id,
            content: item.content,
            createdTime: item.created_time,
            authorUrlToken: item.author?.url_token,
            authorName: item.author?.name,
            authorAvatar: item.author?.avatar_url,
            voteCount: item.like_count,
            isVote: item.liked,
            isAuthor: item.is_author, // 获取是否为本人评论字段
            isHot: item.hot,
            isTop: item.top,
            childCommentCount: item.child_comment_count ?? 0,
            // 关键新增：子评论回复的目标用户
            replyToAuthorName: item.reply_to_author?.name, 
        };
    };

    const refreshChildComments = async (isRefresh: boolean) => {
        if (isRefresh) {
            setIsRefreshing(true);
            offset.current = ""; 
        }

        try {
            const currentOffset = isRefresh ? "" : offset.current; // 修正同样可能发生的并发导致 ref 未清空
            const res = await getChildComments(id, currentOffset, "ts");
            
            // 首屏刷新时，捕获 root 评论和总数量
            if (isRefresh) {
                if (res?.root) {
                    setRootComment(childCommentsClear(res.root));
                }
                if (res?.counts?.total_counts) {
                    setTotalCounts(res.counts.total_counts);
                }
            }

            const data = (res?.data ?? []) as any[];
            const processedItems = data.map(childCommentsClear).filter((item) => item && item.id);

            if (isRefresh) {
                setChildComments(processedItems);
            } else {
                setChildComments((prev) => {
                    const mergedData = [...prev, ...processedItems];
                    const uniqueData = mergedData.filter((v, i, a) =>
                        v?.id && a.findIndex((t) => t?.id === v.id) === i
                    );
                    return uniqueData;
                });
            }

            const urlString = res?.paging?.next;
            if (urlString) {
                try {
                    const url = new URL(urlString);
                    const token = url.searchParams.get('offset');
                    if (token) {
                        offset.current = token;
                    }
                } catch (e) {
                    console.error('URL 格式不正确', e);
                }
            }
        } catch (error) {
            console.error('获取数据失败:', error);
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleChildComment = useCallback((childId: string, authorName?: string) => {
        console.log("点击了子评论，id:", childId);
        // 子评论内部直接点击暂不触发回复框弹出
        // 如果你需要可以在这里做其他跳转或者直接留空
    }, []);

    const renderCommentItem = useCallback(({ item }: { item: any }) => (
        <RenderCommentItem
            item={item}
            theme={theme}
            handleChildComment={(id) => handleChildComment(id, item.authorName)}
            setChildVisible={onClose} 
            id={item.id}
            disableAnimations={disableAnimations}
            onReply={(id) => onReply && onReply(id, item.authorName)}
            style={{ marginLeft: 0, marginRight: 0, width: "100%" }}
        />
    ), [disableAnimations, handleChildComment, theme, onClose, onReply]);

    if (!isMounted) return null;

    return (
        <View style={[StyleSheet.absoluteFill, { zIndex: 1000 }]}>
            <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)', opacity: animValue }]}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
            </Animated.View>

            <Animated.View 
                style={{ 
                    flex: 1,
                    marginTop: 100, // 弹窗从屏幕偏下方开始
                    borderTopLeftRadius: 20,
                    borderTopRightRadius: 20,
                    backgroundColor: theme.colors.background,
                    opacity: animValue,
                    transform: [{
                        translateY: animValue.interpolate({
                            inputRange: [0, 1],
                            outputRange: [300, 0] // 改为从底部滑出的效果，比居中缩放更适合评论区
                        })
                    }],
                    overflow: 'hidden'
                }}
            >
                {/* 顶部把手和标题区 */}
                <View style={{ alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.surfaceVariant }}>
                    <View style={{ width: 40, height: 4, backgroundColor: theme.colors.onSurfaceDisabled, borderRadius: 2, marginBottom: 8 }} />
                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: theme.colors.onSurface }}>
                        {totalCounts > 0 ? `${totalCounts} 条回复` : '回复'}
                    </Text>
                </View>

                <Divider style={{ marginVertical: 16 }} />

                <FlatList
                    data={childComments}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={renderCommentItem}
                    refreshing={isRefreshing}
                    onRefresh={() => refreshChildComments(true)}
                    onEndReached={() => refreshChildComments(false)}
                    onEndReachedThreshold={0.8}
                    initialNumToRender={10}
                    // 新增：渲染父级评论作为列表头部
                    ListHeaderComponent={
                        rootComment ? (
                            <View style={{ marginBottom: 8 }}>
                                <RenderCommentItem
                                    item={rootComment}
                                    theme={theme}
                                    id={rootComment.id}
                                    handleChildComment={(id) => handleChildComment(id, rootComment.authorName)}
                                    setChildVisible={onClose}
                                    disableAnimations={disableAnimations}
                                    onReply={(id) => onReply && onReply(id, rootComment.authorName)}
                                    style={{ marginLeft: 0, marginRight: 0, width: "100%" }}
                                />
                                <Divider style={{ marginVertical: 8 }} />
                            </View>
                        ) : null
                    }
                    ListEmptyComponent={() => (
                        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 20 }}>
                            <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 16 }}>暂无子评论</Text>
                        </View>
                    )}
                />
            </Animated.View>
        </View>
    );
}
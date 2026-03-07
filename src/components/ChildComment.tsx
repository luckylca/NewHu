import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, BackHandler, FlatList, Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { RenderCommentItem } from "../../app/item/[type]/[id]/comment";
import { getChildComments } from "../api/ZhihuApi";
import { useSettingStore } from "../stores/useSettingStore";

export default function ChildComment({ visible, id, onClose }: { visible: boolean, id: string, onClose: () => void }) {
    const theme = useTheme();
    const disableAnimations = useSettingStore((state) => state.disableAnimations);

    const [childComments, setChildComments] = useState<any[]>([]);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const offset = useRef("");

    // 核心：使用 isMounted 延迟组件卸载，保证退场动画有时间播完
    const [isMounted, setIsMounted] = useState(false);
    
    // 动画值：0 代表收拢/透明，1 代表展开/显示
    const animValue = useRef(new Animated.Value(0)).current;

    // 监听 Android 物理返回键 (弹窗打开时按下返回键自动关闭)
    useEffect(() => {
        if (visible) {
            const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
                onClose();
                return true;
            });
            return () => backHandler.remove();
        }
    }, [visible, onClose]);

    // 触发出场/退场动画
    useEffect(() => {
        if (visible) {
            setIsMounted(true);
            refreshChildComments(true); // 每次打开重新拉数据
            
            if (disableAnimations) {
                animValue.setValue(1);
            } else {
                Animated.timing(animValue, {
                    toValue: 1,
                    useNativeDriver: true,
                    duration: 300, // 300ms 是 UI 界面最舒适的展开速度
                }).start();
            }
        } else if (isMounted) {
            if (disableAnimations) {
                animValue.setValue(0);
                setIsMounted(false);
                setChildComments([]); 
            } else {
                Animated.timing(animValue, {
                    toValue: 0,
                    useNativeDriver: true,
                    duration: 250, // 收拢速度稍微快一点，符合物理直觉
                }).start(() => {
                    // 动画彻底播完后，再销毁组件释放内存！
                    setIsMounted(false);
                    setChildComments([]); 
                });
            }
        }
    }, [visible, disableAnimations]);

    const childCommentsClear = (item: any) => {
        return {
            id: item.id,
            content: item.content,
            createdTime: item.created_time,
            authorUrlToken: item.author?.url_token,
            authorName: item.author?.name,
            authorAvatar: item.author?.avatar_url,
            voteCount: item.like_count,
            isVote: item.liked,
            isHot: item.hot,
            isTop: item.top,
            childCommentCount: item.child_comment_count ?? 0,
        };
    };

    const refreshChildComments = async (isRefresh: boolean) => {
        if (isRefresh) {
            setIsRefreshing(true);
            offset.current = ""; 
        }

        try {
            const res = await getChildComments(id, offset.current, "ts");
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

    const handleChildComment = useCallback((id: string) => {
        console.log("点击了子评论，id:", id);
    }, []);

    const renderCommentItem = useCallback(({ item }: { item: any }) => (
        <RenderCommentItem
            item={item}
            theme={theme}
            handleChildComment={handleChildComment}
            disableAnimations={disableAnimations}
            style={{ marginLeft: 0, marginRight: 0, width: "100%" }}
        />
    ), [disableAnimations, handleChildComment, theme]);

    // 如果即不可见，又播完了退场动画，才真正返回 null（卸载）
    if (!isMounted) return null;

    return (
        <View style={[StyleSheet.absoluteFill, { zIndex: 1000 }]}>
            {/* 1. 全局深色半透明遮罩，带淡入淡出。点击遮罩区即可关闭 */}
            <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)', opacity: animValue }]}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
            </Animated.View>

            {/* 2. 内容区：完美展示向中心拉开/收拢效果 */}
            <Animated.View 
                style={{ 
                    flex: 1,
                    margin: 20, // 增加四周留白，能更好看清缩放边界
                    marginTop: 100, // 避开头部的导航栏
                    padding: 10,
                    borderRadius: 20,
                    backgroundColor: theme.colors.background, // 非常关键：必须带有背景色！
                    opacity: animValue,
                    transform: [{ scale: animValue }], // 一维 scale，默认以正中心为缩放锚点
                    overflow: 'hidden'
                }}
            >
                {/* 可选：顶部加个小短条，暗示是个弹出层 */}
                <View style={{ width: 40, height: 4, backgroundColor: theme.colors.surfaceVariant, alignSelf: 'center', marginTop: 12, marginBottom: 8, borderRadius: 2 }} />

                <FlatList
                    data={childComments}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={renderCommentItem}
                    refreshing={isRefreshing}
                    onRefresh={() => refreshChildComments(true)}
                    onEndReached={() => refreshChildComments(false)}
                    onEndReachedThreshold={0.8}
                    initialNumToRender={6}
                    maxToRenderPerBatch={8}
                    windowSize={7}
                    updateCellsBatchingPeriod={16}
                    removeClippedSubviews={true}
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
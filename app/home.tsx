import { getApiInstance, getRecommend } from '@/src/api/ZhihuApi';
import { useContentStore } from '@/src/stores/useContentStore';
import { useUserStore } from '@/src/stores/useUserStore';
import { router } from 'expo-router';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, FlatList, NativeScrollEvent, NativeSyntheticEvent, Pressable, View, StyleSheet } from 'react-native';
import { Card, Icon, Text, TextInput, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettingStore } from '../src/stores/useSettingStore';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const { width: WindowWidth, height: WindowHeight } = Dimensions.get('window');

// ==================== 普通模式 Item ====================
export const RenderItem = memo(({ item, type, needToGet, disableAnimations, hideTitle }: any) => {
    const title = (type === 'answer' && item.questionTitle) ? item.questionTitle : item.title;
    const theme = useTheme();
    const metaColor = theme.colors.onSurfaceVariant;
    const cardBgColor = theme.colors.surfaceVariant;
    
    const openItem = useCallback(() => {
        setTimeout(() => {
            router.push({
                pathname: `/item/[type]/[id]`,
                params: { id: item.id, type, needToGet: needToGet.toString() }
            })
        }, 100);
    }, [item.id, type, needToGet]);

    const scale = useRef(new Animated.Value(1)).current;

    const handlePressIn = useCallback(() => {
        if (disableAnimations) return;
        Animated.spring(scale, {
            toValue: 0.95,
            useNativeDriver: true,
            bounciness: 10,
        }).start();
    }, [disableAnimations]);

    const handlePressOut = useCallback(() => {
        if (disableAnimations) return;
        Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            bounciness: 10,
        }).start();
    }, [disableAnimations]);

    return (
        <AnimatedPressable
            onPress={openItem}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            android_ripple={{ color: theme.colors.surfaceDisabled, foreground: true }}
            style={[
                {
                    width: WindowWidth * 0.9,
                    marginBottom: 10,
                    borderRadius: 16,
                    overflow: 'hidden',
                    backgroundColor: cardBgColor,
                },
                { transform: [{ scale }] }
            ]}
        >
            <Card mode="contained" style={{ borderRadius: 16, overflow: 'hidden', backgroundColor: 'transparent' }}>
                <Card.Content style={{ paddingVertical: 8 }}>
                    {!hideTitle && (
                        <Text variant="titleMedium" style={{ fontWeight: 'bold', marginBottom: 8 }} numberOfLines={2}>
                            {title}
                        </Text>
                    )}
                    <Text variant="bodyMedium" style={{ color: metaColor, marginBottom: 10, lineHeight: 20 }} numberOfLines={3}>
                        {item.excerpt}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 24 }}>
                            <Icon source="thumb-up-outline" size={16} color={metaColor} />
                            <Text variant="labelMedium" style={{ marginLeft: 6, color: metaColor }}>{item.voteCount}</Text>
                        </View>
                        {item.favoriteCount > 0 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 24 }}>
                                <Icon source="star-outline" size={16} color={metaColor} />
                                <Text variant="labelMedium" style={{ marginLeft: 6, color: metaColor }}>{item.favoriteCount}</Text>
                            </View>
                        )}
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 24 }}>
                            <Icon source="comment-outline" size={16} color={metaColor} />
                            <Text variant="labelMedium" style={{ marginLeft: 6, color: metaColor }}>{item.commentCount}</Text>
                        </View>
                    </View>
                </Card.Content>
            </Card>
        </AnimatedPressable>
    );
}, (prevProps: any, nextProps: any) => {
    return prevProps.item.id === nextProps.item.id &&
        prevProps.disableAnimations === nextProps.disableAnimations;
});
RenderItem.displayName = 'RenderItem';

// ==================== 卡片模式 Item (比例写死版) ====================
export const RenderCardModeItem = memo(({ item, type, needToGet, disableAnimations, hideTitle }: any) => {
    const title = (type === 'answer' && item.questionTitle) ? item.questionTitle : item.title;
    
    const theme = useTheme();
    const metaColor = theme.colors.onSurfaceVariant;
    const cardBgColor = theme.colors.surfaceVariant;
    const textColor = theme.colors.onSurface; 
    
    const openItem = useCallback(() => {
        setTimeout(() => {
            router.push({
                pathname: `/item/[type]/[id]`,
                params: { id: item.id, type, needToGet: needToGet.toString() }
            })
        }, 100);
    }, [item.id, type, needToGet]);

    const scale = useRef(new Animated.Value(1)).current;

    const handlePressIn = useCallback(() => {
        if (disableAnimations) return;
        Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, bounciness: 10 }).start();
    }, [disableAnimations]);

    const handlePressOut = useCallback(() => {
        if (disableAnimations) return;
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, bounciness: 10 }).start();
    }, [disableAnimations]);

    // ====== 核心高度比例配置 ======
    // 卡片高度占屏幕的 65%
    const cardHeight = WindowHeight * 0.70; 
    // 顶部留白占屏幕的 5% (你可以按需调整这个数字，比如 0.08 或 0.1)
    // 剩下的 30% 都在底部，不用管它，正好留给你的 Tab 栏
    const topSpacing = WindowHeight * 0.05; 

    return (
        <View style={{ 
            width: WindowWidth, 
            alignItems: 'center', 
            paddingTop: topSpacing // 放弃 flex 垂直居中，直接写死顶部留白高度
        }}>
            <AnimatedPressable
                onPress={openItem}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                android_ripple={{ color: theme.colors.surfaceDisabled, foreground: true }}
                style={[
                    {
                        width: WindowWidth * 0.88, 
                        height: cardHeight, // 卡片固定高度
                        borderRadius: 24,
                        overflow: 'hidden',
                        backgroundColor: cardBgColor,
                        elevation: 4, 
                        shadowColor: theme.colors.shadow,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.1,
                        shadowRadius: 10,
                        padding: 24, 
                        flexDirection: 'column', 
                    },
                    { transform: [{ scale }] }
                ]}
            >
                {/* 标题 */}
                {!hideTitle && (
                    <Text 
                        variant="titleLarge" 
                        style={{ fontWeight: 'bold', marginBottom: 16, color: textColor, lineHeight: 32 }} 
                        numberOfLines={4}
                    >
                        {title || '无标题'}
                    </Text>
                )}
                
                {/* 摘要 (自适应撑开) */}
                <View style={{ flex: 1, marginTop: 4 }}>
                    <Text 
                        variant="bodyLarge" 
                        style={{ color: metaColor, lineHeight: 26 }} 
                        numberOfLines={12}
                    >
                        {item.excerpt || '暂无内容'}
                    </Text>
                </View>

                {/* 底部数据统计栏 */}
                <View style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    marginTop: 20, 
                    paddingTop: 20, 
                    borderTopWidth: StyleSheet.hairlineWidth, 
                    borderColor: theme.colors.outlineVariant 
                }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 24 }}>
                        <Icon source="thumb-up-outline" size={20} color={metaColor} />
                        <Text variant="labelLarge" style={{ marginLeft: 6, color: metaColor }}>{item.voteCount}</Text>
                    </View>
                    {item.favoriteCount > 0 && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 24 }}>
                            <Icon source="star-outline" size={20} color={metaColor} />
                            <Text variant="labelLarge" style={{ marginLeft: 6, color: metaColor }}>{item.favoriteCount}</Text>
                        </View>
                    )}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 24 }}>
                        <Icon source="comment-outline" size={20} color={metaColor} />
                        <Text variant="labelLarge" style={{ marginLeft: 6, color: metaColor }}>{item.commentCount}</Text>
                    </View>
                </View>
            </AnimatedPressable>
        </View>
    );
}, (prevProps: any, nextProps: any) => {
    return prevProps.item.id === nextProps.item.id &&
        prevProps.disableAnimations === nextProps.disableAnimations;
});
RenderCardModeItem.displayName = 'RenderCardModeItem';

// ==================== 主屏幕 ====================
const HomeScreen = ({ navigation, onTabVisibilityChange }: any) => {
    const insets = useSafeAreaInsets();
    const theme = useTheme();
    const contentStore = useContentStore();
    const userStore = useUserStore();
    const disableAnimations = useSettingStore((state) => state.disableAnimations); 
    
    // 1. 获取当前模式
    const displayMode = useSettingStore((state) => state.mode); 

    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    const sessionTokenRef = useRef("");
    const lastOffsetYRef = useRef(0);
    const tabVisibleRef = useRef(true);

    const processFeedItem = (item: any) => {
        const target = item.target;
        const isAds = !!item.promotion_extra;
        const isPaid = !!(target.paid_info || target.answer_type === 'paid');
        if (isAds || isPaid) return null; 

        if (target.type === 'answer' || target.type === 'article') {
            return {
                feedType: target.type,
                isAds: isAds,
                isPaid: isPaid,
                item: {
                    id: target.id,
                    title: target.title || '无标题',
                    authorName: target.author?.name || '匿名用户',
                    authorUrlToken: target.author?.url_token || '',
                    authorAvatar: target.author?.avatar_url || '',
                    excerpt: target.excerpt || '',
                    updatedTime: target.updated_time || target.created || 0,
                    voteCount: target.voteup_count || 0,
                    favoriteCount: target.favorite_count || 0,
                    commentCount: target.comment_count || 0,
                    content: target.content || "",
                    questionTitle: target.question?.title || '未知问题',
                    questionId: target.question?.id || '',
                    questionAuthorName: target.question?.author?.name || '匿名用户',
                    questionAuthorAvatar: target.question?.author?.avatar_url || '',
                    questionAuthorUrlToken: target.question?.author?.url_token || '',
                    questionAnswerCount: target.question?.answer_count || 0,
                    questionCreatedTime: target.question?.created || 0,
                }
            };
        }
        return null;
    };

    const loadData = async (isRefresh = false) => {
        if (isRefresh) {
            setIsRefreshing(true);
            sessionTokenRef.current = ""; 
        } else {
            setIsLoadingMore(true);
        }

        try {
            const res = await getRecommend(sessionTokenRef.current);
            const data = res.data as any[];
            const cleanData = data.filter((item) => item.target && (item.target.type === 'answer' || item.target.type === 'article'));
            const processedItems = cleanData.map(processFeedItem).filter(Boolean); 

            if (isRefresh) {
                contentStore.setFeedList(processedItems);
                console.log('刷新数据', processedItems);
            } else {
                const mergedData = [...contentStore.feedList, ...processedItems];
                const uniqueData = mergedData.filter((v, i, a) =>
                    a.findIndex(t => t.item.id === v.item.id) === i
                );
                contentStore.setFeedList(uniqueData);
            }

            const urlString = res.paging.next;
            try {
                const url = new URL(urlString);
                const token = url.searchParams.get('session_token');
                if (token) sessionTokenRef.current = token;
            } catch (e) {
                console.error('URL 格式不正确', e);
            }
        } catch (error) {
            console.error('获取数据失败:', error);
        } finally {
            setIsRefreshing(false);
            setIsLoadingMore(false);
        }
    };

    useEffect(() => {
        getApiInstance(userStore.cookies); 
        // loadData(true).then(() => loadData(false));
        loadData(true);
    }, []);

    // 普通模式渲染器
    const renderListItem = useCallback(({ item }: any) => (
        <RenderItem 
            item={item.item} 
            type={item.feedType} 
            needToGet={true} 
            disableAnimations={disableAnimations} 
        />
    ), [disableAnimations]);

    // 卡片模式渲染器
    const renderCardListItem = useCallback(({ item }: any) => (
        <RenderCardModeItem 
            item={item.item} 
            type={item.feedType} 
            needToGet={true} 
            disableAnimations={disableAnimations} 
        />
    ), [disableAnimations]);

    const handleListScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const currentY = event.nativeEvent.contentOffset.y;
        const deltaY = currentY - lastOffsetYRef.current;

        if (currentY <= 0) {
            if (!tabVisibleRef.current) {
                tabVisibleRef.current = true;
                onTabVisibilityChange?.(true);
            }
            lastOffsetYRef.current = currentY;
            return;
        }

        if (Math.abs(deltaY) < 8) return;

        if (deltaY > 0 && tabVisibleRef.current) {
            tabVisibleRef.current = false;
            onTabVisibilityChange?.(false);
        } else if (deltaY < 0 && !tabVisibleRef.current) {
            tabVisibleRef.current = true;
            onTabVisibilityChange?.(true);
        }

        lastOffsetYRef.current = currentY;
    }, [onTabVisibilityChange]);

    return (
        <View style={{ flex: 1, alignItems: 'center', marginTop: insets.top, backgroundColor: theme.colors.background }}>
            <TextInput
                label="搜索"
                mode="flat"
                style={{ width: '90%', marginBottom: 10, borderRadius: 5 }}
                left={<TextInput.Icon icon="magnify" />}
            />
            
            {/* 2. 条件渲染 FlatList */}
            {displayMode === 'card' ? (
                <FlatList
                    data={contentStore.feedList}
                    renderItem={renderCardListItem}
                    keyExtractor={(item) => item.item.id.toString()}
                    horizontal={true}             // 开启横向滑动
                    pagingEnabled={true}          // 开启吸附分页
                    showsHorizontalScrollIndicator={false}
                    onEndReached={() => loadData(false)}
                    onEndReachedThreshold={0.8}
                    maxToRenderPerBatch={10}
                    windowSize={3}
                    initialNumToRender={3}
                />
            ) : (
                <FlatList
                    data={contentStore.feedList}
                    renderItem={renderListItem}
                    keyExtractor={(item) => item.item.id.toString()}
                    refreshing={isRefreshing}
                    onRefresh={() => loadData(true)}
                    onEndReached={() => loadData(false)}
                    onEndReachedThreshold={0.8}
                    showsVerticalScrollIndicator={false}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                    initialNumToRender={8}
                    onScroll={handleListScroll}
                    scrollEventThrottle={16}
                />
            )}
        </View>
    );
}

export default HomeScreen;
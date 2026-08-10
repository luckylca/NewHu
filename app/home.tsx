import { getApiInstance, getRecommend, dislikeAnswer, dislikeArticle } from '@/src/api/ZhihuApi'; // 注入对应的不喜欢 API
import { useContentStore } from '@/src/stores/useContentStore';
import { useUserStore } from '@/src/stores/useUserStore';
import { router } from 'expo-router';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, FlatList, NativeScrollEvent, NativeSyntheticEvent, View, StyleSheet, PanResponder, Share } from 'react-native';
import { Card, Icon, SearchBar, Text } from '@/src/ui';
import { useTheme } from '@/src/ui/theme';
import { useSettingStore } from '../src/stores/useSettingStore';
import { useStoreHydrated } from '@/src/hooks/useStoreHydrated';
import type { FeedItem, FeedItemInfo, FeedType } from '@/src/types/zhihu';
import { short } from '@/src/utils/haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: WindowWidth } = Dimensions.get('window');
const WindowHeight = Dimensions.get('window').height;

// ====== Paging 模式下的比例参数 ======
const ITEM_WIDTH = WindowWidth * 0.88; 
const CARD_WIDTH = WindowWidth * 0.82; 
const CARD_HEIGHT = WindowHeight * 0.65;
const CARD_ITEM_HEIGHT = CARD_HEIGHT + 10;

function getContentPreview(item: FeedItem) {
    const content = item.content
        ?.replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();
    return content || item.excerpt || '暂无内容';
}

// ==================== 普通模式 Item ====================
export const RenderItem = memo(({ item, type, needToGet, hideTitle }: {
    item: FeedItem;
    type: FeedType;
    needToGet: boolean;
    hideTitle?: boolean;
}) => {
    const title = (type === 'answer' && item.questionTitle) ? item.questionTitle : item.title;
    const theme = useTheme();
    const metaColor = theme.colors.onSurfaceVariantSummary;
    const cardBgColor = theme.colors.surfaceContainer;

    const openItem = useCallback(() => {
        router.push({
            pathname: `/item/[type]/[id]`,
            params: { id: item.id, type, needToGet: needToGet.toString() }
        });
    }, [item.id, type, needToGet]);

    return (
        <Card
            feedback="none"
            showIndication
            onPress={openItem}
            style={{ width: WindowWidth * 0.9, marginBottom: 10 }}
            contentStyle={{ backgroundColor: cardBgColor, paddingHorizontal: 16, paddingVertical: 14 }}
        >
            {!hideTitle && (
                <Text type="headline1" weight="bold" color={theme.colors.onBackground} style={{ marginBottom: 8 }} numberOfLines={2}>
                    {title}
                </Text>
            )}
            <Text type="body2" color={metaColor} style={{ marginBottom: 10, lineHeight: 20 }} numberOfLines={3}>
                {item.excerpt}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 24 }}>
                    <Icon name="thumb-up-outline" size={16} color={metaColor} />
                    <Text type="footnote1" style={{ marginLeft: 6, color: metaColor }}>{item.voteCount}</Text>
                </View>
                {item.favoriteCount > 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 24 }}>
                        <Icon name="star-outline" size={16} color={metaColor} />
                        <Text type="footnote1" style={{ marginLeft: 6, color: metaColor }}>{item.favoriteCount}</Text>
                    </View>
                )}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 24 }}>
                    <Icon name="comment-outline" size={16} color={metaColor} />
                    <Text type="footnote1" style={{ marginLeft: 6, color: metaColor }}>{item.commentCount}</Text>
                </View>
            </View>
        </Card>
    );
}, (prevProps, nextProps) => {
    return prevProps.item.id === nextProps.item.id &&
        prevProps.type === nextProps.type &&
        prevProps.hideTitle === nextProps.hideTitle;
});
RenderItem.displayName = 'RenderItem';

// ==================== 卡片模式 Item ====================
export const RenderCardModeItem = memo(({ item, type, needToGet, disableAnimations, hideTitle, onDislike, onShare, leftAction, rightAction, onCardDragChange }: {
    item: FeedItem;
    type: FeedType;
    needToGet: boolean;
    disableAnimations?: boolean;
    hideTitle?: boolean;
    onDislike?: (id: string) => void;
    onShare?: () => void;
    leftAction: 'share' | 'dislike' | 'none';
    rightAction: 'share' | 'dislike' | 'none';
    onCardDragChange?: (dragging: boolean) => void;
}) => {
    const title = (type === 'answer' && item.questionTitle) ? item.questionTitle : item.title;

    const theme = useTheme();
    const metaColor = theme.colors.onSurfaceVariantSummary;
    const cardBgColor = theme.colors.surfaceContainer;
    const textColor = theme.colors.onBackground;

    const openItem = useCallback(() => {
        router.push({
            pathname: `/item/[type]/[id]`,
            params: { id: item.id, type, needToGet: needToGet.toString() }
        });
    }, [item.id, type, needToGet]);

    const translateX = useRef(new Animated.Value(0)).current;
    const actionRef = useRef({ onDislike, onShare, leftAction, rightAction });
    actionRef.current = { onDislike, onShare, leftAction, rightAction };

    // 慢速横滑触发卡片动作；纵向手势始终留给分页列表。
    const touchStartTimeRef = useRef(0);
    const isDragModeRef = useRef(false);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponder: (_, gs) => {
                if (isDragModeRef.current) return true;
                const horizontal = Math.abs(gs.dx) > Math.abs(gs.dy) && Math.abs(gs.dx) > 4;
                if (horizontal && Date.now() - touchStartTimeRef.current > 100) {
                    isDragModeRef.current = true;
                    onCardDragChange?.(true);
                    return true;
                }
                return false;
            },
            onPanResponderGrant: () => {},
            onPanResponderMove: (_, gs) => {
                translateX.setValue(gs.dx);
            },
            onPanResponderRelease: (_, gs) => {
                isDragModeRef.current = false;
                onCardDragChange?.(false);
                const direction = gs.dx < -150 ? 'left' : gs.dx > 150 ? 'right' : null;
                if (direction) {
                    short();
                    Animated.timing(translateX, {
                        toValue: direction === 'left' ? -WindowWidth : WindowWidth,
                        duration: 220,
                        useNativeDriver: true,
                    }).start(() => {
                        const config = actionRef.current;
                        const action = direction === 'left' ? config.leftAction : config.rightAction;
                        if (action === 'dislike') config.onDislike?.(item.id);
                        if (action === 'share') config.onShare?.();
                        translateX.setValue(0);
                    });
                } else {
                    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 8 }).start();
                }
            },
            onPanResponderTerminate: () => {
                isDragModeRef.current = false;
                onCardDragChange?.(false);
                translateX.setValue(0);
            },
        })
    ).current;

    const cardOpacity = translateX.interpolate({
        inputRange: [-WindowWidth * 0.35, 0, WindowWidth * 0.35],
        outputRange: [0.4, 1, 0.4],
        extrapolate: 'clamp'
    });

    const topSpacing = 0;
    const preview = getContentPreview(item);
    return (
        <View style={{ 
            width: ITEM_WIDTH,     
            height: CARD_ITEM_HEIGHT,
            alignItems: 'center', 
            paddingTop: topSpacing 
        }}>
            <Animated.View
                {...panResponder.panHandlers}
                onTouchStart={() => {
                    touchStartTimeRef.current = Date.now();
                    isDragModeRef.current = false;
                }}
                onTouchEnd={() => {
                    isDragModeRef.current = false;
                    onCardDragChange?.(false);
                }}
                onTouchCancel={() => {
                    isDragModeRef.current = false;
                    onCardDragChange?.(false);
                }}
                style={[
                    {
                        width: CARD_WIDTH,
                        height: CARD_HEIGHT,
                        borderRadius: 24,
                        overflow: 'hidden',
                        backgroundColor: cardBgColor,
                    },
                    { transform: [{ translateX }], opacity: cardOpacity }
                ]}
            >
                <Card
                    feedback="none"
                    showIndication
                    onPress={openItem}
                    style={{ flex: 1 }}
                    contentStyle={{ backgroundColor: 'transparent', borderRadius: 24, padding: 24, flex: 1 }}
                >
                    {!hideTitle && (
                        <Text
                            type="title3"
                            weight="bold"
                            style={{ marginBottom: 16, color: textColor, lineHeight: 32 }}
                            numberOfLines={3}
                        >
                            {title || '无标题'}
                        </Text>
                    )}
                    
                    <View style={{ flex: 1, marginTop: 4, overflow: 'hidden' }} pointerEvents="none">
                        <Text
                            type="body1"
                            color={metaColor}
                            style={{ lineHeight: 27 }}
                            numberOfLines={12}
                        >
                            {preview}
                        </Text>
                    </View>

                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginTop: 20,
                        paddingTop: 20,
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderColor: theme.colors.dividerLine
                    }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 24 }}>
                            <Icon name="thumb-up-outline" size={20} color={metaColor} />
                            <Text type="body2" style={{ marginLeft: 6, color: metaColor }}>{item.voteCount}</Text>
                        </View>
                        {item.favoriteCount > 0 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 24 }}>
                                <Icon name="star-outline" size={20} color={metaColor} />
                                <Text type="body2" style={{ marginLeft: 6, color: metaColor }}>{item.favoriteCount}</Text>
                            </View>
                        )}
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 24 }}>
                            <Icon name="comment-outline" size={20} color={metaColor} />
                            <Text type="body2" style={{ marginLeft: 6, color: metaColor }}>{item.commentCount}</Text>
                        </View>
                    </View>
                </Card>
            </Animated.View>
        </View>
    );
}, (prevProps, nextProps) => {
    return prevProps.item.id === nextProps.item.id &&
        prevProps.disableAnimations === nextProps.disableAnimations &&
        prevProps.leftAction === nextProps.leftAction &&
        prevProps.rightAction === nextProps.rightAction &&
        prevProps.onCardDragChange === nextProps.onCardDragChange;
});
RenderCardModeItem.displayName = 'RenderCardModeItem';

// ==================== 主屏幕 ====================
const HomeScreen = () => {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    
    // 从 store 中通过精细选择器拉取所需的状态和方法
    const feedList = useContentStore((state) => state.feedList);
    const setFeedList = useContentStore((state) => state.setFeedList);
    const removeFeedItem = useContentStore((state) => state.removeFeedItem); // 引入解耦后的局部删除 Action
    const addUnlikeItem = useContentStore((state) => state.addUnlikeItem);   // 引入新增的本地不喜欢持久化 Action
    
    const cookies = useUserStore((state) => state.cookies);
    const disableAnimations = useSettingStore((state) => state.disableAnimations);
    const displayMode = useSettingStore((state) => state.mode);
    const filterAds = useSettingStore((state) => state.isAds);
    const filterPaid = useSettingStore((state) => state.isPaid);
    const leftSwipeAction = useSettingStore((state) => state.cardSwipeLeftAction);
    const rightSwipeAction = useSettingStore((state) => state.cardSwipeRightAction);
    const userHydrated = useStoreHydrated(useUserStore); // 等用户 store 完成水合再初始化 API

    const [isRefreshing, setIsRefreshing] = useState(false);
    const [cardListHeight, setCardListHeight] = useState(0);
    const requestInFlightRef = useRef(false);

    const sessionTokenRef = useRef("");
    const feedListRef = useRef(feedList);
    feedListRef.current = feedList;
    const loadDataRef = useRef<any>(null);

    const flatListRef = useRef<FlatList>(null);
    const currentIndexRef = useRef(0);
    // 滑动模式保持原生纵向分页；长按拖动卡片时才临时锁住列表。
    const [cardDragging, setCardDragging] = useState(false);
    const onCardDragChange = useCallback((dragging: boolean) => {
        setCardDragging(dragging);
    }, []);

    const processFeedItem = (item: any): FeedItemInfo | null => {
        const target = item.target;
        const isAds = !!item.promotion_extra;
        const isPaid = !!(target.paid_info || target.answer_type === 'paid');
        if ((filterAds && isAds) || (filterPaid && isPaid)) return null;

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
        if (requestInFlightRef.current) return;
        requestInFlightRef.current = true;

        if (isRefresh) {
            setIsRefreshing(true);
            sessionTokenRef.current = ""; 
        }

        try {
            const res = await getRecommend(sessionTokenRef.current);
            const data = res.data as any[];
            const cleanData = data.filter((item) => item.target && (item.target.type === 'answer' || item.target.type === 'article'));
            const processedItems = cleanData.map(processFeedItem).filter((x): x is FeedItemInfo => x !== null);

            if (isRefresh) {
                setFeedList(processedItems);
            } else {
                const mergedData = [...feedListRef.current, ...processedItems];
                const uniqueData = mergedData.filter((v, i, a) =>
                    a.findIndex(t => t.item.id === v.item.id) === i
                );
                setFeedList(uniqueData);
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
            requestInFlightRef.current = false;
            setIsRefreshing(false);
        }
    };

    loadDataRef.current = loadData;

    useEffect(() => {
        if (!userHydrated) return; // 等待持久化的 Cookie 恢复后再初始化，避免用到旧的默认值
        getApiInstance(cookies);
        loadData(true).then(() => loadData(false));
        // 仅在用户 store 水合完成的那一次执行（水合前后各运行一次加载会产生重复数据）
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userHydrated]);

    // 联动优化：不喜欢（移除+网络请求+本地状态）统一处理器
    const handleDislikeItem = useCallback((id: string, feedType: FeedType) => {
        const list = feedListRef.current;
        const targetIndex = list.findIndex((f) => f.item.id.toString() === id.toString());
        if (targetIndex === -1) return;

        // 1. 视窗安全回弹：如果飞走的是列表中最后一个，提前让列表向前翻动一页，避免卡死在空白溢出区
        if (targetIndex === list.length - 1 && list.length > 1) {
            flatListRef.current?.scrollToIndex({
                index: targetIndex - 1,
                animated: true
            });
            currentIndexRef.current = targetIndex - 1;
        }

        // 2. 异步向后端发送不喜欢的网络请求（不阻塞本地动效表现）
        try {
            if (feedType === 'answer') {
                dislikeAnswer?.(String(id));
            } else if (feedType === 'article') {
                dislikeArticle?.(String(id));
            }
            console.log(`已向服务器上报不喜欢，类型: ${feedType}, ID: ${id}`);
        } catch (error) {
            console.error('上报服务器不喜欢状态失败:', error);
        }

        // 3. 将帖子 ID 同步推进本地维护的 store 的 unlikeList 阵列里
        addUnlikeItem(String(id));

        // 4. 从当前的动态推荐流中剔除，引发重绘与完美贴合补位
        removeFeedItem(id);
    }, [removeFeedItem, addUnlikeItem]);

    const handleShareItem = useCallback((item: FeedItem, feedType: FeedType) => {
        const url = feedType === 'article'
            ? `https://zhuanlan.zhihu.com/p/${item.id}`
            : `https://www.zhihu.com/question/${item.questionId}/answer/${item.id}`;
        void Share.share({ title: item.questionTitle || item.title, message: `${item.questionTitle || item.title}\n${url}` });
    }, []);

    const renderListItem = useCallback(({ item }: { item: FeedItemInfo }) => (
        <RenderItem
            item={item.item}
            type={item.feedType}
            needToGet={true}
        />
    ), []);

    // 关键改动：在这里把 item.feedType 作为形参绑定闭包传给 RenderCardModeItem
    const renderCardListItem = useCallback(({ item }: { item: FeedItemInfo }) => (
        <RenderCardModeItem
            item={item.item}
            type={item.feedType}
            needToGet={true}
            disableAnimations={disableAnimations}
            onDislike={(id: string) => handleDislikeItem(id, item.feedType)}
            onShare={() => handleShareItem(item.item, item.feedType)}
            leftAction={leftSwipeAction}
            rightAction={rightSwipeAction}
            onCardDragChange={onCardDragChange}
        />
    ), [disableAnimations, handleDislikeItem, handleShareItem, leftSwipeAction, onCardDragChange, rightSwipeAction]);

    const handleMomentumScrollEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        const index = Math.round(offsetY / CARD_ITEM_HEIGHT);
        currentIndexRef.current = index;

        if (feedListRef.current.length - index <= 5) {
            loadDataRef.current?.(false);
        }
    }, []);

    const cardItemLayout = useCallback((_data: any, index: number) => ({
        length: CARD_ITEM_HEIGHT,
        offset: CARD_ITEM_HEIGHT * index,
        index,
    }), []);

    return (
        <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: theme.colors.surface }}>
            <SearchBar
                label="搜索知乎内容"
                onPress={() => router.push('/search')}
                inputProps={{
                    editable: false,
                    showSoftInputOnFocus: false,
                }}
                style={{ height: theme.components.searchBar.minHeight, marginBottom: 10 }}
            />
            
            {displayMode === 'card' ? (
                <View
                    style={{ flex: 1, alignItems: 'center', width: '100%' }}
                    onLayout={(event) => setCardListHeight(event.nativeEvent.layout.height)}
                >
                    <FlatList
                        ref={flatListRef}
                        style={{ width: '100%', flex: 1 }}
                        contentContainerStyle={{
                            alignItems: 'center',
                            paddingVertical: Math.max(0, (cardListHeight - CARD_ITEM_HEIGHT) / 2),
                        }}
                        data={feedList}
                        renderItem={renderCardListItem}
                        keyExtractor={(item) => item.item.id.toString()}
                        snapToInterval={CARD_ITEM_HEIGHT}
                        snapToAlignment="start"
                        decelerationRate="fast"
                        disableIntervalMomentum={true}
                        scrollEnabled={!cardDragging}
                        showsVerticalScrollIndicator={false}
                        onEndReached={() => loadData(false)}
                        onEndReachedThreshold={0.8}
                        maxToRenderPerBatch={3}
                        windowSize={3}
                        initialNumToRender={2}
                        onMomentumScrollEnd={handleMomentumScrollEnd}
                        getItemLayout={cardItemLayout}
                        removeClippedSubviews={true}
                    />
                </View>
            ) : (
                <FlatList
                    style={{ flex: 1 }}
                    contentContainerStyle={{ alignItems: 'center', paddingTop: 0, paddingBottom: theme.spacing.md }}
                    data={feedList}
                    renderItem={renderListItem}
                    keyExtractor={(item) => item.item.id.toString()}
                    refreshing={isRefreshing}
                    onRefresh={() => loadData(true)}
                    onEndReached={() => loadData(false)}
                    onEndReachedThreshold={0.8}
                    showsVerticalScrollIndicator={false}
                    maxToRenderPerBatch={4}
                    updateCellsBatchingPeriod={48}
                    windowSize={5}
                    initialNumToRender={4}
                    removeClippedSubviews={true}
                />
            )}
        </View>
    );
}

export default HomeScreen;

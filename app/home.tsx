import { getApiInstance, getRecommend } from '@/src/api/ZhihuApi';
import { useContentStore } from '@/src/stores/useContentStore';
import { useUserStore } from '@/src/stores/useUserStore';
import { router } from 'expo-router';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, FlatList, Pressable, View } from 'react-native';
import { Card, Icon, Text, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettingStore } from '../src/stores/useSettingStore';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const { width: WindowWidth } = Dimensions.get('window');

export const RenderItem = memo(({ item, type, needToGet, disableAnimations, hideTitle }: any) => {
    const title = (type === 'answer' && item.questionTitle) ? item.questionTitle : item.title;

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
            android_ripple={{ color: 'rgba(0,0,0,0.15)', foreground: true }}
            style={[
                {
                    width: WindowWidth * 0.9,
                    marginBottom: 10,
                    borderRadius: 16,
                    overflow: 'hidden',
                    backgroundColor: '#F3EDF7',
                },
                { transform: [{ scale }] }
            ]}
        >
            <Card
                mode="contained"
                style={{ borderRadius: 16, overflow: 'hidden', backgroundColor: 'transparent' }}
            >
                <Card.Content style={{ paddingVertical: 8 }}>
                    {!hideTitle && (
                        <Text
                            variant="titleMedium"
                            style={{ fontWeight: 'bold', marginBottom: 8 }}
                            numberOfLines={2}
                        >
                            {title}
                        </Text>
                    )}

                    <Text
                        variant="bodyMedium"
                        style={{ color: '#49454F', marginBottom: 10, lineHeight: 20 }}
                        numberOfLines={3}
                    >
                        {item.excerpt}
                    </Text>

                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 24 }}>
                            <Icon source="thumb-up-outline" size={16} color="#49454F" />
                            <Text variant="labelMedium" style={{ marginLeft: 6, color: '#49454F' }}>
                                {item.voteCount}
                            </Text>
                        </View>
                        {item.favoriteCount > 0 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 24 }}>
                                <Icon source="star-outline" size={16} color="#49454F" />
                                <Text variant="labelMedium" style={{ marginLeft: 6, color: '#49454F' }}>
                                    {item.favoriteCount}
                                </Text>
                            </View>
                        )}

                        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 24 }}>
                            <Icon source="comment-outline" size={16} color="#49454F" />
                            <Text variant="labelMedium" style={{ marginLeft: 6, color: '#49454F' }}>
                                {item.commentCount}
                            </Text>
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

const HomeScreen = ({ navigation }: any) => {
    const insets = useSafeAreaInsets();
    const contentStore = useContentStore();
    const userStore = useUserStore();
    const disableAnimations = useSettingStore((state) => state.disableAnimations); 
    // 1. 状态管理：是否正在下拉刷新，是否正在上拉加载
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    // 2. 使用 useRef 保存 token，这样每次组件刷新它不会被清空重置
    const sessionTokenRef = useRef("");

    const processFeedItem = (item: any) => {
        const target = item.target;
        const isAds = !!item.promotion_extra;
        const isPaid = !!(target.paid_info || target.answer_type === 'paid');
        if (isAds || isPaid) {
            return null; // 过滤掉广告和付费内容
        }
        // console.log('原始数据项：', item.target);
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

    // 3. 核心加载函数：isRefresh 区分是下拉刷新还是上拉加载
    const loadData = async (isRefresh = false) => {
        if (isRefresh) {
            setIsRefreshing(true);
            sessionTokenRef.current = ""; // 下拉刷新重置 token
        } else {
            setIsLoadingMore(true);
        }

        try {
            const res = await getRecommend(sessionTokenRef.current);
            const data = res.data as any[];
            const cleanData = data.filter((item) => item.target && (item.target.type === 'answer' || item.target.type === 'article'));
            const processedItems = cleanData.map(processFeedItem).filter(Boolean); // 过滤掉 null

            if (isRefresh) {
                contentStore.setFeedList(processedItems);
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

                if (token) {
                    sessionTokenRef.current = token;
                }
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
        getApiInstance(userStore.cookies); // 确保 API 实例使用了最新的 Cookie
        loadData(true).then(() => loadData(false));
    }, []);

    const renderListItem = useCallback(({ item }: any) => (
        <RenderItem 
            item={item.item} 
            type={item.feedType} 
            needToGet={true} 
            disableAnimations={disableAnimations} 
        />
    ), [disableAnimations]);

    return (
        <View style={{ flex: 1, alignItems: 'center', marginTop: insets.top }}>
            <TextInput
                label="搜索"
                mode="flat"
                style={{ width: '90%', marginBottom: 20, borderRadius: 5 }}
                left={<TextInput.Icon icon="magnify" />}
            />
            <FlatList
                data={contentStore.feedList}
                renderItem={renderListItem}
                keyExtractor={(item) => item.item.id.toString()}
                refreshing={isRefreshing} // 绑定下拉圈圈的显示状态
                onRefresh={() => loadData(true)} // 触发下拉时执行的方法
                onEndReached={() => loadData(false)} // 列表滑动到底部时触发的方法
                onEndReachedThreshold={0.8}
                showsVerticalScrollIndicator={false}
                maxToRenderPerBatch={10}     // 每次增量渲染的最多数量
                windowSize={5}               // 渲染窗口大小（当前屏幕上下方渲染的屏幕数量，默认21太大了，容易卡）
                initialNumToRender={8}  
            />
        </View>
    );
}
export default HomeScreen;
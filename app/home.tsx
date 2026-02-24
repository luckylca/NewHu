import { getApiInstance, getRecommend } from '@/src/api/ZhihuApi';
import { useContentStore } from '@/src/stores/useContentStore';
import { useUserStore } from '@/src/stores/useUserStore';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, FlatList, Pressable, View } from 'react-native';
import { Card, Icon, Text, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


const { width: WindowWidth } = Dimensions.get('window');

export const renderItem = (item: any, type: string,needToGet: boolean) => {
    const title = type === 'answer' ? item.questionTitle : item.title;
    const openItem = (id: string, type: string) => {
        router.push(`/item?id=${id}&type=${type}&needToGet=${needToGet}`);
    }
    return (
        <Pressable
            onPress={() => {openItem(item.id, type);console.log('点击了项：', item, type);}}
            android_ripple={{ color: 'rgba(0,0,0,0.15)', foreground: true }}
            style={{
                width: WindowWidth * 0.9,
                marginBottom: 10,
                borderRadius: 16,
                overflow: 'hidden',
                backgroundColor: '#F3EDF7'
            }}
        >
            <Card
                mode="contained"
                style={{ borderRadius: 16, overflow: 'hidden', backgroundColor: 'transparent' }}
            >
                <Card.Content style={{ paddingVertical: 8 }}>
                    <Text
                        variant="titleMedium"
                        style={{ fontWeight: 'bold', marginBottom: 8 }}
                        numberOfLines={2}
                    >
                        {title}
                    </Text>

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
                        {item.favoriteCount > 0 && <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 24 }}>
                            <Icon source="star-outline" size={16} color="#49454F" />
                            <Text variant="labelMedium" style={{ marginLeft: 6, color: '#49454F' }}>
                                {item.favoriteCount}
                            </Text>
                        </View>}

                        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 24 }}>
                            <Icon source="comment-outline" size={16} color="#49454F" />
                            <Text variant="labelMedium" style={{ marginLeft: 6, color: '#49454F' }}>
                                {item.commentCount}
                            </Text>
                        </View>
                    </View>
                </Card.Content>
            </Card>
        </Pressable>
    );
};

const HomeScreen = ({ navigation }: any) => {
    const insets = useSafeAreaInsets();
    const contentStore = useContentStore();
    const userStore = useUserStore();
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
        loadData(true);
        loadData(false);
    }, []);


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
                renderItem={({ item }) => renderItem(item.item, item.feedType, false)} // 传入 needToGet 参数
                keyExtractor={(item) => item.item.id.toString()}
                refreshing={isRefreshing} // 绑定下拉圈圈的显示状态
                onRefresh={() => loadData(true)} // 触发下拉时执行的方法
                onEndReached={() => loadData(false)} // 列表滑动到底部时触发的方法
                onEndReachedThreshold={0.8} // 距离底部还有 50% 列表长度时，提前触发加载（实现无感）
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
}
export default HomeScreen;
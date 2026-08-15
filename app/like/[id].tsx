import { getApiInstance } from '@/src/api/ZhihuApi';
import LoadingView from '@/src/components/LoadingView';
import { useStoreHydrated } from '@/src/hooks/useStoreHydrated';
import { useUserStore } from '@/src/stores/useUserStore';
import type { FeedItem, FeedType } from '@/src/types/zhihu';
import { Icon, Text, TopAppBar } from '@/src/ui';
import { useTheme } from '@/src/ui/theme';
import { contentToItem, normalizeContent } from '@/src/db/mappers';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { RenderItem } from '../home';

const PAGE_SIZE = 20;

type CollectionFeedItem = {
    feedType: FeedType;
    item: FeedItem;
};

function normalizeCollectionItem(raw: any): CollectionFeedItem | null {
    const content = raw?.content ?? raw;
    const type = content?.type === 'answer' || content?.type === 'article' ? content.type : null;
    if (!type || !content?.id) return null;

    // 这是“我的收藏夹”，能够出现在这里就代表当前用户已经收藏。
    // 详情接口对回答有时不会返回收藏关系，因此把这个上下文带到详情页。
    const normalized = { ...normalizeContent(content, type), favorited: true };
    return {
        feedType: type,
        item: contentToItem(normalized),
    };
}

export default function CollectionItemsScreen() {
    const theme = useTheme();
    const router = useRouter();
    const { id: rawId, title: rawTitle } = useLocalSearchParams<{ id: string; title?: string }>();
    const collectionId = Array.isArray(rawId) ? rawId[0] : rawId;
    const collectionTitle = Array.isArray(rawTitle) ? rawTitle[0] : rawTitle;
    const hydrated = useStoreHydrated(useUserStore);
    const cookies = useUserStore((state) => state.cookies);
    const isLoggedIn = useUserStore((state) => state.isLoggedIn);

    const [items, setItems] = useState<CollectionFeedItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [error, setError] = useState('');
    const offsetRef = useRef(0);
    const inFlightRef = useRef(false);

    const fetchItems = useCallback(async (mode: 'refresh' | 'more' = 'refresh') => {
        if (!hydrated || !isLoggedIn || !cookies || !collectionId || inFlightRef.current) return;

        const isRefresh = mode === 'refresh';
        inFlightRef.current = true;
        if (isRefresh) {
            setLoading(true);
            setRefreshing(true);
            setError('');
        } else {
            setLoadingMore(true);
        }

        const nextOffset = isRefresh ? 0 : offsetRef.current + PAGE_SIZE;
        try {
            const response = await getApiInstance(cookies).getCollectionItems(collectionId, nextOffset, PAGE_SIZE);
            const rows = Array.isArray(response?.data) ? response.data : [];
            const nextItems = rows
                .map(normalizeCollectionItem)
                .filter((item: CollectionFeedItem | null): item is CollectionFeedItem => item !== null);

            setItems((current) => {
                if (isRefresh) return nextItems;
                const merged = [...current, ...nextItems];
                return merged.filter((item, index) => merged.findIndex((candidate) => (
                    candidate.feedType === item.feedType && candidate.item.id === item.item.id
                )) === index);
            });
            offsetRef.current = nextOffset;
            setHasMore(response?.paging?.is_end === false && rows.length > 0);
        } catch (collectionError) {
            console.error('获取收藏内容失败:', collectionError);
            if (isRefresh) setError('收藏内容加载失败，请稍后重试');
        } finally {
            inFlightRef.current = false;
            setLoading(false);
            setRefreshing(false);
            setLoadingMore(false);
        }
    }, [collectionId, cookies, hydrated, isLoggedIn]);

    useFocusEffect(
        useCallback(() => {
            void fetchItems('refresh');
        }, [fetchItems]),
    );

    const renderItem = ({ item }: { item: CollectionFeedItem }) => (
        <RenderItem item={item.item} type={item.feedType} needToGet={true} />
    );

    const emptyComponent = loading ? (
        <LoadingView />
    ) : error ? (
        <View style={{ alignItems: 'center', paddingTop: theme.spacing.xxl }}>
            <Icon name="alert-circle-outline" size={42} color={theme.colors.onSurfaceVariantActions} />
            <Text type="body1" color={theme.colors.onSurfaceVariantSummary} style={{ marginTop: theme.spacing.md }}>{error}</Text>
        </View>
    ) : (
        <View style={{ alignItems: 'center', paddingTop: theme.spacing.xxl }}>
            <Icon name="bookmark-outline" size={42} color={theme.colors.onSurfaceVariantActions} />
            <Text type="body1" color={theme.colors.onSurfaceVariantSummary} style={{ marginTop: theme.spacing.md }}>
                这个收藏夹还没有内容
            </Text>
        </View>
    );

    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
            <TopAppBar title={collectionTitle || '收藏内容'} back={() => router.back()} />

            {!hydrated ? (
                <LoadingView />
            ) : !isLoggedIn ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: theme.spacing.xxl }}>
                    <Text type="body1" color={theme.colors.onSurfaceVariantSummary} align="center">
                        登录后才能查看收藏内容
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={items}
                    keyExtractor={(item) => `${item.feedType}-${item.item.id}`}
                    renderItem={renderItem}
                    contentContainerStyle={{ padding: theme.spacing.lg, flexGrow: 1, paddingBottom: theme.spacing.xxl }}
                    onRefresh={() => void fetchItems('refresh')}
                    refreshing={refreshing}
                    onEndReached={() => {
                        if (hasMore && !loadingMore) void fetchItems('more');
                    }}
                    onEndReachedThreshold={0.35}
                    ListEmptyComponent={emptyComponent}
                    ListFooterComponent={loadingMore ? (
                        <View style={{ paddingVertical: theme.spacing.lg }}>
                            <LoadingView />
                        </View>
                    ) : null}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </View>
    );
}

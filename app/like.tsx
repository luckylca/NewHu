import { getApiInstance } from '@/src/api/ZhihuApi';
import LoadingView from '@/src/components/LoadingView';
import { useStoreHydrated } from '@/src/hooks/useStoreHydrated';
import { useUserStore } from '@/src/stores/useUserStore';
import { Button, Card, Icon, Text, TopAppBar } from '@/src/ui';
import { useTheme } from '@/src/ui/theme';
import { router } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

const PAGE_SIZE = 20;

type CollectionSummary = {
    id: string;
    title: string;
    description: string;
    itemCount: number;
    answerCount: number;
    followerCount: number;
    isPublic: boolean;
    isDefault: boolean;
    updatedTime: number;
};

function normalizeCollection(raw: any): CollectionSummary | null {
    const id = String(raw?.id ?? '');
    if (!id) return null;

    return {
        id,
        title: String(raw?.title ?? '未命名收藏夹'),
        description: String(raw?.description ?? '').trim(),
        itemCount: Number(raw?.item_count ?? raw?.answer_count ?? 0),
        answerCount: Number(raw?.answer_count ?? 0),
        followerCount: Number(raw?.follower_count ?? 0),
        isPublic: Boolean(raw?.is_public),
        isDefault: Boolean(raw?.is_default),
        updatedTime: Number(raw?.updated_time ?? 0),
    };
}

function formatUpdatedTime(timestamp: number) {
    if (!timestamp) return '暂无更新记录';
    return `更新于 ${new Date(timestamp * 1000).toLocaleDateString()}`;
}

export default function LikeScreen() {
    const theme = useTheme();
    const hydrated = useStoreHydrated(useUserStore);
    const cookies = useUserStore((state) => state.cookies);
    const username = useUserStore((state) => state.username);
    const isLoggedIn = useUserStore((state) => state.isLoggedIn);

    const [collections, setCollections] = useState<CollectionSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [error, setError] = useState('');
    const offsetRef = useRef(0);
    const inFlightRef = useRef(false);

    const fetchCollections = useCallback(async (mode: 'refresh' | 'more' = 'refresh') => {
        if (!hydrated || !isLoggedIn || !cookies || !username || inFlightRef.current) return;

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
            const response = await getApiInstance(cookies).getUserCollections(username, nextOffset, PAGE_SIZE);
            const rows = Array.isArray(response?.data) ? response.data : [];
            const nextCollections = rows
                .map(normalizeCollection)
                .filter((item: CollectionSummary | null): item is CollectionSummary => item !== null);

            setCollections((current) => {
                if (isRefresh) return nextCollections;
                const merged = [...current, ...nextCollections];
                return merged.filter((item, index) => merged.findIndex((candidate) => candidate.id === item.id) === index);
            });
            offsetRef.current = nextOffset;
            setHasMore(response?.paging?.is_end === false && rows.length > 0);
        } catch (collectionError) {
            console.error('获取收藏夹失败:', collectionError);
            if (isRefresh) setError('收藏夹加载失败，请稍后重试');
        } finally {
            inFlightRef.current = false;
            setLoading(false);
            setRefreshing(false);
            setLoadingMore(false);
        }
    }, [cookies, hydrated, isLoggedIn, username]);

    useFocusEffect(
        useCallback(() => {
            void fetchCollections('refresh');
        }, [fetchCollections]),
    );

    const renderCollection = ({ item }: { item: CollectionSummary }) => (
        <Card
            feedback="none"
            showIndication
            onPress={() => router.push({ pathname: '/like/[id]', params: { id: item.id, title: item.title } })}
            style={{ marginBottom: theme.spacing.md }}
            contentStyle={{ padding: theme.spacing.lg }}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                    style={{
                        width: 48,
                        height: 48,
                        borderRadius: theme.radius.tab,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: theme.colors.secondaryContainer,
                    }}
                >
                    <Icon
                        name={item.isDefault ? 'bookmark-multiple-outline' : 'folder-outline'}
                        size={26}
                        color={theme.colors.primary}
                    />
                </View>
                <View style={{ flex: 1, minWidth: 0, marginLeft: theme.spacing.md }}>
                    <Text type="title4" weight="bold" numberOfLines={1}>{item.title}</Text>
                    <Text type="body2" color={theme.colors.onSurfaceVariantSummary} numberOfLines={2} style={{ marginTop: theme.spacing.xs }}>
                        {item.description || `${item.itemCount} 条收藏内容`}
                    </Text>
                </View>
                <Icon name="chevron-right" size={24} color={theme.colors.onSurfaceVariantActions} />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: theme.spacing.md }}>
                <Text type="footnote1" color={theme.colors.onSurfaceVariantSummary}>
                    {item.itemCount} 条内容
                </Text>
                <Text type="footnote1" color={theme.colors.onSurfaceVariantSummary} style={{ marginHorizontal: theme.spacing.sm }}>
                    ·
                </Text>
                <Text type="footnote1" color={theme.colors.onSurfaceVariantSummary}>
                    {item.isPublic ? '公开' : '私密'}
                </Text>
                <Text type="footnote1" color={theme.colors.onSurfaceVariantSummary} style={{ flex: 1, textAlign: 'right' }}>
                    {formatUpdatedTime(item.updatedTime)}
                </Text>
            </View>
        </Card>
    );

    const emptyComponent = loading ? (
        <LoadingView />
    ) : error ? (
        <View style={{ alignItems: 'center', paddingTop: theme.spacing.xxl }}>
            <Icon name="alert-circle-outline" size={42} color={theme.colors.onSurfaceVariantActions} />
            <Text type="body1" color={theme.colors.onSurfaceVariantSummary} style={{ marginTop: theme.spacing.md }}>{error}</Text>
            <Button type="primary" onPress={() => void fetchCollections('refresh')} style={{ marginTop: theme.spacing.lg }}>
                重新加载
            </Button>
        </View>
    ) : (
        <View style={{ alignItems: 'center', paddingTop: theme.spacing.xxl }}>
            <Icon name="bookmark-multiple-outline" size={42} color={theme.colors.onSurfaceVariantActions} />
            <Text type="body1" color={theme.colors.onSurfaceVariantSummary} style={{ marginTop: theme.spacing.md }}>
                暂无收藏夹
            </Text>
        </View>
    );

    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
            <TopAppBar title="收藏列表" back={() => router.back()} />

            {!hydrated ? (
                <LoadingView />
            ) : !isLoggedIn ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: theme.spacing.xxl }}>
                    <Icon name="bookmark-multiple-outline" size={48} color={theme.colors.onSurfaceVariantActions} />
                    <Text type="body1" color={theme.colors.onSurfaceVariantSummary} align="center" style={{ marginTop: theme.spacing.md }}>
                        登录知乎后才能查看收藏列表
                    </Text>
                    <Button type="primary" onPress={() => router.push('/webview')} style={{ marginTop: theme.spacing.lg }}>
                        登录知乎
                    </Button>
                </View>
            ) : (
                <FlatList
                    data={collections}
                    keyExtractor={(item) => item.id}
                    renderItem={renderCollection}
                    contentContainerStyle={{ padding: theme.spacing.lg, flexGrow: 1, paddingBottom: theme.spacing.xxl }}
                    onRefresh={() => void fetchCollections('refresh')}
                    refreshing={refreshing}
                    onEndReached={() => {
                        if (hasMore && !loadingMore) void fetchCollections('more');
                    }}
                    onEndReachedThreshold={0.4}
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

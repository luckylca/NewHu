import { fetchGuestRecommendPage } from '@/src/services/guestBrowseService';
import { Button, Card, PageFlatList, PageScaffold, SearchBar, Text } from '@/src/ui';
import { useContentStore } from '@/src/stores/useContentStore';
import type { FeedItemInfo } from '@/src/types/zhihu';
import { useTheme } from '@/src/ui/theme';
import { router } from 'expo-router';
import React from 'react';
import { ActivityIndicator, RefreshControl, View } from 'react-native';
import { MAIN_PAGE_TOP_SPACING, useMainTabBottomContentInset } from '@/src/components/MainTabLayout';

function feedKey(item: FeedItemInfo) {
    return `${item.feedType}:${item.item.id}`;
}

function titleFor(item: FeedItemInfo) {
    return item.feedType === 'answer' ? (item.item.questionTitle || item.item.title) : item.item.title;
}

function GuestFeedCard({ item, open }: { item: FeedItemInfo; open: (item: FeedItemInfo) => void }) {
    const theme = useTheme();
    const typeLabel = item.feedType === 'answer' ? '回答' : item.feedType === 'article' ? '文章' : '问题';
    return (
        <Card
            feedback="none"
            showIndication
            glassVariant="preferencePanel"
            onPress={() => open(item)}
            style={{ width: '100%', marginBottom: theme.spacing.md }}
            contentStyle={{ backgroundColor: theme.colors.surfaceContainer, padding: theme.spacing.lg }}
        >
            <Text type="footnote1" weight="medium" color={theme.colors.primary} style={{ marginBottom: theme.spacing.xs }}>
                知乎 Android 推荐 · {typeLabel}
            </Text>
            <Text type="headline1" weight="bold" color={theme.colors.onSurface} numberOfLines={3}>
                {titleFor(item) || '无标题'}
            </Text>
            {item.item.excerpt ? (
                <Text type="body2" color={theme.colors.onSurfaceVariantSummary} numberOfLines={6} style={{ marginTop: theme.spacing.sm, lineHeight: 22 }}>
                    {item.item.excerpt}
                </Text>
            ) : null}
            <Text type="footnote1" color={theme.colors.onSurfaceVariantSummary} style={{ marginTop: theme.spacing.md }}>
                {item.item.authorName || '匿名用户'} · {item.item.voteCount.toLocaleString()} 赞同 · {item.item.commentCount.toLocaleString()} 条评论
            </Text>
        </Card>
    );
}

export default function GuestHomeFeed({ active = true }: { active?: boolean }) {
    const theme = useTheme();
    const bottomContentInset = useMainTabBottomContentInset();
    const [items, setItems] = React.useState<FeedItemInfo[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);
    const [loadingMore, setLoadingMore] = React.useState(false);
    const [hasMore, setHasMore] = React.useState(true);
    const [error, setError] = React.useState('');
    const itemsRef = React.useRef<FeedItemInfo[]>([]);
    const nextCursorRef = React.useRef('');
    const hasMoreRef = React.useRef(true);
    const requestInFlightRef = React.useRef(false);

    const load = React.useCallback(async (isRefresh = false) => {
        if (requestInFlightRef.current || (!isRefresh && !hasMoreRef.current)) return;
        requestInFlightRef.current = true;
        if (isRefresh) setRefreshing(true);
        else if (itemsRef.current.length) setLoadingMore(true);
        else setLoading(true);
        const cursor = isRefresh ? '' : nextCursorRef.current;
        try {
            const page = await fetchGuestRecommendPage(cursor);
            const base = isRefresh ? [] : itemsRef.current;
            const seen = new Set(base.map(feedKey));
            const appended = page.items.filter((item) => {
                const key = feedKey(item);
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
            const nextItems = [...base, ...appended];
            itemsRef.current = nextItems;
            nextCursorRef.current = page.nextCursor;
            hasMoreRef.current = Boolean(page.nextCursor) && !page.isEnd;
            setItems(nextItems);
            setHasMore(hasMoreRef.current);
            setError('');
            useContentStore.getState().setFeedList(nextItems);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Android 推荐暂时不可用，请稍后重试');
        } finally {
            requestInFlightRef.current = false;
            setLoading(false);
            setRefreshing(false);
            setLoadingMore(false);
        }
    }, []);

    React.useEffect(() => {
        void load(true);
    }, [load]);

    const openItem = React.useCallback((feed: FeedItemInfo) => {
        if (feed.feedType === 'question') {
            router.push({
                pathname: '/question',
                params: {
                    id: feed.item.questionId || feed.item.id,
                    title: feed.item.title,
                    excerpt: feed.item.excerpt,
                    authorName: feed.item.authorName,
                    authorAvatar: feed.item.authorAvatar,
                    answerCount: String(feed.item.questionAnswerCount),
                    followerCount: '0',
                    commentCount: String(feed.item.commentCount),
                    createdAt: String(feed.item.updatedTime),
                },
            });
            return;
        }
        router.push({
            pathname: '/item/[type]/[id]',
            params: { id: feed.item.id, type: feed.feedType, needToGet: 'false', initialFavorited: 'false' },
        });
    }, []);

    const searchAccessory = (
        <SearchBar
            label="搜索本机离线内容"
            onPress={() => router.push('/search')}
            glassRenderMode={active ? 'backdrop' : 'local'}
            inputProps={{ editable: false, showSoftInputOnFocus: false }}
            style={{ height: theme.components.searchBar.minHeight }}
        />
    );

    return (
        <PageScaffold
            searchAccessory={searchAccessory}
            searchAccessoryTopSpacing={MAIN_PAGE_TOP_SPACING}
            searchAccessoryBottomSpacing={theme.spacing.sm}
        >
            <PageFlatList
                data={items}
                keyExtractor={feedKey}
                renderItem={({ item }) => <GuestFeedCard item={item} open={openItem} />}
                contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl + bottomContentInset, flexGrow: 1 }}
                showsVerticalScrollIndicator={false}
                onEndReached={() => { void load(false); }}
                onEndReachedThreshold={0.65}
                refreshControl={(
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => { void load(true); }}
                        tintColor={theme.colors.primary}
                    />
                )}
                ListHeaderComponent={(
                    <View style={{ paddingTop: theme.spacing.md, paddingBottom: theme.spacing.md }}>
                        <Text type="title2" weight="bold" color={theme.colors.onSurface}>知乎推荐</Text>
                        <Text type="footnote1" color={theme.colors.onSurfaceVariantSummary} style={{ marginTop: theme.spacing.xs }}>
                            游客模式 · 使用不带 Cookie 的 Android 推荐接口
                        </Text>
                    </View>
                )}
                ListEmptyComponent={(
                    <View style={{ flex: 1, minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md }}>
                        {loading ? <ActivityIndicator color={theme.colors.primary} /> : null}
                        <Text type="body2" color={theme.colors.onSurfaceVariantSummary} align="center">
                            {error || (loading ? '正在加载 Android 推荐…' : '暂时没有公开推荐内容')}
                        </Text>
                        {!loading && error ? <Button type="default" onPress={() => void load(true)}>重试</Button> : null}
                    </View>
                )}
                ListFooterComponent={(
                    <View style={{ paddingVertical: theme.spacing.lg, alignItems: 'center' }}>
                        {loadingMore ? <ActivityIndicator color={theme.colors.primary} /> : null}
                        {!loadingMore && items.length > 0 ? (
                            <Text type="footnote2" color={theme.colors.onSurfaceVariantSummary} align="center">
                                {hasMore ? '继续下滑加载推荐' : '已显示当前可用的推荐内容'}
                            </Text>
                        ) : null}
                    </View>
                )}
            />
        </PageScaffold>
    );
}

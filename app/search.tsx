import { getApiInstance, search } from '@/src/api/ZhihuApi';
import { useStoreHydrated } from '@/src/hooks/useStoreHydrated';
import { useUserStore } from '@/src/stores/useUserStore';
import { notify } from '@/src/stores/useNotificationStore';
import { Card, Icon, SearchBar, Text } from '@/src/ui';
import { useTheme } from '@/src/ui/theme';
import type { FeedType } from '@/src/types/zhihu';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Keyboard, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type SearchResult = {
    id: string;
    type: FeedType;
    title: string;
    excerpt: string;
    author: string;
    voteCount: number;
    commentCount: number;
};

const PAGE_SIZE = 20;

function plainText(value: unknown) {
    return String(value ?? '')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim();
}

function normalizeResult(raw: any): SearchResult | null {
    const object = raw?.object ?? raw;
    const type = object?.type;
    if (type !== 'answer' && type !== 'article') return null;

    const title = type === 'answer'
        ? object.question?.title ?? raw?.highlight?.title
        : object.title ?? raw?.highlight?.title;

    return {
        id: String(object.id),
        type,
        title: plainText(title) || '无标题',
        excerpt: plainText(object.excerpt ?? raw?.highlight?.description ?? raw?.highlight?.content),
        author: plainText(object.author?.name) || '匿名用户',
        voteCount: Number(object.voteup_count || 0),
        commentCount: Number(object.comment_count || 0),
    };
}

export default function SearchScreen() {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const cookies = useUserStore((state) => state.cookies);
    const hydrated = useStoreHydrated(useUserStore);

    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState('');
    const [hasMore, setHasMore] = useState(false);

    const offsetRef = useRef(0);
    const requestIdRef = useRef(0);
    const loadingMoreRef = useRef(false);

    useEffect(() => {
        if (hydrated && cookies) getApiInstance(cookies);
    }, [cookies, hydrated]);

    const runSearch = useCallback(async (keyword: string, loadMore = false) => {
        const trimmed = keyword.trim();
        if (!trimmed || (loadMore && loadingMoreRef.current)) return;
        if (!cookies) {
            setError('登录后才能使用搜索');
            notify('请先登录知乎账号');
            return;
        }
        if (loadMore) loadingMoreRef.current = true;
        const requestId = ++requestIdRef.current;
        const offset = loadMore ? offsetRef.current : 0;
        if (loadMore) setLoadingMore(true);
        else {
            setLoading(true);
            setResults([]);
            setHasMore(false);
            setError('');
        }

        try {
            const response = await search(trimmed, offset);
            const rows = Array.isArray(response?.data) ? response.data : [];
            const next = rows.map(normalizeResult).filter((item: SearchResult | null): item is SearchResult => item !== null);

            if (requestId !== requestIdRef.current) return;
            setResults((current) => {
                if (!loadMore) return next;
                const merged = [...current, ...next];
                return merged.filter((item, index) => merged.findIndex((candidate) => candidate.id === item.id && candidate.type === item.type) === index);
            });
            offsetRef.current = offset + rows.length;
            setHasMore(response?.paging ? response.paging.is_end === false : rows.length >= PAGE_SIZE);
        } catch (searchError) {
            if (requestId === requestIdRef.current) {
                console.error('搜索失败:', searchError);
                setError('搜索失败，请稍后重试');
                notify('搜索失败，请检查网络后重试');
            }
        } finally {
            if (loadMore) loadingMoreRef.current = false;
            if (requestId === requestIdRef.current) {
                setLoading(false);
                setLoadingMore(false);
            }
        }
    }, [cookies]);

    useEffect(() => {
        const trimmed = query.trim();
        if (!trimmed) {
            requestIdRef.current += 1;
            offsetRef.current = 0;
            setResults([]);
            setError('');
            setHasMore(false);
            return;
        }

        const timer = setTimeout(() => runSearch(trimmed), 350);
        return () => clearTimeout(timer);
    }, [query, runSearch]);

    const renderResult = ({ item }: { item: SearchResult }) => (
        <Card
            feedback="none"
            showIndication
            onPressIn={() => router.prefetch({
                pathname: '/item/[type]/[id]',
                params: { type: item.type, id: item.id, needToGet: 'true' },
            })}
            onPress={() => router.push({
                pathname: '/item/[type]/[id]',
                params: { type: item.type, id: item.id, needToGet: 'true' },
            })}
            style={{ marginBottom: theme.spacing.md }}
            contentStyle={{ padding: theme.spacing.lg, backgroundColor: theme.colors.surfaceContainer }}
        >
            <Text type="headline1" weight="bold" numberOfLines={2}>{item.title}</Text>
            {item.excerpt ? (
                <Text type="body2" color={theme.colors.onSurfaceVariantSummary} numberOfLines={3} style={{ marginTop: theme.spacing.sm }}>
                    {item.excerpt}
                </Text>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: theme.spacing.md }}>
                <Text type="footnote1" color={theme.colors.onSurfaceVariantSummary} numberOfLines={1} style={{ flex: 1 }}>
                    {item.author}
                </Text>
                <Icon name="thumb-up-outline" size={16} color={theme.colors.onSurfaceVariantSummary} />
                <Text type="footnote1" color={theme.colors.onSurfaceVariantSummary} style={{ marginLeft: 4, marginRight: 14 }}>
                    {item.voteCount}
                </Text>
                <Icon name="comment-outline" size={16} color={theme.colors.onSurfaceVariantSummary} />
                <Text type="footnote1" color={theme.colors.onSurfaceVariantSummary} style={{ marginLeft: 4 }}>
                    {item.commentCount}
                </Text>
            </View>
        </Card>
    );

    const emptyMessage = error || (query.trim() ? '没有找到相关内容' : '输入关键词搜索回答和文章');

    return (
        <View style={{ flex: 1, paddingTop: insets.top + theme.spacing.sm, backgroundColor: theme.colors.surface }}>
            <SearchBar
                value={query}
                onChangeText={setQuery}
                onSearch={() => Keyboard.dismiss()}
                expanded
                onExpandedChange={(expanded) => {
                    if (!expanded) router.back();
                }}
                label="搜索知乎内容"
                cancelText="取消"
                inputProps={{ autoFocus: true }}
                style={{ marginBottom: 4 }}
            />

            <FlatList
                data={results}
                renderItem={renderResult}
                keyExtractor={(item) => `${item.type}-${item.id}`}
                contentContainerStyle={{ flexGrow: 1, paddingHorizontal: theme.spacing.lg, paddingBottom: insets.bottom + theme.spacing.lg }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                onEndReached={() => {
                    if (hasMore && !loadingMore) runSearch(query, true);
                }}
                onEndReachedThreshold={0.35}
                ListEmptyComponent={
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: theme.spacing.xxl }}>
                        {loading ? (
                            <ActivityIndicator size="large" color={theme.colors.primary} />
                        ) : (
                            <>
                                <Icon name={error ? 'alert-circle-outline' : 'magnify'} size={34} color={theme.colors.onSurfaceVariantActions} />
                                <Text type="body1" color={theme.colors.onSurfaceVariantSummary} align="center" style={{ marginTop: theme.spacing.md }}>
                                    {emptyMessage}
                                </Text>
                            </>
                        )}
                    </View>
                }
                ListFooterComponent={loadingMore ? (
                    <ActivityIndicator style={{ paddingVertical: theme.spacing.lg }} color={theme.colors.primary} />
                ) : null}
            />
        </View>
    );
}

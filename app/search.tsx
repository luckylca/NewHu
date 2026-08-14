import {
    getApiInstance,
    getSearchCustomize,
    getSearchSuggestions,
    search,
    streamSearchAi,
} from '@/src/api/ZhihuApi';
import { useStoreHydrated } from '@/src/hooks/useStoreHydrated';
import { useUserStore } from '@/src/stores/useUserStore';
import { notify } from '@/src/stores/useNotificationStore';
import { Card, Icon, SearchBar, Text } from '@/src/ui';
import { useTheme } from '@/src/ui/theme';
import type { FeedType } from '@/src/types/zhihu';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Keyboard, Pressable, ScrollView, View } from 'react-native';
import MiuixProgressIndicator from '@/src/components/MiuixProgressIndicator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type SearchMode = 'general' | 'answer' | 'article' | 'people' | 'ai';

type ContentSearchResult = {
    kind: 'content';
    id: string;
    type: FeedType;
    title: string;
    excerpt: string;
    author: string;
    voteCount: number;
    commentCount: number;
};

type PeopleSearchResult = {
    kind: 'person';
    id: string;
    type: 'people';
    name: string;
    headline: string;
    urlToken: string;
    avatarUrl: string;
    followerCount: number;
};

type SearchResult = ContentSearchResult | PeopleSearchResult;

type FilterOption = {
    label: string;
    value: string;
};

const PAGE_SIZE = 20;

const MODE_OPTIONS: { label: string; value: SearchMode }[] = [
    { label: '综合', value: 'general' },
    { label: '回答', value: 'answer' },
    { label: '文章', value: 'article' },
    { label: '用户', value: 'people' },
    { label: '知乎 AI', value: 'ai' },
];

const DEFAULT_SORT_OPTIONS: FilterOption[] = [
    { label: '综合排序', value: '' },
    { label: '最多赞同', value: 'upvoted_count' },
    { label: '最新发布', value: 'created_time' },
];

const DEFAULT_TIME_OPTIONS: FilterOption[] = [
    { label: '不限时间', value: '' },
    { label: '一天内', value: 'a_day' },
    { label: '一周内', value: 'a_week' },
    { label: '一月内', value: 'a_month' },
    { label: '三月内', value: 'three_months' },
    { label: '半年内', value: 'half_a_year' },
    { label: '一年内', value: 'a_year' },
];

function plainText(value: unknown) {
    return String(value ?? '')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'")
        .trim();
}

function normalizeResult(raw: any, mode: SearchMode): SearchResult | null {
    const object = raw?.object ?? raw;

    if (mode === 'people') {
        const urlToken = String(object?.url_token ?? object?.urlToken ?? '');
        const id = String(object?.id ?? urlToken);
        if (!urlToken || !id) return null;

        return {
            kind: 'person',
            id,
            type: 'people',
            name: plainText(object?.name) || '匿名用户',
            headline: plainText(object?.headline ?? object?.description),
            urlToken,
            avatarUrl: String(object?.avatar_url ?? ''),
            followerCount: Number(object?.follower_count ?? 0),
        };
    }

    const objectType = object?.type;
    const type = objectType === 'answer' || objectType === 'article' ? objectType : mode === 'answer' || mode === 'article' ? mode : null;
    if (!type) return null;

    const title = type === 'answer'
        ? object?.question?.title ?? raw?.highlight?.title
        : object?.title ?? raw?.highlight?.title;

    const id = String(object?.id ?? raw?.id ?? '');
    if (!id) return null;

    return {
        kind: 'content',
        id,
        type,
        title: plainText(title) || '无标题',
        excerpt: plainText(object?.excerpt ?? raw?.highlight?.description ?? raw?.highlight?.content),
        author: plainText(object?.author?.name) || '匿名用户',
        voteCount: Number(object?.voteup_count || 0),
        commentCount: Number(object?.comment_count || 0),
    };
}

function normalizeSuggestions(response: any): string[] {
    const suggestions = Array.isArray(response?.suggest) ? response.suggest : [];
    return suggestions
        .map((item: any) => typeof item === 'string' ? item : item?.query)
        .map((item: unknown) => plainText(item))
        .filter(Boolean)
        .filter((item: string, index: number, all: string[]) => all.indexOf(item) === index)
        .slice(0, 8);
}

function normalizeFilterOptions(response: any, group: string, fallback: FilterOption[]): FilterOption[] {
    const groups = Array.isArray(response?.data) ? response.data : [];
    const values = groups
        .flatMap((items: any[]) => Array.isArray(items) ? items : [])
        .filter((item: any) => item?.group === group)
        .map((item: any) => ({ label: plainText(item.title), value: String(item.link_name ?? '') }))
        .filter((item: FilterOption) => item.label);

    return values.length > 0 ? values : fallback;
}

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
    const theme = useTheme();

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={onPress}
            style={{
                minHeight: 34,
                paddingHorizontal: theme.spacing.md,
                borderRadius: 17,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: selected ? theme.colors.primary : theme.colors.secondaryVariant,
            }}
        >
            <Text type="footnote1" weight={selected ? 'bold' : 'medium'} color={selected ? theme.colors.onPrimary : theme.colors.onSecondaryVariant}>
                {label}
            </Text>
        </Pressable>
    );
}

export default function SearchScreen() {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const cookies = useUserStore((state) => state.cookies);
    const hydrated = useStoreHydrated(useUserStore);

    const [query, setQuery] = useState('');
    const [submittedQuery, setSubmittedQuery] = useState('');
    const [mode, setMode] = useState<SearchMode>('general');
    const [sort, setSort] = useState('');
    const [timeInterval, setTimeInterval] = useState('');
    const [sortOptions, setSortOptions] = useState(DEFAULT_SORT_OPTIONS);
    const [timeOptions, setTimeOptions] = useState(DEFAULT_TIME_OPTIONS);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [results, setResults] = useState<SearchResult[]>([]);
    const [aiAnswer, setAiAnswer] = useState('');
    const [loading, setLoading] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState('');
    const [aiError, setAiError] = useState('');
    const [hasMore, setHasMore] = useState(false);
    const [showScrollTop, setShowScrollTop] = useState(false);

    const offsetRef = useRef(0);
    const requestIdRef = useRef(0);
    const aiRequestIdRef = useRef(0);
    const suggestionRequestIdRef = useRef(0);
    const loadingMoreRef = useRef(false);
    const listRef = useRef<FlatList<SearchResult>>(null);

    useEffect(() => {
        if (hydrated && cookies) getApiInstance(cookies);
    }, [cookies, hydrated]);

    const runSearch = useCallback(async (
        keyword: string,
        loadMore = false,
        nextMode: SearchMode = mode,
        nextSort = sort,
        nextTimeInterval = timeInterval,
    ) => {
        const trimmed = keyword.trim();
        if (!trimmed || nextMode === 'ai' || (loadMore && loadingMoreRef.current)) return;
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
            const response = await search(trimmed, offset, nextMode === 'people' ? 'people' : 'general', {
                vertical: nextMode === 'answer' || nextMode === 'article' ? nextMode : undefined,
                sort: nextMode === 'people' ? undefined : nextSort,
                timeInterval: nextMode === 'people' ? undefined : nextTimeInterval,
            });
            const rows = Array.isArray(response?.data) ? response.data : [];
            const next = rows
                .map((row: any) => normalizeResult(row, nextMode))
                .filter((item: SearchResult | null): item is SearchResult => item !== null);

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
    }, [cookies, mode, sort, timeInterval]);

    const runAiSearch = useCallback(async (keyword: string) => {
        const trimmed = keyword.trim();
        if (!trimmed) return;
        if (!cookies) {
            setAiError('登录后才能使用知乎 AI');
            notify('请先登录知乎账号');
            return;
        }

        const requestId = ++aiRequestIdRef.current;
        setAiAnswer('');
        setAiError('');
        setAiLoading(true);
        let receivedAnswer = false;

        try {
            await streamSearchAi(trimmed, (chunk) => {
                if (requestId !== aiRequestIdRef.current) return;
                receivedAnswer = true;
                setAiAnswer((current) => current + chunk);
            });
            if (requestId === aiRequestIdRef.current && !receivedAnswer) setAiError('知乎 AI 暂时没有返回内容');
        } catch (aiSearchError) {
            if (requestId === aiRequestIdRef.current) {
                console.error('知乎 AI 搜索失败:', aiSearchError);
                setAiError('知乎 AI 暂时不可用，请稍后重试');
            }
        } finally {
            if (requestId === aiRequestIdRef.current) setAiLoading(false);
        }
    }, [cookies]);

    const submitSearch = useCallback((value: string) => {
        const trimmed = value.trim();
        if (!trimmed) return;
        setQuery(trimmed);
        setSubmittedQuery(trimmed);
        setSuggestions([]);
        Keyboard.dismiss();
        if (mode === 'ai') void runAiSearch(trimmed);
        else void runSearch(trimmed, false, mode, sort, timeInterval);
    }, [mode, runAiSearch, runSearch, sort, timeInterval]);

    useEffect(() => {
        const trimmed = query.trim();
        if (!trimmed || trimmed === submittedQuery || !cookies) {
            setSuggestions([]);
            return;
        }

        const requestId = ++suggestionRequestIdRef.current;
        const timer = setTimeout(() => {
            void Promise.allSettled([getSearchSuggestions(trimmed), getSearchCustomize(trimmed)]).then(([suggestionResult, customizeResult]) => {
                if (requestId !== suggestionRequestIdRef.current) return;
                if (suggestionResult.status === 'fulfilled') setSuggestions(normalizeSuggestions(suggestionResult.value));
                if (customizeResult.status === 'fulfilled') {
                    setSortOptions(normalizeFilterOptions(customizeResult.value, 'sort', DEFAULT_SORT_OPTIONS));
                    setTimeOptions(normalizeFilterOptions(customizeResult.value, 'time_interval', DEFAULT_TIME_OPTIONS));
                }
            });
        }, 220);

        return () => clearTimeout(timer);
    }, [cookies, query, submittedQuery]);

    const handleQueryChange = useCallback((value: string) => {
        setQuery(value);
        if (value.trim() !== submittedQuery) {
            requestIdRef.current += 1;
            aiRequestIdRef.current += 1;
            loadingMoreRef.current = false;
            setResults([]);
            setAiAnswer('');
            setLoading(false);
            setLoadingMore(false);
            setError('');
            setAiError('');
        }
        if (!value.trim()) {
            setSubmittedQuery('');
            setHasMore(false);
        }
    }, [submittedQuery]);

    const handleModeSelect = useCallback((nextMode: SearchMode) => {
        requestIdRef.current += 1;
        setMode(nextMode);
        setResults([]);
        setError('');
        setAiError('');
        if (nextMode !== 'ai') {
            aiRequestIdRef.current += 1;
            setAiLoading(false);
        }
        if (!submittedQuery) return;
        if (nextMode === 'ai') void runAiSearch(submittedQuery);
        else void runSearch(submittedQuery, false, nextMode, sort, timeInterval);
    }, [runAiSearch, runSearch, sort, submittedQuery, timeInterval]);

    const handleSortSelect = useCallback((value: string) => {
        setSort(value);
        if (submittedQuery && mode !== 'people' && mode !== 'ai') {
            void runSearch(submittedQuery, false, mode, value, timeInterval);
        }
    }, [mode, runSearch, submittedQuery, timeInterval]);

    const handleTimeSelect = useCallback((value: string) => {
        setTimeInterval(value);
        if (submittedQuery && mode !== 'people' && mode !== 'ai') {
            void runSearch(submittedQuery, false, mode, sort, value);
        }
    }, [mode, runSearch, sort, submittedQuery]);

    const renderResult = ({ item }: { item: SearchResult }) => {
        if (item.kind === 'person') {
            return (
                <Card
                    feedback="none"
                    showIndication
                    onPress={() => router.push({ pathname: '/people', params: { urlToken: item.urlToken } })}
                    style={{ marginBottom: theme.spacing.md }}
                    contentStyle={{ padding: theme.spacing.lg, backgroundColor: theme.colors.surfaceContainer }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {item.avatarUrl ? (
                            <Image source={{ uri: item.avatarUrl }} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.secondaryVariant }} />
                        ) : (
                            <Icon name="account-circle-outline" size={48} color={theme.colors.onSurfaceVariantActions} />
                        )}
                        <View style={{ flex: 1, minWidth: 0, marginLeft: theme.spacing.md }}>
                            <Text type="title4" weight="bold" numberOfLines={1}>{item.name}</Text>
                            {item.headline ? (
                                <Text type="body2" color={theme.colors.onSurfaceVariantSummary} numberOfLines={2} style={{ marginTop: theme.spacing.xs }}>
                                    {item.headline}
                                </Text>
                            ) : null}
                            <Text type="footnote1" color={theme.colors.onSurfaceVariantSummary} style={{ marginTop: theme.spacing.xs }}>
                                {item.followerCount} 位关注者
                            </Text>
                        </View>
                        <Icon name="chevron-right" size={22} color={theme.colors.onSurfaceVariantActions} />
                    </View>
                </Card>
            );
        }

        return (
            <Card
                feedback="none"
                showIndication
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
    };

    const renderAiEmpty = () => (
        <View style={{ flex: 1, paddingTop: theme.spacing.xl }}>
            {submittedQuery ? (
                <Card feedback="none" contentStyle={{ padding: theme.spacing.lg, backgroundColor: theme.colors.surfaceContainer }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Icon name="creation" size={22} color={theme.colors.primary} />
                        <Text type="title4" weight="bold" style={{ marginLeft: theme.spacing.sm }}>知乎 AI</Text>
                    </View>
                    {aiLoading && !aiAnswer ? (
                        <View style={{ paddingVertical: theme.spacing.xl, alignItems: 'center' }}>
                            <View style={{ width: 140 }}><MiuixProgressIndicator indeterminate /></View>
                            <Text type="body2" color={theme.colors.onSurfaceVariantSummary} style={{ marginTop: theme.spacing.md }}>
                                正在整理知乎内容…
                            </Text>
                        </View>
                    ) : aiAnswer ? (
                        <Text type="body1" style={{ marginTop: theme.spacing.md }}>{aiAnswer}</Text>
                    ) : (
                        <Text type="body2" color={theme.colors.onSurfaceVariantSummary} style={{ marginTop: theme.spacing.md }}>
                            {aiError || '暂时没有回答内容'}
                        </Text>
                    )}
                    {aiLoading && aiAnswer ? <View style={{ width: 120, marginTop: theme.spacing.md }}><MiuixProgressIndicator indeterminate height={3} /></View> : null}
                </Card>
            ) : (
                <View style={{ alignItems: 'center', paddingHorizontal: theme.spacing.xxl }}>
                    <Icon name="creation-outline" size={34} color={theme.colors.onSurfaceVariantActions} />
                    <Text type="body1" color={theme.colors.onSurfaceVariantSummary} align="center" style={{ marginTop: theme.spacing.md }}>
                        输入问题后点击“搜索”，让知乎 AI 帮你整理答案
                    </Text>
                </View>
            )}
        </View>
    );

    const hasSubmittedSearch = Boolean(submittedQuery && query.trim() === submittedQuery);
    const showSuggestions = Boolean(query.trim() && !hasSubmittedSearch && suggestions.length > 0);
    const emptyMessage = error || (submittedQuery ? '没有找到相关内容' : '输入关键词搜索回答、文章和用户');

    const renderListHeader = () => (
        <View style={{ paddingBottom: theme.spacing.sm }}>
            {hasSubmittedSearch ? (
                <>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.spacing.sm }}>
                        {MODE_OPTIONS.map((item) => (
                            <FilterChip key={item.value} label={item.label} selected={mode === item.value} onPress={() => handleModeSelect(item.value)} />
                        ))}
                    </ScrollView>
                    {mode !== 'people' && mode !== 'ai' ? (
                        <>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.spacing.sm, paddingTop: theme.spacing.sm }}>
                                {sortOptions.map((item) => (
                                    <FilterChip key={`sort-${item.value || 'default'}`} label={item.label} selected={sort === item.value} onPress={() => handleSortSelect(item.value)} />
                                ))}
                            </ScrollView>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.spacing.sm, paddingTop: theme.spacing.sm }}>
                                {timeOptions.map((item) => (
                                    <FilterChip key={`time-${item.value || 'default'}`} label={item.label} selected={timeInterval === item.value} onPress={() => handleTimeSelect(item.value)} />
                                ))}
                            </ScrollView>
                        </>
                    ) : null}
                </>
            ) : null}

            {showSuggestions ? (
                <View style={{ width: '100%', marginTop: hasSubmittedSearch ? theme.spacing.sm : 0, padding: theme.spacing.sm, borderRadius: theme.radius.component, backgroundColor: theme.colors.surfaceContainer }}>
                    <Text type="footnote1" color={theme.colors.onSurfaceVariantSummary} style={{ paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.xs }}>
                        搜索建议
                    </Text>
                    {suggestions.map((suggestion) => (
                        <Pressable
                            key={suggestion}
                            onPress={() => submitSearch(suggestion)}
                            style={{ minHeight: 38, flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.sm }}
                        >
                            <Icon name="magnify" size={18} color={theme.colors.onSurfaceVariantActions} />
                            <Text type="body2" numberOfLines={1} style={{ flex: 1, marginLeft: theme.spacing.sm }}>{suggestion}</Text>
                            <Icon name="arrow-top-left" size={18} color={theme.colors.onSurfaceVariantActions} />
                        </Pressable>
                    ))}
                </View>
            ) : null}
        </View>
    );

    const emptyComponent = mode === 'ai' ? renderAiEmpty() : query.trim() && !hasSubmittedSearch ? null : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: theme.spacing.xxl }}>
            {loading ? (
                <View style={{ width: 150 }}><MiuixProgressIndicator indeterminate /></View>
            ) : (
                <>
                    <Icon name={error ? 'alert-circle-outline' : 'magnify'} size={34} color={theme.colors.onSurfaceVariantActions} />
                    <Text type="body1" color={theme.colors.onSurfaceVariantSummary} align="center" style={{ marginTop: theme.spacing.md }}>
                        {emptyMessage}
                    </Text>
                </>
            )}
        </View>
    );

    return (
        <View style={{ flex: 1, paddingTop: insets.top + theme.spacing.sm, backgroundColor: theme.colors.surface }}>
            <SearchBar
                value={query}
                onChangeText={handleQueryChange}
                onSearch={submitSearch}
                onAction={() => submitSearch(query)}
                actionText="搜索"
                expanded
                onExpandedChange={(expanded) => {
                    if (!expanded) router.back();
                }}
                label="搜索知乎内容"
                inputProps={{ autoFocus: true }}
                horizontalPadding={theme.spacing.sm}
                actionWidth={64}
                actionPaddingHorizontal={theme.spacing.sm}
                style={{ marginBottom: theme.spacing.sm }}
            />

            <FlatList
                ref={listRef}
                data={mode === 'ai' ? [] : results}
                renderItem={renderResult}
                keyExtractor={(item) => `${item.type}-${item.id}`}
                ListHeaderComponent={renderListHeader}
                contentContainerStyle={{ flexGrow: 1, paddingHorizontal: theme.spacing.sm, paddingBottom: insets.bottom + theme.spacing.lg }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                onScroll={(event) => setShowScrollTop(event.nativeEvent.contentOffset.y > 240)}
                scrollEventThrottle={16}
                onEndReached={() => {
                    if (mode !== 'ai' && hasMore && !loadingMore) void runSearch(submittedQuery, true);
                }}
                onEndReachedThreshold={0.35}
                ListEmptyComponent={emptyComponent}
                ListFooterComponent={loadingMore ? (
                    <View style={{ paddingVertical: theme.spacing.lg, paddingHorizontal: theme.spacing.xxl }}><MiuixProgressIndicator indeterminate height={4} /></View>
                ) : null}
            />

            {showScrollTop ? (
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="回到顶部"
                    onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
                    style={{
                        position: 'absolute',
                        right: theme.spacing.xxl,
                        bottom: insets.bottom + theme.spacing.xxl,
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: theme.colors.primary,
                        elevation: 4,
                        zIndex: 10,
                        shadowColor: '#000000',
                        shadowOpacity: 0.16,
                        shadowRadius: 8,
                        shadowOffset: { width: 0, height: 3 },
                    }}
                >
                    <Icon name="arrow-up" size={22} color={theme.colors.onPrimary} />
                </Pressable>
            ) : null}
        </View>
    );
}

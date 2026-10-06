import { getApiInstance, getRecommend, dislikeAnswer, dislikeArticle } from '@/src/api/ZhihuApi'; // 注入对应的不喜欢 API
import { getRecommendSessionToken, normalizeRecommendItem } from '@/src/services/recommendFeedService';
import { fetchAndroidRecommendPage } from '@/src/services/androidRecommendService';
import { fetchRecommendationSourcePage } from '@/src/services/candidateSourceService';
import { useContentStore } from '@/src/stores/useContentStore';
import { useUserStore } from '@/src/stores/useUserStore';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, FlatList, NativeScrollEvent, NativeSyntheticEvent, RefreshControl, ScrollView, View, StyleSheet, Share } from 'react-native';
import type { FlatListProps, GestureResponderEvent, LayoutChangeEvent } from 'react-native';
import { Card, Icon, Menu, PageFlatList, PageScaffold, PageScrollView, SearchBar, Text, usePageContentInset } from '@/src/ui';
import { useTheme } from '@/src/ui/theme';
import { useSettingStore } from '../src/stores/useSettingStore';
import { useStoreHydrated } from '@/src/hooks/useStoreHydrated';
import type { FeedItem, FeedItemInfo, FeedType } from '@/src/types/zhihu';
import { short } from '@/src/utils/haptics';
import { getNetworkStatus, useNetworkStore, type NetworkStatus } from '@/src/stores/useNetworkStore';
import { notify } from '@/src/stores/useNotificationStore';
import { getRecentFeed, saveFeedEntries, trimTransientFeedEntries } from '@/src/db/repositories/feedRepository';
import { fetchAndSaveRecommendationPage } from '@/src/services/browseAndSaveService';
import { recordUserEvent } from '@/src/db/repositories/userEventRepository';
import { useConsentStore } from '@/src/stores/useConsentStore';
import { loadProductV1Settings, processProductV1Feed, recordProductV1Exposure, recordProductV1Feedback } from '@/src/product-v1';
import { isProductV1DomainClassificationAvailable } from '@/src/product-v1/domainClassifier';
import { AiSuspicionBadge } from '@/src/components/AiSuspicionBadge';
import { ProductDomainBadges } from '@/src/components/ProductDomainBadges';
import { semanticExcerpt } from '@/src/product-v1/semanticInput';
import { ProductRecommendationReason } from '@/src/components/ProductRecommendationReason';
import GuestHomeFeed from '@/src/components/GuestHomeFeed';
import { MAIN_PAGE_TOP_SPACING, useMainTabBottomContentInset } from '@/src/components/MainTabLayout';
import type { ProductV1DomainClassificationPriority } from '@/src/product-v1/domainTaskQueue';

const { width: WindowWidth } = Dimensions.get('window');
const WindowHeight = Dimensions.get('window').height;

// ====== Paging 模式下的比例参数 ======
const ITEM_WIDTH = WindowWidth * 0.88; 
const CARD_WIDTH = WindowWidth * 0.82; 
const CARD_HEIGHT = WindowHeight * 0.65;
const CARD_ITEM_HEIGHT = CARD_HEIGHT + 10;
const WATERFALL_GAP = 12;
const WATERFALL_INITIAL_RENDER_AHEAD = WindowHeight * 5;

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

function getAiDetectionText(item: FeedItem) {
    return item.excerpt?.trim() || getContentPreview(item);
}

function sameStringSet(a: Set<string>, b: Set<string>) {
    if (a.size !== b.size) return false;
    for (const value of a) if (!b.has(value)) return false;
    return true;
}

function openFeedContent(item: FeedItem, type: FeedType, needToGet: boolean) {
    if (type === 'question') {
        router.push({
            pathname: '/question',
            params: {
                id: item.questionId || item.id,
                title: item.title,
                excerpt: item.excerpt,
                authorName: item.authorName,
                authorAvatar: item.authorAvatar,
                answerCount: String(item.questionAnswerCount || 0),
            },
        });
        return;
    }
    router.push({
        pathname: `/item/[type]/[id]`,
        params: { id: item.id, type, needToGet: needToGet.toString(), initialFavorited: item.favorited ? 'true' : 'false' },
    });
}

// ==================== 普通模式 Item ====================
export const RenderItem = memo(({ item, type, needToGet, hideTitle, showAiDetection, showDomainLabels, domainPriority, onOpenMenu }: {
    item: FeedItem;
    type: FeedType;
    needToGet: boolean;
    hideTitle?: boolean;
    showAiDetection?: boolean;
    showDomainLabels?: boolean;
    domainPriority?: ProductV1DomainClassificationPriority;
    onOpenMenu?: (item: FeedItem, feedType: FeedType, event: GestureResponderEvent) => void;
}) => {
    const title = (type === 'answer' && item.questionTitle) ? item.questionTitle : item.title;
    const theme = useTheme();
    const metaColor = theme.colors.onSurfaceVariantSummary;
    const cardBgColor = theme.colors.surfaceContainer;

    const openItem = useCallback(() => {
        if (useConsentStore.getState().aiInterestAnalysisEnabled) {
            void recordUserEvent({ contentId: item.id, contentType: type, eventType: 'content_open' });
        }
        openFeedContent(item, type, needToGet);
    }, [item.favorited, item.id, type, needToGet]);
    const openActionMenu = useCallback((event: GestureResponderEvent) => {
        onOpenMenu?.(item, type, event);
    }, [item, onOpenMenu, type]);

    return (
        <Card
            feedback="none"
            showIndication
            glassVariant="preferencePanel"
            onPress={openItem}
            onLongPress={type === 'question' ? undefined : openActionMenu}
            style={{ width: WindowWidth * 0.9, marginBottom: 10 }}
            contentStyle={{ backgroundColor: cardBgColor, paddingHorizontal: 16, paddingVertical: 14 }}
        >
            {!hideTitle && (
                <View style={{ marginBottom: 8 }}>
                    <Text type="headline1" weight="bold" color={theme.colors.onBackground} numberOfLines={2}>
                        {title}
                    </Text>
                    {(showAiDetection || showDomainLabels) ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', minHeight: 24, marginTop: 6 }}>
                            {showAiDetection ? (
                                <AiSuspicionBadge
                                    contentKey={`${type}:${item.id}`}
                                    text={getAiDetectionText(item)}
                                    style={{ marginRight: 6 }}
                                />
                            ) : null}
                            <ProductDomainBadges
                                enabled={Boolean(showDomainLabels)}
                                contentKey={`${type}:${item.id}`}
                                title={title || '无标题'}
                                excerpt={semanticExcerpt(type, item, getContentPreview(item))}
                                feedType={type}
                                contentId={item.id}
                                questionId={type === 'answer' ? item.questionId : undefined}
                                questionTopicIds={type === 'answer' ? item.questionTopicIds : undefined}
                                priority={domainPriority}
                                style={{ flex: 1 }}
                            />
                        </View>
                    ) : null}
                </View>
            )}
            <Text type="body2" color={metaColor} style={{ marginBottom: 10, lineHeight: 20 }} numberOfLines={3}>
                {item.excerpt}
            </Text>
            <ProductRecommendationReason
                reason={item.recommendationReason}
                style={{ marginTop: -2, marginBottom: 10 }}
            />
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
        prevProps.item.recommendationReason?.summary === nextProps.item.recommendationReason?.summary &&
        prevProps.type === nextProps.type &&
        prevProps.needToGet === nextProps.needToGet &&
        prevProps.onOpenMenu === nextProps.onOpenMenu &&
        prevProps.hideTitle === nextProps.hideTitle &&
        prevProps.showAiDetection === nextProps.showAiDetection &&
        prevProps.showDomainLabels === nextProps.showDomainLabels &&
        prevProps.domainPriority === nextProps.domainPriority;
});
RenderItem.displayName = 'RenderItem';

function estimateWaterfallHeight(feed: FeedItemInfo, showRecommendationReason = true, showDomainLabels = true) {
    const title = feed.feedType === 'answer' && feed.item.questionTitle ? feed.item.questionTitle : feed.item.title;
    // A narrow waterfall column wraps Chinese titles earlier than a full-width card.
    // Keep the placement estimate at least as tall as the rendered 3-line title,
    // otherwise the next absolute-positioned card can visually overlap it.
    const titleLines = title.length > 18 ? 3 : title.length > 9 ? 2 : 1;
    const excerptLines = feed.item.excerpt.length > 180 ? 5 : feed.item.excerpt.length > 100 ? 4 : 3;
    // Match WaterfallItem's actual padding, line heights and metadata row.
    // The old estimate was 40–50dp taller than the rendered card, which made
    // a tight waterfall look like cards were overlapping or leaving large gaps.
    const recommendationReasonHeight = showRecommendationReason && feed.item.recommendationReason ? 23 : 0;
    const badgeRowHeight = showDomainLabels ? 28 : 0;
    return 28 + titleLines * 23 + badgeRowHeight + 8 + excerptLines * 20 + recommendationReasonHeight + 12 + 15;
}

type WaterfallPlacement = {
    feed: FeedItemInfo;
    column: 0 | 1;
    top: number;
    height: number;
};

const WaterfallItem = memo(({ item, type, needToGet, measurementKey, showDomainLabels, domainPriority, onMeasured, onOpenMenu }: {
    item: FeedItem;
    type: FeedType;
    needToGet: boolean;
    measurementKey: string;
    showDomainLabels?: boolean;
    domainPriority?: ProductV1DomainClassificationPriority;
    onMeasured?: (key: string, height: number) => void;
    onOpenMenu?: (item: FeedItem, feedType: FeedType, event: GestureResponderEvent) => void;
}) => {
    const theme = useTheme();
    const title = type === 'answer' && item.questionTitle ? item.questionTitle : item.title;
    const metaColor = theme.colors.onSurfaceVariantSummary;
    const openItem = useCallback(() => {
        if (useConsentStore.getState().aiInterestAnalysisEnabled) {
            void recordUserEvent({ contentId: item.id, contentType: type, eventType: 'content_open' });
        }
        openFeedContent(item, type, needToGet);
    }, [item.favorited, item.id, type, needToGet]);

    const openActionMenu = useCallback((event: GestureResponderEvent) => {
        onOpenMenu?.(item, type, event);
    }, [item, onOpenMenu, type]);

    const handleLayout = useCallback((event: LayoutChangeEvent) => {
        onMeasured?.(measurementKey, event.nativeEvent.layout.height);
    }, [measurementKey, onMeasured]);

    const excerptLines = item.excerpt.length > 180 ? 5 : item.excerpt.length > 100 ? 4 : 3;
    return (
        <View onLayout={handleLayout} style={{ width: '100%' }}>
            <Card
                feedback="none"
                showIndication
                glassVariant="preferencePanel"
                onPress={openItem}
                onLongPress={type === 'question' ? undefined : openActionMenu}
                style={{ width: '100%' }}
                contentStyle={{ paddingHorizontal: 13, paddingVertical: 14 }}
            >
                <View style={{ marginBottom: 8 }}>
                    <Text type="headline1" weight="bold" color={theme.colors.onBackground} numberOfLines={3} style={{ lineHeight: 23 }}>
                        {title || '无标题'}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', minHeight: 22, marginTop: 6 }}>
                        <AiSuspicionBadge
                            contentKey={`${type}:${item.id}`}
                            text={getAiDetectionText(item)}
                            style={{ marginRight: 6 }}
                        />
                        <ProductDomainBadges
                            enabled={Boolean(showDomainLabels)}
                            contentKey={`${type}:${item.id}`}
                            title={title || '无标题'}
                            excerpt={semanticExcerpt(type, item, getContentPreview(item))}
                            feedType={type}
                            contentId={item.id}
                            questionId={type === 'answer' ? item.questionId : undefined}
                            questionTopicIds={type === 'answer' ? item.questionTopicIds : undefined}
                            priority={domainPriority}
                            style={{ flex: 1 }}
                        />
                    </View>
                </View>
                <Text type="body2" color={metaColor} numberOfLines={excerptLines} style={{ marginTop: 8, lineHeight: 20 }}>
                    {item.excerpt || '暂无简介'}
                </Text>
                <ProductRecommendationReason
                    reason={item.recommendationReason}
                    style={{ marginTop: 6 }}
                />
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
                    <Icon name="thumb-up-outline" size={15} color={metaColor} />
                    <Text type="footnote1" style={{ marginLeft: 4, color: metaColor }}>{item.voteCount}</Text>
                    <Icon name="comment-outline" size={15} color={metaColor} style={{ marginLeft: 12 }} />
                    <Text type="footnote1" style={{ marginLeft: 4, color: metaColor }}>{item.commentCount}</Text>
                </View>
            </Card>
        </View>
    );
}, (prevProps, nextProps) => (
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.recommendationReason?.summary === nextProps.item.recommendationReason?.summary &&
    prevProps.type === nextProps.type &&
    prevProps.needToGet === nextProps.needToGet &&
    prevProps.measurementKey === nextProps.measurementKey &&
    prevProps.showDomainLabels === nextProps.showDomainLabels &&
    prevProps.domainPriority === nextProps.domainPriority &&
    prevProps.onMeasured === nextProps.onMeasured &&
    prevProps.onOpenMenu === nextProps.onOpenMenu
));
WaterfallItem.displayName = 'WaterfallItem';

// ==================== 卡片模式 Item ====================
export const RenderCardModeItem = memo(({ item, type, needToGet, disableAnimations, hideTitle, showDomainLabels, domainPriority, onOpenMenu }: {
    item: FeedItem;
    type: FeedType;
    needToGet: boolean;
    disableAnimations?: boolean;
    hideTitle?: boolean;
    showDomainLabels?: boolean;
    domainPriority?: ProductV1DomainClassificationPriority;
    onOpenMenu?: (item: FeedItem, feedType: FeedType, event: GestureResponderEvent) => void;
}) => {
    const title = (type === 'answer' && item.questionTitle) ? item.questionTitle : item.title;

    const theme = useTheme();
    const metaColor = theme.colors.onSurfaceVariantSummary;
    const cardBgColor = theme.colors.surfaceContainer;
    const textColor = theme.colors.onBackground;

    const openItem = useCallback(() => {
        if (useConsentStore.getState().aiInterestAnalysisEnabled) {
            void recordUserEvent({ contentId: item.id, contentType: type, eventType: 'content_open' });
        }
        openFeedContent(item, type, needToGet);
    }, [item.favorited, item.id, type, needToGet]);

    const openActionMenu = useCallback((event: GestureResponderEvent) => {
        onOpenMenu?.(item, type, event);
    }, [item, onOpenMenu, type]);

    const topSpacing = 0;
    const preview = getContentPreview(item);
    return (
        <View style={{ 
            width: ITEM_WIDTH,     
            height: CARD_ITEM_HEIGHT,
            alignItems: 'center', 
            paddingTop: topSpacing 
        }}>
            <View style={{ width: CARD_WIDTH, height: CARD_HEIGHT, borderRadius: 24, overflow: 'hidden' }}>
                <Card
                    feedback={disableAnimations ? 'none' : 'sink'}
                    showIndication
                    glassVariant="preferencePanel"
                    onPress={openItem}
                    onLongPress={type === 'question' ? undefined : openActionMenu}
                    style={{ flex: 1 }}
                    contentStyle={{ backgroundColor: cardBgColor, borderRadius: 24, padding: 20, flex: 1 }}
                >
                    {!hideTitle && (
                        <View style={{ marginBottom: 12 }}>
                            <Text
                                type="title3"
                                weight="bold"
                                style={{ color: textColor, lineHeight: 31 }}
                                numberOfLines={3}
                            >
                                {title || '无标题'}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', minHeight: 22, marginTop: 8 }}>
                                <AiSuspicionBadge
                                    contentKey={`${type}:${item.id}`}
                                    text={getAiDetectionText(item)}
                                    style={{ marginRight: 8 }}
                                />
                                <ProductDomainBadges
                                    enabled={Boolean(showDomainLabels)}
                                    contentKey={`${type}:${item.id}`}
                                    title={title || '无标题'}
                                    excerpt={semanticExcerpt(type, item, preview)}
                                    feedType={type}
                                    contentId={item.id}
                                    questionId={type === 'answer' ? item.questionId : undefined}
                                    questionTopicIds={type === 'answer' ? item.questionTopicIds : undefined}
                                    priority={domainPriority}
                                    style={{ flex: 1 }}
                                />
                            </View>
                        </View>
                    )}
                    
                    <View style={{ flex: 1, overflow: 'hidden' }} pointerEvents="none">
                        <Text
                            type="body1"
                            color={metaColor}
                            style={{ lineHeight: 26 }}
                            numberOfLines={18}
                        >
                            {preview}
                        </Text>
                    </View>
                    <ProductRecommendationReason
                        reason={item.recommendationReason}
                        style={{ marginTop: 10 }}
                    />

                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginTop: 12,
                        paddingTop: 12,
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
            </View>
        </View>
    );
}, (prevProps, nextProps) => {
    return prevProps.item.id === nextProps.item.id &&
        prevProps.item.recommendationReason?.summary === nextProps.item.recommendationReason?.summary &&
        prevProps.disableAnimations === nextProps.disableAnimations &&
        prevProps.type === nextProps.type &&
        prevProps.needToGet === nextProps.needToGet &&
        prevProps.onOpenMenu === nextProps.onOpenMenu &&
        prevProps.hideTitle === nextProps.hideTitle &&
        prevProps.showDomainLabels === nextProps.showDomainLabels &&
        prevProps.domainPriority === nextProps.domainPriority;
});
RenderCardModeItem.displayName = 'RenderCardModeItem';

// ==================== 主屏幕 ====================
type HomeScreenProps = {
    active?: boolean;
};

const HomeScreen = ({ active = true }: HomeScreenProps) => {
    const theme = useTheme();
    const bottomContentInset = useMainTabBottomContentInset();
    
    // 从 store 中通过精细选择器拉取所需的状态和方法
    const feedList = useContentStore((state) => state.feedList);
    const setFeedList = useContentStore((state) => state.setFeedList);
    const removeFeedItem = useContentStore((state) => state.removeFeedItem); // 引入解耦后的局部删除 Action
    const addUnlikeItem = useContentStore((state) => state.addUnlikeItem);   // 引入新增的本地不喜欢持久化 Action
    const addSeenFeedKeys = useContentStore((state) => state.addSeenFeedKeys);
    const seenFeedKeys = useContentStore((state) => state.seenFeedKeys);
    const refreshRequest = useContentStore((state) => state.refreshRequest);
    const scrollTopRequest = useContentStore((state) => state.scrollTopRequest);
    
    const cookies = useUserStore((state) => state.cookies);
    const disableAnimations = useSettingStore((state) => state.disableAnimations);
    // `mode` is intentionally not subscribed through the React hook while Home
    // is hidden behind PagerView. Switching the mode from the User page would
    // otherwise synchronously rebuild the entire feed tree in the same frame as
    // the SegmentedControl glass animation.
    const [displayMode, setDisplayMode] = useState(() => useSettingStore.getState().mode);
    const filterAds = useSettingStore((state) => state.isAds);
    const filterPaid = useSettingStore((state) => state.isPaid);
    const deduplicateFeed = useSettingStore((state) => state.deduplicateFeed);
    const browseAndSaveOfflineEnabled = useSettingStore((state) => state.browseAndSaveOfflineEnabled);
    const userHydrated = useStoreHydrated(useUserStore); // 等用户 store 完成水合再初始化 API
    const settingHydrated = useStoreHydrated(useSettingStore);
    const contentHydrated = useStoreHydrated(useContentStore);
    const networkStatus = useNetworkStore((state) => state.status);
    const personalizationEnabled = useConsentStore((state) => state.aiInterestAnalysisEnabled);

    const [isRefreshing, setIsRefreshing] = useState(false);
    const [cardListHeight, setCardListHeight] = useState(0);
    const [actionMenuTarget, setActionMenuTarget] = useState<{ item: FeedItem; type: FeedType } | null>(null);
    const [actionMenuAnchor, setActionMenuAnchor] = useState({ x: 0, y: 0, width: 1, height: 1 });
    const [domainLabelsEnabled, setDomainLabelsEnabled] = useState(() => isProductV1DomainClassificationAvailable());
    const [visibleDomainKeys, setVisibleDomainKeys] = useState<Set<string>>(() => new Set());
    const commitVisibleDomainKeys = useCallback((next: Set<string>) => {
        setVisibleDomainKeys((current) => sameStringSet(current, next) ? current : next);
    }, []);

    // Only observe display-mode changes while Home is actually visible. When
    // inactive, the persisted setting can change freely without mounting a new
    // FlatList/ScrollView tree off-screen. On re-entry we apply the latest mode
    // on the next frame so the bottom-tab page switch is not blocked by that
    // potentially expensive feed reconstruction.
    useEffect(() => {
        if (!active) return;

        let frame = requestAnimationFrame(() => {
            frame = 0;
            const nextMode = useSettingStore.getState().mode;
            setDisplayMode((current) => current === nextMode ? current : nextMode);
        });

        const unsubscribe = useSettingStore.subscribe((state, previousState) => {
            if (state.mode === previousState.mode) return;
            const nextMode = state.mode;
            if (frame) cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                frame = 0;
                setDisplayMode((current) => current === nextMode ? current : nextMode);
            });
        });

        return () => {
            if (frame) cancelAnimationFrame(frame);
            unsubscribe();
        };
    }, [active]);
    const requestInFlightRef = useRef(false);
    const productMergeGenerationRef = useRef(0);
    const offlineSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
    const lastOfflineSaveCursorRef = useRef('');
    const previousBrowseAndSaveEnabledRef = useRef(browseAndSaveOfflineEnabled);

    useFocusEffect(useCallback(() => {
        setDomainLabelsEnabled(isProductV1DomainClassificationAvailable());
    }, []));
    const visibleFeedList = useMemo(() => feedList.filter((feed) => (
        !(filterAds && feed.isAds) && !(filterPaid && feed.isPaid)
    )), [feedList, filterAds, filterPaid]);
    const feedEmptyState = useMemo(() => {
        if (!userHydrated) return null;
        if (networkStatus === 'offline') {
            return (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xl }}>
                    <Text type="body1" color={theme.colors.onSurfaceVariantSummary}>暂无可离线浏览的内容</Text>
                </View>
            );
        }
        return null;
    }, [cookies, networkStatus, theme, userHydrated]);

    const sessionTokenRef = useRef("");
    const androidRecommendCursorRef = useRef('');
    const feedListRef = useRef(feedList);
    feedListRef.current = feedList;
    const seenFeedKeysRef = useRef(seenFeedKeys);
    seenFeedKeysRef.current = seenFeedKeys;
    const visibleFeedListRef = useRef(visibleFeedList);
    visibleFeedListRef.current = visibleFeedList;
    const loadDataRef = useRef<any>(null);
    const loadOfflineFeedRef = useRef<(() => Promise<void>) | null>(null);
    const handledRefreshRequestRef = useRef(refreshRequest);
    const handledScrollTopRequestRef = useRef(scrollTopRequest);
    // Start from unknown so an offline cold start still enters the branch
    // that loads the SQLite feed. Initializing this ref from the current
    // value would skip that load when NetInfo resolves before the effect.
    const previousNetworkStatusRef = useRef<NetworkStatus>('unknown');
    const onlineFeedStartedRef = useRef(false);

    const flatListRef = useRef<FlatList>(null);
    const waterfallScrollRef = useRef<ScrollView>(null);
    const waterfallOffsetYRef = useRef(0);
    const waterfallRenderWindowRef = useRef({ start: 0, end: WATERFALL_INITIAL_RENDER_AHEAD });
    const [waterfallRenderWindow, setWaterfallRenderWindow] = useState(waterfallRenderWindowRef.current);
    const waterfallMeasuredHeightsRef = useRef<Record<string, number>>({});
    const [waterfallMeasuredHeights, setWaterfallMeasuredHeights] = useState<Record<string, number>>({});
    const waterfallMeasureFrameRef = useRef<number | null>(null);
    const waterfallLoadTriggerRef = useRef(0);
    const currentIndexRef = useRef(0);

    const handleWaterfallMeasured = useCallback((key: string, height: number) => {
        if (!Number.isFinite(height) || height <= 0) return;
        const previous = waterfallMeasuredHeightsRef.current[key];
        if (previous !== undefined && Math.abs(previous - height) < 1) return;
        waterfallMeasuredHeightsRef.current[key] = height;
        if (waterfallMeasureFrameRef.current !== null) return;
        waterfallMeasureFrameRef.current = requestAnimationFrame(() => {
            waterfallMeasureFrameRef.current = null;
            setWaterfallMeasuredHeights({ ...waterfallMeasuredHeightsRef.current });
        });
    }, []);

    useEffect(() => () => {
        if (waterfallMeasureFrameRef.current !== null) {
            cancelAnimationFrame(waterfallMeasureFrameRef.current);
        }
    }, []);

    const getFeedKey = (feed: FeedItemInfo) => `${feed.feedType}:${feed.item.id}`;

    const loadOfflineFeed = async () => {
        // Offline mode exposes only entries explicitly saved from the
        // offline-cache page, so every visible item has its own body/comment
        // cache policy and optional image resources.
        const cached = await getRecentFeed(80, true);
        // 网络可能在读取 SQLite 期间恢复；恢复在线后丢弃这次离线结果，
        // 防止本地 Feed 异步回写到在线首页的最前面。
        if (getNetworkStatus() !== 'offline') return;
        feedListRef.current = cached;
        setFeedList(cached);
        sessionTokenRef.current = '';
        androidRecommendCursorRef.current = '';
    };

    loadOfflineFeedRef.current = loadOfflineFeed;

    const loadData = async (isRefresh = false) => {
        if (requestInFlightRef.current) return;
        requestInFlightRef.current = true;

        if (isRefresh) {
            productMergeGenerationRef.current += 1;
            setIsRefreshing(true);
            sessionTokenRef.current = ""; 
            androidRecommendCursorRef.current = '';
        }
        const productMergeGeneration = productMergeGenerationRef.current;

        try {
            if (networkStatus === 'offline') {
                await loadOfflineFeed();
                return;
            }
            if (networkStatus !== 'online') return;
            const sourceSettings = await loadProductV1Settings().catch(() => null);
            const sourceMode = sourceSettings?.recommendationSourceMode ?? 'web';
            // 推荐接口的一页不一定都是回答/文章，也可能是视频、问题或推广项。
            // 首屏至少补够一批可展示内容，避免过滤/去重后只剩一条。
            const targetVisibleCount = isRefresh ? 8 : 4;
            // 刷新直接采用推荐流返回的内容（批次内去重），加载更多才翻页
            // 寻找未推送过的内容，因此刷新通常一页即可凑满目标数量。
            const maxPages = isRefresh ? 12 : 5;
            let nextToken = isRefresh ? '' : sessionTokenRef.current;
            let nextAndroidCursor = isRefresh ? '' : androidRecommendCursorRef.current;
            let activeSourceMode = sourceMode;
            const batchKeys = new Set<string>();
            let visibleItemCount = 0;
            let hasRenderedRefreshPage = false;

            for (let page = 0; page < maxPages; page += 1) {
                const requestCursor = nextToken;
                const requestAndroidCursor = nextAndroidCursor;
                const acquired = await fetchRecommendationSourcePage({
                    mode: activeSourceMode,
                    webCursor: requestCursor,
                    androidCursor: requestAndroidCursor,
                    fetchWeb: getRecommend,
                    fetchAndroid: fetchAndroidRecommendPage,
                    normalizeWebItem: normalizeRecommendItem,
                });
                const { webResponse, androidPage, items: processedItems } = acquired;
                if (acquired.webError) {
                    const status = typeof acquired.webError?.status === 'number' ? `http_${acquired.webError.status}` : 'request';
                    console.warn(`[CandidateSource] web unavailable category=${status}`);
                }
                if (acquired.androidError) {
                    const status = typeof acquired.androidError?.status === 'number' ? `http_${acquired.androidError.status}` : 'request';
                    console.warn(`[CandidateSource] android unavailable category=${status} fallback=${activeSourceMode === 'android' ? 'web' : 'continue'}`);
                }
                console.info(`[CandidateSource] mode=${activeSourceMode} webRaw=${acquired.webRawCount} web=${acquired.webNormalizedCount} androidRaw=${androidPage?.rawCount ?? 0} android=${androidPage?.items.length ?? 0} merged=${processedItems.length} dedup=${acquired.duplicateCount}`);

                const existingKeys = new Set([
                    ...seenFeedKeysRef.current,
                    ...feedListRef.current.map(getFeedKey),
                    ...batchKeys,
                ]);
                // 主动刷新时不对历史推送记录去重：知乎推荐流会反复推送旧内容，
                // 历史去重会把整批结果滤空，表现为“刷新不出任何东西”。
                // 历史去重只作用于加载更多，刷新只保证当批次内不重复。
                const acceptKnownItems = isRefresh;
                const acceptedItems = processedItems.filter((item: FeedItemInfo) => {
                    const key = getFeedKey(item);
                    if (batchKeys.has(key) || (deduplicateFeed && !acceptKnownItems && existingKeys.has(key))) return false;
                    batchKeys.add(key);
                    return true;
                });

                if (deduplicateFeed) {
                    const fetchedKeys = processedItems.map(getFeedKey);
                    addSeenFeedKeys(fetchedKeys);
                    seenFeedKeysRef.current = [...new Set([...seenFeedKeysRef.current, ...fetchedKeys])].slice(-2000);
                }

                // Cursor 分页必须等待上一页返回 next 游标，不能安全地把
                // 第 2/3 页同时发出；但每页拿到后立即落库并更新 UI，
                // 避免首页为了凑满 8 条而长时间白屏。
                const sessionParts = [
                    webResponse ? getRecommendSessionToken(requestCursor) : '',
                    androidPage?.feedRequestId ?? '',
                ].filter(Boolean);
                const pageSession = sessionParts.join('|') || `source-page-${page}`;
                const persistedPage = await saveFeedEntries(
                    acceptedItems,
                    'recommend',
                    pageSession,
                    deduplicateFeed && !isRefresh,
                );
                if (persistedPage.length > 0) {
                    const mergedData = isRefresh && !hasRenderedRefreshPage
                        ? persistedPage
                        : [...feedListRef.current, ...persistedPage];
                    const uniqueData = mergedData.filter((value, index, array) =>
                        array.findIndex((item) => getFeedKey(item) === getFeedKey(value)) === index
                    );
                    feedListRef.current = uniqueData;
                    setFeedList(uniqueData);
                    hasRenderedRefreshPage = true;
                    visibleItemCount += persistedPage.filter((item) => (
                        !(filterAds && item.isAds) && !(filterPaid && item.isPaid)
                    )).length;

                    // Render fetched recommendations now; embedding and search-based
                    // personalization can take several seconds on a device. Merge its
                    // results into the list when it finishes without blocking scroll.
                    if (useConsentStore.getState().aiInterestAnalysisEnabled) {
                        const productInput = [...persistedPage];
                        const productSession = pageSession;
                        void processProductV1Feed(productInput)
                            .then((rankedPage) => saveFeedEntries(rankedPage, 'product-v1', productSession, false))
                            .then((rankedPage) => {
                                if (productMergeGenerationRef.current !== productMergeGeneration) return;
                                const replacements = new Map(rankedPage.map((item) => [getFeedKey(item), item]));
                                const current = feedListRef.current;
                                const currentKeys = new Set(current.map(getFeedKey));
                                const merged = current.map((item) => replacements.get(getFeedKey(item)) ?? item);
                                for (const item of rankedPage) {
                                    const key = getFeedKey(item);
                                    if (!currentKeys.has(key)) {
                                        currentKeys.add(key);
                                        merged.push(item);
                                    }
                                }
                                feedListRef.current = merged;
                                setFeedList(merged);
                            })
                            .catch((error) => console.error('Product 推荐后台处理失败:', error));
                    }
                }

                nextToken = acquired.nextWebCursor;
                nextAndroidCursor = acquired.nextAndroidCursor;
                const webHasMore = Boolean(webResponse && nextToken && webResponse?.paging?.is_end !== true);
                const androidHasMore = Boolean(androidPage && nextAndroidCursor && !androidPage.isEnd);
                // Once a source fails or reaches its terminal page, stop asking it for
                // page one again while the other source continues paging.
                if (acquired.androidError && webResponse) activeSourceMode = 'web';
                else if (acquired.webError && androidPage) activeSourceMode = 'android';
                else if (activeSourceMode === 'mixed' && webResponse && !webHasMore && androidHasMore) activeSourceMode = 'android';
                else if (activeSourceMode === 'mixed' && androidPage && !androidHasMore && webHasMore) activeSourceMode = 'web';
                const hasMore = activeSourceMode === 'web'
                    ? webHasMore
                    : activeSourceMode === 'android'
                        ? androidHasMore
                        : webHasMore || androidHasMore;
                if (visibleItemCount >= targetVisibleCount || !hasMore) break;
            }
            sessionTokenRef.current = nextToken;
            androidRecommendCursorRef.current = nextAndroidCursor;
            void trimTransientFeedEntries();
        } catch (error) {
            console.error('获取数据失败:', error);
            if (isRefresh) notify({ message: '刷新失败，已保留当前内容', duration: 4000 });
        } finally {
            requestInFlightRef.current = false;
            setIsRefreshing(false);
        }
    };

    loadDataRef.current = loadData;

    const queueOfflineSavePage = useCallback((cursor: string) => {
        if (
            !cursor
            || cursor === lastOfflineSaveCursorRef.current
            || getNetworkStatus() !== 'online'
            || !useUserStore.getState().cookies
        ) return;
        lastOfflineSaveCursorRef.current = cursor;
        offlineSaveQueueRef.current = offlineSaveQueueRef.current
            .catch(() => undefined)
            .then(async () => {
                if (
                    !useSettingStore.getState().browseAndSaveOfflineEnabled
                    || getNetworkStatus() !== 'online'
                ) {
                    if (lastOfflineSaveCursorRef.current === cursor) lastOfflineSaveCursorRef.current = '';
                    return;
                }
                const result = await fetchAndSaveRecommendationPage({
                    cursor,
                    cookie: useUserStore.getState().cookies || '',
                    filterAds: useSettingStore.getState().isAds,
                    filterPaid: useSettingStore.getState().isPaid,
                    withImages: useSettingStore.getState().browseAndSaveWithImages,
                });
                if (result.failed > 0) {
                    console.warn('边看边存部分内容失败:', result);
                }
                if (result.fetched > 0) {
                    notify({
                        message: `边看边存：新增 ${result.saved} 篇，已缓存 ${result.skipped} 篇，失败 ${result.failed} 篇`,
                        duration: 3500,
                    });
                }
            })
            .catch((error) => {
                if (lastOfflineSaveCursorRef.current === cursor) lastOfflineSaveCursorRef.current = '';
                console.error('边看边存推荐页失败:', error);
            });
    }, []);

    useFocusEffect(useCallback(() => {
        const wasEnabled = previousBrowseAndSaveEnabledRef.current;
        previousBrowseAndSaveEnabledRef.current = browseAndSaveOfflineEnabled;
        if (
            settingHydrated
            && wasEnabled !== browseAndSaveOfflineEnabled
            && browseAndSaveOfflineEnabled
            && networkStatus === 'online'
        ) {
            // Turning the setting on while Home is behind Settings saves the
            // next recommendation page as soon as the user returns.
            queueOfflineSavePage(sessionTokenRef.current);
        }
    }, [browseAndSaveOfflineEnabled, networkStatus, queueOfflineSavePage, settingHydrated]));

    const refreshHome = useCallback(async (loadMoreWhenDisabled: boolean) => {
        await loadDataRef.current?.(true);
        if (useSettingStore.getState().browseAndSaveOfflineEnabled) {
            queueOfflineSavePage(sessionTokenRef.current);
        } else if (loadMoreWhenDisabled) {
            await loadDataRef.current?.(false);
        }
    }, [queueOfflineSavePage]);

    const scrollHomeToTop = useCallback(() => {
        currentIndexRef.current = 0;
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        waterfallScrollRef.current?.scrollTo({ y: 0, animated: true });
        waterfallOffsetYRef.current = 0;
        waterfallRenderWindowRef.current = { start: 0, end: WATERFALL_INITIAL_RENDER_AHEAD };
        setWaterfallRenderWindow(waterfallRenderWindowRef.current);
        waterfallLoadTriggerRef.current = 0;
        commitVisibleDomainKeys(new Set());
    }, [commitVisibleDomainKeys]);

    useEffect(() => {
        if (handledScrollTopRequestRef.current === scrollTopRequest) return;
        handledScrollTopRequestRef.current = scrollTopRequest;
        scrollHomeToTop();
    }, [scrollHomeToTop, scrollTopRequest]);

    useEffect(() => {
        if (handledRefreshRequestRef.current === refreshRequest) return;
        handledRefreshRequestRef.current = refreshRequest;
        const refresh = async () => {
            scrollHomeToTop();
            currentIndexRef.current = 0;
            await refreshHome(true);
        };
        void refresh();
    }, [refreshRequest, refreshHome, scrollHomeToTop]);

    useEffect(() => {
        if (!userHydrated || !settingHydrated || !contentHydrated) return;
        const previous = previousNetworkStatusRef.current;

        if (networkStatus === 'offline') {
            onlineFeedStartedRef.current = false;
            if (previous !== 'offline') {
                notify({ message: '当前无网络，已进入离线模式', duration: 5000 });
                void loadOfflineFeedRef.current?.();
            }
        } else if (networkStatus === 'online' && !cookies) {
            onlineFeedStartedRef.current = false;
            feedListRef.current = [];
            setFeedList([]);
            sessionTokenRef.current = '';
        } else if (networkStatus === 'online' && (!onlineFeedStartedRef.current || previous === 'offline')) {
            onlineFeedStartedRef.current = true;
            // 在线模式只显示本次推荐请求结果，不能把离线数据库里的 Feed
            // 混进来；SQLite 仍然只负责历史去重和持久化。
            feedListRef.current = [];
            setFeedList([]);
            sessionTokenRef.current = '';
            getApiInstance(cookies);
            void refreshHome(true);
        }

        previousNetworkStatusRef.current = networkStatus;
    }, [contentHydrated, cookies, networkStatus, refreshHome, settingHydrated, userHydrated, setFeedList]);

    useEffect(() => {
        currentIndexRef.current = 0;
        waterfallOffsetYRef.current = 0;
        commitVisibleDomainKeys(new Set());
        const frame = requestAnimationFrame(() => {
            flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
            waterfallScrollRef.current?.scrollTo({ y: 0, animated: false });
            waterfallRenderWindowRef.current = { start: 0, end: WATERFALL_INITIAL_RENDER_AHEAD };
            setWaterfallRenderWindow(waterfallRenderWindowRef.current);
            waterfallLoadTriggerRef.current = 0;
        });
        return () => cancelAnimationFrame(frame);
    }, [commitVisibleDomainKeys, displayMode, filterAds, filterPaid]);

    // 联动优化：不喜欢（移除+网络请求+本地状态）统一处理器
    const handleDislikeItem = useCallback((id: string, feedType: FeedType) => {
        const list = visibleFeedListRef.current;
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

        // 2. 本地先隐藏；远端失败时保留本地偏好，但不能误报为同步成功。
        const report = feedType === 'answer'
            ? dislikeAnswer(String(id))
            : dislikeArticle(String(id));
        void report.catch((error) => {
            console.error('上报服务器不喜欢状态失败:', error);
            notify('已在本地隐藏，但未能同步到知乎');
        });

        // 3. 将帖子 ID 同步推进本地维护的 store 的 unlikeList 阵列里
        addUnlikeItem(String(id));

        if (useConsentStore.getState().aiInterestAnalysisEnabled) {
            void recordProductV1Feedback({
                contentId: String(id),
                contentType: feedType,
                eventType: 'explicit_not_interested',
                hidden: true,
                explicitNotInterested: true,
            });
        }

        // 4. 从当前的动态推荐流中剔除，引发重绘与完美贴合补位
        removeFeedItem(id);
    }, [removeFeedItem, addUnlikeItem]);

    const handleShareItem = useCallback((item: FeedItem, feedType: FeedType) => {
        const url = feedType === 'article'
            ? `https://zhuanlan.zhihu.com/p/${item.id}`
            : feedType === 'question'
                ? `https://www.zhihu.com/question/${item.questionId || item.id}`
                : `https://www.zhihu.com/question/${item.questionId}/answer/${item.id}`;
        void Share.share({ title: item.questionTitle || item.title, message: `${item.questionTitle || item.title}\n${url}` });
    }, []);

    const openActionMenu = useCallback((item: FeedItem, feedType: FeedType, event: GestureResponderEvent) => {
        const { pageX, pageY } = event.nativeEvent;
        setActionMenuTarget({ item, type: feedType });
        setActionMenuAnchor({ x: pageX, y: pageY, width: 1, height: 1 });
        short();
    }, []);

    const closeActionMenu = useCallback(() => setActionMenuTarget(null), []);

    const reportExposure = useCallback((feed: FeedItemInfo) => {
        if (!useConsentStore.getState().aiInterestAnalysisEnabled) return;
        void recordProductV1Exposure(String(feed.item.id), feed.feedType);
    }, []);

    const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: { item: FeedItemInfo; isViewable: boolean }[] }) => {
        const nextVisibleKeys = new Set<string>();
        for (const viewable of viewableItems) {
            if (!viewable.isViewable) continue;
            reportExposure(viewable.item);
            nextVisibleKeys.add(`${viewable.item.feedType}:${viewable.item.item.id}`);
        }
        commitVisibleDomainKeys(nextVisibleKeys);
    }).current;

    const actionMenuItems = useMemo(() => [
        {
            label: '分享',
            onPress: () => {
                if (actionMenuTarget) handleShareItem(actionMenuTarget.item, actionMenuTarget.type);
            },
        },
        {
            label: '不喜欢',
            onPress: () => {
                if (actionMenuTarget) handleDislikeItem(actionMenuTarget.item.id, actionMenuTarget.type);
            },
        },
    ], [actionMenuTarget, handleDislikeItem, handleShareItem]);

    const renderListItem = useCallback(({ item }: { item: FeedItemInfo }) => {
        return (
            <RenderItem
                item={item.item}
                type={item.feedType}
                needToGet={true}
                showAiDetection
                showDomainLabels={domainLabelsEnabled}
                domainPriority={visibleDomainKeys.has(`${item.feedType}:${item.item.id}`) ? 'high' : 'low'}
                onOpenMenu={openActionMenu}
            />
        );
    }, [domainLabelsEnabled, openActionMenu, visibleDomainKeys]);

    // 关键改动：在这里把 item.feedType 作为形参绑定闭包传给 RenderCardModeItem
    const renderCardListItem = useCallback(({ item }: { item: FeedItemInfo }) => {
        return (
            <RenderCardModeItem
                item={item.item}
                type={item.feedType}
                needToGet={true}
                disableAnimations={disableAnimations}
                showDomainLabels={domainLabelsEnabled}
                domainPriority={visibleDomainKeys.has(`${item.feedType}:${item.item.id}`) ? 'high' : 'low'}
                onOpenMenu={openActionMenu}
            />
        );
    }, [disableAnimations, domainLabelsEnabled, openActionMenu, visibleDomainKeys]);

    const waterfallColumnWidth = Math.max(0, (WindowWidth - 24 - WATERFALL_GAP) / 2);
    const waterfallLayout = useMemo(() => {
        const heights = [0, 0];
        const placements: WaterfallPlacement[] = [];
        visibleFeedList.forEach((feed) => {
            const columnIndex = heights[0] <= heights[1] ? 0 : 1;
            const measurementKey = getFeedKey(feed);
            const height = waterfallMeasuredHeights[measurementKey]
                ?? estimateWaterfallHeight(feed, personalizationEnabled, domainLabelsEnabled);
            // Each column owns its vertical cursor. This keeps every gap
            // identical and lets the natural card-height difference create
            // the masonry stagger without inserting artificial blank space.
            const top = heights[columnIndex];
            const placement: WaterfallPlacement = {
                feed,
                column: columnIndex as 0 | 1,
                top,
                height,
            };
            placements.push(placement);
            heights[columnIndex] = top + height + WATERFALL_GAP;
        });
        return {
            placements,
            contentHeight: Math.max(heights[0], heights[1]) + theme.spacing.xl,
        };
    }, [personalizationEnabled, theme.spacing.xl, visibleFeedList, waterfallMeasuredHeights]);

    useEffect(() => {
        if (displayMode !== 'waterfall') return;
        const start = waterfallOffsetYRef.current;
        const end = start + WindowHeight;
        const nextVisibleKeys = new Set<string>();
        for (const placement of waterfallLayout.placements) {
            if (placement.top + placement.height >= start && placement.top <= end) {
                nextVisibleKeys.add(`${placement.feed.feedType}:${placement.feed.item.id}`);
            }
        }
        commitVisibleDomainKeys(nextVisibleKeys);
    }, [commitVisibleDomainKeys, displayMode, waterfallLayout.placements]);

    const updateWaterfallRenderWindow = useCallback((offsetY: number) => {
        const start = Math.max(0, offsetY - WindowHeight * 1.5);
        const end = offsetY + WindowHeight * 3;
        const previous = waterfallRenderWindowRef.current;
        if (
            Math.abs(start - previous.start) < WindowHeight * 0.45 &&
            Math.abs(end - previous.end) < WindowHeight * 0.45
        ) {
            return;
        }
        const next = { start, end };
        waterfallRenderWindowRef.current = next;
        setWaterfallRenderWindow(next);
    }, []);

    const loadWaterfallMore = useCallback(() => {
        void loadDataRef.current?.(false);
    }, []);

    const handleWaterfallScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        waterfallOffsetYRef.current = offsetY;
        updateWaterfallRenderWindow(offsetY);
    }, [updateWaterfallRenderWindow]);

    const handleWaterfallScrollSettled = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
        waterfallOffsetYRef.current = contentOffset.y;
        updateWaterfallRenderWindow(contentOffset.y);
        const nextVisibleKeys = new Set<string>();
        for (const placement of waterfallLayout.placements) {
            if (placement.top + placement.height >= contentOffset.y && placement.top <= contentOffset.y + layoutMeasurement.height) {
                reportExposure(placement.feed);
                nextVisibleKeys.add(`${placement.feed.feedType}:${placement.feed.item.id}`);
            }
        }
        commitVisibleDomainKeys(nextVisibleKeys);
        if (
            contentSize.height > waterfallLoadTriggerRef.current &&
            contentOffset.y + layoutMeasurement.height >= contentSize.height - 700
        ) {
            waterfallLoadTriggerRef.current = contentSize.height;
            loadWaterfallMore();
        }
    }, [commitVisibleDomainKeys, loadWaterfallMore, reportExposure, updateWaterfallRenderWindow, waterfallLayout.placements]);

    const renderedWaterfallItems = useMemo(() => waterfallLayout.placements.filter(({ top, height }) => (
        top + height >= waterfallRenderWindow.start && top <= waterfallRenderWindow.end
    )), [waterfallLayout.placements, waterfallRenderWindow.end, waterfallRenderWindow.start]);

    const handleMomentumScrollEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        const index = Math.round(offsetY / CARD_ITEM_HEIGHT);
        currentIndexRef.current = index;
        const visible = visibleFeedListRef.current[index];
        if (visible) reportExposure(visible);

        if (visibleFeedListRef.current.length - index <= 5) {
            loadDataRef.current?.(false);
        }
    }, [reportExposure]);

    if (userHydrated && !cookies && networkStatus !== 'offline') {
        return <GuestHomeFeed active={active} />;
    }

    const searchAccessory = (
        <SearchBar
            label="搜索知乎内容"
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
            searchAccessoryBottomSpacing={10}
        >
            {displayMode === 'card' ? (
                <View
                    style={{ flex: 1, alignItems: 'center', width: '100%' }}
                    onLayout={(event) => setCardListHeight(event.nativeEvent.layout.height)}
                >
                    <HomeCardList
                        listRef={flatListRef}
                        itemExtent={CARD_ITEM_HEIGHT}
                        viewportHeight={cardListHeight}
                        bottomContentInset={bottomContentInset}
                        style={{ width: '100%', flex: 1 }}
                        data={visibleFeedList}
                        renderItem={renderCardListItem}
                        ListEmptyComponent={feedEmptyState}
                        keyExtractor={(item) => item.item.id.toString()}
                        snapToInterval={CARD_ITEM_HEIGHT}
                        snapToAlignment="start"
                        decelerationRate={0.96}
                        disableIntervalMomentum
                        showsVerticalScrollIndicator={false}
                        onEndReached={() => loadData(false)}
                        onEndReachedThreshold={0.8}
                        maxToRenderPerBatch={3}
                        windowSize={3}
                        initialNumToRender={2}
                        updateCellsBatchingPeriod={80}
                        onMomentumScrollEnd={handleMomentumScrollEnd}
                        onViewableItemsChanged={onViewableItemsChanged}
                        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
                        removeClippedSubviews={true}
                    />
                </View>
            ) : displayMode === 'waterfall' ? (
                <PageScrollView
                    pageScrollRef={waterfallScrollRef}
                    style={{ flex: 1 }}
                    contentContainerStyle={{ flexGrow: 1, paddingBottom: bottomContentInset }}
                    showsVerticalScrollIndicator={false}
                    scrollEventThrottle={32}
                    onScroll={handleWaterfallScroll}
                    onScrollEndDrag={handleWaterfallScrollSettled}
                    onMomentumScrollEnd={handleWaterfallScrollSettled}
                    refreshControl={(
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={() => { void refreshHome(false); }}
                            tintColor={theme.colors.primary}
                        />
                    )}
                >
                    {waterfallLayout.placements.length > 0 ? (
                        <View style={{ position: 'relative', width: '100%', height: waterfallLayout.contentHeight }}>
                            {renderedWaterfallItems.map(({ feed, column, top, height }) => (
                                <View
                                    key={`${feed.feedType}-${feed.item.id}`}
                                    style={{
                                        position: 'absolute',
                                        top,
                                        left: column === 0 ? 12 : 12 + waterfallColumnWidth + WATERFALL_GAP,
                                        width: waterfallColumnWidth,
                                    }}
                                >
                                    <WaterfallItem
                                        item={feed.item}
                                        type={feed.feedType}
                                        needToGet={true}
                                        measurementKey={`${feed.feedType}:${feed.item.id}`}
                                        showDomainLabels={domainLabelsEnabled}
                                        domainPriority={visibleDomainKeys.has(`${feed.feedType}:${feed.item.id}`) ? 'high' : 'low'}
                                        onMeasured={handleWaterfallMeasured}
                                        onOpenMenu={openActionMenu}
                                    />
                                </View>
                            ))}
                        </View>
                    ) : feedEmptyState}
                </PageScrollView>
            ) : (
                <PageFlatList
                    style={{ flex: 1 }}
                    contentContainerStyle={{ alignItems: 'center', paddingBottom: theme.spacing.md + bottomContentInset }}
                    data={visibleFeedList}
                    renderItem={renderListItem}
                    ListEmptyComponent={feedEmptyState}
                    keyExtractor={(item) => item.item.id.toString()}
                    refreshing={isRefreshing}
                    onRefresh={() => refreshHome(false)}
                    onEndReached={() => loadData(false)}
                    onEndReachedThreshold={0.8}
                    onViewableItemsChanged={onViewableItemsChanged}
                    viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
                    showsVerticalScrollIndicator={false}
                    maxToRenderPerBatch={4}
                    updateCellsBatchingPeriod={48}
                    windowSize={5}
                    initialNumToRender={4}
                    maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
                    removeClippedSubviews={true}
                />
            )}

            <Menu
                visible={actionMenuTarget !== null}
                onClose={closeActionMenu}
                anchor={actionMenuAnchor}
                items={actionMenuItems}
            />
        </PageScaffold>
    );
}

type HomeCardListProps<ItemT> = Omit<FlatListProps<ItemT>, 'contentContainerStyle' | 'getItemLayout' | 'ref'> & {
    listRef: React.RefObject<FlatList<ItemT> | null>;
    itemExtent: number;
    viewportHeight: number;
    bottomContentInset: number;
};

function HomeCardList<ItemT>({ listRef, itemExtent, viewportHeight, bottomContentInset, ...props }: HomeCardListProps<ItemT>) {
    const contentTopInset = usePageContentInset();
    const centerSpace = contentTopInset > 0
        ? Math.max(0, (viewportHeight - contentTopInset - bottomContentInset - itemExtent) / 2)
        : Math.max(0, (viewportHeight - itemExtent) / 2);
    const getItemLayout = (_data: ArrayLike<ItemT> | null | undefined, index: number) => ({
        length: itemExtent,
        // HyperOS keeps the previous offsets exactly; only floating Liquid Glass
        // pages include their reserved overlay inset in virtualized coordinates.
        offset: contentTopInset > 0 ? contentTopInset + centerSpace + itemExtent * index : itemExtent * index,
        index,
    });

    return (
        <PageFlatList
            listRef={listRef}
            {...props}
            contentContainerStyle={{
                alignItems: 'center',
                paddingTop: centerSpace,
                paddingBottom: centerSpace + bottomContentInset,
            }}
            getItemLayout={getItemLayout}
        />
    );
}

// PagerView changes activeIndex after a swipe; the feed owns its own store and
// state subscriptions, so the parent's tab update need not rerun this screen.
export default React.memo(HomeScreen);

import { FeedPage, Icon, Text, type FeedPageProps } from '@/src/ui';
import { useTheme } from '@/src/ui/theme';
import type { FeedItem, FeedType } from '@/src/types/zhihu';
import React, { useCallback } from 'react';
import type { ListRenderItem } from '@shopify/flash-list';
import { View } from 'react-native';

export interface ActivityFeedEntry {
    id: string;
    actionText: string;
    createdTime: number;
    displayTime: string;
    feedType: FeedType;
    item: FeedItem;
}

export function normalizeActivityFeedEntry(entry: Omit<ActivityFeedEntry, 'displayTime'>): ActivityFeedEntry {
    return {
        ...entry,
        id: String(entry.id),
        displayTime: new Date(entry.createdTime * 1000).toLocaleString(),
    };
}

export function normalizeActivityFeedItem(item: Partial<FeedItem> & Pick<FeedItem, 'id'>): FeedItem {
    return {
        id: String(item.id),
        title: item.title ?? '无标题',
        authorName: item.authorName ?? '匿名用户',
        authorUrlToken: item.authorUrlToken ?? '',
        authorAvatar: item.authorAvatar ?? '',
        excerpt: item.excerpt ?? '',
        updatedTime: item.updatedTime ?? 0,
        voteCount: item.voteCount ?? 0,
        favoriteCount: item.favoriteCount ?? 0,
        favorited: item.favorited,
        commentCount: item.commentCount ?? 0,
        content: item.content ?? '',
        questionTitle: item.questionTitle ?? '',
        questionExcerpt: item.questionExcerpt,
        questionId: item.questionId ?? '',
        questionTopicIds: item.questionTopicIds ?? [],
        questionAuthorName: item.questionAuthorName ?? '',
        questionAuthorAvatar: item.questionAuthorAvatar ?? '',
        questionAuthorUrlToken: item.questionAuthorUrlToken ?? '',
        questionAnswerCount: item.questionAnswerCount ?? 0,
        questionCreatedTime: item.questionCreatedTime ?? 0,
        recommendationReason: item.recommendationReason,
    };
}

export interface ActivityFeedProps extends Omit<
    FeedPageProps<ActivityFeedEntry>,
    'renderItem' | 'keyExtractor'
> {
    renderContent: (entry: ActivityFeedEntry) => React.ReactNode;
}

export function ActivityFeed({ renderContent, ...pageProps }: ActivityFeedProps) {
    const theme = useTheme();
    const secondaryColor = theme.colors.onSurfaceVariantSummary;
    const renderItem = useCallback<ListRenderItem<ActivityFeedEntry>>(({ item }) => (
        <View style={{ paddingHorizontal: 16, marginBottom: 16, alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 4 }}>
                <Icon name="history" size={16} color={secondaryColor} />
                <Text type="footnote1" color={secondaryColor}>
                    {item.actionText} · {item.displayTime}
                </Text>
            </View>
            {renderContent(item)}
        </View>
    ), [renderContent, secondaryColor]);
    const keyExtractor = useCallback<NonNullable<FeedPageProps<ActivityFeedEntry>['keyExtractor']>>(
        (item) => `${item.id}:${item.feedType}:${item.item.id}`,
        [],
    );

    return <FeedPage {...pageProps} renderItem={renderItem} keyExtractor={keyExtractor} />;
}

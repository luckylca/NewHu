import { followUser, getUserActivities, getUserInfo, unfollowUser } from "@/src/api/ZhihuApi";
import { Button, Divider, Icon } from "@/src/ui";
import { notify } from "@/src/stores/useNotificationStore";
import { Text } from "@/src/ui/primitives";
import { useTheme } from "@/src/ui/theme";
import { ActivityFeed, normalizeActivityFeedEntry, normalizeActivityFeedItem } from '@/src/components/feed/ActivityFeed';
import type { ActivityFeedEntry } from '@/src/components/feed/ActivityFeed';
import { formatProfileText } from '@/src/utils/profileText';
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { View } from "react-native";
import { RenderItem } from "./home";

export type PeopleParams = {
    urlToken:string
};

type PeopleHeaderProps = {
    userInfo: any;
    isFollowing: boolean;
    isFollowPending: boolean;
    onToggleFollow: () => void;
};

const PeopleHeader = React.memo(({ userInfo, isFollowing, isFollowPending, onToggleFollow }: PeopleHeaderProps) => {
    const theme = useTheme();
    const primaryText = theme.colors.onBackground;
    const secondaryText = theme.colors.onSurfaceSecondary;
    const headline = formatProfileText(userInfo.headline);
    const description = formatProfileText(userInfo.description);
    const coverSource = React.useMemo(() => ({ uri: userInfo.cover_url }), [userInfo.cover_url]);
    const avatarSource = React.useMemo(() => ({ uri: userInfo.avatar_url }), [userInfo.avatar_url]);
    const vipSource = React.useMemo(() => ({ uri: userInfo.vip_info?.vip_icon?.url }), [userInfo.vip_info?.vip_icon?.url]);

    const renderStats = (label: string, value: number) => (
        <View style={{ alignItems: 'center', flex: 1 }}>
            <Text type="title4" weight="bold" color={primaryText}>{value || 0}</Text>
            <Text type="footnote1" color={secondaryText}>{label}</Text>
        </View>
    );

    return (
        <View>
            <Image
                source={coverSource}
                style={[{ width: '100%', height: 160 }, { backgroundColor: theme.colors.secondaryContainer }]}
                contentFit="cover"
            />

            <View style={{ paddingHorizontal: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: -30, marginBottom: 16 }}>
                    <Image
                        source={avatarSource}
                        style={[{ width: 80, height: 80, borderRadius: 40, borderWidth: 3 }, { borderColor: theme.colors.background }]}
                        cachePolicy="memory-disk"
                        transition={0}
                    />
                    <View style={{ flex: 1, marginLeft: 12, marginTop: 36 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text type="title2" weight="bold" color={primaryText}>
                                {userInfo.name}
                            </Text>
                            {userInfo.vip_info?.is_vip && (
                                <Image
                                    source={vipSource}
                                    style={{ width: 40, height: 16 }}
                                    contentFit="contain"
                                    cachePolicy="memory-disk"
                                    transition={0}
                                />
                            )}
                        </View>
                        {headline ? (
                            <Text type="body2" style={{ color: secondaryText, marginTop: 4 }}>
                                {headline}
                            </Text>
                        ) : null}
                    </View>
                </View>

                <Button
                    type={isFollowing ? 'default' : 'primary'}
                    disabled={isFollowPending}
                    onPress={onToggleFollow}
                    style={{ alignSelf: 'flex-start', minWidth: 132, marginBottom: 8 }}
                >
                    {isFollowPending ? '处理中…' : isFollowing ? '取消关注' : '关注'}
                </Button>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 }}>
                    {renderStats("关注了", userInfo.following_count)}
                    {renderStats("关注者", userInfo.follower_count)}
                    {renderStats("获赞同", userInfo.voteup_count)}
                    {renderStats("获收藏", userInfo.favorited_count)}
                </View>

                <Divider style={{ marginVertical: 16 }} />

                <View style={{ marginBottom: 20 }}>
                    {description ? (
                        <Text type="body2" color={primaryText} style={{ marginBottom: 12 }}>
                            {description}
                        </Text>
                    ) : null}

                    <View style={{ gap: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Icon name="briefcase-outline" size={18} color={secondaryText} />
                            <Text type="body2" color={secondaryText}>
                                {userInfo.business?.name || "未知行业"}
                            </Text>
                        </View>

                        {userInfo.locations?.[0]?.name && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Icon name="map-marker-outline" size={18} color={secondaryText} />
                                <Text type="body2" color={secondaryText}>
                                    {userInfo.locations[0].name}
                                </Text>
                            </View>
                        )}

                        {userInfo.ip_info && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Icon name="ip-network-outline" size={18} color={secondaryText} />
                                <Text type="body2" color={secondaryText}>
                                    {userInfo.ip_info}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                <View style={{ marginTop: 24 }}>
                    <Text type="title4" weight="bold" color={primaryText} style={{ marginBottom: 12 }}>最新动态</Text>
                </View>
            </View>
        </View>
    );
});
PeopleHeader.displayName = 'PeopleHeader';

const PeopleScreen = () => {
    const {urlToken} = useLocalSearchParams<PeopleParams>()
    const theme = useTheme()
    const secondaryText = theme.colors.onSurfaceSecondary
    const router = useRouter()
    const [userInfo, setUserInfo] = React.useState<any>(null)
    const [isFollowing, setIsFollowing] = React.useState(false)
    const [isFollowPending, setIsFollowPending] = React.useState(false)
    const [offsetString, setOffsetString] = React.useState("")
    const [pageNum, setPageNum] = React.useState(1)

    // 动态列表状态
    const [activities, setActivities] = React.useState<ActivityFeedEntry[]>([])
    const [isLoadingActivities, setIsLoadingActivities] = React.useState(false)
    const [hasMoreActivities, setHasMoreActivities] = React.useState(true)
    const requestGenerationRef = React.useRef(0)
    const activeTokenRef = React.useRef<string | null>(null)
    const inflightCursorsRef = React.useRef(new Set<string>())
    const loadedCursorsRef = React.useRef(new Set<string>())
    const seenActivityIdsRef = React.useRef(new Set<string>())
    const hasUserStartedScrollingRef = React.useRef(false)

    const handleToggleFollow = React.useCallback(async () => {
        if (!urlToken || isFollowPending) return;

        const previousFollowing = isFollowing;
        const nextFollowing = !previousFollowing;
        setIsFollowPending(true);
        setIsFollowing(nextFollowing);
        setUserInfo((previous: any) => {
            if (!previous) return previous;
            const currentCount = Number(previous.follower_count) || 0;
            return {
                ...previous,
                is_following: nextFollowing,
                follower_count: Math.max(0, currentCount + (nextFollowing ? 1 : -1)),
            };
        });

        try {
            if (nextFollowing) {
                await followUser(urlToken);
            } else {
                await unfollowUser(urlToken);
            }
        } catch (error) {
            console.error('更新关注状态失败:', error);
            setIsFollowing(previousFollowing);
            setUserInfo((previous: any) => {
                if (!previous) return previous;
                const currentCount = Number(previous.follower_count) || 0;
                return {
                    ...previous,
                    is_following: previousFollowing,
                    follower_count: Math.max(0, currentCount + (previousFollowing ? 1 : -1)),
                };
            });
            notify('关注操作失败，请稍后重试');
        } finally {
            setIsFollowPending(false);
        }
    }, [isFollowPending, isFollowing, urlToken]);


    const fetchActivities = React.useCallback(async (
        token: string,
        currentOffset: string,
        currentPage: number,
        isRefresh = false,
        generation = requestGenerationRef.current,
    ) => {
        if (generation !== requestGenerationRef.current || activeTokenRef.current !== token) return;
        const cursorKey = JSON.stringify([token, currentOffset, currentPage]);
        if (inflightCursorsRef.current.has(cursorKey) || loadedCursorsRef.current.has(cursorKey)) return;
        inflightCursorsRef.current.add(cursorKey);
        setIsLoadingActivities(true);
        if (isRefresh) {
            seenActivityIdsRef.current.clear();
            loadedCursorsRef.current.clear();
            setActivities([]);
        }

        try {
            const data = await getUserActivities(token, currentOffset, currentPage);
            if (generation !== requestGenerationRef.current || activeTokenRef.current !== token) return;

            const rawActivities = Array.isArray(data?.data) ? data.data : [];
            const seenIds = seenActivityIdsRef.current;
            if (isRefresh) seenIds.clear();
            const freshActivities: ActivityFeedEntry[] = [];
            for (const activity of rawActivities) {
                const target = activity?.target;
                if (!target || (target.type !== 'answer' && target.type !== 'article')) continue;
                const targetId = target.id == null ? '' : String(target.id).trim();
                if (!targetId) continue;
                const activityId = String(activity.id ?? '').trim() ||
                    `${target.type}:${targetId}:${Number(activity.created_time) || 0}:${String(activity.action_text ?? '')}`;
                if (!activityId || seenIds.has(activityId)) continue;
                seenIds.add(activityId);
                freshActivities.push(normalizeActivityFeedEntry({
                    id: activityId,
                    actionText: String(activity.action_text ?? ''),
                    createdTime: Number(activity.created_time) || 0,
                    feedType: target.type,
                    item: normalizeActivityFeedItem({
                        id: targetId,
                        title: target.title || (target.question ? target.question.title : '无标题'),
                        authorName: target.author?.name || '匿名用户',
                        authorUrlToken: target.author?.url_token || '',
                        authorAvatar: target.author?.avatar_url || '',
                        excerpt: target.excerpt || '',
                        updatedTime: target.updated_time || target.created || 0,
                        voteCount: target.voteup_count || 0,
                        commentCount: target.comment_count || 0,
                        questionTitle: target.question?.title || '未知问题',
                        questionId: target.question?.id || '',
                    }),
                }));
            }

            if (__DEV__) {
                console.info(`[PEOPLE_PAGE] ${JSON.stringify({ token, currentOffset, currentPage, rawCount: rawActivities.length, displayedCount: freshActivities.length, ids: freshActivities.map((activity) => activity.id) })}`);
            }

            setActivities((previous) => {
                const base = isRefresh ? [] : previous;
                const mergedIds = new Set(base.map((activity) => activity.id));
                return [...base, ...freshActivities.filter((activity) => {
                    if (mergedIds.has(activity.id)) return false;
                    mergedIds.add(activity.id);
                    return true;
                })];
            });
            loadedCursorsRef.current.add(cursorKey);

            const paging = data?.paging;
            if (paging?.is_end === false && typeof paging.next === 'string' && paging.next.length > 0) {
                try {
                    const nextUrl = new URL(paging.next, 'https://www.zhihu.com');
                    const nextOffset = nextUrl.searchParams.get('offset') ?? currentOffset;
                    const requestedPage = Number(nextUrl.searchParams.get('page_num'));
                    const nextPage = Number.isInteger(requestedPage) && requestedPage > 0
                        ? requestedPage
                        : currentPage + 1;
                    const nextCursorKey = JSON.stringify([token, nextOffset, nextPage]);
                    if (nextCursorKey === cursorKey || loadedCursorsRef.current.has(nextCursorKey)) {
                        setHasMoreActivities(false);
                    } else {
                        setOffsetString(nextOffset);
                        setPageNum(nextPage);
                        setHasMoreActivities(true);
                    }
                } catch {
                    setHasMoreActivities(false);
                }
            } else {
                setHasMoreActivities(false);
            }
        } catch (error) {
            console.error("Failed to fetch user activities:", error);
        } finally {
            inflightCursorsRef.current.delete(cursorKey);
            if (generation === requestGenerationRef.current && activeTokenRef.current === token) {
                setIsLoadingActivities(false);
            }
        }
    }, []);

    React.useEffect(() => {
        if (!urlToken) return;
        const token = String(urlToken);
        const generation = requestGenerationRef.current + 1;
        requestGenerationRef.current = generation;
        activeTokenRef.current = token;
        inflightCursorsRef.current.clear();
        loadedCursorsRef.current.clear();
        seenActivityIdsRef.current.clear();
        hasUserStartedScrollingRef.current = false;

        getUserInfo(token).then((data) => {
            if (generation !== requestGenerationRef.current || activeTokenRef.current !== token) return;
            setUserInfo(data)
            setIsFollowing(Boolean(data?.is_following))
        }).catch((error) => {
            console.error("Failed to fetch user info:", error)
        })

        setActivities([]);
        setOffsetString("");
        setPageNum(1);
        setHasMoreActivities(true);
        void fetchActivities(token, "", 1, true, generation);

        return () => {
            if (requestGenerationRef.current === generation) requestGenerationRef.current += 1;
            if (activeTokenRef.current === token) activeTokenRef.current = null;
        };
    }, [fetchActivities, urlToken])

    React.useEffect(() => {
        if (__DEV__) {
            console.info(`[PEOPLE_STATE] ${JSON.stringify({ token: activeTokenRef.current, userLoaded: Boolean(userInfo), displayedCount: activities.length, displayedIds: activities.map((activity) => activity.id), isLoadingActivities, hasMoreActivities })}`);
        }
    }, [activities, hasMoreActivities, isLoadingActivities, userInfo]);

    const peopleHeader = React.useMemo(() => userInfo ? (
        <PeopleHeader
            userInfo={userInfo}
            isFollowing={isFollowing}
            isFollowPending={isFollowPending}
            onToggleFollow={handleToggleFollow}
        />
    ) : null, [handleToggleFollow, isFollowPending, isFollowing, userInfo]);

    const renderActivityContent = React.useCallback((activity: ActivityFeedEntry) => {
        if (__DEV__) console.info(`[PEOPLE_RENDER_ITEM] ${JSON.stringify({ id: activity.id, type: activity.feedType, itemId: activity.item.id })}`);
        return <RenderItem item={activity.item} type={activity.feedType} needToGet={true} />;
    }, []);
    const handleEndReached = React.useCallback(() => {
        if (hasUserStartedScrollingRef.current && !isLoadingActivities && hasMoreActivities) {
            void fetchActivities(urlToken, offsetString, pageNum);
        }
    }, [fetchActivities, hasMoreActivities, isLoadingActivities, offsetString, pageNum, urlToken]);
    const handleScrollBeginDrag = React.useCallback(() => {
        hasUserStartedScrollingRef.current = true;
    }, []);
    const activityFooter = React.useMemo(() => (
        <View style={{ marginVertical: 20, alignItems: 'center' }}>
            {isLoadingActivities && <Text type="body2" color={secondaryText}>加载中...</Text>}
            {!hasMoreActivities && activities.length > 0 && <Text type="body2" color={secondaryText}>没有更多了</Text>}
        </View>
    ), [activities.length, hasMoreActivities, isLoadingActivities, secondaryText]);

    return (
        <ActivityFeed
            title={userInfo?.name || '人物信息'}
            back={() => router.back()}
            data={activities}
            renderContent={renderActivityContent}
            header={peopleHeader}
            footer={activityFooter}
            emptyContent={!userInfo ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Text type="body1" color={secondaryText}>Loading...</Text>
                </View>
            ) : null}
            contentContainerStyle={{ paddingBottom: 40 }}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.5}
            onScrollBeginDrag={handleScrollBeginDrag}
            testID="people-feed"
        />
    );
}

export default PeopleScreen

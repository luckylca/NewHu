import { getUserActivities, getUserInfo } from "@/src/api/ZhihuApi";
import { Divider, Icon, TopAppBar } from "@/src/ui";
import { Text } from "@/src/ui/primitives";
import { useTheme } from "@/src/ui/theme";
import { useMonetTextColor } from '@/src/hooks/useMonetTextColor';
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { FlatList, View } from "react-native";
import { RenderItem } from "./home";

export type PeopleParams = {
    urlToken:string
};

const PeopleScreen = () => {
    const {urlToken} = useLocalSearchParams<PeopleParams>()
    const theme = useTheme()
    const wallpaperText = useMonetTextColor()
    const wallpaperSecondaryText = useMonetTextColor(true)
    const router = useRouter()
    const [userInfo, setUserInfo] = React.useState<any>(null)
    const [offsetString, setOffsetString] = React.useState("")
    const [pageNum, setPageNum] = React.useState(1)

    // 动态列表状态
    const [activities, setActivities] = React.useState<any[]>([])
    const [isLoadingActivities, setIsLoadingActivities] = React.useState(false)
    const [hasMoreActivities, setHasMoreActivities] = React.useState(true)

    React.useEffect(() => {
        if (urlToken) {
            getUserInfo(urlToken).then((data) => {
                setUserInfo(data)
            }).catch((error) => {
                console.error("Failed to fetch user info:", error)
            })

            // 初始加载动态
            setActivities([]);
            setOffsetString("");
            setPageNum(1);
            setHasMoreActivities(true);
            setTimeout(() => {
                fetchActivities(true);
            }, 0);
        }
    }, [urlToken])


    const fetchActivities = async (isRefresh = false) => {
        // 如果不是刷新，且已经在加载或是没有更多数据了，则直接返回
        if (!isRefresh && (isLoadingActivities || !hasMoreActivities)) return;

        const currentOffset = isRefresh ? "" : offsetString;
        const currentPage = isRefresh ? 1 : pageNum;

        setIsLoadingActivities(true);
        if (isRefresh) setActivities([]);

        try {
            const data = await getUserActivities(urlToken, currentOffset, currentPage);
            console.log("User activities data retrieved");

            if (data && data.data && data.data.length > 0) {
                // 清洗活动数据，将其转换为类似于 home.tsx 的 feedList 结构
                const processedActivities = data.data.map((activity: any) => {
                    const target = activity.target;

                    if (target && (target.type === 'answer' || target.type === 'article')) {
                        return {
                            id: activity.id,
                            actionText: activity.action_text,
                            createdTime: activity.created_time,
                            feedType: target.type,
                            item: {
                                id: target.id,
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
                            }
                        };
                    }
                    return null;
                }).filter((item: any) => item !== null);

                setActivities(prev => isRefresh ? processedActivities : [...prev, ...processedActivities]);

                if (data.paging && data.paging.is_end === false) {
                    const nextUrl = data.paging.next;
                    try {
                        const urlObj = new URL(nextUrl);
                        const nextOffset = urlObj.searchParams.get('offset') || "";
                        setOffsetString(nextOffset);
                        setPageNum(currentPage + 1);
                        setHasMoreActivities(true);
                    } catch (e) {
                         setHasMoreActivities(false);
                    }
                } else {
                    setHasMoreActivities(false);
                }
            } else {
                setHasMoreActivities(false);
            }
        } catch (error) {
            console.error("Failed to fetch user activities:", error);
        } finally {
            setIsLoadingActivities(false);
        }
    };

    const renderStats = (label: string, value: number) => (
        <View style={{ alignItems: 'center', flex: 1 }}>
            <Text type="title4" weight="bold" color={wallpaperText}>{value || 0}</Text>
            <Text type="footnote1" color={wallpaperSecondaryText}>{label}</Text>
        </View>
    );

    return (
        <View style={{ flex: 1 ,backgroundColor: theme.colors.background}}>
            <TopAppBar title={userInfo ? userInfo.name : "人物信息"} back={() => router.back()} />
            {userInfo ? (
                <FlatList
                    data={activities}
                    keyExtractor={(item, index) => item.id + index}
                    contentContainerStyle={{ paddingBottom: 40 }}
                    ListHeaderComponent={() => (
                        <View>
                            <Image
                                source={{ uri: userInfo.cover_url }}
                                style={[{ width: '100%', height: 160 }, { backgroundColor: theme.colors.secondaryContainer }]}
                                contentFit="cover"
                            />

                            <View style={{ paddingHorizontal: 16 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: -30, marginBottom: 16 }}>
                                    <Image
                                        source={{ uri: userInfo.avatar_url }}
                                        style={[{ width: 80, height: 80, borderRadius: 40, borderWidth: 3 }, { borderColor: theme.colors.background }]}
                                    />
                                    <View style={{ flex: 1, marginLeft: 12, marginTop: 36 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Text type="title2" weight="bold" color={wallpaperText}>
                                                {userInfo.name}
                                            </Text>
                                            {userInfo.vip_info?.is_vip && (
                                                <Image
                                                    source={{ uri: userInfo.vip_info.vip_icon?.url }}
                                                    style={{ width: 40, height: 16 }}
                                                    contentFit="contain"
                                                />
                                            )}
                                        </View>
                                        {userInfo.headline ? (
                                            <Text type="body2" numberOfLines={2} style={{ color: wallpaperSecondaryText, marginTop: 4 }}>
                                                {userInfo.headline}
                                            </Text>
                                        ) : null}
                                    </View>
                                </View>

                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 }}>
                                    {renderStats("关注了", userInfo.following_count)}
                                    {renderStats("关注者", userInfo.follower_count)}
                                    {renderStats("获赞同", userInfo.voteup_count)}
                                    {renderStats("获收藏", userInfo.favorited_count)}
                                </View>

                                <Divider style={{ marginVertical: 16 }} />

                                <View style={{ marginBottom: 20 }}>
                                    {userInfo.description ? (
                                        <Text type="body2" color={wallpaperText} style={{ marginBottom: 12 }}>
                                            {userInfo.description}
                                        </Text>
                                    ) : null}

                                    <View style={{ gap: 8 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <Icon name="briefcase-outline" size={18} color={wallpaperSecondaryText} />
                                            <Text type="body2" color={wallpaperSecondaryText}>
                                                {userInfo.business?.name || "未知行业"}
                                            </Text>
                                        </View>

                                        {userInfo.locations?.[0]?.name && (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                <Icon name="map-marker-outline" size={18} color={wallpaperSecondaryText} />
                                                <Text type="body2" color={wallpaperSecondaryText}>
                                                    {userInfo.locations[0].name}
                                                </Text>
                                            </View>
                                        )}

                                        {userInfo.ip_info && (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                <Icon name="ip-network-outline" size={18} color={wallpaperSecondaryText} />
                                                <Text type="body2" color={wallpaperSecondaryText}>
                                                    {userInfo.ip_info}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                </View>

                                <View style={{ marginTop: 24 }}>
                                    <Text type="title4" weight="bold" color={wallpaperText} style={{ marginBottom: 12 }}>最新动态</Text>
                                </View>
                            </View>
                        </View>
                    )}
                    renderItem={({ item }) => (
                        <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 4 }}>
                                <Icon name="history" size={16} color={wallpaperSecondaryText} />
                                <Text type="footnote1" color={wallpaperSecondaryText}>
                                    {item.actionText} · {new Date(item.createdTime * 1000).toLocaleString()}
                                </Text>
                            </View>
                            <RenderItem
                                item={item.item}
                                type={item.feedType}
                                needToGet={true}
                            />
                        </View>
                    )}
                    onEndReached={() => {
                        if (!isLoadingActivities && hasMoreActivities) {
                            fetchActivities();
                        }
                    }}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={() => (
                        <View style={{ marginVertical: 20, alignItems: 'center' }}>
                            {isLoadingActivities && <Text type="body2" color={wallpaperSecondaryText}>加载中...</Text>}
                            {!hasMoreActivities && activities.length > 0 && <Text type="body2" color={wallpaperSecondaryText}>没有更多了</Text>}
                        </View>
                    )}
                />
            ) : (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Text type="body1" color={wallpaperText}>Loading...</Text>
                </View>
            )}
        </View>
    )
}

export default PeopleScreen

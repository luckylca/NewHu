import { getQuestion, getQuestionAnswers } from "@/src/api/ZhihuApi";
import { Divider, Icon, ListRow, TopAppBar } from "@/src/ui";
import { Text } from "@/src/ui/primitives";
import { useTheme } from "@/src/ui/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { FlatList, Image, View } from "react-native";
import { RenderItem } from "./home";

export type QuestionParams = {
    id:string
};

const QuestionScreen = () => {
    const {id} = useLocalSearchParams<QuestionParams>()
    console.log("Question ID from params:", id);
    const theme = useTheme()
    const router = useRouter()
    const [questionInfo, setQuestionInfo] = React.useState<any>(null)
    const [offsetString, setOffsetString] = React.useState(0)
    const [pageNum, setPageNum] = React.useState(1)

    // 动态列表状态
    const [activities, setActivities] = React.useState<any[]>([])
    const [isLoadingActivities, setIsLoadingActivities] = React.useState(false)
    const [hasMoreActivities, setHasMoreActivities] = React.useState(true)

    React.useEffect(() => {
        if (id) {
            console.log("Fetching question info for ID:", id);
            getQuestion(id).then((data) => {
                setQuestionInfo(data)
                console.log("Question info retrieved:", data);
            }).catch((error) => {
                console.error("Failed to fetch question info:", error)
            })

            // 初始加载动态
            setActivities([]);
            setOffsetString(0);
            setPageNum(1);
            setHasMoreActivities(true);
            setTimeout(() => {
                fetchActivities(true);
            }, 0);
        }
    }, [id])


    const fetchActivities = async (isRefresh = false) => {
        // 如果不是刷新，且已经在加载或是没有更多数据了，则直接返回
        if (!isRefresh && (isLoadingActivities || !hasMoreActivities)) return;

        const currentOffset = isRefresh ? 0 : offsetString;
        const currentPage = isRefresh ? 1 : pageNum;

        setIsLoadingActivities(true);
        if (isRefresh) setActivities([]);

        try {
            const data = await getQuestionAnswers(id, currentOffset, "default");
            console.log("Question answers data retrieved");

            if (data && data.data && data.data.length > 0) {
                // 清洗活动数据，将其转换为类似于 home.tsx 的 feedList 结构
                const processedActivities = data.data.map((answer: any) => {
                    const authorName = answer.author?.name || '匿名用户';
                    return {
                        id: answer.id,
                        actionText: `${authorName} 回答了问题`,
                        createdTime: answer.created_time,
                        feedType: answer.type, // 'answer'
                        item: {
                            id: answer.id,
                            title: answer.excerpt || '无标题',
                            authorName: answer.author?.name || '匿名用户',
                            authorUrlToken: answer.author?.url_token || '',
                            authorAvatar: answer.author?.avatar_url || '',
                            excerpt: answer.excerpt || '',
                            updatedTime: answer.updated_time || answer.created_time || 0,
                            voteCount: answer.voteup_count || 0,
                            commentCount: answer.comment_count || 0,
                        }
                    };
                }).filter((item: any) => item !== null);

                setActivities(prev => isRefresh ? processedActivities : [...prev, ...processedActivities]);

                if (data.paging && data.paging.is_end === false) {
                    const nextUrl = data.paging.next;
                    try {
                        const urlObj = new URL(nextUrl);
                        const nextOffset = urlObj.searchParams.get('offset') || 0;
                        setOffsetString(Number(nextOffset));
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
            console.error("Failed to fetch question answers:", error);
        } finally {
            setIsLoadingActivities(false);
        }
    };

    const renderStats = (label: string, value: number) => (
        <View style={{ alignItems: 'center', flex: 1 }}>
            <Text type="title4" weight="bold">{value || 0}</Text>
            <Text type="footnote1" color={theme.colors.onSurfaceVariantSummary}>{label}</Text>
        </View>
    );

    return (
        <View style={{ flex: 1 ,backgroundColor: theme.colors.background}}>
            <TopAppBar title={questionInfo ? questionInfo.title : "问题信息"} back={() => router.back()} />
            {questionInfo ? (
                <FlatList
                    data={activities}
                    keyExtractor={(item, index) => item.id + index}
                    contentContainerStyle={{ paddingBottom: 40 }}
                    ListHeaderComponent={() => (
                        <View style={{ padding: 16, backgroundColor: theme.colors.surface }}>
                            <Text type="title2" weight="bold" style={{ marginBottom: 12 }}>
                                {questionInfo.title}
                            </Text>

                            {questionInfo.author && (
                                <ListRow
                                    icon={
                                        <Image
                                            source={{ uri: questionInfo.author.avatar_url }}
                                            style={{ width: 40, height: 40, borderRadius: theme.radius.full, backgroundColor: theme.colors.secondaryContainer }}
                                        />
                                    }
                                    title={questionInfo.author.name}
                                    summary={questionInfo.author.headline}
                                    onPress={() => {
                                        if (questionInfo.author.url_token) {
                                            router.push({ pathname: '/people', params: { urlToken: questionInfo.author.url_token } });
                                        }
                                    }}
                                    style={{ paddingHorizontal: 0, marginBottom: 4 }}
                                />
                            )}

                            <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginVertical: 12, paddingVertical: 12, backgroundColor: theme.colors.secondaryContainer, borderRadius: theme.radius.tabContour }}>
                                {renderStats("关注者", questionInfo.follower_count)}
                                {renderStats("浏览量", questionInfo.visit_count)}
                                {renderStats("回答", questionInfo.answer_count)}
                            </View>

                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                                <Text type="footnote1" color={theme.colors.onSurfaceVariantSummary}>
                                    提问于 {new Date(questionInfo.created * 1000).toLocaleDateString()}
                                </Text>
                                <Text type="footnote1" color={theme.colors.onSurfaceVariantSummary}>
                                    {questionInfo.comment_count} 条评论
                                </Text>
                            </View>
                            <Divider style={{ marginTop: 16 }} />
                        </View>
                    )}
                    renderItem={({ item }) => (
                        <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 4 }}>
                                <Icon name="history" size={16} color={theme.colors.onSurfaceVariantSummary} />
                                <Text type="footnote1" color={theme.colors.onSurfaceVariantSummary}>
                                    {item.actionText} · {new Date(item.createdTime * 1000).toLocaleString()}
                                </Text>
                            </View>
                            <RenderItem
                                item={item.item}
                                type={item.feedType}
                                needToGet={true}
                                hideTitle={true}
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
                            {isLoadingActivities && <Text type="body2" color={theme.colors.onSurfaceVariantSummary}>加载中...</Text>}
                            {!hasMoreActivities && activities.length > 0 && <Text type="body2" color={theme.colors.onSurfaceVariantSummary}>没有更多了</Text>}
                        </View>
                    )}
                />
            ) : (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Text type="body1">Loading...</Text>
                </View>
            )}
        </View>
    )
}

export default QuestionScreen;
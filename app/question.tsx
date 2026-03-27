import { getQuestion, getQuestionAnswers } from "@/src/api/ZhihuApi";
import { useAppTheme } from "@/src/hooks/useAppTheme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { Animated, FlatList, Image, Pressable, View } from "react-native";
import { Appbar, Divider, Text } from "react-native-paper";
import { RenderItem } from "./home";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type QuestionParams = {
    id:string
};

const QuestionScreen = () => {
    const {id} = useLocalSearchParams<QuestionParams>()
    console.log("Question ID from params:", id);
    const theme = useAppTheme()
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
            <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>{value || 0}</Text>
            <Text variant="labelMedium" style={{ color: theme.colors.outline }}>{label}</Text>
        </View>
    );

    return (        
        <View style={{ flex: 1 ,backgroundColor: theme.colors.background}}>
            <Appbar.Header style={{ backgroundColor: theme.colors.surface }}>
                <Appbar.BackAction onPress={() => router.back()} />
                <Appbar.Content title={questionInfo ? questionInfo.title : "问题信息"} />
            </Appbar.Header>
            {questionInfo ? (
                <FlatList
                    data={activities}
                    keyExtractor={(item, index) => item.id + index}
                    contentContainerStyle={{ paddingBottom: 40 }}
                    ListHeaderComponent={() => (
                        <View style={{ padding: 16, backgroundColor: theme.colors.surface }}>
                            <Text variant="headlineSmall" style={{ fontWeight: 'bold', marginBottom: 12 }}>
                                {questionInfo.title}
                            </Text>

                            {questionInfo.author && (
                                <AnimatedPressable 
                                    style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}
                                    onPress={() => {
                                        if (questionInfo.author.url_token) {
                                            router.push({ pathname: '/people', params: { urlToken: questionInfo.author.url_token } });
                                        }
                                    }}
                                    android_ripple={{ color: 'rgba(0,0,0,0.1)', borderless: true }}
                                >
                                    <Image 
                                        source={{ uri: questionInfo.author.avatar_url }} 
                                        style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12, backgroundColor: theme.colors.surfaceVariant }} 
                                    />
                                    <View style={{ flex: 1 }}>
                                        <Text variant="titleMedium" style={{ fontSize: 15, fontWeight: 'bold' }}>
                                            {questionInfo.author.name}
                                        </Text>
                                        {questionInfo.author.headline ? (
                                            <Text variant="bodySmall" style={{ color: theme.colors.outline, marginTop: 2 }} numberOfLines={1}>
                                                {questionInfo.author.headline}
                                            </Text>
                                        ) : null}
                                    </View>
                                </AnimatedPressable>
                            )}

                            <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginVertical: 12, paddingVertical: 12, backgroundColor: theme.colors.surfaceVariant, borderRadius: 8 }}>
                                {renderStats("关注者", questionInfo.follower_count)}
                                {renderStats("浏览量", questionInfo.visit_count)}
                                {renderStats("回答", questionInfo.answer_count)}
                            </View>
                            
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                                <Text variant="labelMedium" style={{ color: theme.colors.outline }}>
                                    提问于 {new Date(questionInfo.created * 1000).toLocaleDateString()}
                                </Text>
                                <Text variant="labelMedium" style={{ color: theme.colors.outline }}>
                                    {questionInfo.comment_count} 条评论
                                </Text>
                            </View>
                            <Divider style={{ marginTop: 16 }} />
                        </View>
                    )}
                    renderItem={({ item }) => (
                        <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 4 }}>
                                <MaterialCommunityIcons name="history" size={16} color={theme.colors.onSurfaceVariant} />
                                <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
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
                            {isLoadingActivities && <Text style={{ color: theme.colors.onSurfaceVariant }}>加载中...</Text>}
                            {!hasMoreActivities && activities.length > 0 && <Text style={{ color: theme.colors.onSurfaceVariant }}>没有更多了</Text>}
                        </View>
                    )}
                />
            ) : (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Text>Loading...</Text>
                </View>
            )}
        </View>
    )
}

export default QuestionScreen;
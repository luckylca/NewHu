import { getQuestion, getQuestionAnswers } from "@/src/api/ZhihuApi";
import { Card, Divider, ListRow, PageFlatList, PageScaffold, TopAppBar } from "@/src/ui";
import { Text } from "@/src/ui/primitives";
import { useTheme } from "@/src/ui/theme";
import { ActivityFeed, normalizeActivityFeedEntry, normalizeActivityFeedItem } from '@/src/components/feed/ActivityFeed';
import type { ActivityFeedEntry } from '@/src/components/feed/ActivityFeed';
import { formatProfileText } from '@/src/utils/profileText';
import { useUserStore } from '@/src/stores/useUserStore';
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { Image, View } from "react-native";
import { RenderItem } from "./home";
import { DiagnosticListCell, isPageRenderDiagnosticsEnabled, recordPageRenderDiagnostic } from '@/src/components/feed/pageRenderDiagnostics';

export type QuestionParams = {
    id: string;
    title?: string;
    excerpt?: string;
    authorName?: string;
    authorAvatar?: string;
    answerCount?: string;
    followerCount?: string;
    commentCount?: string;
    createdAt?: string;
    questionRuntime?: string | string[];
};

function routeString(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

const QuestionScreen = () => {
    const params = useLocalSearchParams<QuestionParams>();
    const id = routeString(params.id);
    const requestedRuntime = routeString(params.questionRuntime);
    const diagnosticRuntime = __DEV__ && (requestedRuntime === 'home' || requestedRuntime === 'generic');
    const useHomeListRuntime = diagnosticRuntime && requestedRuntime === 'home';
    if (__DEV__ && isPageRenderDiagnosticsEnabled()) recordPageRenderDiagnostic('question', 'screenRenders');
    const routeTitle = routeString(params.title);
    const routeExcerpt = routeString(params.excerpt);
    const routeAuthorName = routeString(params.authorName);
    const routeAuthorAvatar = routeString(params.authorAvatar);
    const routeAnswerCount = routeString(params.answerCount);
    const routeFollowerCount = routeString(params.followerCount);
    const routeCommentCount = routeString(params.commentCount);
    const routeCreatedAt = routeString(params.createdAt);
    const cookies = useUserStore((state) => state.cookies);
    const theme = useTheme()
    const router = useRouter()
    const [questionInfo, setQuestionInfo] = React.useState<any>(null)
    const [offsetString, setOffsetString] = React.useState(0)
    const [pageNum, setPageNum] = React.useState(1)

    // 动态列表状态
    const [activities, setActivities] = React.useState<ActivityFeedEntry[]>([])
    const [isLoadingActivities, setIsLoadingActivities] = React.useState(false)
    const [hasMoreActivities, setHasMoreActivities] = React.useState(true)

    const fetchActivities = React.useCallback(async (
        questionId: string,
        currentOffset: number,
        currentPage: number,
        isRefresh = false,
    ) => {
        setIsLoadingActivities(true);
        if (isRefresh) setActivities([]);

        try {
            const data = await getQuestionAnswers(questionId, currentOffset, "default");
            console.log("Question answers data retrieved");

            if (data && data.data && data.data.length > 0) {
                // 清洗活动数据，将其转换为类似于 home.tsx 的 feedList 结构
                const mappedActivities = data.data.map((answer: any) => {
                    const authorName = answer.author?.name || '匿名用户';
                    return normalizeActivityFeedEntry({
                        id: String(answer.id),
                        actionText: `${authorName} 回答了问题`,
                        createdTime: Number(answer.created_time) || 0,
                        feedType: 'answer',
                        item: normalizeActivityFeedItem({
                            id: String(answer.id),
                            title: answer.excerpt || '无标题',
                            authorName,
                            authorUrlToken: answer.author?.url_token || '',
                            authorAvatar: answer.author?.avatar_url || '',
                            excerpt: answer.excerpt || '',
                            updatedTime: answer.updated_time || answer.created_time || 0,
                            voteCount: answer.voteup_count || 0,
                            commentCount: answer.comment_count || 0,
                            questionTitle: answer.question?.title || '',
                            questionId: answer.question?.id ? String(answer.question.id) : questionId,
                        }),
                    });
                }).filter((item: any) => item !== null);
                const processedActivities = diagnosticRuntime ? mappedActivities.slice(0, 20) : mappedActivities;
                if (diagnosticRuntime) {
                    console.info('[QUESTION_CANDIDATE_DATA]', JSON.stringify({
                        questionId,
                        runtime: requestedRuntime,
                        mappedAnswers: mappedActivities.length,
                        fixedAnswerCount: processedActivities.length,
                        answerIds: processedActivities.map((entry: ActivityFeedEntry) => entry.item.id),
                    }));
                }

                setActivities(prev => isRefresh ? processedActivities : [...prev, ...processedActivities]);

                if (data.paging && data.paging.is_end === false) {
                    const nextUrl = data.paging.next;
                    try {
                        const urlObj = new URL(nextUrl);
                        const nextOffset = urlObj.searchParams.get('offset') || 0;
                        setOffsetString(Number(nextOffset));
                        setPageNum(currentPage + 1);
                        setHasMoreActivities(true);
                    } catch {
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
    }, [diagnosticRuntime, requestedRuntime]);

    React.useEffect(() => {
        if (!id || !cookies) {
            setQuestionInfo(null);
            setActivities([]);
            setHasMoreActivities(false);
            return;
        }

        console.log("Fetching question info for ID:", id);
        getQuestion(id).then((data) => {
            setQuestionInfo(data)
            console.log("Question info retrieved:", data);
        }).catch((error) => {
            console.error("Failed to fetch question info:", error)
        })

        setActivities([]);
        setOffsetString(0);
        setPageNum(1);
        setHasMoreActivities(true);
        void fetchActivities(id, 0, 1, true);
    }, [cookies, fetchActivities, id])

    const guestQuestionInfo = React.useMemo(() => {
        if (cookies || !routeTitle) return null;
        return {
            title: routeTitle,
            excerpt: routeExcerpt,
            author: routeAuthorName ? {
                name: routeAuthorName,
                avatar_url: routeAuthorAvatar,
                url_token: '',
                headline: '',
            } : null,
            answer_count: Number(routeAnswerCount) || 0,
            follower_count: Number(routeFollowerCount) || 0,
            comment_count: Number(routeCommentCount) || 0,
            created: Number(routeCreatedAt) || 0,
            visit_count: 0,
        };
    }, [cookies, routeAnswerCount, routeAuthorAvatar, routeAuthorName, routeCommentCount, routeCreatedAt, routeExcerpt, routeFollowerCount, routeTitle]);
    const visibleQuestionInfo = cookies ? questionInfo : guestQuestionInfo;

    const renderStats = React.useCallback((label: string, value: number) => (
        <View style={{ alignItems: 'center', flex: 1 }}>
            <Text type="title4" weight="bold">{value || 0}</Text>
            <Text type="footnote1" color={theme.colors.onSurfaceVariantSummary}>{label}</Text>
        </View>
    ), [theme.colors.onSurfaceVariantSummary]);

    const questionHeader = React.useMemo(() => {
        if (__DEV__ && isPageRenderDiagnosticsEnabled()) recordPageRenderDiagnostic('question', 'headerRenders');
        return (
        <View style={{ padding: 16, backgroundColor: theme.colors.surface }}>
            <Text type="title2" weight="bold" style={{ marginBottom: 12 }}>
                {visibleQuestionInfo?.title}
            </Text>

            {!cookies && visibleQuestionInfo?.excerpt ? (
                <Text type="body1" color={theme.colors.onSurfaceVariantSummary} style={{ marginBottom: 12, lineHeight: 25 }}>
                    {visibleQuestionInfo.excerpt}
                </Text>
            ) : null}

            {visibleQuestionInfo?.author && (
                <ListRow
                    icon={
                        <Image
                            source={{ uri: visibleQuestionInfo.author.avatar_url }}
                            style={{ width: 40, height: 40, borderRadius: theme.radius.full, backgroundColor: theme.colors.secondaryContainer }}
                        />
                    }
                    title={visibleQuestionInfo.author.name}
                    summary={formatProfileText(visibleQuestionInfo.author.headline)}
                    onPress={cookies && visibleQuestionInfo.author.url_token
                        ? () => router.push({ pathname: '/people', params: { urlToken: visibleQuestionInfo.author.url_token } })
                        : undefined}
                    style={{ paddingHorizontal: 0, marginBottom: 4 }}
                />
            )}

            <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginVertical: 12, paddingVertical: 12, backgroundColor: theme.colors.secondaryContainer, borderRadius: theme.radius.tabContour }}>
                {renderStats('关注者', visibleQuestionInfo?.follower_count)}
                {renderStats('浏览量', visibleQuestionInfo?.visit_count)}
                {renderStats('回答', visibleQuestionInfo?.answer_count)}
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <Text type="footnote1" color={theme.colors.onSurfaceVariantSummary}>
                    {visibleQuestionInfo?.created ? `提问于 ${new Date(visibleQuestionInfo.created * 1000).toLocaleDateString()}` : '知乎公开热榜'}
                </Text>
                <Text type="footnote1" color={theme.colors.onSurfaceVariantSummary}>
                    {visibleQuestionInfo?.comment_count} 条评论
                </Text>
            </View>
            {!cookies ? (
                <Card feedback="none" style={{ marginTop: 16 }} contentStyle={{ padding: 14 }}>
                    <Text type="body2" color={theme.colors.onSurfaceVariantSummary}>
                        游客模式显示 Android 推荐卡片提供的问题摘要。知乎可能限制此问题的匿名回答列表。
                    </Text>
                </Card>
            ) : null}
            <Divider style={{ marginTop: 16 }} />
        </View>
        );
    }, [cookies, renderStats, router, theme.colors.onSurfaceVariantSummary, theme.colors.secondaryContainer, theme.colors.surface, theme.radius.full, theme.radius.tabContour, visibleQuestionInfo]);

    const renderActivityContent = React.useCallback((activity: ActivityFeedEntry) => {
        const item = (
            <RenderItem
                item={activity.item}
                type={activity.feedType}
                needToGet={true}
                hideTitle={true}
                diagnosticPage={__DEV__ && isPageRenderDiagnosticsEnabled() ? 'question' : undefined}
            />
        );
        return __DEV__ && isPageRenderDiagnosticsEnabled()
            ? <DiagnosticListCell page="question">{item}</DiagnosticListCell>
            : item;
    }, []);
    const handleEndReached = React.useCallback(() => {
        if (diagnosticRuntime) return;
        if (!isLoadingActivities && hasMoreActivities) {
            void fetchActivities(id, offsetString, pageNum);
        }
    }, [diagnosticRuntime, fetchActivities, hasMoreActivities, id, isLoadingActivities, offsetString, pageNum]);
    const activityFooter = React.useMemo(() => (
        <View style={{ marginVertical: 20, alignItems: 'center' }}>
            {isLoadingActivities && <Text type="body2" color={theme.colors.onSurfaceVariantSummary}>加载中...</Text>}
            {!hasMoreActivities && activities.length > 0 && <Text type="body2" color={theme.colors.onSurfaceVariantSummary}>没有更多了</Text>}
        </View>
    ), [activities.length, hasMoreActivities, isLoadingActivities, theme.colors.onSurfaceVariantSummary]);
    const renderHomeRuntimeItem = React.useCallback(({ item }: { item: ActivityFeedEntry }) => {
        const content = (
            <RenderItem
                item={item.item}
                type={item.feedType}
                needToGet={true}
                hideTitle={true}
                diagnosticPage={__DEV__ && isPageRenderDiagnosticsEnabled() ? 'question' : undefined}
            />
        );
        return __DEV__ && isPageRenderDiagnosticsEnabled()
            ? <DiagnosticListCell page="question">{content}</DiagnosticListCell>
            : content;
    }, []);

    const emptyContent = !visibleQuestionInfo ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text type="body1" color={theme.colors.onSurfaceVariantSummary}>
                {cookies ? 'Loading...' : '公开问题摘要不可用，请从首页热榜重新打开。'}
            </Text>
        </View>
    ) : null;

    if (useHomeListRuntime) {
        const fixedAnswers = activities.slice(0, 20);
        return (
            <PageScaffold topBar={<TopAppBar title={visibleQuestionInfo?.title || '问题信息'} back={() => router.back()} />}>
                <PageFlatList
                    data={fixedAnswers}
                    renderItem={renderHomeRuntimeItem}
                    keyExtractor={(item) => item.id}
                    ListHeaderComponent={visibleQuestionInfo ? questionHeader : null}
                    ListEmptyComponent={emptyContent}
                    contentContainerStyle={{ alignItems: 'center', paddingBottom: 40 }}
                    showsVerticalScrollIndicator={false}
                    initialNumToRender={4}
                    maxToRenderPerBatch={4}
                    windowSize={5}
                    updateCellsBatchingPeriod={48}
                    removeClippedSubviews={true}
                    testID="question-home-runtime"
                />
            </PageScaffold>
        );
    }

    return (
        <ActivityFeed
            title={visibleQuestionInfo?.title || '问题信息'}
            back={() => router.back()}
            data={activities}
            renderContent={renderActivityContent}
            header={visibleQuestionInfo ? questionHeader : null}
            footer={activityFooter}
            emptyContent={emptyContent}
            contentContainerStyle={{ paddingBottom: 40 }}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.5}
            testID="question-feed"
        />
    );
}

export default QuestionScreen;

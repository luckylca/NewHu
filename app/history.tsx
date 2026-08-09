import { getReadHistory } from "@/src/api/ZhihuApi";
import LoadingView from "@/src/components/LoadingView";
import { Appbar, Text } from "@/src/components/ui";
import { useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import { FlatList, View } from "react-native";
import { RenderItem } from "./home";
import { useFocusEffect } from "@react-navigation/native";

const PAGE_SIZE = 20;

export default function HistoryScreen() {
    const router = useRouter();

    const [historyData, setHistoryData] = useState<any[]>([]);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);

    const offsetRef = useRef(0);
    const inFlightRef = useRef(false);

    const parseAgreeComment = useCallback((text?: string) => {
        if (!text) return null;
        const m = text.match(/([\d.]+)\s*(万)?\s*赞同\s*·\s*([\d.]+)\s*(万)?\s*评论/);
        if (!m) return null;

        const toNum = (numStr: string, unitWan?: string) => {
            const n = Number(numStr);
            if (Number.isNaN(n)) return 0;
            return unitWan ? Math.round(n * 10000) : n;
        };

        return { agree: toNum(m[1], m[2]), comment: toNum(m[3], m[4]) };
    }, []);

    const processHistoryItem = useCallback(
        (item: any) => {
            if (!item?.extra) return null;

            const text = item?.matrix?.[0]?.data?.text ?? "";
            const parsed = parseAgreeComment(text);

            return {
                id: String(item.extra.content_token),
                feedType: item.extra.content_type, // 'answer' | 'article'
                excerpt: item?.content?.summary ?? "",
                questionTitle: item?.header?.title ?? "",
                title: item?.header?.title ?? "",
                voteCount: parsed?.agree ?? 0,
                commentCount: parsed?.comment ?? 0,
            };
        },
        [parseAgreeComment]
    );

    const fetchHistory = useCallback(
        async (mode: "refresh" | "more" = "refresh") => {
            if (inFlightRef.current) return; // 防止重复触发
            inFlightRef.current = true;

            const isRefresh = mode === "refresh";
            if (isRefresh) {
                setIsRefreshing(true);
                setLoading(true);
            }

            const nextOffset = isRefresh ? 0 : offsetRef.current + PAGE_SIZE;
            try {
                const res = await getReadHistory(nextOffset);
                const raw = res.data as any[];

                const cleanData = raw
                    .map((x) => x.data)
                    .filter(
                        (d) => d && (d.extra?.content_type === "answer" || d.extra?.content_type === "article")
                    );

                const processedItems = cleanData.map(processHistoryItem).filter(Boolean);

                offsetRef.current = nextOffset;

                setHistoryData((prev) => (isRefresh ? processedItems : [...prev, ...processedItems]));
            } catch (e) {
                console.error("获取数据失败:", e);
            } finally {
                inFlightRef.current = false;
                setIsRefreshing(false);
                setLoading(false);
            }
        },
        [processHistoryItem]
    );

    // 进入页面自动刷新；离开页面清空
    useFocusEffect(
        useCallback(() => {
            fetchHistory("refresh");
            return () => {
                offsetRef.current = 0;
                setHistoryData([]);
                setIsRefreshing(false);
                setLoading(true);
            };
        }, [fetchHistory])
    );

    return (
        <View style={{ flex: 1 }}>
            <Appbar.Header>
                <Appbar.BackAction onPress={() => router.back()} />
                <Appbar.Content title="浏览历史" />
            </Appbar.Header>

            <FlatList
                data={historyData}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <RenderItem item={item} type={item.feedType} needToGet={true} />}
                contentContainerStyle={{ padding: 16 }}
                onRefresh={() => fetchHistory("refresh")}
                refreshing={isRefreshing}
                onEndReachedThreshold={0.3}
                onEndReached={() => fetchHistory("more")}
                ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                ListEmptyComponent={() =>
                    loading ? (
                        <LoadingView />
                    ) : (
                        <View style={{ marginTop: 50, alignItems: "center" }}>
                            <Text style={{ opacity: 0.6 }}>没有浏览历史记录</Text>
                        </View>
                    )
                }
            />
        </View>
    );
}
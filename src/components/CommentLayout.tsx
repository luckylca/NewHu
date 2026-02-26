import React, { useEffect } from "react";
import { View, FlatList } from "react-native";
import { getRootComments } from "@/src/api/ZhihuApi";
import CommentText from "@/src/components/CommentText";
import { EMOJI_URL_MAP } from "@/src/constants/emoji";
import { useTheme, Avatar, IconButton, Text } from "react-native-paper";


type CommentLayoutProps = {
    id: string;
    type: string;
}

export const CommentLayout = ({ id, type }: CommentLayoutProps) => {
    const theme = useTheme();
    const [offset, setOffset] = React.useState("");
    const [sort, setSort] = React.useState("score");
    const [comments, setComments] = React.useState<any[]>([]);
    const [commentCount, setCommentCount] = React.useState(0);
    type = type === 'answer' ? 'answers' : type === 'article' ? 'articles' : type;
    useEffect(() => {

        loadComments();

    }, [id, type]);

    const rootCommentsClear = (item: any) => {
        return {
            id: item.id,
            content: item.content,
            createdTime: item.created_time,
            authorUrlToken: item.author.url_token,
            authorName: item.author.name,
            authorAvatar: item.author.avatar_url,
            voteCount: item.like_count,
            isVote: item.liked,
            isHot: item.hot,
            isTop: item.top,
            childCommentCount: item.child_comment_count,
        }
    }

    const loadComments = async () => {
        try {
            console.log(id, type)
            const data = await getRootComments(id, type, offset, sort);
            setCommentCount(data.counts.total_counts);
            setOffset(data.paging.next ?? "");
            const clearedComments = data.data.map(rootCommentsClear);
            console.log("加载评论成功:", clearedComments);
            setComments(prev => [...prev, ...clearedComments]);
        } catch (e) {
            console.error("加载评论失败:", e);
        }
    };




    const RenderCommentItem = ({ item }: { item: any }) => {

        const formatTime = (ts: number) => {
            // created_time 看起来是 seconds，按需改成 ms
            const d = new Date(ts * 1000);
            return d.toLocaleString();
        };

        const Tag = ({
            label,
            bg,
            fg,
        }: {
            label: string;
            bg: string;
            fg: string;
        }) => (
            <View
                style={{
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 999,
                    alignSelf: "center",
                    marginLeft: 8,
                    backgroundColor: bg,
                }}
            >
                <Text variant="labelSmall" style={{ color: fg }}>
                    {label}
                </Text>
            </View>
        );

        return (
            <View
                style={{
                    borderRadius: 20,
                    backgroundColor: theme.colors.surface,
                    borderWidth: 1,
                    borderColor: theme.colors.outlineVariant,
                    overflow: "hidden",
                    marginBottom: 12,
                }}
            >
                <View style={{ paddingHorizontal: 12, paddingVertical: 12 }}>
                    {/* Header */}
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <Avatar.Image
                            size={36}
                            source={item.authorAvatar ? { uri: item.authorAvatar } : undefined}
                            style={{
                                backgroundColor: theme.colors.surfaceVariant,
                                marginRight: 12,
                            }}
                        />

                        <View style={{ flex: 1, minWidth: 0 }}>
                            <Text
                                variant="titleSmall"
                                numberOfLines={1}
                                style={{ color: theme.colors.onSurface }}
                            >
                                {item.authorName}
                            </Text>

                            <View
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    marginTop: 2,
                                    flexWrap: "wrap",
                                }}
                            >
                                <Text
                                    variant="labelSmall"
                                    style={{ color: theme.colors.onSurfaceVariant }}
                                >
                                    {formatTime(item.createdTime)}
                                </Text>

                                {item.isTop ? (
                                    <Tag
                                        label="置顶"
                                        bg={theme.colors.tertiaryContainer}
                                        fg={theme.colors.onTertiaryContainer}
                                    />
                                ) : null}

                                {item.isHot ? (
                                    <Tag
                                        label="热"
                                        bg={theme.colors.secondaryContainer}
                                        fg={theme.colors.onSecondaryContainer}
                                    />
                                ) : null}
                            </View>
                        </View>

                        {/* Actions */}
                        <View style={{ flexDirection: "row", alignItems: "center", marginLeft: 8 }}>
                            <IconButton
                                icon={item.isVote ? "thumb-up" : "thumb-up-outline"}
                                size={18}
                                onPress={() => { }}
                                iconColor={
                                    item.isVote ? theme.colors.primary : theme.colors.onSurfaceVariant
                                }
                                style={{ margin: 0 }}
                            />
                            <Text
                                variant="labelSmall"
                                style={{
                                    color: theme.colors.onSurfaceVariant,
                                    minWidth: 20,
                                    textAlign: "right",
                                }}
                            >
                                {item.voteCount}
                            </Text>
                        </View>
                    </View>

                    {/* Body */}
                    <View style={{ marginTop: 10 }}>
                        <CommentText content={item.content} emojiMap={EMOJI_URL_MAP} />
                    </View>

                    {/* Footer */}
                    {item.childCommentCount > 0 ? (
                        <View style={{ marginTop: 10, flexDirection: "row", alignItems: "center" }}>
                            <Text variant="labelMedium" style={{ color: theme.colors.primary }}>
                                查看 {item.childCommentCount} 条回复
                            </Text>
                        </View>
                    ) : null}
                </View>
            </View>
        );
    };

    return (
        <View style={{ flex: 1, padding: 16 }}>
            <FlatList
                data={comments}
                scrollEnabled={false}
                keyExtractor={(item) => item.id}
                renderItem={RenderCommentItem}
            />
        </View>
    )
}
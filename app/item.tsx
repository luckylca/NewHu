import React from "react";
import { View, ScrollView, useWindowDimensions, Pressable } from "react-native";
import { Appbar, Text, Avatar, Divider, useTheme } from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useContentStore } from "@/src/stores/useContentStore";
import RenderHtml from 'react-native-render-html';

export default function Item() {
    const { id, type } = useLocalSearchParams();
    const contentStore = useContentStore();
    const router = useRouter();
    const theme = useTheme();
    const { width } = useWindowDimensions();

    const readData = contentStore.feedList.find((item) => String(item.item.id) === String(id))?.item;

    if (!readData) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
                <Text>数据加载失败或不存在</Text>
            </View>
        );
    }

    const title = type === 'answer' ? readData.questionTitle : (readData.title || '未知标题');
    const htmlContent = readData.content || "<p>暂无正文内容</p>";

    // 注意：RenderHtml 的 tagsStyles 必须是一个对象传递，这部分保持不变
    const tagsStyles = {
        body: { color: theme.colors.onSurface, fontSize: 16, lineHeight: 28 },
        p: { marginBottom: 16 },
        figure: { margin: 0, marginTop: 8, marginBottom: 8 },
        img: { borderRadius: 12 }
    };

    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
            {/* 顶部导航栏 */}
            <Appbar.Header elevated>
                <Appbar.BackAction onPress={() => router.back()} />
                <Appbar.Content title={type === 'answer' ? '回答详情' : '文章详情'} />
            </Appbar.Header>

            <ScrollView
                contentContainerStyle={{ padding: 10 }}
                showsVerticalScrollIndicator={false}
            >
                {/* 标题 */}
                <Pressable
                    onPress={() => console.log('点击了标题')}
                    android_ripple={{ color: 'rgba(0,0,0,0.15)', foreground: true }}
                    style={{
                        width: '100%',
                        borderRadius: 16,
                        height:'auto',
                        overflow: 'hidden',
                        paddingTop: 8,
                        paddingBottom: 8,
                    }}
                >
                    <Text variant="headlineSmall" style={{ fontWeight: 'bold' }}>
                        {title}
                    </Text>
                </Pressable>

                {/* 作者信息区域 */}
                <Pressable
                    onPress={() => console.log('点击了作者信息')}
                    android_ripple={{ color: 'rgba(0,0,0,0.15)', foreground: true }}
                    style={{
                        width: '100%',
                        borderRadius: 16,
                        height:'auto',
                        overflow: 'hidden',
                        paddingTop: 8,
                        paddingBottom: 8,
                    }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {readData.authorAvatar ? (
                            <Avatar.Image size={40} source={{ uri: readData.authorAvatar }} />
                        ) : (
                            <Avatar.Text size={40} label={readData.authorName?.substring(0, 1) || '佚'} />
                        )}
                        <View style={{ marginLeft: 12, justifyContent: 'center' }}>
                            <Text variant="titleMedium">{readData.authorName}</Text>
                            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                                {readData.updatedTime ? new Date(readData.updatedTime * 1000).toLocaleDateString() : '最近更新'}
                            </Text>
                        </View>
                    </View>
                </Pressable>
                {/* 分割线 */}
                <Divider style={{ marginVertical: 16 }} />

                {/* HTML 正文渲染 */}
                <RenderHtml
                    contentWidth={width - 32}
                    source={{ html: htmlContent }}
                    tagsStyles={tagsStyles}
                    enableExperimentalMarginCollapsing={true}
                />

                {/* 底部留白 */}
                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}
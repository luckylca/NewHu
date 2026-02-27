// app/item/type/[id]/index.tsx
import ImageReanimatedModal from "@/src/components/ImageReanimatedModal";
import { useContentStore } from "@/src/stores/useContentStore";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Image, Pressable, ScrollView, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { Appbar, Avatar, Divider, Portal, Text, useTheme } from "react-native-paper";
import RenderHtml from 'react-native-render-html';
import { getAnswer,getArticle,addReadHistory } from "@/src/api/ZhihuApi";
import LoadingView from "@/src/components/LoadingView";


export type ItemParams = {
    id: string;
    type: 'answer' | 'article';
    needToGet?: 'true' | 'false';
};
export default function Item() {
    const { id, type,needToGet } = useLocalSearchParams<ItemParams>();
    const contentStore = useContentStore();
    const router = useRouter();
    const theme = useTheme();
    const [orgin, setOrigin] = useState({ x: 0, y: 0, width: 0, height: 0 });
    const [modalVisible, setModalVisible] = useState(false);
    const [imageUrl, setImageUrl] = useState("");
    const { width } = useWindowDimensions();
    const [readData, setReadData] = useState<any>(null);
    useEffect(() => {
        addReadHistory(String(id), type === 'answer' ? 'answer' : 'article')
        console.log('添加阅读历史：', { id, type });
    }, [id, type]);
    useEffect(() => {
        if (needToGet==='true') {
            if (type === 'answer') {
                getAnswer(String(id)).then((data) => {
                    const tmpReadData = {
                        id: data.id,
                        title: data.title || '无标题',
                        authorName: data.author?.name || '匿名用户',
                        authorUrlToken: data.author?.url_token || '',
                        authorAvatar: data.author?.avatar_url || '',
                        excerpt: data.excerpt || '',
                        updatedTime: data.updated_time || data.created || 0,
                        voteCount: data.voteup_count || 0,
                        favoriteCount: data.favorite_count || 0,
                        commentCount: data.comment_count || 0,

                        content: data.content || "",
                        questionTitle: data.question?.title || '未知问题',
                        questionId: data.question?.id || '',
                        questionAuthorName: data.question?.author?.name || '匿名用户',
                        questionAuthorAvatar: data.question?.author?.avatar_url || '',
                        questionAuthorUrlToken: data.question?.author?.url_token || '',
                        questionAnswerCount: data.question?.answer_count || 0,
                        questionCreatedTime: data.question?.created || 0,
                    };
                    setReadData(tmpReadData);
                });
            } else if (type === 'article') {
                getArticle(String(id)).then((data) => {
                    const tmpReadData = {
                        id: data.id,
                        title: data.title || '无标题',
                        authorName: data.author?.name || '匿名用户',
                        authorUrlToken: data.author?.url_token || '',
                        authorAvatar: data.author?.avatar_url || '',
                        excerpt: data.excerpt || '',
                        updatedTime: data.updated_time || data.created || 0,
                        voteCount: data.voteup_count || 0,
                        favoriteCount: data.favorite_count || 0,
                        commentCount: data.comment_count || 0,

                        content: data.content || "",
                        questionTitle: data.question?.title || '未知问题',
                        questionId: data.question?.id || '',
                        questionAuthorName: data.question?.author?.name || '匿名用户',
                        questionAuthorAvatar: data.question?.author?.avatar_url || '',
                        questionAuthorUrlToken: data.question?.author?.url_token || '',
                        questionAnswerCount: data.question?.answer_count || 0,
                        questionCreatedTime: data.question?.created || 0,
                    };
                    setReadData(tmpReadData);
                });
            }
        }else {
            const tmpReadData = contentStore.feedList.find((item) => String(item.item.id) === String(id))?.item;
            console.log('从 store 中获取的详情数据：', tmpReadData);
            setReadData(tmpReadData);
        }
    }, [id, type, needToGet, contentStore.feedList]);

    

    if (!readData) {
        return (
            <LoadingView />
        );
    }

    const title = type === 'answer' ? readData.questionTitle : (readData.title || '未知标题');
    const htmlContent = readData.content || "<p>暂无正文内容</p>";

    const tagsStyles = {
        body: { color: theme.colors.onSurface, fontSize: 16, lineHeight: 28 },
        p: { marginBottom: 16 },
        figure: { margin: 0, marginTop: 8, marginBottom: 8 },
        img: { borderRadius: 12 }
    };

const CustomImageRenderer = (props: any) => {
    const imageRef = useRef<View>(null);
    const attrs = props.tnode.attributes;

    // 知乎懒加载：真实地址在 data-original 或 data-actualsrc，src 只是占位 SVG
    const src = attrs['data-original'] || attrs['data-actualsrc'] || attrs['data-src'] || attrs.src;
    const { width: imgWidth, height: imgHeight } = attrs;

    // 如果是占位 SVG 则不渲染
    if (!src || src.startsWith('data:image/svg')) {
        return null;
    }

    const openImage = () => {
        if (imageRef.current) {
            imageRef.current.measure((x, y, width, height, pageX, pageY) => {
                setOrigin({ x: pageX, y: pageY, width, height });
            });
        }
    };

    return (
        <View ref={imageRef} style={{ flex: 1, alignItems: 'center', marginVertical: 8 }}>
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                    console.log('图片地址:', src);
                    openImage();
                    setImageUrl(src);
                    setModalVisible(true);
                }}
            >
                <Image
                    source={{ uri: src }}
                    style={{
                        width: '100%',
                        aspectRatio: imgWidth && imgHeight ? imgWidth / imgHeight : 16 / 9,
                        borderRadius: 8
                    }}
                    resizeMode="contain"
                />
            </TouchableOpacity>
        </View>
    );
};

    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <Portal>
                <ImageReanimatedModal
                    visible={modalVisible}
                    url={imageUrl}
                    origin={orgin}
                    onClose={() => setModalVisible(false)}
                />
            </Portal>
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
                        height: 'auto',
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
                    onPress={() => console.log(readData.updatedTime)}
                    android_ripple={{ color: 'rgba(0,0,0,0.15)', foreground: true }}
                    style={{
                        width: '100%',
                        borderRadius: 16,
                        height: 'auto',
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
                    renderers={{
                        img: CustomImageRenderer
                    }}
                    defaultTextProps={
                        { selectable: false  }
                    }
                />

                {/* 底部留白 */}
                <View style={{ height: 40 }} />
                {/* <CommentLayout id={id} type={type} /> */}
            </ScrollView>
        </View>
    );
}
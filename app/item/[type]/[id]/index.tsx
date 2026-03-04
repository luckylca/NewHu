// app/item/type/[id]/index.tsx
import { addReadHistory, cancelVoteupAnswer, cancelVoteupArticle, getAnswer, getArticle, voteupAnswer, voteupArticle } from "@/src/api/ZhihuApi";
import ImageReanimatedModal from "@/src/components/ImageReanimatedModal";
import LoadingView from "@/src/components/LoadingView";
import { useContentStore } from "@/src/stores/useContentStore";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Image, Pressable, ScrollView, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Appbar, Avatar, Divider, Icon, Menu, Portal, Snackbar, Text, useTheme } from "react-native-paper";
import RenderHtml from 'react-native-render-html';
import { scheduleOnRN } from "react-native-worklets";


export type ItemParams = {
    id: string;
    type: 'answer' | 'article';
    needToGet?: 'true' | 'false';
};

type ArrowEffect = {
    id: number;
    x: number;
    y: number;
    scale: Animated.Value;
    translateY: Animated.Value;
    opacity: Animated.Value;
};

export default function Item() {
    const { id, type, needToGet } = useLocalSearchParams<ItemParams>();
    const contentStore = useContentStore();
    const router = useRouter();
    const navigation = useNavigation();
    const theme = useTheme();
    const [origin, setOrigin] = useState({ x: 0, y: 0, width: 0, height: 0 });
    const [modalVisible, setModalVisible] = useState(false);
    const [imageUrl, setImageUrl] = useState("");
    const { width } = useWindowDimensions();
    const [readData, setReadData] = useState<any>(null);
    const [menuVisible, setMenuVisible] = useState(false);
    const [voted, setVoted] = useState(false);
    const [voteCount, setVoteCount] = useState(0);
    const [snackVisible, setSnackVisible] = useState(false);
    const [snackText, setSnackText] = useState('');
    const [arrowEffects, setArrowEffects] = useState<ArrowEffect[]>([]);
    const arrowIdRef = useRef(0);
    useEffect(() => {
        addReadHistory(String(id), type === 'answer' ? 'answer' : 'article')
        console.log('添加阅读历史：', { id, type });
    }, [id, type]);
    useEffect(() => {
        if (needToGet === 'true') {
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
                        voted: data.relationship?.voting === 1,
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
                    // console.log('获取到的回答详情数据：', tmpReadData);
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
                        voted: data.relationship?.voting === 1,
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
        } else {
            const tmpReadData = contentStore.feedList.find((item) => String(item.item.id) === String(id))?.item;
            setReadData(tmpReadData);
        }
    }, [id, type, needToGet, contentStore.feedList]);

    useEffect(() => {
        if (!readData) return;
        setVoteCount(Number(readData.voteCount || 0));
        setVoted(Boolean(readData.voted));
    }, [readData]);

    const voteupAction = type === 'answer' ? voteupAnswer : voteupArticle;
    const cancelVoteupActionv = type === 'answer' ? cancelVoteupAnswer : cancelVoteupArticle;

    const showSnack = (text: string) => {
        setSnackText(text);
        setSnackVisible(true);
    };

    const playArrowAnimation = (absoluteX: number, absoluteY: number) => {
        const id = arrowIdRef.current + 1;
        arrowIdRef.current = id;

        const scale = new Animated.Value(0.6);
        const translateY = new Animated.Value(0);
        const opacity = new Animated.Value(0);

        setArrowEffects((prev) => [
            ...prev,
            { id, x: absoluteX, y: absoluteY, scale, translateY, opacity },
        ]);

        Animated.parallel([
            Animated.sequence([
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 80,
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 0,
                    duration: 380,
                    useNativeDriver: true,
                }),
            ]),
            Animated.timing(scale, {
                toValue: 1.2,
                duration: 260,
                useNativeDriver: true,
            }),
            Animated.timing(translateY, {
                toValue: -26,
                duration: 420,
                useNativeDriver: true,
            }),
        ]).start(() => {
            setArrowEffects((prev) => prev.filter((item) => item.id !== id));
        });
    };

    const handleVoteUp = () => {
        if (voted) {
            showSnack(`已经点赞过了，当前已经有${voteCount}点赞`);
            console.log('重复点赞，已忽略');
            return;
        }
        voteupAction(String(id))
        setVoted(true);
        setVoteCount((count: number) => {
            const nextCount = count + 1;
            showSnack(`点赞成功，当前已经有${nextCount}点赞`);
            return nextCount;
        });
        setReadData((prev: any) => ({
            ...prev,
            voted: true,
            voteCount: Number(prev.voteCount || 0) + 1,
        }));
    };

    const pressVoteUp = () => {
        if (voted) {
            setVoted(false);
            cancelVoteupActionv(String(id));
            setVoteCount((count: number) => {
                const nextCount = count - 1;
                return nextCount;
            });
            setReadData((prev: any) => ({
                ...prev,
                voted: false,
                voteCount: Number(prev.voteCount || 0) - 1,
            }));
            return;
        }
        setVoted(true);
        voteupAction(String(id));
        setVoteCount((count: number) => {
            const nextCount = count + 1;
            showSnack(`点赞成功，当前已经有${nextCount}点赞`);
            return nextCount;
        });
        setReadData((prev: any) => ({
            ...prev,
            voted: true,
            voteCount: Number(prev.voteCount || 0) + 1,
        }));
    }

    const handleDoubleTapAt = (absoluteX: number, absoluteY: number) => {
        playArrowAnimation(absoluteX, absoluteY);
        handleVoteUp();
    };

    const doubleTab = Gesture.Tap().numberOfTaps(2).onEnd((e) => {
        scheduleOnRN(handleDoubleTapAt, e.absoluteX, e.absoluteY);
    });

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
                    origin={origin}
                    onClose={() => setModalVisible(false)}
                />
            </Portal>
            {/* 顶部导航栏 */}
            <Appbar.Header elevated>
                <Appbar.BackAction onPress={() => router.back()} />
                <Appbar.Content title={type === 'answer' ? '回答详情' : '文章详情'} />
                <Menu
                    visible={menuVisible}
                    onDismiss={() => setMenuVisible(false)}
                    anchor={<Appbar.Action icon="dots-vertical" onPress={() => setMenuVisible(true)} />}>
                    <Menu.Item
                        onPress={() => { console.log('复制内容'); }}
                        title="复制内容"
                        leadingIcon={() => <Icon source="content-copy" size={16} color="#49454F" />}
                    />
                    <Menu.Item
                        onPress={() => {
                        }}
                        title="取消点赞"
                        leadingIcon={() => <Icon source="account-outline" size={16} color="#49454F" />}
                    />
                </Menu>
            </Appbar.Header>

            <ScrollView
                contentContainerStyle={{ padding: 10 ,flexGrow: 1}}
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
                {/* 第一个分割线 */}
                <Divider style={{ marginVertical: 16 }} />

                {/* 用 GestureDetector 包裹下面所有的内容 */}
                <GestureDetector gesture={doubleTab}>
                    {/* 必须有一个 View 作为直接子节点，加上 collapsable={false} 确保在 Android 上手势正常 */}
                    <View style={{ flex: 1 }} collapsable={false}>

                        {/* HTML 正文渲染 */}
                        <RenderHtml
                            contentWidth={width - 32}
                            source={{ html: htmlContent }}
                            tagsStyles={tagsStyles}
                            enableExperimentalMarginCollapsing={true}
                            renderers={{ img: CustomImageRenderer }}
                            defaultTextProps={{ selectable: false }}
                        />

                        {/* 第二个分割线 */}
                        <Divider style={{ marginVertical: 16 }} />

                        {/* 底部操作按钮区域 */}
                        <View style={{ paddingLeft: 24, paddingRight: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Pressable
                                onPress={pressVoteUp}
                                style={{ borderRadius: 8 }}
                                android_ripple={{ color: 'rgba(0,0,0,0.15)', foreground: true }}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    {(voted || readData.voted) ? (
                                        <Icon source="thumb-up" size={26} color="#49454F" />
                                    ) : (
                                        <Icon source="thumb-up-outline" size={26} color="#49454F" />
                                    )}
                                    <Text variant="labelMedium" style={{ marginLeft: 6, color: "#49454F" }}>
                                        {readData.voteCount}
                                    </Text>
                                </View>
                            </Pressable>
                            <Pressable
                                onPress={() => console.log('点击了收藏')}
                                style={{ borderRadius: 8 }}
                                android_ripple={{ color: 'rgba(0,0,0,0.15)', foreground: true }}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Icon source="star-outline" size={26} color="#49454F" />
                                    {readData.favoriteCount > 0 &&
                                        <Text variant="labelMedium" style={{ marginLeft: 6, color: '#49454F' }}>
                                            {readData.favoriteCount}
                                        </Text>}
                                </View>
                            </Pressable>
                            <Pressable
                                onPress={() => navigation.navigate('comment', { id: readData.id, type: type } as any)}
                                style={{ borderRadius: 8 }}
                                android_ripple={{ color: 'rgba(0,0,0,0.15)', foreground: true }}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Icon source="comment-outline" size={26} color="#49454F" />
                                    <Text variant="labelMedium" style={{ marginLeft: 6, color: '#49454F' }}>
                                        {readData.commentCount}
                                    </Text>
                                </View>
                            </Pressable>
                        </View>

                        {/* 底部留白区域 (现在双击这里也会触发点赞了) */}
                        <View style={{ height: 40 }} />
                    </View>
                </GestureDetector>

            </ScrollView>

            {arrowEffects.map((arrow) => (
                <Animated.View
                    key={arrow.id}
                    pointerEvents="none"
                    style={{
                        position: 'absolute',
                        left: arrow.x - 15,
                        top: arrow.y - 15,
                        opacity: arrow.opacity,
                        transform: [{ translateY: arrow.translateY }, { scale: arrow.scale }],
                    }}
                >
                    <MaterialCommunityIcons name="triangle" size={30} color={theme.colors.primary} />
                </Animated.View>
            ))}

            <Snackbar
                visible={snackVisible}
                style={{ marginBottom: 8 }}
                onDismiss={() => setSnackVisible(false)}
                duration={1400}
            >
                {snackText}
            </Snackbar>
        </View>
    );
}
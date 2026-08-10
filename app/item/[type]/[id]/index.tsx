// app/item/type/[id]/index.tsx
import { addReadHistory, cancelVoteupAnswer, cancelVoteupArticle, getAnswer, getArticle, voteupAnswer, voteupArticle } from "@/src/api/ZhihuApi";
import type { FeedDetail } from "@/src/types/zhihu";
import ImageReanimatedModal from "@/src/components/ImageReanimatedModal";
import LoadingView from "@/src/components/LoadingView";
import { useContentStore } from "@/src/stores/useContentStore";
import { useExportContentStore } from "@/src/stores/useExportContentStore";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Image, Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Divider, Icon, ListRow, Menu, TopAppBar } from "@/src/ui";
import { notify } from '@/src/stores/useNotificationStore';
import { PressIndication, Text } from "@/src/ui/primitives";
import type { IconName } from "@/src/ui/primitives";
import { useTheme } from "@/src/ui/theme";
import { exportImage, exportPdf } from '@/src/utils/contentExport';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
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

// 提取到组件外部的独立组件
const CustomImageRenderer = React.memo(({ tnode, setOrigin, setImageUrl, setModalVisible }: any) => {
    const attrs = tnode.attributes;
    const localImageRef = useRef<View>(null);
    const theme = useTheme();
    const pressed = useSharedValue(0);

    // 知乎懒加载：真实地址在 data-original 或 data-actualsrc，src 只是占位 SVG
    const src = attrs['data-original'] || attrs['data-actualsrc'] || attrs['data-src'] || attrs.src;
    const { width: imgWidth, height: imgHeight } = attrs;
    const declaredAspect = imgWidth && imgHeight ? Number(imgWidth) / Number(imgHeight) : 16 / 9;
    const [aspectRatio, setAspectRatio] = useState(Number.isFinite(declaredAspect) ? declaredAspect : 16 / 9);

    useEffect(() => {
        if (!src || src.startsWith('data:image/svg')) return;
        Image.getSize(src, (width, height) => {
            if (width > 0 && height > 0) setAspectRatio(width / height);
        });
    }, [src]);

    // 如果是占位 SVG 则不渲染
    if (!src || src.startsWith('data:image/svg')) {
        return null;
    }

    return (
        <View ref={localImageRef} collapsable={false} style={{ width: '100%', alignItems: 'center', marginVertical: 8 }}>
            <Pressable
                onPress={() => {
                    console.log('图片地址:', src);
                    if (localImageRef.current) {
                        localImageRef.current.measureInWindow((pageX, pageY, componentWidth, componentHeight) => {
                            setOrigin({ x: pageX, y: pageY, width: componentWidth, height: componentHeight });
                            setImageUrl(src);
                            setModalVisible(true);
                        });
                    }
                }}
                onPressIn={() => (pressed.value = 1)}
                onPressOut={() => (pressed.value = 0)}
                style={{ width: '100%', borderRadius: theme.radius.tabContour, overflow: 'hidden' }}
            >
                <Image
                    source={{ uri: src }}
                    style={{
                        width: '100%',
                        aspectRatio,
                        borderRadius: theme.radius.tabContour
                    }}
                    resizeMode="contain"
                />
                <PressIndication pressed={pressed} color={theme.colors.onBackground} radius={theme.radius.tabContour} />
            </Pressable>
        </View>
    );
});
CustomImageRenderer.displayName = 'CustomImageRenderer';

// 底部操作按钮：图标 + 可选计数，DS 按压缩放（alpha 覆盖层）
const ContentActionButton = ({ name, count, alwaysShowCount, color, onPress }: {
    name: IconName;
    count?: number;
    alwaysShowCount?: boolean;
    color: string;
    onPress: () => void;
}) => {
    const theme = useTheme();
    const pressed = useSharedValue(0);
    const showCount = count != null && (count > 0 || alwaysShowCount);
    return (
        <Pressable
            accessibilityRole="button"
            onPress={onPress}
            onPressIn={() => (pressed.value = 1)}
            onPressOut={() => (pressed.value = 0)}
            hitSlop={6}
            style={{ borderRadius: theme.radius.tabContour, overflow: 'hidden', padding: 4 }}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Icon name={name} size={26} color={color} />
                {showCount ? (
                    <Text type="footnote1" style={{ marginLeft: 6, color: theme.colors.onSurfaceVariantSummary }}>
                        {count}
                    </Text>
                ) : null}
            </View>
            <PressIndication pressed={pressed} color={theme.colors.onBackground} radius={theme.radius.tabContour} />
        </Pressable>
    );
};

export default function Item() {
    const { id, type, needToGet } = useLocalSearchParams<ItemParams>();
    const contentStore = useContentStore();
    const router = useRouter();
    const theme = useTheme();
    const primaryText = theme.colors.onBackground;
    const secondaryText = theme.colors.onSurfaceSecondary;

    const [origin, setOrigin] = useState({ x: 0, y: 0, width: 0, height: 0 });
    const [modalVisible, setModalVisible] = useState(false);
    const [imageUrl, setImageUrl] = useState("");
    const [imageExporting, setImageExporting] = useState(false);
    const [documentExporting, setDocumentExporting] = useState(false);
    const { width } = useWindowDimensions();

    const [readData, setReadData] = useState<FeedDetail | null>(null);
    const [menuVisible, setMenuVisible] = useState(false);
    const [menuAnchor, setMenuAnchor] = useState({ x: 0, y: 0, width: 0, height: 0 });
    const menuBtnRef = useRef<View>(null);
    const [voted, setVoted] = useState(false);
    const [voteCount, setVoteCount] = useState(0);
    const [arrowEffects, setArrowEffects] = useState<ArrowEffect[]>([]);
    const arrowIdRef = useRef(0);
    const titlePressed = useSharedValue(0);
    const setPendingExport = useExportContentStore((state) => state.setPending);

    useEffect(() => {
        addReadHistory(String(id), type === 'answer' ? 'answer' : 'article');
        console.log('添加阅读历史：', { id, type });
    }, [id, type]);

    useEffect(() => {
        if (needToGet === 'true') {
            if (type === 'answer') {
                getAnswer(String(id)).then((data) => {
                    const tmpReadData: FeedDetail = {
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
                    console.log(tmpReadData.voted)
                    setReadData(tmpReadData);
                });
            } else if (type === 'article') {
                getArticle(String(id)).then((data) => {
                    const tmpReadData: FeedDetail = {
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
            setReadData(tmpReadData ?? null);
        }
    }, [id, type, needToGet, contentStore.feedList]);

    useEffect(() => {
        if (!readData) return;
        setVoteCount(Number(readData.voteCount || 0));
        setVoted(Boolean(readData.voted));
    }, [readData]);

    const voteupAction = type === 'answer' ? voteupAnswer : voteupArticle;
    const cancelVoteupAction = type === 'answer' ? cancelVoteupAnswer : cancelVoteupArticle;

    const playArrowAnimation = (absoluteX: number, absoluteY: number) => {
        const arrowId = arrowIdRef.current + 1;
        arrowIdRef.current = arrowId;

        const scale = new Animated.Value(0.6);
        const translateY = new Animated.Value(0);
        const opacity = new Animated.Value(0);

        setArrowEffects((prev) => [
            ...prev,
            { id: arrowId, x: absoluteX, y: absoluteY, scale, translateY, opacity },
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
            setArrowEffects((prev) => prev.filter((item) => item.id !== arrowId));
        });
    };

    const handleVoteUp = () => {
        if (voted) {
            notify(`已经点赞过了，当前已有 ${voteCount} 个赞`);
            console.log('重复点赞，已忽略');
            return;
        }
        voteupAction(String(id));
        setVoted(true);
        const nextCount = voteCount + 1;
        setVoteCount(nextCount);
        notify(`点赞成功，当前已有 ${nextCount} 个赞`);
        setReadData((prev: any) => ({
            ...prev,
            voted: true,
            voteCount: Number(prev.voteCount || 0) + 1,
        }));
    };

    const pressVoteUp = () => {
        if (voted) {
            setVoted(false);
            cancelVoteupAction(String(id));
            setVoteCount(voteCount - 1);
            setReadData((prev: any) => ({
                ...prev,
                voted: false,
                voteCount: Number(prev.voteCount || 0) - 1,
            }));
            return;
        }
        setVoted(true);
        voteupAction(String(id));
        const nextCount = voteCount + 1;
        setVoteCount(nextCount);
        notify(`点赞成功，当前已有 ${nextCount} 个赞`);
        setReadData((prev: any) => ({
            ...prev,
            voted: true,
            voteCount: Number(prev.voteCount || 0) + 1,
        }));
    };

    const handleTitlePress = () => {
        if (type === 'answer' && readData?.questionId) {
            console.log('跳转到问题详情，问题ID:', readData.questionId);
            router.push({ pathname: '/question', params: { id: readData.questionId } });
        }
    };

    const handleDoubleTapAt = (absoluteX: number, absoluteY: number) => {
        playArrowAnimation(absoluteX, absoluteY);
        handleVoteUp();
    };

    const doubleTab = Gesture.Tap().numberOfTaps(2).onEnd((e) => {
        scheduleOnRN(handleDoubleTapAt, e.absoluteX, e.absoluteY);
    });

    // 右滑返回：只在水平向右并且水平位移显著且垂直位移较小时触发
    const rightSwipe = Gesture.Pan()
        .onEnd((e) => {
            const translationX = (e as any).translationX ?? 0;
            const translationY = (e as any).translationY ?? 0;
            // 阈值可根据需要调整
            if (translationX > 50 && Math.abs(translationY) < 80) {
                console.log('检测到右滑返回手势');
                runOnJS(router.back)();
            }
        });

    // 双击和右滑互斥：优先尝试双击，失败则尝试右滑
    const combinedGesture = Gesture.Exclusive(doubleTab, rightSwipe);

    const openHeaderMenu = () => {
        menuBtnRef.current?.measureInWindow((x, y, width, height) => {
            setMenuAnchor({ x, y, width, height });
            setMenuVisible(true);
        });
    };

    const openCopyPage = () => {
        if (!readData) return;
        setPendingExport({
            id: String(readData.id),
            type,
            title: type === 'answer' ? readData.questionTitle : readData.title,
            authorName: readData.authorName,
            updatedTime: readData.updatedTime,
            htmlContent: readData.content || '<p>暂无正文内容</p>',
        });
        router.push({ pathname: '/select-text/[type]/[id]', params: { type, id: String(readData.id) } });
    };

    const runDocumentExport = async () => {
        if (!readData || documentExporting) return;
        setDocumentExporting(true);
        notify('正在导出文档…');
        try {
            const result = await exportPdf({
                id: String(readData.id),
                title: type === 'answer' ? readData.questionTitle : readData.title,
                authorName: readData.authorName,
                updatedTime: readData.updatedTime,
                htmlContent: readData.content || '<p>暂无正文内容</p>',
            });
            notify(`已保存到 Download/NewHu/${result.fileName}`);
        } catch (exportError) {
            console.error('导出文档失败', exportError);
            notify(exportError instanceof Error ? exportError.message : '导出失败，请重试');
        } finally {
            setDocumentExporting(false);
        }
    };

    const runImageExport = async () => {
        if (!imageUrl || imageExporting) return;
        setImageExporting(true);
        notify('正在保存图片…');
        try {
            const result = await exportImage(imageUrl, imageUrl);
            notify(`已保存到 Download/NewHu/pictures/${result.fileName}`);
        } catch (exportError) {
            console.error('导出图片失败', exportError);
            notify(exportError instanceof Error ? exportError.message : '图片导出失败，请重试');
        } finally {
            setImageExporting(false);
        }
    };

    // 1. 缓存 tagsStyles
    const tagsStyles = useMemo(() => ({
        body: { color: primaryText, fontSize: 16, lineHeight: 28 },
        p: { marginBottom: 16 },
        figure: { margin: 0, marginTop: 8, marginBottom: 8 },
        img: { borderRadius: theme.radius.tab }
    }), [primaryText, theme.radius.tab]);

    // 2. 缓存 renderers 对象
    const renderers = useMemo(() => ({
        img: (props: any) => (
            <CustomImageRenderer
                {...props}
                setOrigin={setOrigin}
                setImageUrl={setImageUrl}
                setModalVisible={setModalVisible}
            />
        )
    }), []);


    if (!readData) {
        return <LoadingView />;
    }

    const title = type === 'answer' ? readData.questionTitle : (readData.title || '未知标题');
    const htmlContent = readData.content || "<p>暂无正文内容</p>";

    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <ImageReanimatedModal
                visible={modalVisible}
                url={imageUrl}
                origin={origin}
                onClose={() => setModalVisible(false)}
                onLongPress={() => void runImageExport()}
            />

            {/* 顶部导航栏 */}
            <TopAppBar
                title={type === 'answer' ? '回答详情' : '文章详情'}
                back={() => router.back()}
                actions={
                    <View ref={menuBtnRef} collapsable={false}>
                        <Pressable
                            accessibilityRole="button"
                            onPress={openHeaderMenu}
                            hitSlop={8}
                            style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 40 }}
                        >
                            <Icon name="dots-vertical" size={24} color={theme.colors.onBackground} />
                        </Pressable>
                    </View>
                }
            />
            <Menu
                visible={menuVisible}
                onClose={() => setMenuVisible(false)}
                anchor={menuAnchor}
                items={[
                    { label: '复制内容', onPress: openCopyPage },
                    { label: '导出文档', onPress: () => void runDocumentExport(), disabled: documentExporting },
                    {
                        label: '取消点赞',
                        onPress: () => {
                            if (!voted) {
                                notify('当前内容还没有点赞');
                                return;
                            }
                            cancelVoteupAction(String(id));
                            setVoted(false);
                            setVoteCount((count: number) => Math.max(0, count - 1));
                            setReadData((prev) => prev ? { ...prev, voted: false, voteCount: Math.max(0, Number(prev.voteCount || 0) - 1) } : prev);
                            notify('已取消点赞');
                        }
                    },
                ]}
            />

            <ScrollView
                contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xl, flexGrow: 1 }}
                showsVerticalScrollIndicator={false}
            >
                {/* 标题 */}
                <Pressable
                    onPress={() => handleTitlePress()}
                    onPressIn={() => (titlePressed.value = 1)}
                    onPressOut={() => (titlePressed.value = 0)}
                    style={{
                        width: '100%',
                        borderRadius: theme.radius.component,
                        overflow: 'hidden',
                        paddingTop: 8,
                        paddingBottom: 8,
                    }}
                >
                    <Text type="title2" weight="bold" color={primaryText}>
                        {title}
                    </Text>
                    <PressIndication pressed={titlePressed} color={primaryText} radius={theme.radius.component} />
                </Pressable>

                {/* 作者信息区域 */}
                <ListRow
                    icon={
                        readData.authorAvatar ? (
                            <Image
                                source={{ uri: readData.authorAvatar }}
                                style={{ width: 40, height: 40, borderRadius: theme.radius.full, backgroundColor: theme.colors.secondaryContainer }}
                            />
                        ) : (
                            <View style={{ width: 40, height: 40, borderRadius: theme.radius.full, backgroundColor: theme.colors.secondaryContainer, alignItems: 'center', justifyContent: 'center' }}>
                                <Text type="body2" weight="medium" color={theme.colors.onSurfaceContainer}>
                                    {readData.authorName?.substring(0, 1) || '佚'}
                                </Text>
                            </View>
                        )
                    }
                    title={readData.authorName}
                    summary={readData.updatedTime ? new Date(readData.updatedTime * 1000).toLocaleDateString() : '最近更新'}
                    titleColor={primaryText}
                    summaryColor={secondaryText}
                    onPress={() => router.push({ pathname: '/people', params: { urlToken: readData.authorUrlToken } })}
                    style={{ paddingHorizontal: 0, marginBottom: 4 }}
                />

                {/* 第一个分割线 */}
                <Divider style={{ marginVertical: 16 }} />

                <GestureDetector gesture={combinedGesture}>
                    <View style={{ flex: 1 }} collapsable={false}>
                        {/* HTML 正文渲染 */}
                        <RenderHtml
                            contentWidth={width - 32}
                            source={{ html: htmlContent }}
                            tagsStyles={tagsStyles}
                            enableExperimentalMarginCollapsing={true}
                            renderers={renderers}
                            ignoredDomTags={['noscript']}
                            defaultTextProps={{ selectable: false }}
                        />

                        {/* 第二个分割线 */}
                        <Divider style={{ marginVertical: 16 }} />

                        {/* 底部操作按钮区域 */}
                        <View style={{ paddingLeft: 24, paddingRight: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <ContentActionButton
                                name={(voted || readData.voted) ? "thumb-up" : "thumb-up-outline"}
                                count={readData.voteCount}
                                alwaysShowCount
                                color={(voted || readData.voted) ? theme.colors.primary : secondaryText}
                                onPress={pressVoteUp}
                            />
                            <ContentActionButton
                                name="star-outline"
                                count={readData.favoriteCount}
                                color={secondaryText}
                                onPress={() => console.log('点击了收藏')}
                            />
                            <ContentActionButton
                                name="comment-outline"
                                count={readData.commentCount}
                                alwaysShowCount
                                color={secondaryText}
                                onPress={() => router.push({ pathname: '/item/[type]/[id]/comment', params: { id: readData.id, type } })}
                            />
                        </View>

                        {/* 底部留白区域 */}
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
                    <Icon name="triangle" size={30} color={theme.colors.primary} />
                </Animated.View>
            ))}

        </View>
    );
}

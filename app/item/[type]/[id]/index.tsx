// app/item/type/[id]/index.tsx
import { addReadHistory, favoriteAnswer, favoriteArticle, getAnswer, getArticle, unfavoriteAnswer, unfavoriteArticle } from "@/src/api/ZhihuApi";
import type { FeedDetail } from "@/src/types/zhihu";
import ImageReanimatedModal from "@/src/components/ImageReanimatedModal";
import LoadingView from "@/src/components/LoadingView";
import OfflineImage from "@/src/components/OfflineImage";
import { useContentStore } from "@/src/stores/useContentStore";
import { useExportContentStore } from "@/src/stores/useExportContentStore";
import { useNetworkStore } from "@/src/stores/useNetworkStore";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, FlatList, Image, Pressable, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Divider, Icon, ListRow, Menu, TopAppBar } from "@/src/ui";
import { notify } from '@/src/stores/useNotificationStore';
import { PressIndication, Text } from "@/src/ui/primitives";
import type { IconName } from "@/src/ui/primitives";
import { useTheme } from "@/src/ui/theme";
import { exportImage, exportPdf } from '@/src/utils/contentExport';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import RenderHtml from 'react-native-render-html';
import { DomUtils, parseDocument } from 'htmlparser2';
import { getContent, upsertContent } from "@/src/db/repositories/contentRepository";
import { normalizeContent } from "@/src/db/mappers";
import { setContentVote } from "@/src/services/offlineActions";
import { normalizeRemoteUrl, resolveImageUri } from "@/src/services/resourceService";
import { useConsentStore } from '@/src/stores/useConsentStore';
import { recordProductV1Feedback } from '@/src/product-v1';

export type ItemParams = {
    id: string;
    type: 'answer' | 'article';
    needToGet?: 'true' | 'false';
    initialFavorited?: 'true' | 'false';
    authorName?: string;
    authorUrlToken?: string;
};

type ArrowEffect = {
    id: number;
    x: number;
    y: number;
    scale: Animated.Value;
    translateY: Animated.Value;
    opacity: Animated.Value;
};

const imageAspectCache = new Map<string, number>();
const imageAspectRequests = new Map<string, Promise<number | null>>();

function getImageAspect(uri: string) {
    const cached = imageAspectCache.get(uri);
    if (cached) return Promise.resolve(cached);
    const pending = imageAspectRequests.get(uri);
    if (pending) return pending;
    const request = new Promise<number | null>((resolve) => {
        Image.getSize(
            uri,
            (width, height) => {
                const aspect = width > 0 && height > 0 ? width / height : null;
                if (aspect) imageAspectCache.set(uri, aspect);
                resolve(aspect);
            },
            () => resolve(null),
        );
    }).finally(() => imageAspectRequests.delete(uri));
    imageAspectRequests.set(uri, request);
    return request;
}

function splitArticleHtml(html: string, targetLength = 3600) {
    try {
        const blocks = parseDocument(html).children
            .map((node) => DomUtils.getOuterHTML(node))
            .filter((block) => block.trim().length > 0);
        const chunks: string[] = [];
        let current = '';
        for (const block of blocks) {
            if (current && current.length + block.length > targetLength) {
                chunks.push(current);
                current = '';
            }
            current += block;
        }
        if (current) chunks.push(current);
        return chunks.length ? chunks : [html];
    } catch {
        return [html];
    }
}

// 提取到组件外部的独立组件
const CustomImageRenderer = React.memo(({ tnode, setOrigin, setImageUrl, setModalVisible }: any) => {
    const attrs = tnode.attributes || {};
    const localImageRef = useRef<Image>(null);
    const theme = useTheme();
    const networkStatus = useNetworkStore((state) => state.status);
    const pressed = useSharedValue(0);

    // 知乎懒加载：真实地址在 data-original 或 data-actualsrc，src 只是占位 SVG
    const imageCandidates = useMemo(() => {
        // Keep a fallback for parser versions that expose data-* attributes
        // on the underlying DOM node instead of tnode.attributes.
        const currentAttrs = tnode.attributes || {};
        const domAttrs = tnode.domNode?.attribs || {};
        return [...new Set([
            currentAttrs['data-actualsrc'], currentAttrs['data-original'], currentAttrs['data-src'], currentAttrs.src,
            domAttrs['data-actualsrc'], domAttrs['data-original'], domAttrs['data-src'], domAttrs.src,
        ].map((value) => normalizeRemoteUrl(value || '')).filter((value) => (
            /^https?:\/\//i.test(value) && !/^data:image\/svg/i.test(value)
        )))];
    }, [tnode]);
    const src = imageCandidates[0] || '';
    const isEquation = /\/equation\?/i.test(src);
    const { width: imgWidth, height: imgHeight } = attrs;
    const declaredAspect = imgWidth && imgHeight ? Number(imgWidth) / Number(imgHeight) : 16 / 9;
    const [aspectRatio, setAspectRatio] = useState(Number.isFinite(declaredAspect) ? declaredAspect : 16 / 9);
    const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        if (!imageCandidates.length) {
            setResolvedSrc(null);
            return () => { active = false; };
        }
        if (networkStatus === 'online') {
            setResolvedSrc(src);
            return () => { active = false; };
        }
        const resolve = async () => {
            for (const candidate of imageCandidates) {
                const uri = await resolveImageUri(candidate, false);
                if (uri) {
                    if (active) setResolvedSrc(uri);
                    return;
                }
            }
            if (active) setResolvedSrc(null);
        };
        void resolve();
        return () => { active = false; };
    }, [imageCandidates, networkStatus]);

    useEffect(() => {
        if (!resolvedSrc || isEquation || (imgWidth && imgHeight)) return;
        let active = true;
        void getImageAspect(resolvedSrc).then((aspect) => {
            if (active && aspect) setAspectRatio(aspect);
        });
        return () => { active = false; };
    }, [imgHeight, imgWidth, isEquation, resolvedSrc]);

    // 如果是占位 SVG 则不渲染
    if (!src || src.startsWith('data:image/svg')) {
        return null;
    }

    // Zhihu formulas are tiny inline images. Keep their real rendering, but
    // never run Image.getSize for the equation endpoint: that endpoint rejects
    // the native size probe and used to generate many duplicate failures while
    // the screen transition was running.
    if (isEquation) {
        const formulaWidth = Math.min(280, Math.max(20, String(attrs.alt || '').length * 11));
        return (
            <Image
                source={{ uri: resolvedSrc || src }}
                accessibilityLabel={attrs.alt || '公式'}
                style={{ width: formulaWidth, height: 28 }}
                resizeMode="contain"
            />
        );
    }

    if (!resolvedSrc) {
        return <View style={{ width: '100%', height: 120, marginVertical: 8, borderRadius: theme.radius.tabContour, backgroundColor: theme.colors.surfaceContainerHigh }} />;
    }

    return (
        <View collapsable={false} style={{ width: '100%', alignItems: 'center', marginVertical: 8 }}>
            <Pressable
                onPress={() => {
                    console.log('图片地址:', src);
                    if (localImageRef.current) {
                        localImageRef.current.measureInWindow((pageX, pageY, componentWidth, componentHeight) => {
                            setOrigin({ x: pageX, y: pageY, width: componentWidth, height: componentHeight });
                            setImageUrl(resolvedSrc);
                            setModalVisible(true);
                        });
                    }
                }}
                onPressIn={() => (pressed.value = 1)}
                onPressOut={() => (pressed.value = 0)}
                style={{ width: '100%', borderRadius: theme.radius.tabContour, overflow: 'hidden' }}
            >
                <Image
                    ref={localImageRef}
                    source={{ uri: resolvedSrc }}
                    style={{
                        width: '100%',
                        ...(isEquation ? { height: 48 } : { aspectRatio }),
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

const StableArticleBody = React.memo(function StableArticleBody({
    contentWidth,
    html,
    tagsStyles,
    renderers,
}: {
    contentWidth: number;
    html: string;
    tagsStyles: Record<string, object>;
    renderers: Record<string, React.ComponentType<any> | ((props: any) => React.ReactNode)>;
}) {
    const source = useMemo(() => ({ html }), [html]);
    return (
        <RenderHtml
            contentWidth={contentWidth}
            source={source}
            tagsStyles={tagsStyles}
            enableExperimentalMarginCollapsing
            enableExperimentalGhostLinesPrevention
            renderers={renderers as any}
            ignoredDomTags={['noscript']}
            defaultTextProps={{ selectable: false }}
        />
    );
});

export default function Item() {
    const { id, type, needToGet, initialFavorited } = useLocalSearchParams<ItemParams>();
    // Subscribe only to this item's fallback. Subscribing to the whole store
    // made every feed append re-render the complete HTML document while the
    // user was scrolling the detail page.
    const fallbackContent = useContentStore((state) => (
        state.feedList.find((item) => String(item.item.id) === String(id))?.item
    ));
    const networkStatus = useNetworkStore((state) => state.status);
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
    const [hydrated, setHydrated] = useState(false);
    const [detailLoading, setDetailLoading] = useState(true);
    const [menuVisible, setMenuVisible] = useState(false);
    const [menuAnchor, setMenuAnchor] = useState({ x: 0, y: 0, width: 0, height: 0 });
    const menuBtnRef = useRef<View>(null);
    const [voted, setVoted] = useState(false);
    const [voteCount, setVoteCount] = useState(0);
    const [favorited, setFavorited] = useState(false);
    const [favoriteCount, setFavoriteCount] = useState(0);
    const favoritePendingRef = useRef(false);
    const readingStartedAtRef = useRef(Date.now());
    const maxScrollRatioRef = useRef(0);
    const [arrowEffects, setArrowEffects] = useState<ArrowEffect[]>([]);
    const arrowIdRef = useRef(0);
    const titlePressed = useSharedValue(0);
    const setPendingExport = useExportContentStore((state) => state.setPending);
    const contentType = type === 'answer' ? 'answer' : 'article';

    useEffect(() => {
        if (networkStatus === 'online') {
            void addReadHistory(String(id), type === 'answer' ? 'answer' : 'article').catch((error) => {
                console.warn('阅读历史同步失败', error);
            });
        }
        console.log('添加阅读历史：', { id, type });
    }, [id, networkStatus, type]);

    useEffect(() => {
        let active = true;
        const contentType = type === 'answer' ? 'answer' : 'article';
        const load = async () => {
            setHydrated(false);
            try {
                setDetailLoading(true);
                const local = await getContent(String(id), contentType);
                if (!active) return;
                setReadData((local as FeedDetail | null) ?? fallbackContent ?? null);
                setHydrated(true);

                // Network status can be unknown for a short time on a cold
                // start. Keep the detail spinner visible until NetInfo tells us
                // whether a remote request can be attempted.
                if (networkStatus !== 'online') return;
                try {
                    const raw = contentType === 'answer' ? await getAnswer(String(id)) : await getArticle(String(id));
                    const fresh = normalizeContent(raw, contentType);
                    // 文章接口通常返回顶层 is_favorited，但回答接口可能完全不返回
                    // 收藏关系。若接口缺字段，沿用从“我的收藏夹”带进来的确定状态。
                    const remoteFavorited = raw?.relationship?.is_favorited ?? raw?.is_favorited;
                    if (remoteFavorited == null && initialFavorited === 'true') {
                        fresh.favorited = true;
                    }
                    if (active) setReadData(fresh);
                    void upsertContent(fresh, contentType, { cacheState: 'transient', voted: fresh.voted }).catch((error) => {
                        console.warn('详情写入本地缓存失败', error);
                    });
                } catch (error) {
                    console.warn('详情后台刷新失败，继续使用本地内容', error);
                }
            } catch (error) {
                if (active) {
                    setReadData((current) => current ?? fallbackContent ?? null);
                    setHydrated(true);
                }
                console.warn('读取本地详情失败', error);
            } finally {
                if (active && networkStatus !== 'unknown') setDetailLoading(false);
            }
        };
        void load();
        return () => { active = false; };
    }, [id, type, needToGet, initialFavorited, fallbackContent, networkStatus]);

    useEffect(() => {
        if (!readData) return;
        setVoteCount(Number(readData.voteCount || 0));
        setVoted(Boolean(readData.voted));
        setFavoriteCount(Number(readData.favoriteCount || 0));
        setFavorited(Boolean(readData.favorited));
    }, [readData]);

    useEffect(() => {
        if (!readData) return;
        readingStartedAtRef.current = Date.now();
        maxScrollRatioRef.current = 0;
        return () => {
            if (!useConsentStore.getState().aiInterestAnalysisEnabled) return;
            const dwellMs = Date.now() - readingStartedAtRef.current;
            if (dwellMs < 1000) return;
            const textLength = String(readData.content || readData.excerpt || '').replace(/<[^>]+>/g, '').length;
            const estimatedReadingMs = Math.max(15_000, textLength / 400 * 60_000);
            void recordProductV1Feedback({
                contentId: String(readData.id),
                contentType,
                eventType: 'read_session',
                opened: true,
                dwellMs,
                estimatedReadingMs,
                scrollRatio: maxScrollRatioRef.current,
            });
        };
    }, [contentType, readData]);

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

    const commitVote = (nextVoted: boolean) => {
        if (!readData) return;
        const currentVoted = Boolean(readData.voted);
        const nextCount = Math.max(0, Number(readData.voteCount || 0) + (currentVoted === nextVoted ? 0 : nextVoted ? 1 : -1));
        const next = { ...readData, voted: nextVoted, voteCount: nextCount };
        setVoted(nextVoted);
        setVoteCount(nextCount);
        setReadData(next);
        void setContentVote(readData, contentType, nextVoted).catch((error) => {
            notify(error instanceof Error ? error.message : '点赞同步失败，稍后会自动重试');
        });
        if (nextVoted && useConsentStore.getState().aiInterestAnalysisEnabled) {
            void recordProductV1Feedback({
                contentId: String(readData.id), contentType, eventType: 'like', opened: true, liked: true,
            });
        }
    };

    const handleVoteUp = () => {
        if (voted) {
            notify(`已经点赞过了，当前已有 ${voteCount} 个赞`);
            console.log('重复点赞，已忽略');
            return;
        }
        commitVote(true);
        notify(`点赞成功，当前已有 ${voteCount + 1} 个赞`);
    };

    const pressVoteUp = () => {
        commitVote(!voted);
        notify(voted ? '已取消点赞' : `点赞成功，当前已有 ${voteCount + 1} 个赞`);
    };

    const pressFavorite = async () => {
        if (!readData || favoritePendingRef.current) return;

        const nextFavorited = !favorited;
        const nextCount = Math.max(0, favoriteCount + (nextFavorited ? 1 : -1));
        const nextData = { ...readData, favorited: nextFavorited, favoriteCount: nextCount };
        favoritePendingRef.current = true;
        setFavorited(nextFavorited);
        setFavoriteCount(nextCount);
        setReadData(nextData);

        try {
            if (contentType === 'answer') {
                if (nextFavorited) await favoriteAnswer(String(readData.id));
                else await unfavoriteAnswer(String(readData.id));
            } else if (nextFavorited) {
                await favoriteArticle(String(readData.id));
            } else {
                await unfavoriteArticle(String(readData.id));
            }
            void upsertContent(nextData, contentType, { cacheState: 'transient', voted: nextData.voted }).catch((error) => {
                console.warn('收藏状态写入本地缓存失败', error);
            });
            notify(nextFavorited ? '已收藏' : '已取消收藏');
            if (nextFavorited && useConsentStore.getState().aiInterestAnalysisEnabled) {
                void recordProductV1Feedback({
                    contentId: String(readData.id), contentType, eventType: 'favorite', opened: true, favorited: true,
                });
            }
        } catch (favoriteError) {
            console.error('收藏操作失败:', favoriteError);
            setFavorited(!nextFavorited);
            setFavoriteCount(favoriteCount);
            setReadData(readData);
            notify(nextFavorited ? '收藏失败，请稍后重试' : '取消收藏失败，请稍后重试');
        } finally {
            favoritePendingRef.current = false;
        }
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

    const doubleTap = Gesture.Tap()
        .numberOfTaps(2)
        .maxDelay(320)
        .maxDistance(32)
        .onEnd((e, success) => {
            if (success) {
                runOnJS(handleDoubleTapAt)(e.absoluteX, e.absoluteY);
            }
        });

    // 右滑返回：只在水平向右并且水平位移显著且垂直位移较小时触发
    const rightSwipe = Gesture.Pan()
        .activeOffsetX(24)
        .failOffsetY([-12, 12])
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
    const combinedGesture = Gesture.Exclusive(doubleTap, rightSwipe);

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

    const htmlContent = readData?.content || "<p>暂无正文内容</p>";
    const articleChunks = useMemo(() => splitArticleHtml(htmlContent), [htmlContent]);


    if (!hydrated) {
        return <LoadingView />;
    }

    if (!readData && detailLoading) {
        return <LoadingView message="正在加载详情…" />;
    }

    if (!readData) {
        return (
            <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
                <TopAppBar title="详情" back={() => router.back()} />
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xl }}>
                    <Text type="body1" color={secondaryText} style={{ textAlign: 'center' }}>
                        当前没有网络，且本地没有这篇内容。联网后可重新打开。
                    </Text>
                </View>
            </View>
        );
    }

    const title = type === 'answer' ? readData.questionTitle : (readData.title || '未知标题');
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
                            commitVote(false);
                            notify('已取消点赞');
                        }
                    },
                ]}
            />

            <GestureDetector gesture={combinedGesture}>
                <FlatList
                    data={articleChunks}
                    keyExtractor={(_, index) => `${readData.id}:${index}`}
                    renderItem={({ item: chunk }) => (
                        <View collapsable={false}>
                            <StableArticleBody
                                contentWidth={width - 32}
                                html={chunk}
                                tagsStyles={tagsStyles}
                                renderers={renderers}
                            />
                        </View>
                    )}
                contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xl, flexGrow: 1 }}
                showsVerticalScrollIndicator={false}
                initialNumToRender={2}
                maxToRenderPerBatch={2}
                updateCellsBatchingPeriod={64}
                windowSize={5}
                    removeClippedSubviews
                    scrollEventThrottle={120}
                    onScroll={(event) => {
                        const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
                        const scrollable = Math.max(1, contentSize.height - layoutMeasurement.height);
                        maxScrollRatioRef.current = Math.max(maxScrollRatioRef.current, Math.min(1, contentOffset.y / scrollable));
                    }}
                ListHeaderComponent={(
                    <>
                        <Pressable
                            onPress={() => handleTitlePress()}
                            onPressIn={() => (titlePressed.value = 1)}
                            onPressOut={() => (titlePressed.value = 0)}
                            style={{ width: '100%', borderRadius: theme.radius.component, overflow: 'hidden', paddingTop: 8, paddingBottom: 8 }}
                        >
                            <Text type="title2" weight="bold" color={primaryText}>{title}</Text>
                            <PressIndication pressed={titlePressed} color={primaryText} radius={theme.radius.component} />
                        </Pressable>
                        <ListRow
                            icon={readData.authorAvatar ? (
                                <OfflineImage source={{ uri: readData.authorAvatar }} style={{ width: 40, height: 40, borderRadius: theme.radius.full, backgroundColor: theme.colors.secondaryContainer }} />
                            ) : (
                                <View style={{ width: 40, height: 40, borderRadius: theme.radius.full, backgroundColor: theme.colors.secondaryContainer, alignItems: 'center', justifyContent: 'center' }}>
                                    <Text type="body2" weight="medium" color={theme.colors.onSurfaceContainer}>{readData.authorName?.substring(0, 1) || '佚'}</Text>
                                </View>
                            )}
                            title={readData.authorName}
                            summary={readData.updatedTime ? new Date(readData.updatedTime * 1000).toLocaleDateString() : '最近更新'}
                            titleColor={primaryText}
                            summaryColor={secondaryText}
                            onPress={() => router.push({ pathname: '/people', params: { urlToken: readData.authorUrlToken } })}
                            style={{ paddingHorizontal: 0, marginBottom: 4 }}
                        />
                        <Divider style={{ marginVertical: 16 }} />
                    </>
                )}
                ListFooterComponent={(
                    <>
                        <Divider style={{ marginVertical: 16 }} />
                        <View style={{ paddingLeft: 24, paddingRight: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <ContentActionButton name={(voted || readData.voted) ? "thumb-up" : "thumb-up-outline"} count={readData.voteCount} alwaysShowCount color={(voted || readData.voted) ? theme.colors.primary : secondaryText} onPress={pressVoteUp} />
                            <ContentActionButton
                                name={favorited ? 'star' : 'star-outline'}
                                count={favoriteCount}
                                color={favorited ? theme.colors.primary : secondaryText}
                                onPress={() => { void pressFavorite(); }}
                            />
                            <ContentActionButton name="comment-outline" count={readData.commentCount} alwaysShowCount color={secondaryText} onPress={() => router.push({ pathname: '/item/[type]/[id]/comment', params: { id: readData.id, type, authorName: readData.authorName, authorUrlToken: readData.authorUrlToken } })} />
                        </View>
                        <View style={{ height: 40 }} />
                    </>
                )}
                />
            </GestureDetector>

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

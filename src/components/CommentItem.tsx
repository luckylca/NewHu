import CommentText from '@/src/components/CommentText';
import OfflineImage from '@/src/components/OfflineImage';
import { EMOJI_URL_MAP } from '@/src/constants/emoji';
import { Icon, Menu, Pressable, useSurfaceEnvironment } from '@/src/ui';
import { PressIndication, Text } from '@/src/ui/primitives';
import { useTheme } from '@/src/ui/theme';
import { notify } from '@/src/stores/useNotificationStore';
import { htmlToPlainText } from '@/src/utils/contentExport';
import { short } from '@/src/utils/haptics';
import { setCommentVote } from '@/src/services/offlineActions';
import { getNetworkStatus } from '@/src/stores/useNetworkStore';
import { commentMatchesContentAuthor, type CommentAuthorIdentity } from '@/src/utils/commentAuthor';
import { useCommentInteractionHost } from '@/src/components/CommentInteractionHost';
import { GlassSurface } from '@newhu/react-native-liquid-glass';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';

export type CommentViewModel = {
    id: string;
    content: string;
    createdTime: number;
    authorUrlToken?: string;
    authorName?: string;
    authorAvatar?: string;
    voteCount: number;
    isVote: boolean;
    isAuthor: boolean;
    /** True when the API explicitly supplied the author relationship flag. */
    isAuthorFromApi?: boolean;
    isHot?: boolean;
    isTop?: boolean;
    childCommentCount: number;
    replyToAuthorName?: string;
};

type CommentItemProps = {
    item: CommentViewModel;
    contentAuthor?: CommentAuthorIdentity;
    onOpenReplies?: (id: string) => void;
    onReply?: (id: string) => void;
    onNavigateAway?: () => void;
    style?: StyleProp<ViewStyle>;
};

const FORMATTED_TIME_CACHE_LIMIT = 512;
const formattedTimeCache = new Map<number, string>();

function formatTime(timestamp: number) {
    const cached = formattedTimeCache.get(timestamp);
    if (cached !== undefined) {
        formattedTimeCache.delete(timestamp);
        formattedTimeCache.set(timestamp, cached);
        return cached;
    }
    const value = new Date(timestamp * 1000).toLocaleString();
    formattedTimeCache.set(timestamp, value);
    if (formattedTimeCache.size > FORMATTED_TIME_CACHE_LIMIT) {
        const oldest = formattedTimeCache.keys().next().value;
        if (oldest !== undefined) formattedTimeCache.delete(oldest);
    }
    return value;
}

export const CommentItem = memo(function CommentItem({ item, contentAuthor, onOpenReplies, onReply, onNavigateAway, style }: CommentItemProps) {
    const theme = useTheme();
    const router = useRouter();
    const isContentAuthor = item.isAuthorFromApi === true
        ? item.isAuthor
        : item.isAuthor || commentMatchesContentAuthor(item, contentAuthor);
    const glassCommentStyle = theme.presentation.content.groupMaterial === 'glass' && theme.glass.enabled;
    const surfaceEnvironment = useSurfaceEnvironment();
    const embeddedInGlassOverlay = glassCommentStyle && surfaceEnvironment === 'glassOverlay';
    const usesGlassMaterial = glassCommentStyle && !embeddedInGlassOverlay;
    const interactionHost = useCommentInteractionHost();
    const swipeableRef = useRef<Swipeable>(null);
    const pressed = useSharedValue(0);
    const likePressed = useSharedValue(0);
    const [liked, setLiked] = useState(item.isVote);
    const [voteCount, setVoteCount] = useState(item.voteCount);
    const [menuVisible, setMenuVisible] = useState(false);
    const [menuAnchor, setMenuAnchor] = useState({ x: 0, y: 0, width: 1, height: 1 });

    useEffect(() => {
        setLiked(item.isVote);
        setVoteCount(item.voteCount);
    }, [item.isVote, item.voteCount]);

    const toggleLike = useCallback(async () => {
        if (isContentAuthor || item.id.startsWith('local:')) return;
        const nextLiked = !liked;
        const nextCount = Math.max(0, voteCount + (nextLiked ? 1 : -1));
        setLiked(nextLiked);
        setVoteCount(nextCount);
        try {
            await setCommentVote(item.id, nextLiked, nextCount);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (getNetworkStatus() !== 'online' || /network|timeout|fetch|offline|internet/i.test(message)) {
                notify('点赞已保存，联网后自动同步');
                return;
            }
            setLiked(!nextLiked);
            setVoteCount(voteCount);
            notify(message || '点赞同步失败');
        }
    }, [isContentAuthor, item.id, liked, voteCount]);

    const renderRightActions = useCallback((_progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
        const translateX = dragX.interpolate({ inputRange: [-80, 0], outputRange: [0, 80], extrapolate: 'clamp' });
        return (
            <View style={{ width: 80, justifyContent: 'center', alignItems: 'center' }}>
                <Animated.View style={{ transform: [{ translateX }] }}>
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="reply" size={20} color={theme.colors.onPrimary} />
                    </View>
                </Animated.View>
            </View>
        );
    }, [theme.colors.onPrimary, theme.colors.primary]);

    const openReply = useCallback(() => {
        short();
        swipeableRef.current?.close();
        onReply?.(item.id);
    }, [item.id, onReply]);

    const copyComment = useCallback(async () => {
        try {
            const text = htmlToPlainText(item.content) || item.content;
            await Clipboard.setStringAsync(text);
            notify('已复制评论');
        } catch (error) {
            console.error('复制评论失败:', error);
            notify('复制评论失败，请重试');
        }
    }, [item.content]);

    const menuItems = useMemo(() => ([
        { label: '复制评论', onPress: () => void copyComment() },
        { label: '回复', onPress: openReply },
        { label: liked ? '取消点赞' : '点赞', disabled: isContentAuthor || item.id.startsWith('local:'), onPress: toggleLike },
    ]), [copyComment, isContentAuthor, item.id, liked, openReply, toggleLike]);

    const openAuthor = useCallback(() => {
        if (!item.authorUrlToken) return;
        router.push({ pathname: '/people', params: { urlToken: item.authorUrlToken } });
        onNavigateAway?.();
    }, [item.authorUrlToken, onNavigateAway, router]);

    const commentContent = (
        <>
            {glassCommentStyle && isContentAuthor ? (
                <View
                    pointerEvents="none"
                    style={[StyleSheet.absoluteFillObject, { backgroundColor: theme.colors.primary, opacity: 0.08 }]}
                />
            ) : null}
            <PressIndication pressed={pressed} color={theme.colors.onBackground} radius={theme.radius.component} />
            {!interactionHost ? (
                <Menu
                    visible={menuVisible}
                    onClose={() => setMenuVisible(false)}
                    anchor={menuAnchor}
                    items={menuItems}
                />
            ) : null}

            <View style={{ padding: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Pressable onPress={openAuthor} hitSlop={4}>
                        {item.authorAvatar ? (
                            <OfflineImage source={{ uri: item.authorAvatar }} style={{ width: 36, height: 36, borderRadius: 18, marginRight: 12, backgroundColor: theme.colors.surfaceContainerHigh }} />
                        ) : (
                            <View style={{ width: 36, height: 36, borderRadius: 18, marginRight: 12, backgroundColor: theme.colors.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center' }}>
                                <Text type="footnote1" weight="medium">{item.authorName?.slice(0, 1) || '佚'}</Text>
                            </View>
                        )}
                    </Pressable>

                    <View style={{ flex: 1, minWidth: 0 }}>
                        <Text type="headline2" weight="medium" numberOfLines={1}>
                            {item.authorName || '匿名用户'}
                            {item.replyToAuthorName ? <Text color={theme.colors.onSurfaceVariantSummary}>{` 回复 ${item.replyToAuthorName}`}</Text> : null}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, flexWrap: 'wrap' }}>
                            <Text type="footnote2" color={theme.colors.onSurfaceVariantSummary}>{formatTime(item.createdTime)}</Text>
                            {item.isTop ? <CommentTag label="置顶" color={theme.colors.onTertiaryContainer} background={theme.colors.tertiaryContainer} /> : null}
                            {item.isHot ? <CommentTag label="热" color={theme.colors.onSecondaryContainer} background={theme.colors.secondaryContainer} /> : null}
                            {isContentAuthor ? <CommentTag label="作者" color={theme.colors.onPrimaryContainer} background={theme.colors.primaryContainer} /> : null}
                        </View>
                    </View>

                    <Pressable
                        showIndication={false}
                        onPress={toggleLike}
                        disabled={isContentAuthor || item.id.startsWith('local:')}
                        onPressIn={isContentAuthor || item.id.startsWith('local:') ? undefined : () => (likePressed.value = 1)}
                        onPressOut={isContentAuthor || item.id.startsWith('local:') ? undefined : () => (likePressed.value = 0)}
                        hitSlop={8}
                        style={{ flexDirection: 'row', alignItems: 'center', padding: 4, borderRadius: 20, overflow: 'hidden' }}
                    >
                        <Icon name={liked ? 'thumb-up' : 'thumb-up-outline'} size={18} color={isContentAuthor || item.id.startsWith('local:') ? theme.colors.disabledOnSurface : liked ? theme.colors.primary : theme.colors.onSurfaceVariantSummary} />
                        <Text type="footnote2" color={theme.colors.onSurfaceVariantSummary} style={{ marginLeft: 5 }}>{voteCount}</Text>
                        {!isContentAuthor && !item.id.startsWith('local:') ? <PressIndication pressed={likePressed} color={theme.colors.onBackground} radius={20} /> : null}
                    </Pressable>
                </View>

                <View style={{ marginTop: 10 }}>
                    <CommentText content={item.content} emojiMap={EMOJI_URL_MAP} />
                </View>
                {item.childCommentCount > 0 ? (
                    <Text type="footnote1" color={theme.colors.primary} style={{ marginTop: 10 }}>
                        共 {item.childCommentCount} 条回复
                    </Text>
                ) : null}
            </View>
        </>
    );

    return (
        <Swipeable
            ref={swipeableRef}
            renderRightActions={renderRightActions}
            friction={2}
            rightThreshold={64}
            onSwipeableWillOpen={openReply}
            overshootRight={false}
        >
            <Pressable
                showIndication={false}
                onPress={onOpenReplies ? () => onOpenReplies(item.id) : undefined}
                onLongPress={(event) => {
                    const anchor = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY, width: 1, height: 1 };
                    if (interactionHost) interactionHost.openMenu(anchor, menuItems);
                    else {
                        setMenuAnchor(anchor);
                        setMenuVisible(true);
                    }
                }}
                onPressIn={() => (pressed.value = 1)}
                onPressOut={() => (pressed.value = 0)}
                style={[{
                    marginBottom: 8,
                    borderRadius: theme.radius.component,
                    overflow: 'hidden',
                    backgroundColor: glassCommentStyle
                        ? 'transparent'
                        : isContentAuthor
                            ? theme.colors.primaryContainer
                            : theme.colors.secondaryContainer,
                    borderWidth: usesGlassMaterial ? 0 : embeddedInGlassOverlay ? StyleSheet.hairlineWidth : isContentAuthor ? 1 : 0,
                    borderColor: isContentAuthor ? theme.colors.primary : glassCommentStyle ? theme.colors.dividerLine : 'transparent',
                }, style, glassCommentStyle ? {
                    backgroundColor: embeddedInGlassOverlay ? theme.glass.tint[theme.dark ? 'dark' : 'light'] : 'transparent',
                } : undefined]}
            >
                {usesGlassMaterial ? (
                    <GlassSurface
                        variant="preferencePanel"
                        positioning="inFlow"
                        sampling="local"
                        style={{
                            width: '100%',
                            borderRadius: theme.glass.materials.preferencePanel.radius,
                            overflow: 'hidden',
                            borderWidth: isContentAuthor ? StyleSheet.hairlineWidth : 0,
                            borderColor: isContentAuthor ? theme.colors.primary : 'transparent',
                        }}
                    >
                        {commentContent}
                    </GlassSurface>
                ) : commentContent}
            </Pressable>
        </Swipeable>
    );
}, (previous, next) => (
    previous.item.id === next.item.id
    && previous.item.content === next.item.content
    && previous.item.createdTime === next.item.createdTime
    && previous.item.authorUrlToken === next.item.authorUrlToken
    && previous.item.authorName === next.item.authorName
    && previous.item.authorAvatar === next.item.authorAvatar
    && previous.item.isVote === next.item.isVote
    && previous.item.voteCount === next.item.voteCount
    && previous.item.replyToAuthorName === next.item.replyToAuthorName
    && previous.item.isAuthor === next.item.isAuthor
    && previous.item.isAuthorFromApi === next.item.isAuthorFromApi
    && previous.item.isHot === next.item.isHot
    && previous.item.isTop === next.item.isTop
    && previous.item.childCommentCount === next.item.childCommentCount
    && previous.contentAuthor?.name === next.contentAuthor?.name
    && previous.contentAuthor?.urlToken === next.contentAuthor?.urlToken
    && previous.onOpenReplies === next.onOpenReplies
    && previous.onReply === next.onReply
    && previous.onNavigateAway === next.onNavigateAway
    && previous.style === next.style
));

function CommentTag({ label, color, background }: { label: string; color: string; background: string }) {
    return (
        <View style={{ marginLeft: 8, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, backgroundColor: background }}>
            <Text type="footnote2" color={color}>{label}</Text>
        </View>
    );
}

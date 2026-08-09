import { cancelLikeComment, likeComment } from '@/src/api/ZhihuApi';
import CommentText from '@/src/components/CommentText';
import { EMOJI_URL_MAP } from '@/src/constants/emoji';
import { Icon, Menu } from '@/src/ui';
import { PressIndication, Text } from '@/src/ui/primitives';
import { useTheme } from '@/src/ui/theme';
import { short } from '@/src/utils/haptics';
import { useRouter } from 'expo-router';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, View } from 'react-native';
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
    isHot?: boolean;
    isTop?: boolean;
    childCommentCount: number;
    replyToAuthorName?: string;
};

type CommentItemProps = {
    item: CommentViewModel;
    onOpenReplies?: (id: string) => void;
    onReply?: (id: string) => void;
    onNavigateAway?: () => void;
    style?: StyleProp<ViewStyle>;
};

function formatTime(timestamp: number) {
    return new Date(timestamp * 1000).toLocaleString();
}

export const CommentItem = memo(function CommentItem({ item, onOpenReplies, onReply, onNavigateAway, style }: CommentItemProps) {
    const theme = useTheme();
    const router = useRouter();
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
        if (item.isAuthor) return;
        const nextLiked = !liked;
        setLiked(nextLiked);
        setVoteCount((count) => count + (nextLiked ? 1 : -1));
        try {
            if (nextLiked) await likeComment(item.id);
            else await cancelLikeComment(item.id);
        } catch {
            setLiked(!nextLiked);
            setVoteCount((count) => count + (nextLiked ? -1 : 1));
        }
    }, [item.id, item.isAuthor, liked]);

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

    const openAuthor = useCallback(() => {
        if (!item.authorUrlToken) return;
        router.push({ pathname: '/people', params: { urlToken: item.authorUrlToken } });
        onNavigateAway?.();
    }, [item.authorUrlToken, onNavigateAway, router]);

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
                onPress={onOpenReplies ? () => onOpenReplies(item.id) : undefined}
                onLongPress={(event) => {
                    setMenuAnchor({ x: event.nativeEvent.pageX, y: event.nativeEvent.pageY, width: 1, height: 1 });
                    setMenuVisible(true);
                }}
                onPressIn={() => (pressed.value = 1)}
                onPressOut={() => (pressed.value = 0)}
                style={[{
                    marginBottom: 8,
                    borderRadius: theme.radius.component,
                    overflow: 'hidden',
                    backgroundColor: theme.colors.secondaryContainer,
                }, style]}
            >
                <PressIndication pressed={pressed} color={theme.colors.onBackground} radius={theme.radius.component} />
                <Menu
                    visible={menuVisible}
                    onClose={() => setMenuVisible(false)}
                    anchor={menuAnchor}
                    items={[
                        { label: '回复', onPress: openReply },
                        { label: liked ? '取消点赞' : '点赞', disabled: item.isAuthor, onPress: toggleLike },
                    ]}
                />

                <View style={{ padding: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Pressable onPress={openAuthor} hitSlop={4}>
                            {item.authorAvatar ? (
                                <Image source={{ uri: item.authorAvatar }} style={{ width: 36, height: 36, borderRadius: 18, marginRight: 12, backgroundColor: theme.colors.surfaceContainerHigh }} />
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
                            </View>
                        </View>

                        <Pressable
                            onPress={toggleLike}
                            disabled={item.isAuthor}
                            onPressIn={item.isAuthor ? undefined : () => (likePressed.value = 1)}
                            onPressOut={item.isAuthor ? undefined : () => (likePressed.value = 0)}
                            hitSlop={8}
                            style={{ flexDirection: 'row', alignItems: 'center', padding: 4, borderRadius: 20, overflow: 'hidden' }}
                        >
                            <Icon name={liked ? 'thumb-up' : 'thumb-up-outline'} size={18} color={item.isAuthor ? theme.colors.disabledOnSurface : liked ? theme.colors.primary : theme.colors.onSurfaceVariantSummary} />
                            <Text type="footnote2" color={theme.colors.onSurfaceVariantSummary} style={{ marginLeft: 5 }}>{voteCount}</Text>
                            {!item.isAuthor ? <PressIndication pressed={likePressed} color={theme.colors.onBackground} radius={20} /> : null}
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
            </Pressable>
        </Swipeable>
    );
}, (previous, next) => (
    previous.item.id === next.item.id
    && previous.item.isVote === next.item.isVote
    && previous.item.voteCount === next.item.voteCount
    && previous.item.replyToAuthorName === next.item.replyToAuthorName
));

function CommentTag({ label, color, background }: { label: string; color: string; background: string }) {
    return (
        <View style={{ marginLeft: 8, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, backgroundColor: background }}>
            <Text type="footnote2" color={color}>{label}</Text>
        </View>
    );
}

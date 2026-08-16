import { submitComment } from '@/src/api/ZhihuApi';
import { EMOJI_URL_MAP } from '@/src/constants/emoji';
import { getCommentDraftId, useDraftStore } from '@/src/stores/useDraftStore';
import { notify } from '@/src/stores/useNotificationStore';
import { enqueueAction, getPendingActionByTarget, markActionResult } from '@/src/db/repositories/outboxRepository';
import { insertLocalComment } from '@/src/db/repositories/commentRepository';
import { getNetworkStatus } from '@/src/stores/useNetworkStore';
import { useUserStore } from '@/src/stores/useUserStore';
import type { CommentViewModel } from './CommentItem';
import { Button, Icon, Input, TopAppBar } from '@/src/ui';
import { useTheme } from '@/src/ui/theme';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';

type CommentEditProps = {
    visible: boolean;
    name: string;
    contentType: string;
    contentId: string;
    replyCommentId: string;
    rootCommentId: string;
    onClose: () => void;
    onSubmitted?: () => void;
};

export default function CommentEdit({ visible, name, contentType, contentId, replyCommentId, rootCommentId, onClose, onSubmitted }: CommentEditProps) {
    const theme = useTheme();
    const [content, setContent] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [emojiVisible, setEmojiVisible] = useState(false);
    const [saving, setSaving] = useState(false);
    const contentRef = useRef('');
    const saveCommentDraft = useDraftStore((state) => state.saveCommentDraft);
    const removeDraft = useDraftStore((state) => state.removeDraft);
    const pageBackground = theme.dark ? '#161616' : '#F7F7F7';
    const draftId = getCommentDraftId(contentType, contentId, replyCommentId);
    const emojiEntries = Object.entries(EMOJI_URL_MAP);
    const normalizedContentType = contentType === 'answer' ? 'answer' : 'article';

    useEffect(() => {
        if (!visible) return;
        const saved = useDraftStore.getState().drafts.find((item) => item.id === draftId);
        const savedContent = saved?.content ?? '';
        contentRef.current = savedContent;
        setContent(savedContent);
        setEmojiVisible(false);
        setSaving(false);
    }, [draftId, visible]);

    const persistDraft = useCallback((text: string) => {
        if (!text.trim()) {
            removeDraft(draftId);
            return;
        }
        saveCommentDraft({
            id: draftId,
            title: name ? `回复 ${name}` : '发表评论',
            content: text,
            target: {
                contentType,
                contentId,
                replyCommentId,
                replyName: name,
                rootCommentId,
            },
        });
    }, [contentId, contentType, draftId, name, removeDraft, replyCommentId, rootCommentId, saveCommentDraft]);

    useEffect(() => {
        if (!visible) return;
        const timer = setTimeout(() => {
            persistDraft(contentRef.current);
            setSaving(false);
        }, 300);
        return () => clearTimeout(timer);
    }, [content, persistDraft, visible]);

    useEffect(() => {
        if (!visible) return;
        return () => persistDraft(contentRef.current);
    }, [persistDraft, visible]);

    const changeContent = useCallback((text: string) => {
        contentRef.current = text;
        setContent(text);
        setSaving(true);
    }, []);

    const addEmoji = useCallback((name: string) => {
        changeContent(`${contentRef.current}[${name}]`);
    }, [changeContent]);

    const persistLocalComment = async (text: string, status: 'pending' | 'needs_user_action' = 'pending') => {
        const localId = `local:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`;
        const user = useUserStore.getState();
        const localComment: CommentViewModel = {
            id: localId,
            content: text,
            createdTime: Math.floor(Date.now() / 1000),
            authorName: user.username || '我',
            authorAvatar: user.avatar || undefined,
            voteCount: 0,
            isVote: false,
            // `isAuthor` means the content author, not the current user's own comment.
            isAuthor: false,
            childCommentCount: 0,
            replyToAuthorName: name || undefined,
        };
        await insertLocalComment({
            contentId,
            contentType: normalizedContentType,
            comment: localComment,
            parentCommentId: replyCommentId || null,
            orderBy: replyCommentId ? 'ts' : 'score',
        });
        const dependsOnAction = replyCommentId.startsWith('local:') ? await getPendingActionByTarget(replyCommentId) : null;
        const actionId = await enqueueAction({
            actionType: replyCommentId ? 'CREATE_REPLY' : 'CREATE_COMMENT',
            targetType: normalizedContentType,
            targetId: localId,
            payload: {
                contentType: normalizedContentType,
                contentId,
                text,
                replyCommentId: replyCommentId || undefined,
            },
            dependsOnActionId: dependsOnAction?.id,
        });
        if (status === 'needs_user_action') {
            await markActionResult(actionId, status, '提交结果未知，请确认知乎端是否已发表后再重试');
        }
    };

    const handleSend = async () => {
        const text = content.trim();
        if (!text || submitting) return;
        setSubmitting(true);
        try {
            if (getNetworkStatus() !== 'online') {
                await persistLocalComment(text);
                contentRef.current = '';
                setContent('');
                setSaving(false);
                removeDraft(draftId);
                onClose();
                onSubmitted?.();
                notify('已保存到本地，联网后自动发表');
                return;
            }
            await submitComment({
                contentType: normalizedContentType,
                contentId,
                text,
                replyCommentId: replyCommentId || undefined,
            });
            contentRef.current = '';
            setContent('');
            setSaving(false);
            removeDraft(draftId);
            onClose();
            onSubmitted?.();
            notify('评论已发表');
        } catch (error) {
            console.error('发表评论失败:', error);
            const message = error instanceof Error ? error.message : String(error);
            if (/network|timeout|fetch|offline|internet/i.test(message)) {
                try {
                    await persistLocalComment(text, 'needs_user_action');
                    contentRef.current = '';
                    setContent('');
                    setSaving(false);
                    removeDraft(draftId);
                    onClose();
                    onSubmitted?.();
                    notify('提交结果未知，请先确认知乎端是否已发表，暂不自动重试');
                    return;
                } catch (saveError) {
                    console.error('保存待确认评论失败:', saveError);
                }
            }
            notify('发表失败，请稍后重试');
        } finally {
            setSubmitting(false);
        }
    };

    if (!visible) return null;

    return (
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: pageBackground }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <TopAppBar
                    title={saving ? '正在实时保存到草稿箱' : name ? `回复 ${name}` : '发表评论'}
                    navigation={
                        <Pressable onPress={onClose} hitSlop={8} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 }}>
                            <Icon name="close" size={24} color={theme.colors.onBackground} />
                        </Pressable>
                    }
                    actions={
                        <Button type="primary" onPress={handleSend} disabled={!content.trim() || submitting}>
                            {submitting ? '发表中' : '发表'}
                        </Button>
                    }
                />
                <View style={{ flex: 1, padding: theme.spacing.lg }}>
                    <Input
                        value={content}
                        onChangeText={changeContent}
                        singleLine={false}
                        placeholder={name ? `回复 ${name}…` : '友善地写下你的评论…'}
                        inputProps={{
                            autoFocus: true,
                            textAlignVertical: 'top',
                            style: { flex: 1, minHeight: 180 },
                            maxLength: 5000,
                        }}
                        style={{ flex: 1, alignItems: 'stretch' }}
                        onFocus={() => setEmojiVisible(false)}
                    />
                </View>
                <View style={{ borderTopWidth: 1, borderTopColor: theme.colors.dividerLine, backgroundColor: pageBackground }}>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="表情"
                        onPress={() => {
                            Keyboard.dismiss();
                            setEmojiVisible((current) => !current);
                        }}
                        style={{ height: 48, paddingHorizontal: theme.spacing.lg, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' }}
                    >
                        <Icon name="emoticon-happy-outline" size={23} color={emojiVisible ? theme.colors.primary : theme.colors.onSurfaceVariantActions} />
                    </Pressable>
                    {emojiVisible ? (
                        <FlatList
                            data={emojiEntries}
                            keyExtractor={([emojiName]) => emojiName}
                            numColumns={7}
                            keyboardShouldPersistTaps="always"
                            style={{ maxHeight: 252 }}
                            contentContainerStyle={{ paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.lg }}
                            renderItem={({ item: [emojiName, uri] }) => (
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={emojiName}
                                    onPress={() => addEmoji(emojiName)}
                                    style={{ width: '14.285%', height: 52, alignItems: 'center', justifyContent: 'center' }}
                                >
                                    <Image source={{ uri }} style={{ width: 32, height: 32 }} resizeMode="contain" />
                                </Pressable>
                            )}
                        />
                    ) : null}
                </View>
        </KeyboardAvoidingView>
    );
}

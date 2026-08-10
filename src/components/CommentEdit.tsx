import { submitComment } from '@/src/api/ZhihuApi';
import { EMOJI_URL_MAP } from '@/src/constants/emoji';
import { getCommentDraftId, useDraftStore } from '@/src/stores/useDraftStore';
import { notify } from '@/src/stores/useNotificationStore';
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

    const handleSend = async () => {
        const text = content.trim();
        if (!text || submitting) return;
        setSubmitting(true);
        try {
            await submitComment({
                contentType,
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

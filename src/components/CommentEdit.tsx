import { submitComment } from '@/src/api/ZhihuApi';
import { notify } from '@/src/stores/useNotificationStore';
import { Button, Icon, Input, TopAppBar } from '@/src/ui';
import { useTheme } from '@/src/ui/theme';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';

type CommentEditProps = {
    visible: boolean;
    name: string;
    contentType: string;
    contentId: string;
    replyCommentId: string;
    onClose: () => void;
    onSubmitted?: () => void;
};

export default function CommentEdit({ visible, name, contentType, contentId, replyCommentId, onClose, onSubmitted }: CommentEditProps) {
    const theme = useTheme();
    const [content, setContent] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const pageBackground = theme.dark ? '#161616' : '#F7F7F7';

    useEffect(() => {
        if (!visible) setContent('');
    }, [visible]);

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
            setContent('');
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
                    title={name ? `回复 ${name}` : '发表评论'}
                    navigation={
                        <Pressable onPress={onClose} hitSlop={8} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 }}>
                            <Icon name="close" size={24} color={theme.colors.onBackground} />
                        </Pressable>
                    }
                    actions={
                        <Button type="primary" onPress={handleSend} disabled={!content.trim() || submitting} style={{ marginRight: theme.spacing.lg }}>
                            {submitting ? '发表中' : '发表'}
                        </Button>
                    }
                />
                <View style={{ flex: 1, padding: theme.spacing.lg }}>
                    <Input
                        value={content}
                        onChangeText={setContent}
                        singleLine={false}
                        placeholder={name ? `回复 ${name}…` : '友善地写下你的评论…'}
                        inputProps={{
                            autoFocus: true,
                            textAlignVertical: 'top',
                            style: { flex: 1, minHeight: 180 },
                            maxLength: 5000,
                        }}
                        style={{ flex: 1, alignItems: 'stretch' }}
                    />
                </View>
        </KeyboardAvoidingView>
    );
}

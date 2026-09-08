import { KnowledgeCardEditorSheet } from '@/src/components/KnowledgeCardEditorSheet';
import {
    deleteKnowledgeCard,
    listKnowledgeCards,
} from '@/src/db/repositories/knowledgeCardRepository';
import type { KnowledgeCard, KnowledgeReviewState } from '@/src/db/types';
import { notify } from '@/src/stores/useNotificationStore';
import {
    KNOWLEDGE_REVIEW_LABELS,
    KNOWLEDGE_REVIEW_STATES,
} from '@/src/utils/knowledgeCard';
import {
    Button,
    Card,
    Dialog,
    SegmentedControl,
    TopAppBar,
} from '@/src/ui';
import { Text } from '@/src/ui/primitives';
import { useTheme } from '@/src/ui/theme';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

const FILTER_STATES: (KnowledgeReviewState | null)[] = [
    null,
    ...KNOWLEDGE_REVIEW_STATES,
];

export default function KnowledgeCardsScreen() {
    const theme = useTheme();
    const router = useRouter();
    const [cards, setCards] = useState<KnowledgeCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterIndex, setFilterIndex] = useState(0);
    const [editingCard, setEditingCard] = useState<KnowledgeCard | null>(null);
    const [deleteCandidate, setDeleteCandidate] = useState<KnowledgeCard | null>(null);

    const reload = useCallback(async () => {
        setLoading(true);
        try {
            setCards(await listKnowledgeCards());
        } catch (error) {
            console.error('知识卡片读取失败', error);
            notify('知识卡片读取失败');
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(useCallback(() => {
        void reload();
    }, [reload]));

    const filteredCards = useMemo(() => {
        const state = FILTER_STATES[filterIndex] ?? null;
        return state ? cards.filter((card) => card.reviewState === state) : cards;
    }, [cards, filterIndex]);

    const remove = async () => {
        const candidate = deleteCandidate;
        if (!candidate) return;
        try {
            await deleteKnowledgeCard(candidate.id);
            setCards((current) => current.filter((card) => card.id !== candidate.id));
            setDeleteCandidate(null);
            notify('知识卡片已删除');
        } catch (error) {
            console.error('删除知识卡片失败', error);
            notify('删除失败，请重试');
        }
    };

    const openSource = (card: KnowledgeCard) => {
        router.push({
            pathname: '/select-text/[type]/[id]',
            params: {
                type: card.contentType,
                id: card.contentId,
            },
        });
    };

    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <TopAppBar title="知识卡片" back={() => router.back()} />

            <View style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md }}>
                <SegmentedControl
                    tabs={['全部', '待复习', '复习中', '已掌握']}
                    selected={filterIndex}
                    onSelect={setFilterIndex}
                />
            </View>

            <ScrollView
                contentContainerStyle={{
                    padding: theme.spacing.lg,
                    paddingBottom: theme.spacing.xxl,
                    gap: theme.spacing.md,
                }}
                showsVerticalScrollIndicator={false}
            >
                {loading ? (
                    <View style={{ paddingVertical: theme.spacing.xxl, alignItems: 'center' }}>
                        <Text type="body1" color={theme.colors.onSurfaceVariantSummary}>
                            正在读取知识卡片…
                        </Text>
                    </View>
                ) : filteredCards.length === 0 ? (
                    <View style={{ paddingVertical: theme.spacing.xxl, alignItems: 'center' }}>
                        <Text type="title4" weight="medium" color={theme.colors.onBackground}>
                            还没有知识卡片
                        </Text>
                        <Text
                            type="body2"
                            color={theme.colors.onSurfaceVariantSummary}
                            align="center"
                            style={{ marginTop: theme.spacing.sm }}
                        >
                            在文章“划线与笔记”页面选择一个标注，即可生成知识卡片。
                        </Text>
                    </View>
                ) : (
                    filteredCards.map((card) => (
                        <Card
                            key={card.id}
                            feedback="none"
                            contentStyle={{ padding: theme.spacing.lg }}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                <View
                                    style={{
                                        paddingHorizontal: 10,
                                        paddingVertical: 5,
                                        borderRadius: theme.radius.full,
                                        backgroundColor: theme.colors.secondaryContainer,
                                    }}
                                >
                                    <Text type="footnote1" weight="medium" color={theme.colors.onSecondaryContainer}>
                                        {KNOWLEDGE_REVIEW_LABELS[card.reviewState]}
                                    </Text>
                                </View>
                                <Text
                                    type="footnote1"
                                    color={theme.colors.onSurfaceVariantSummary}
                                    numberOfLines={1}
                                    style={{ flexShrink: 1 }}
                                >
                                    {new Date(card.updatedAt).toLocaleString()}
                                </Text>
                            </View>

                            <Text
                                type="title4"
                                weight="medium"
                                color={theme.colors.onBackground}
                                numberOfLines={2}
                                style={{ marginTop: theme.spacing.md }}
                            >
                                {card.title || '未命名内容'}
                            </Text>

                            <Text
                                type="body1"
                                color={theme.colors.onBackground}
                                numberOfLines={6}
                                style={{ marginTop: theme.spacing.sm }}
                            >
                                {card.quoteText.trim()}
                            </Text>

                            {card.understandingText ? (
                                <View
                                    style={{
                                        marginTop: theme.spacing.md,
                                        padding: theme.spacing.md,
                                        borderRadius: theme.radius.component,
                                        backgroundColor: theme.colors.surfaceContainerHigh,
                                    }}
                                >
                                    <Text type="footnote1" color={theme.colors.onSurfaceVariantSummary}>
                                        我的理解
                                    </Text>
                                    <Text
                                        type="body2"
                                        color={theme.colors.onBackground}
                                        style={{ marginTop: theme.spacing.xs }}
                                    >
                                        {card.understandingText}
                                    </Text>
                                </View>
                            ) : null}

                            {card.tags.length ? (
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: theme.spacing.md }}>
                                    {card.tags.map((tag) => (
                                        <View
                                            key={tag}
                                            style={{
                                                paddingHorizontal: 9,
                                                paddingVertical: 4,
                                                borderRadius: theme.radius.full,
                                                backgroundColor: theme.colors.tertiaryContainer,
                                            }}
                                        >
                                            <Text type="footnote1" color={theme.colors.onTertiaryContainer}>
                                                {tag}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            ) : null}

                            <Text
                                type="footnote1"
                                color={theme.colors.onSurfaceVariantSummary}
                                numberOfLines={2}
                                style={{ marginTop: theme.spacing.md }}
                            >
                                {[card.authorName, card.sourceUrl].filter(Boolean).join(' · ')}
                            </Text>

                            <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
                                <Button style={{ flex: 1 }} onPress={() => setEditingCard(card)}>
                                    编辑
                                </Button>
                                <Button style={{ flex: 1 }} onPress={() => openSource(card)}>
                                    原文
                                </Button>
                                <Button style={{ flex: 1 }} onPress={() => setDeleteCandidate(card)}>
                                    删除
                                </Button>
                            </View>
                        </Card>
                    ))
                )}
            </ScrollView>

            <KnowledgeCardEditorSheet
                visible={editingCard != null}
                card={editingCard}
                onClose={() => setEditingCard(null)}
                onSaved={(saved) => {
                    setCards((current) => current.map((card) => card.id === saved.id ? saved : card));
                    setEditingCard(null);
                }}
            />

            <Dialog
                visible={deleteCandidate != null}
                onClose={() => setDeleteCandidate(null)}
                title="删除知识卡片"
                summary={deleteCandidate?.quoteText.trim().slice(0, 100)}
            >
                <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                    <Button style={{ flex: 1 }} onPress={() => setDeleteCandidate(null)}>
                        取消
                    </Button>
                    <Button type="primary" style={{ flex: 1 }} onPress={() => void remove()}>
                        删除
                    </Button>
                </View>
            </Dialog>
        </View>
    );
}

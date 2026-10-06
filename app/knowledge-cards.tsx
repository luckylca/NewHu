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
    PageFlatList,
    PageScaffold,
    SegmentedControl,
    TopAppBar,
} from '@/src/ui';
import { Text } from '@/src/ui/primitives';
import { getBadgeColorsByIndex } from '@/src/ui/badgePalette';
import { useTheme } from '@/src/ui/theme';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';

const FILTER_STATES: (KnowledgeReviewState | null)[] = [
    null,
    ...KNOWLEDGE_REVIEW_STATES,
];

type DisplayKnowledgeCard = KnowledgeCard & { displayTime: string };

function normalizeKnowledgeCard(card: KnowledgeCard): DisplayKnowledgeCard {
    return {
        ...card,
        displayTime: new Date(card.updatedAt).toLocaleString(),
    };
}

export default function KnowledgeCardsScreen() {
    const theme = useTheme();
    const router = useRouter();
    const [cards, setCards] = useState<DisplayKnowledgeCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterIndex, setFilterIndex] = useState(0);
    const [editingCard, setEditingCard] = useState<KnowledgeCard | null>(null);
    const [deleteCandidate, setDeleteCandidate] = useState<KnowledgeCard | null>(null);

    const reload = useCallback(async () => {
        setLoading(true);
        try {
            setCards((await listKnowledgeCards()).map(normalizeKnowledgeCard));
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

    const openSource = useCallback((card: KnowledgeCard) => {
        router.push({
            pathname: '/select-text/[type]/[id]',
            params: {
                type: card.contentType,
                id: card.contentId,
            },
        });
    }, [router]);

    const listHeader = useMemo(() => (
        <View>
            <View style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md }}>
                <SegmentedControl
                    tabs={['全部', '待复习', '复习中', '已掌握']}
                    selected={filterIndex}
                    onSelect={setFilterIndex}
                />
            </View>

            <View style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md }}>
                <Card feedback="none" contentStyle={{ padding: theme.spacing.md }}>
                    <Text type="body2" weight="medium" color={theme.colors.onBackground}>
                        知识卡片是用来复习的，不是另一份收藏夹
                    </Text>
                    <Text
                        type="body2"
                        color={theme.colors.onSurfaceVariantSummary}
                        style={{ marginTop: theme.spacing.xs, lineHeight: 20 }}
                    >
                        把文章或回答里的一段划线/摘录变成卡片，保留原文、你的理解、标签和复习状态。之后可以按“待复习 → 复习中 → 已掌握”整理真正需要记住的内容。
                    </Text>
                </Card>
            </View>
        </View>
    ), [filterIndex, theme]);

    const renderCard = useCallback(({ item: card }: { item: DisplayKnowledgeCard }) => {
        const stateIndex = card.reviewState === 'new' ? 2 : card.reviewState === 'learning' ? 5 : 3;
        const colors = getBadgeColorsByIndex(stateIndex, theme.dark);
        return (
            <View style={{ marginHorizontal: theme.spacing.lg }}>
            <Card feedback="none" contentStyle={{ padding: theme.spacing.lg }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <View
                        style={{
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            borderRadius: theme.radius.full,
                            backgroundColor: colors.background,
                            borderWidth: 1,
                            borderColor: colors.border,
                        }}
                    >
                        <Text type="footnote1" weight="bold" color={colors.foreground}>
                            {KNOWLEDGE_REVIEW_LABELS[card.reviewState]}
                        </Text>
                    </View>
                    <Text
                        type="footnote1"
                        color={theme.colors.onSurfaceVariantSummary}
                        numberOfLines={1}
                        style={{ flexShrink: 1 }}
                    >
                        {card.displayTime}
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
                    <Card
                        feedback="none"
                        style={{ marginTop: theme.spacing.md }}
                        contentStyle={{ padding: theme.spacing.md, backgroundColor: theme.colors.surfaceContainerHigh }}
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
                    </Card>
                ) : null}

                {card.tags.length ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: theme.spacing.md }}>
                        {card.tags.map((tag, index) => {
                            const tagColors = getBadgeColorsByIndex(index + 4, theme.dark);
                            return (
                                <View
                                    key={tag}
                                    style={{
                                        paddingHorizontal: 9,
                                        paddingVertical: 4,
                                        borderRadius: theme.radius.full,
                                        backgroundColor: tagColors.background,
                                        borderWidth: 1,
                                        borderColor: tagColors.border,
                                    }}
                                >
                                    <Text type="footnote1" weight="medium" color={tagColors.foreground}>
                                        {tag}
                                    </Text>
                                </View>
                            );
                        })}
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
            </View>
        );
    }, [openSource, theme]);

    const keyExtractor = useCallback((card: DisplayKnowledgeCard) => card.id, []);
    const listEmpty = useMemo(() => loading ? (
        <View style={{ paddingVertical: theme.spacing.xxl, alignItems: 'center' }}>
            <Text type="body1" color={theme.colors.onSurfaceVariantSummary}>
                正在读取知识卡片…
            </Text>
        </View>
    ) : (
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
    ), [loading, theme]);

    return (
        <PageScaffold topBar={<TopAppBar title="知识卡片" back={() => router.back()} />}>
            <PageFlatList
                data={filteredCards}
                keyExtractor={keyExtractor}
                renderItem={renderCard}
                ListHeaderComponent={listHeader}
                ListEmptyComponent={listEmpty}
                contentContainerStyle={{ paddingBottom: theme.spacing.xxl }}
                showsVerticalScrollIndicator={false}
            />

            <KnowledgeCardEditorSheet
                visible={editingCard != null}
                card={editingCard}
                onClose={() => setEditingCard(null)}
                onSaved={(saved) => {
                    setCards((current) => current.map((card) => card.id === saved.id ? normalizeKnowledgeCard(saved) : card));
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
        </PageScaffold>
    );
}

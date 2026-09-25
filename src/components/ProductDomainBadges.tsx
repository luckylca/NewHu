import { classifyProductV1Domains } from '@/src/product-v1/domainClassifier';
import type { ProductV1DomainMatch } from '@/src/product-v1/domainSelection';
import type { ProductV1DomainClassificationPriority } from '@/src/product-v1/domainTaskQueue';
import type { FeedType } from '@/src/types/zhihu';
import { Text } from '@/src/ui/primitives';
import { badgeColorSeed, getDistinctBadgePalette } from '@/src/ui/badgePalette';
import { useTheme } from '@/src/ui/theme';
import { StableAsyncResultCache } from '@/src/utils/stableAsyncResultCache';
import React from 'react';
import { View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

type BadgeClassificationInput = {
  contentKey: string;
  title: string;
  excerpt: string;
  feedType?: FeedType;
  contentId?: string;
  questionId?: string;
  questionTopicIds?: string[];
};

const stableBadges = new StableAsyncResultCache<ProductV1DomainMatch[]>(500);

function classify(input: BadgeClassificationInput, priority: ProductV1DomainClassificationPriority, signal: AbortSignal) {
  return classifyProductV1Domains(input.contentKey, input.title, input.excerpt, {
    feedType: input.feedType,
    contentId: input.contentId,
    questionId: input.questionId,
    questionTopicIds: input.questionTopicIds,
    priority,
    signal,
  });
}

function getStableBadges(input: BadgeClassificationInput) {
  // Classify once when a card first becomes visible. The request is shared by
  // every mount of this feed item, so virtualized scrolling cannot restart it
  // or replace the capsule with a different low-priority guess.
  return stableBadges.get(input.contentKey, () => classify(input, 'high', new AbortController().signal));
}

export function ProductDomainBadges({
  enabled,
  contentKey,
  title,
  excerpt,
  feedType,
  contentId,
  questionId,
  questionTopicIds,
  priority = 'normal',
  style,
}: {
  enabled: boolean;
  contentKey: string;
  title: string;
  excerpt: string;
  feedType?: FeedType;
  contentId?: string;
  questionId?: string;
  questionTopicIds?: string[];
  priority?: ProductV1DomainClassificationPriority;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const [classification, setClassification] = React.useState(() => ({
    key: contentKey,
    domains: [] as ProductV1DomainMatch[],
  }));
  const input: BadgeClassificationInput = {
    contentKey,
    title,
    excerpt,
    feedType,
    contentId,
    questionId,
    questionTopicIds,
  };

  React.useEffect(() => {
    if (!enabled || priority !== 'high') {
      if (classification.key !== contentKey) {
        setClassification({ key: contentKey, domains: [] });
      }
      return;
    }

    let active = true;
    void getStableBadges(input)
      .then((matches) => {
        if (active) setClassification({ key: contentKey, domains: matches });
      })
      .catch(() => undefined);

    return () => {
      // Keep the shared request alive when this card leaves the render window.
      // Its result is memoized and reused if the user scrolls back to it.
      active = false;
    };
  // Input is intentionally captured on the first visible render for this key.
  // Updates caused by preview hydration or scrolling must not alter its label.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentKey, enabled, priority]);

  const domains = classification.key === contentKey ? classification.domains : [];

  if (!enabled || domains.length === 0) return null;

  const palette = getDistinctBadgePalette(theme.dark);
  const usedPaletteIndexes = new Set<number>();
  const coloredDomains = domains.map((domain) => {
    let paletteIndex = badgeColorSeed(domain.domain) % palette.length;
    for (let offset = 0; offset < palette.length; offset += 1) {
      const candidate = (paletteIndex + offset) % palette.length;
      if (!usedPaletteIndexes.has(candidate)) {
        paletteIndex = candidate;
        break;
      }
    }
    usedPaletteIndexes.add(paletteIndex);
    return { domain, colors: palette[paletteIndex] };
  });

  return (
    <View
      pointerEvents="none"
      style={[
        {
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 4,
        },
        style,
      ]}
    >
      {coloredDomains.map(({ domain, colors }) => (
        <View
          key={domain.domain}
          style={{
            minHeight: 22,
            paddingHorizontal: 8,
            borderRadius: theme.radius.full,
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text type="footnote2" weight="bold" color={colors.foreground}>
            {domain.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

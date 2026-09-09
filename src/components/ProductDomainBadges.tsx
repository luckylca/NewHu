import { classifyProductV1Domains } from '@/src/product-v1/domainClassifier';
import type { ProductV1DomainMatch } from '@/src/product-v1/domainSelection';
import type { ProductV1DomainClassificationPriority } from '@/src/product-v1/domainTaskQueue';
import { Text } from '@/src/ui/primitives';
import { badgeColorSeed, getDistinctBadgePalette } from '@/src/ui/badgePalette';
import { useTheme } from '@/src/ui/theme';
import React from 'react';
import { View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

export function ProductDomainBadges({
  enabled,
  contentKey,
  title,
  excerpt,
  priority = 'normal',
  style,
}: {
  enabled: boolean;
  contentKey: string;
  title: string;
  excerpt: string;
  priority?: ProductV1DomainClassificationPriority;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const [domains, setDomains] = React.useState<ProductV1DomainMatch[]>([]);

  React.useEffect(() => {
    if (!enabled) {
      setDomains([]);
      return;
    }

    let active = true;
    const controller = new AbortController();
    void classifyProductV1Domains(contentKey, title, excerpt, {
      priority,
      signal: controller.signal,
    })
      .then((matches) => {
        if (active) setDomains(matches);
      })
      .catch(() => {
        if (active) setDomains([]);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [contentKey, enabled, excerpt, priority, title]);

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

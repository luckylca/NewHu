import { classifyProductV1Domains } from '@/src/product-v1/domainClassifier';
import type { ProductV1DomainMatch } from '@/src/product-v1/domainSelection';
import { Text } from '@/src/ui/primitives';
import { useTheme } from '@/src/ui/theme';
import React from 'react';
import { View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

function domainColorSeed(domain: string) {
  let hash = 2166136261;
  for (const char of domain) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function ProductDomainBadges({
  enabled,
  contentKey,
  title,
  excerpt,
  style,
}: {
  enabled: boolean;
  contentKey: string;
  title: string;
  excerpt: string;
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
    void classifyProductV1Domains(contentKey, title, excerpt)
      .then((matches) => {
        if (active) setDomains(matches);
      })
      .catch(() => {
        if (active) setDomains([]);
      });

    return () => {
      active = false;
    };
  }, [contentKey, enabled, excerpt, title]);

  if (!enabled || domains.length === 0) return null;

  const palette = [
    { background: theme.colors.primaryContainer, foreground: theme.colors.onPrimaryContainer },
    { background: theme.colors.secondaryContainer, foreground: theme.colors.onSecondaryContainer },
    { background: theme.colors.tertiaryContainer, foreground: theme.colors.onTertiaryContainer },
    { background: theme.colors.errorContainer, foreground: theme.colors.onErrorContainer },
    { background: theme.colors.primaryVariant, foreground: theme.colors.onPrimaryVariant },
    { background: theme.colors.secondaryVariant, foreground: theme.colors.onSecondaryVariant },
    { background: theme.colors.secondaryContainerVariant, foreground: theme.colors.onSecondaryContainerVariant },
    { background: theme.colors.surfaceContainerHigh, foreground: theme.colors.onSurfaceContainerHigh },
  ];
  const usedPaletteIndexes = new Set<number>();
  const coloredDomains = domains.map((domain) => {
    let paletteIndex = domainColorSeed(domain.domain) % palette.length;
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

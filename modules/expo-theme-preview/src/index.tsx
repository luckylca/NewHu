import { requireNativeViewManager } from 'expo-modules-core';
import React from 'react';
import { Platform, processColor } from 'react-native';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';

export interface ThemePreviewThumbnailProps {
  style?: StyleProp<ViewStyle>;
  surfaceColor: ColorValue;
  outlineColor: ColorValue;
  primaryTextColor: ColorValue;
  secondaryTextColor: ColorValue;
  dotColor: ColorValue;
}

type NativeThumbnailProps = Omit<ThemePreviewThumbnailProps, 'surfaceColor' | 'outlineColor' | 'primaryTextColor' | 'secondaryTextColor' | 'dotColor'> & {
  surfaceColor: ReturnType<typeof processColor>;
  outlineColor: ReturnType<typeof processColor>;
  primaryTextColor: ReturnType<typeof processColor>;
  secondaryTextColor: ReturnType<typeof processColor>;
  dotColor: ReturnType<typeof processColor>;
};

const NativeThemePreviewThumbnail = Platform.OS === 'android'
  ? requireNativeViewManager<NativeThumbnailProps>('ExpoThemePreview', 'ThemePreviewThumbnail')
  : null;

export const supportsNativeThemePreviewThumbnail = NativeThemePreviewThumbnail !== null;

export function ThemePreviewThumbnail(props: ThemePreviewThumbnailProps) {
  if (!NativeThemePreviewThumbnail) return null;
  return React.createElement(NativeThemePreviewThumbnail, {
    ...props,
    surfaceColor: processColor(props.surfaceColor),
    outlineColor: processColor(props.outlineColor),
    primaryTextColor: processColor(props.primaryTextColor),
    secondaryTextColor: processColor(props.secondaryTextColor),
    dotColor: processColor(props.dotColor),
  });
}

export interface ThemePreviewLiquidGlassProps {
  style?: StyleProp<ViewStyle>;
  pointerEvents?: 'none' | 'auto' | 'box-none' | 'box-only';
  barMaterial: number[];
  cardMaterial: number[];
  tabBarMaterial: number[];
  outlineColor: ColorValue;
  primaryTextColor: ColorValue;
  secondaryTextColor: ColorValue;
  dotColor: ColorValue;
}

type NativeLiquidGlassProps = Omit<ThemePreviewLiquidGlassProps,
  'outlineColor' | 'primaryTextColor' | 'secondaryTextColor' | 'dotColor'> & {
    outlineColor: ReturnType<typeof processColor>;
    primaryTextColor: ReturnType<typeof processColor>;
    secondaryTextColor: ReturnType<typeof processColor>;
    dotColor: ReturnType<typeof processColor>;
  };

const NativeThemePreviewLiquidGlass = Platform.OS === 'android'
  ? requireNativeViewManager<NativeLiquidGlassProps>('ExpoThemePreview', 'ThemePreviewLiquidGlass')
  : null;

export const supportsNativeThemePreviewLiquidGlass = Platform.OS === 'android'
  && Number(Platform.Version) >= 33
  && NativeThemePreviewLiquidGlass !== null;

export function ThemePreviewLiquidGlass(props: ThemePreviewLiquidGlassProps) {
  if (!NativeThemePreviewLiquidGlass) return null;
  return React.createElement(NativeThemePreviewLiquidGlass, {
    ...props,
    outlineColor: processColor(props.outlineColor),
    primaryTextColor: processColor(props.primaryTextColor),
    secondaryTextColor: processColor(props.secondaryTextColor),
    dotColor: processColor(props.dotColor),
  });
}

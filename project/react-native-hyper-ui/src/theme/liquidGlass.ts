import { Platform } from 'react-native';
import { componentTokens, opacity, spacing, typography } from './tokens';
import { liquidGlassPresentation } from './presentation';
import { liquidGlassWallpaperTokens } from './wallpaper';
import { liquidGlassForegroundColors } from './glassColors';
import type { AppTheme, GlassTokens, ThemeColors, ThemeFonts, ThemeRadius } from './types';

const lightColors: ThemeColors = {
    primary: '#346FE3', onPrimary: '#FFFFFF', primaryVariant: '#235CCB', onPrimaryVariant: '#D9E5FF',
    error: '#B93838', onError: '#FFFFFF', errorContainer: '#FCE8E8', onErrorContainer: '#5C1616',
    disabledPrimary: '#B6C8EC', disabledOnPrimary: '#F1F5FC', disabledPrimaryButton: '#B6C8EC',
    disabledOnPrimaryButton: '#FFFFFF', disabledPrimarySlider: '#A9BDE3',
    primaryContainer: '#DCE7FF', onPrimaryContainer: '#234B99',
    secondary: '#DCE3EC', onSecondary: '#253247', secondaryVariant: '#E8EDF3', onSecondaryVariant: '#33445B',
    disabledSecondary: '#E8ECF1', disabledOnSecondary: '#F7F8FA', disabledSecondaryVariant: '#E7EBF0',
    disabledOnSecondaryVariant: '#8994A3', secondaryContainer: '#E9EFF7', onSecondaryContainer: '#50627A',
    secondaryContainerVariant: '#E2EAF5', onSecondaryContainerVariant: '#53657D',
    tertiaryContainer: '#E0F0F5', onTertiaryContainer: '#287087', tertiaryContainerVariant: '#E8F3F7',
    background: 'transparent', onBackground: '#162235', onBackgroundVariant: '#64758D',
    ...liquidGlassForegroundColors.light,
    surface: '#F4F7FB', onSurface: '#1B293C', surfaceVariant: '#EFF4FA',
    onSurfaceSecondary: 'rgba(24,38,57,0.82)', onSurfaceVariantSummary: 'rgba(45,62,84,0.68)',
    onSurfaceVariantActions: 'rgba(45,62,84,0.48)', disabledOnSurface: '#9AA6B5',
    surfaceContainer: '#F8FAFD', onSurfaceContainer: '#1B293C', onSurfaceContainerVariant: '#708096',
    surfaceContainerHigh: '#EAF0F7', onSurfaceContainerHigh: '#63758C',
    surfaceContainerHighest: '#DDE6F0', onSurfaceContainerHighest: '#28384E',
    outline: '#C7D2E0', dividerLine: 'rgba(71,91,116,0.14)', windowDimming: 'rgba(13,24,39,0.38)',
    sliderKeyPoint: 'rgba(95,125,169,0.24)', sliderKeyPointForeground: '#5C91E8', sliderBackground: 'rgba(52,82,125,0.1)',
    card: '#F8FAFD', text: '#1B293C', border: '#C7D2E0', notification: '#B93838',
};

const darkColors: ThemeColors = {
    primary: '#8FB4FF', onPrimary: '#112746', primaryVariant: '#AEC8FF', onPrimaryVariant: '#294A7F',
    error: '#FFB4AB', onError: '#690005', errorContainer: '#8F1D20', onErrorContainer: '#FFE1DE',
    disabledPrimary: '#354B6D', disabledOnPrimary: '#8495B1', disabledPrimaryButton: '#354B6D',
    disabledOnPrimaryButton: '#AAB8CC', disabledPrimarySlider: '#455C7E',
    primaryContainer: '#29466F', onPrimaryContainer: '#DBE6FF',
    secondary: '#46546A', onSecondary: '#E3ECF9', secondaryVariant: '#344257', onSecondaryVariant: '#D9E4F1',
    disabledSecondary: '#303B4C', disabledOnSecondary: '#8490A2', disabledSecondaryVariant: '#354155',
    disabledOnSecondaryVariant: '#818FA3', secondaryContainer: '#303D50', onSecondaryContainer: '#BDCADB',
    secondaryContainerVariant: '#39485D', onSecondaryContainerVariant: '#BBC9DB',
    tertiaryContainer: '#244252', onTertiaryContainer: '#9AD5E7', tertiaryContainerVariant: '#2D4655',
    background: 'transparent', onBackground: '#EDF3FB', onBackgroundVariant: '#A1AEC0',
    ...liquidGlassForegroundColors.dark,
    surface: '#1B2230', onSurface: '#EDF3FB', surfaceVariant: '#222C3A',
    onSurfaceSecondary: 'rgba(237,243,251,0.84)', onSurfaceVariantSummary: 'rgba(210,222,238,0.66)',
    onSurfaceVariantActions: 'rgba(210,222,238,0.48)', disabledOnSurface: '#77859A',
    surfaceContainer: '#202A39', onSurfaceContainer: '#EAF1FA', onSurfaceContainerVariant: '#A0AEC1',
    surfaceContainerHigh: '#283547', onSurfaceContainerHigh: '#B7C4D6',
    surfaceContainerHighest: '#344358', onSurfaceContainerHighest: '#E1EAF6',
    outline: '#52647B', dividerLine: 'rgba(214,228,246,0.14)', windowDimming: 'rgba(0,5,14,0.62)',
    sliderKeyPoint: 'rgba(161,183,213,0.24)', sliderKeyPointForeground: '#8DB4F7', sliderBackground: 'rgba(210,225,246,0.15)',
    card: '#202A39', text: '#EDF3FB', border: '#52647B', notification: '#FFB4AB',
};

const fonts: ThemeFonts = {
    regular: { fontFamily: Platform.select({ ios: 'System', default: 'sans-serif' })!, fontWeight: '400' },
    medium: { fontFamily: Platform.select({ ios: 'System', default: 'sans-serif-medium' })!, fontWeight: '500' },
    bold: { fontFamily: Platform.select({ ios: 'System', default: 'sans-serif' })!, fontWeight: '700' },
    heavy: { fontFamily: Platform.select({ ios: 'System', default: 'sans-serif' })!, fontWeight: '800' },
};

const radius: ThemeRadius = {
    component: 20,
    tab: 16,
    tabContour: 12,
    bottomSheet: 32,
    dialog: 28,
    full: 9999,
};

const glass: GlassTokens = {
    enabled: true,
    quality: 'balanced',
    wallpaperScrim: { light: 'rgba(235,242,251,0.28)', dark: 'rgba(16,23,34,0.32)' },
    tint: { light: 'rgba(238,246,255,0.12)', dark: 'rgba(26,37,53,0.18)' },
    fallbackTint: { light: 'rgba(237,244,252,0.94)', dark: 'rgba(31,42,58,0.96)' },
    fallbackBorder: { light: 'rgba(255,255,255,0.78)', dark: 'rgba(216,230,248,0.2)' },
    procedural: {
        baseTint: { light: 'rgba(247,251,255,0.28)', dark: 'rgba(24,38,58,0.34)' },
        accentTint: { light: 'rgba(175,205,252,0.24)', dark: 'rgba(103,158,235,0.2)' },
        highlightTint: { light: 'rgba(255,255,255,0.94)', dark: 'rgba(207,228,255,0.62)' },
        innerShade: { light: 'rgba(33,62,101,0.19)', dark: 'rgba(0,4,12,0.68)' },
        outerShadow: { light: 'rgba(49,71,102,0.2)', dark: 'rgba(0,2,9,0.54)' },
        noiseStrength: 0.014,
    },
    materials: {
        surface: { radius: 20, opacity: 0.86, blurRadius: 3, refractionHeight: 8, refractionAmount: 10, saturation: 1.08, chromaticAberration: 0.1, highlightAlpha: 0.54, highlightWidth: 1.6 },
        card: { radius: 20, opacity: 0.9, accentTint: { light: 'rgba(156,193,249,0.28)', dark: 'rgba(78,130,205,0.25)' }, blurRadius: 3, refractionHeight: 9, refractionAmount: 12, saturation: 1.1, chromaticAberration: 0.14, highlightAlpha: 0.78, highlightWidth: 1.8 },
        preferencePanel: { radius: 22, opacity: 1, accentTint: { light: 'rgba(156,193,249,0.26)', dark: 'rgba(78,130,205,0.22)' }, blurRadius: 4, refractionHeight: 7, refractionAmount: 8, refractionBodyAmount: 1.2, saturation: 1.08, chromaticAberration: 0.06, highlightAlpha: 0.72, highlightWidth: 1.5, tintAlpha: 1, specularStrength: 0.82, fresnelStrength: 0.78, innerShadowStrength: 0.14 },
        bar: { opticsModel: 'sdfScaleLens', sdfScaleLens: { contrast: 1.2, brightness: 1.05, saturation: 1.1, outerShadowAlpha: 0.25, outerShadowBlurRadius: 8, outerShadowOffsetY: 4, innerShadowAlpha: 0.15, innerShadowExtent: 25 }, radius: 0, opacity: 0.78, blurRadius: 0, refractionHeight: 8, refractionAmount: 12, saturation: 1.08, chromaticAberration: 0.16, highlightAlpha: 0.72, highlightWidth: 2 },
        search: { opticsModel: 'sdfScaleLens', sdfScaleLens: { contrast: 1.2, brightness: 1.05, saturation: 1.1, outerShadowAlpha: 0.25, outerShadowBlurRadius: 8, outerShadowOffsetY: 4, innerShadowAlpha: 0.15, innerShadowExtent: 25 }, radius: 9999, opacity: 0.78, blurRadius: 0, refractionHeight: 6, refractionAmount: 10, saturation: 1.08, chromaticAberration: 0.12, highlightAlpha: 0.62, highlightWidth: 1.6 },
        menu: { radius: 20, opacity: 0.84, blurRadius: 4, refractionHeight: 9, refractionAmount: 13, saturation: 1.1, chromaticAberration: 0.14, highlightAlpha: 0.72, highlightWidth: 1.8, shadowOpacity: 0.2, shadowRadius: 14, shadowOffsetY: 5, elevation: 8 },
        notification: { radius: 20, opacity: 0.84, blurRadius: 3, refractionHeight: 8, refractionAmount: 12, saturation: 1.1, chromaticAberration: 0.12, highlightAlpha: 0.7, highlightWidth: 1.8, shadowOpacity: 0.18, shadowRadius: 12, shadowOffsetY: 4, elevation: 6 },
        tabBar: { radius: 34, opacity: 0.62, blurRadius: 3, refractionHeight: 9, refractionAmount: 7, saturation: 1.1, chromaticAberration: 0.1, highlightAlpha: 0.64, highlightWidth: 2, shadowOpacity: 0.2, shadowRadius: 14, shadowOffsetY: 5, elevation: 8 },
        tabBarShell: { radius: 33, opacity: 0.52, blurRadius: 2, refractionHeight: 8, refractionAmount: 6, saturation: 1.08, chromaticAberration: 0.08, highlightAlpha: 0.54, highlightWidth: 1.8, shadowOpacity: 0.16, shadowRadius: 12, shadowOffsetY: 4, elevation: 6 },
        tabSelectionIdle: { radius: 24, opacity: 0.68, accentTint: { light: 'rgba(171,208,255,0.13)', dark: 'rgba(125,176,244,0.16)' }, blurRadius: 2, refractionHeight: 8, refractionAmount: 10, saturation: 1.08, chromaticAberration: 0.08, highlightAlpha: 0.62, highlightWidth: 1.8 },
        tabSelectionInteractive: { radius: 27, opacity: 0.92, accentTint: { light: 'rgba(171,208,255,0.22)', dark: 'rgba(125,176,244,0.24)' }, blurRadius: 2, refractionHeight: 12, refractionAmount: 12.5, saturation: 1.16, chromaticAberration: 0.24, highlightAlpha: 0.96, highlightWidth: 2.4 },
        tabSelectionLens: {
            radius: 24,
            opacity: 1,
            blurRadius: 0.35,
            // Native shader values are dp and become physical px at device
            // density. Keep idle offsets to low single-digit dp; the former
            // double-digit dp rim offset over-compressed text at phone density.
            refractionHeight: 12,
            refractionAmount: 5.5,
            refractionBodyAmount: 1.5,
            saturation: 1.02,
            chromaticAberration: 0.3,
            highlightAlpha: 0.62,
            highlightWidth: 1.3,
            tintAlpha: 0.08,
            specularStrength: 0.95,
            fresnelStrength: 0.72,
            innerShadowStrength: 0.2,
        },
        tabPreview: { radius: 22, opacity: 0.84, blurRadius: 4, refractionHeight: 13, refractionAmount: 18, saturation: 1.16, chromaticAberration: 0.2, highlightAlpha: 0.88, highlightWidth: 2.2 },
        floating: { radius: 24, opacity: 0.88, blurRadius: 4, refractionHeight: 10, refractionAmount: 14, saturation: 1.12, chromaticAberration: 0.2, highlightAlpha: 0.8, highlightWidth: 2 },
        sheet: { radius: 32, blurRadius: 4, refractionHeight: 11, refractionAmount: 14, saturation: 1.1, chromaticAberration: 0.14, highlightAlpha: 0.68, highlightWidth: 1.8 },
        dialog: { radius: 28, blurRadius: 4, refractionHeight: 11, refractionAmount: 14, saturation: 1.1, chromaticAberration: 0.16, highlightAlpha: 0.72, highlightWidth: 1.8 },
        control: { radius: 9999, opacity: 0.76, blurRadius: 2, refractionHeight: 8, refractionAmount: 10, saturation: 1.08, chromaticAberration: 0.12, highlightAlpha: 0.6, highlightWidth: 1.6 },
        lens: {
            radius: 22,
            opacity: 1.38,
            accentTint: { light: 'rgba(171,208,255,0.3)', dark: 'rgba(125,176,244,0.34)' },
            blurRadius: 4,
            refractionHeight: 14,
            refractionAmount: 24,
            saturation: 1.18,
            chromaticAberration: 0.24,
            highlightAlpha: 0.98,
            highlightWidth: 2.6,
        },
    },
    interaction: { enabled: true },
};

const liquidGlassTheme = (dark: boolean): AppTheme => ({
    name: 'liquidGlass',
    dark,
    colors: dark ? darkColors : lightColors,
    typography,
    spacing,
    radius,
    opacity,
    components: {
        ...componentTokens,
        button: { ...componentTokens.button, radius: 20 },
        card: { radius: 20 },
        searchBar: { ...componentTokens.searchBar, minHeight: 48 },
        tabRow: { ...componentTokens.tabRow, height: 46, radius: 16 },
        bottomSheet: { ...componentTokens.bottomSheet, radius: 32 },
        dialog: { ...componentTokens.dialog, radius: 28 },
    },
    presentation: liquidGlassPresentation,
    wallpaper: liquidGlassWallpaperTokens,
    glass,
    fonts,
});

export const liquidGlassLightTheme: AppTheme = liquidGlassTheme(false);
export const liquidGlassDarkTheme: AppTheme = liquidGlassTheme(true);

import type { TextStyle } from 'react-native';

/**
 * Design System theme types.
 *
 * The theme carries much more than colors: typography, spacing, radius,
 * opacity, component tokens and motion presets all live here so business
 * pages never decide the visual language themselves.
 *
 * Color roles follow miuix (HyperOS) semantics — see tokens.ts. Values are
 * ported 1:1 from miuix-vue `src/theme/tokens.scss` (which itself is a 1:1
 * port of miuix `Colors.kt` / `TextStyles.kt`).
 */

export type ThemeName = 'hyperos' | 'coloros' | 'liquidGlass';

/** Semantic color roles (miuix / HyperOS). */
export interface ThemeColors {
    primary: string;
    onPrimary: string;
    primaryVariant: string;
    onPrimaryVariant: string;

    error: string;
    onError: string;
    errorContainer: string;
    onErrorContainer: string;

    disabledPrimary: string;
    disabledOnPrimary: string;
    disabledPrimaryButton: string;
    disabledOnPrimaryButton: string;
    disabledPrimarySlider: string;

    primaryContainer: string;
    onPrimaryContainer: string;

    secondary: string;
    onSecondary: string;
    secondaryVariant: string;
    onSecondaryVariant: string;

    disabledSecondary: string;
    disabledOnSecondary: string;
    disabledSecondaryVariant: string;
    disabledOnSecondaryVariant: string;

    secondaryContainer: string;
    onSecondaryContainer: string;
    secondaryContainerVariant: string;
    onSecondaryContainerVariant: string;

    tertiaryContainer: string;
    onTertiaryContainer: string;
    tertiaryContainerVariant: string;

    background: string;
    onBackground: string;
    onBackgroundVariant: string;

    surface: string;
    onSurface: string;
    surfaceVariant: string;
    /** onSurface @ 0.80 — secondary text on surfaces. */
    onSurfaceSecondary: string;
    /** onSurface @ 0.60 — preference summary. */
    onSurfaceVariantSummary: string;
    /** onSurface @ 0.40 — tertiary actions / hints. */
    onSurfaceVariantActions: string;
    disabledOnSurface: string;

    surfaceContainer: string;
    onSurfaceContainer: string;
    onSurfaceContainerVariant: string;
    surfaceContainerHigh: string;
    onSurfaceContainerHigh: string;
    surfaceContainerHighest: string;
    onSurfaceContainerHighest: string;

    outline: string;
    dividerLine: string;
    windowDimming: string;

    sliderKeyPoint: string;
    sliderKeyPointForeground: string;
    sliderBackground: string;

    // ---- React Navigation compatibility aliases (derived) ----
    card: string;
    text: string;
    border: string;
    notification: string;
}

/** A single text style preset (fontSize + optional weight / lineHeight). */
export interface TextStylePreset {
    fontSize: number;
    fontWeight?: TextStyle['fontWeight'];
    lineHeight?: number;
    lineHeightRatio?: number;
}

/**
 * Miuix typography presets (TextStyles.kt).
 * 1dp = 1px @ 1x DPR.
 */
export interface ThemeTypography {
    main: TextStylePreset;
    paragraph: TextStylePreset;
    body1: TextStylePreset;
    body2: TextStylePreset;
    button: TextStylePreset;
    footnote1: TextStylePreset;
    footnote2: TextStylePreset;
    headline1: TextStylePreset;
    headline2: TextStylePreset;
    subtitle: TextStylePreset;
    title1: TextStylePreset;
    title2: TextStylePreset;
    title3: TextStylePreset;
    title4: TextStylePreset;
}

export interface ThemeSpacing {
    none: number;
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
}

export interface ThemeRadius {
    /** Button / Card / Surface / TextField = 16. */
    component: number;
    tab: number;
    tabContour: number;
    bottomSheet: number;
    dialog: number;
    full: number;
}

export interface ThemeOpacity {
    /** MiuixIndication hover overlay. */
    hover: number;
    /** MiuixIndication focus overlay. */
    focus: number;
    /** MiuixIndication press overlay. */
    press: number;
    /** Bottom-nav unselected. */
    navUnselected: number;
    navSelected: number;
    navPressedSelected: number;
    navPressedUnselected: number;
    /** Bottom-sheet drag handle rest. */
    sheetHandle: number;
    sheetHandlePressed: number;
}

export interface ButtonTokens {
    minWidth: number;
    minHeight: number;
    radius: number;
    paddingHorizontal: number;
    paddingVertical: number;
    fontSize: number;
}

export interface CardTokens {
    radius: number;
}

export interface SwitchTokens {
    width: number;
    height: number;
    thumbSize: number;
    thumbOffset: number;
    /** on-left = thumbOffset + travel. */
    travel: number;
}

export interface SliderTokens {
    height: number;
    knobRatio: number;
    keyPointDivisor: number;
}

export interface SearchBarTokens {
    minHeight: number;
    radius: number;
    fontSize: number;
    fontWeight: TextStyle['fontWeight'];
}

export interface PreferenceTokens {
    minHeight: number;
    padding: number;
    gap: number;
    titleFontSize: number;
    titleWeight: TextStyle['fontWeight'];
    summaryFontSize: number;
}

export interface TabRowTokens {
    height: number;
    radius: number;
    minTabWidth: number;
    maxTabWidth: number;
    gap: number;
    fontSize: number;
}

export interface NavigationBarTokens {
    itemHeight: number;
    iconSize: number;
    labelSize: number;
    topBarCollapsedHeight: number;
}

export interface BottomSheetTokens {
    radius: number;
    maxWidth: number;
    horizontalPadding: number;
    handleWidth: number;
    handleHeight: number;
}

export interface DialogTokens {
    radius: number;
    maxWidth: number;
    padding: number;
    outsideMargin: number;
}

export interface ComponentTokens {
    button: ButtonTokens;
    card: CardTokens;
    switch: SwitchTokens;
    slider: SliderTokens;
    searchBar: SearchBarTokens;
    preference: PreferenceTokens;
    tabRow: TabRowTokens;
    navigationBar: NavigationBarTokens;
    bottomSheet: BottomSheetTokens;
    dialog: DialogTokens;
}

export interface FontStyle {
    fontFamily: string;
    fontWeight: '400' | '500' | '700' | '800';
}

/** React Navigation v7 fonts structure (kept on the theme so the navigation
 *  theme can be derived directly from the app theme). */
export interface ThemeFonts {
    regular: FontStyle;
    medium: FontStyle;
    bold: FontStyle;
    heavy: FontStyle;
}

export interface AppTheme {
    name: ThemeName;
    dark: boolean;
    colors: ThemeColors;
    typography: ThemeTypography;
    spacing: ThemeSpacing;
    radius: ThemeRadius;
    opacity: ThemeOpacity;
    components: ComponentTokens;
    fonts: ThemeFonts;
}

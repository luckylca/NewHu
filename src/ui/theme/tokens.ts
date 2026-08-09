import type {
    ComponentTokens,
    ThemeColors,
    ThemeOpacity,
    ThemeRadius,
    ThemeSpacing,
    ThemeTypography,
} from './types';

/**
 * Miuix / HyperOS design tokens.
 *
 * Color values are ported 1:1 from:
 *   miuix-vue/src/theme/tokens.scss  (itself a 1:1 port of miuix Colors.kt)
 * Typography / radius values follow TextStyles.kt.
 *
 * ⚠️ Do not "tune" these values — they are the reference implementation.
 */

// ---------------------------------------------------------------------------
// Light colors
// ---------------------------------------------------------------------------

const lightColors: ThemeColors = {
    primary: '#3482FF',
    onPrimary: '#FFFFFF',
    primaryVariant: '#3482FF',
    onPrimaryVariant: '#AECDFF',

    error: '#E94634',
    onError: '#FFFFFF',
    errorContainer: '#FDF6F4',
    onErrorContainer: '#410002',

    disabledPrimary: '#C2D9FF',
    disabledOnPrimary: '#F3F8FF',
    disabledPrimaryButton: '#C2D9FF',
    disabledOnPrimaryButton: '#FFFFFF',
    disabledPrimarySlider: '#B8CFF5',

    primaryContainer: '#5D9BFF',
    onPrimaryContainer: '#FFFFFF',

    secondary: '#E6E6E6',
    onSecondary: '#FFFFFF',
    secondaryVariant: '#F0F0F0',
    onSecondaryVariant: '#303030',

    disabledSecondary: '#F0F0F0',
    disabledOnSecondary: '#FCFCFC',
    disabledSecondaryVariant: '#F2F2F2',
    disabledOnSecondaryVariant: '#B2B2B2',

    secondaryContainer: '#F0F0F0',
    onSecondaryContainer: '#A9A9A9',
    secondaryContainerVariant: '#F0F0F0',
    onSecondaryContainerVariant: '#A8A8A8',

    tertiaryContainer: '#EAF2FF',
    onTertiaryContainer: '#3482FF',
    tertiaryContainerVariant: '#EAF2FF',

    background: '#FFFFFF',
    onBackground: '#000000',
    onBackgroundVariant: '#8C93B0',

    surface: '#F7F7F7',
    onSurface: '#000000',
    surfaceVariant: '#FFFFFF',
    onSurfaceSecondary: 'rgba(0,0,0,0.80)',
    onSurfaceVariantSummary: 'rgba(0,0,0,0.60)',
    onSurfaceVariantActions: 'rgba(0,0,0,0.40)',
    disabledOnSurface: '#B2B2B2',

    surfaceContainer: '#FFFFFF',
    onSurfaceContainer: '#000000',
    onSurfaceContainerVariant: '#959595',
    surfaceContainerHigh: '#E8E8E8',
    onSurfaceContainerHigh: '#A2A2A2',
    surfaceContainerHighest: '#E8E8E8',
    onSurfaceContainerHighest: '#000000',

    outline: '#D9D9D9',
    dividerLine: '#E0E0E0',
    windowDimming: 'rgba(0,0,0,0.30)',

    sliderKeyPoint: 'rgba(163,179,205,0.30)',
    sliderKeyPointForeground: '#6EB5FF',
    sliderBackground: 'rgba(0,0,0,0.06)',

    // React Navigation aliases
    card: '#FFFFFF',
    text: '#000000',
    border: '#D9D9D9',
    notification: '#E94634',
};

// ---------------------------------------------------------------------------
// Dark colors
// ---------------------------------------------------------------------------

const darkColors: ThemeColors = {
    primary: '#277AF7',
    onPrimary: '#FFFFFF',
    primaryVariant: '#0073DD',
    onPrimaryVariant: '#99C7F1',

    error: '#F12522',
    onError: '#FFFFFF',
    errorContainer: '#2E0603',
    onErrorContainer: '#FFDAD6',

    disabledPrimary: '#253E64',
    disabledOnPrimary: '#677993',
    disabledPrimaryButton: '#253E64',
    disabledOnPrimaryButton: '#677893',
    disabledPrimarySlider: '#44587C',

    primaryContainer: '#338FE4',
    onPrimaryContainer: '#FFFFFF',

    secondary: '#505050',
    onSecondary: '#FFFFFF',
    secondaryVariant: '#434343',
    onSecondaryVariant: '#D9D9D9',

    disabledSecondary: '#3F3F3F',
    disabledOnSecondary: '#797979',
    disabledSecondaryVariant: '#404040',
    disabledOnSecondaryVariant: '#707170',

    secondaryContainer: '#434343',
    onSecondaryContainer: '#7C7C7C',
    secondaryContainerVariant: '#4F4F4F',
    onSecondaryContainerVariant: '#959595',

    tertiaryContainer: '#2B3B54',
    onTertiaryContainer: '#4788FF',
    tertiaryContainerVariant: '#505050',

    background: '#242424',
    onBackground: 'rgba(255,255,255,0.90)',
    onBackgroundVariant: '#787E96',

    surface: '#000000',
    onSurface: '#F2F2F2',
    surfaceVariant: '#242424',
    onSurfaceSecondary: 'rgba(255,255,255,0.80)',
    onSurfaceVariantSummary: 'rgba(255,255,255,0.50)',
    onSurfaceVariantActions: 'rgba(255,255,255,0.40)',
    disabledOnSurface: '#666666',

    surfaceContainer: '#242424',
    onSurfaceContainer: 'rgba(255,255,255,0.90)',
    onSurfaceContainerVariant: '#737373',
    surfaceContainerHigh: '#242424',
    onSurfaceContainerHigh: '#666666',
    surfaceContainerHighest: '#2D2D2D',
    onSurfaceContainerHighest: '#E9E9E9',

    outline: '#404040',
    dividerLine: '#393939',
    windowDimming: 'rgba(0,0,0,0.60)',

    sliderKeyPoint: 'rgba(122,138,166,0.30)',
    sliderKeyPointForeground: '#5DAAFF',
    sliderBackground: 'rgba(255,255,255,0.15)',

    // React Navigation aliases
    card: '#242424',
    text: '#F2F2F2',
    border: '#404040',
    notification: '#F12522',
};

// ---------------------------------------------------------------------------
// Typography (TextStyles.kt)
// ---------------------------------------------------------------------------

export const typography: ThemeTypography = {
    main: { fontSize: 17, fontWeight: '400' },
    paragraph: { fontSize: 17, lineHeightRatio: 1.2 },
    body1: { fontSize: 16, fontWeight: '400' },
    body2: { fontSize: 14, fontWeight: '400' },
    button: { fontSize: 17, fontWeight: '400' },
    footnote1: { fontSize: 13, fontWeight: '400' },
    footnote2: { fontSize: 11, fontWeight: '400' },
    headline1: { fontSize: 17, fontWeight: '400' },
    headline2: { fontSize: 16, fontWeight: '400' },
    subtitle: { fontSize: 14, fontWeight: '700' },
    title1: { fontSize: 32, fontWeight: '400' },
    title2: { fontSize: 24, fontWeight: '400' },
    title3: { fontSize: 20, fontWeight: '400' },
    title4: { fontSize: 18, fontWeight: '400' },
};

// ---------------------------------------------------------------------------
// Spacing / radius / opacity
// ---------------------------------------------------------------------------

export const spacing: ThemeSpacing = {
    none: 0,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
};

export const radius: ThemeRadius = {
    component: 16,
    tab: 12,
    tabContour: 8,
    bottomSheet: 28,
    dialog: 32,
    full: 9999,
};

export const opacity: ThemeOpacity = {
    hover: 0.06,
    focus: 0.08,
    press: 0.1,
    navUnselected: 0.4,
    navSelected: 1,
    navPressedSelected: 0.5,
    navPressedUnselected: 0.6,
    sheetHandle: 0.2,
    sheetHandlePressed: 0.35,
};

// ---------------------------------------------------------------------------
// Component tokens (Miuix component defaults)
// ---------------------------------------------------------------------------

export const componentTokens: ComponentTokens = {
    button: {
        minWidth: 58,
        minHeight: 40,
        radius: 16,
        paddingHorizontal: 16,
        paddingVertical: 13,
        fontSize: 17,
    },
    card: {
        radius: 16,
    },
    switch: {
        width: 49,
        height: 28,
        thumbSize: 20,
        thumbOffset: 4,
        travel: 21,
    },
    slider: {
        height: 28,
        knobRatio: 0.72,
        keyPointDivisor: 7.5,
    },
    searchBar: {
        minHeight: 45,
        radius: 9999,
        fontSize: 17,
        fontWeight: '500',
    },
    preference: {
        minHeight: 56,
        padding: 16,
        gap: 8,
        titleFontSize: 17,
        titleWeight: '500',
        summaryFontSize: 14,
    },
    tabRow: {
        height: 42,
        radius: 12,
        minTabWidth: 76,
        maxTabWidth: 98,
        gap: 9,
        fontSize: 16,
    },
    navigationBar: {
        itemHeight: 64,
        iconSize: 26,
        labelSize: 12,
        topBarCollapsedHeight: 52,
    },
    bottomSheet: {
        radius: 28,
        maxWidth: 640,
        horizontalPadding: 24,
        handleWidth: 45,
        handleHeight: 4,
    },
    dialog: {
        radius: 32,
        maxWidth: 420,
        padding: 24,
        outsideMargin: 12,
    },
};

export { lightColors, darkColors };

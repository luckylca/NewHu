import type {
    ComponentTokens,
    ThemeColors,
    ThemeOpacity,
    ThemeRadius,
    ThemeSpacing,
    ThemeTypography,
    GlassTokens,
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
    onGlass: '#172438',
    onGlassSecondary: 'rgba(23,36,56,0.74)',
    onGlassMuted: 'rgba(23,36,56,0.54)',

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
    onGlass: '#EDF3FB',
    onGlassSecondary: 'rgba(237,243,251,0.76)',
    onGlassMuted: 'rgba(237,243,251,0.55)',

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

/** Disabled for legacy theme families; kept here so every AppTheme is complete. */
export const noGlassTokens: GlassTokens = {
    enabled: false,
    quality: 'balanced',
    wallpaperScrim: { light: 'rgba(250,250,252,0.55)', dark: 'rgba(10,10,12,0.55)' },
    tint: { light: 'rgba(244,248,255,0.2)', dark: 'rgba(30,38,52,0.28)' },
    fallbackTint: { light: 'rgba(244,248,255,0.92)', dark: 'rgba(30,38,52,0.94)' },
    fallbackBorder: { light: 'rgba(255,255,255,0.72)', dark: 'rgba(255,255,255,0.18)' },
    procedural: {
        baseTint: { light: 'rgba(246,250,255,0.22)', dark: 'rgba(24,37,54,0.32)' },
        accentTint: { light: 'rgba(210,229,255,0.11)', dark: 'rgba(98,151,224,0.12)' },
        highlightTint: { light: 'rgba(255,255,255,0.88)', dark: 'rgba(201,222,255,0.54)' },
        innerShade: { light: 'rgba(30,55,88,0.2)', dark: 'rgba(0,5,14,0.62)' },
        outerShadow: { light: 'rgba(53,73,100,0.22)', dark: 'rgba(0,0,0,0.48)' },
        noiseStrength: 0.012,
    },
    materials: {
        surface: { radius: 18, blurRadius: 6, refractionHeight: 8, refractionAmount: 10, saturation: 1.1, chromaticAberration: 0.08, highlightAlpha: 0.36, highlightWidth: 1.2 },
        card: { radius: 20, blurRadius: 8, refractionHeight: 10, refractionAmount: 12, saturation: 1.12, chromaticAberration: 0.08, highlightAlpha: 0.4, highlightWidth: 1.3 },
        preferencePanel: { radius: 22, opacity: 0.9, blurRadius: 4, refractionHeight: 7, refractionAmount: 8, refractionBodyAmount: 1.2, saturation: 1.08, chromaticAberration: 0.06, highlightAlpha: 0.42, highlightWidth: 1.5, tintAlpha: 1, specularStrength: 0.82, fresnelStrength: 0.78, innerShadowStrength: 0.14 },
        bar: { radius: 0, blurRadius: 10, refractionHeight: 12, refractionAmount: 14, saturation: 1.12, chromaticAberration: 0.1, highlightAlpha: 0.46, highlightWidth: 1.3 },
        search: { radius: 9999, blurRadius: 8, refractionHeight: 8, refractionAmount: 10, saturation: 1.1, chromaticAberration: 0.06, highlightAlpha: 0.4, highlightWidth: 1.2 },
        menu: { radius: 20, blurRadius: 10, refractionHeight: 10, refractionAmount: 13, saturation: 1.12, chromaticAberration: 0.08, highlightAlpha: 0.44, highlightWidth: 1.4 },
        notification: { radius: 20, blurRadius: 9, refractionHeight: 9, refractionAmount: 12, saturation: 1.1, chromaticAberration: 0.06, highlightAlpha: 0.42, highlightWidth: 1.3 },
        tabBar: { radius: 32, blurRadius: 8, refractionHeight: 12, refractionAmount: 14, saturation: 1.12, chromaticAberration: 0.1, highlightAlpha: 0.5, highlightWidth: 1.5 },
        tabBarShell: { radius: 32, opacity: 0.7, blurRadius: 7, refractionHeight: 11, refractionAmount: 13, saturation: 1.12, chromaticAberration: 0.1, highlightAlpha: 0.5, highlightWidth: 1.5 },
        tabSelectionIdle: { radius: 24, opacity: 0.7, blurRadius: 4, refractionHeight: 9, refractionAmount: 12, saturation: 1.12, chromaticAberration: 0.12, highlightAlpha: 0.58, highlightWidth: 1.8 },
        tabSelectionInteractive: { radius: 27, opacity: 0.9, blurRadius: 2, refractionHeight: 12, refractionAmount: 12.5, saturation: 1.16, chromaticAberration: 0.22, highlightAlpha: 0.9, highlightWidth: 2.2 },
        tabSelectionLens: { radius: 24, blurRadius: 0.35, refractionHeight: 18, refractionAmount: 13, refractionBodyAmount: 5.5, saturation: 1.02, chromaticAberration: 0.2, highlightAlpha: 0.78, highlightWidth: 1.7, tintAlpha: 0.24, specularStrength: 0.9, fresnelStrength: 1.12, innerShadowStrength: 0.3 },
        tabPreview: { radius: 22, opacity: 0.84, blurRadius: 4, refractionHeight: 13, refractionAmount: 18, saturation: 1.16, chromaticAberration: 0.22, highlightAlpha: 0.88, highlightWidth: 2.2 },
        floating: { radius: 24, blurRadius: 10, refractionHeight: 12, refractionAmount: 14, saturation: 1.15, chromaticAberration: 0.1, highlightAlpha: 0.48, highlightWidth: 1.5 },
        sheet: { radius: 30, blurRadius: 12, refractionHeight: 14, refractionAmount: 16, saturation: 1.12, chromaticAberration: 0.08, highlightAlpha: 0.42, highlightWidth: 1.5 },
        dialog: { radius: 28, blurRadius: 12, refractionHeight: 14, refractionAmount: 16, saturation: 1.14, chromaticAberration: 0.08, highlightAlpha: 0.46, highlightWidth: 1.5 },
        control: { radius: 9999, blurRadius: 8, refractionHeight: 9, refractionAmount: 10, saturation: 1.1, chromaticAberration: 0.06, highlightAlpha: 0.4, highlightWidth: 1.2 },
        lens: { radius: 22, blurRadius: 4, refractionHeight: 13, refractionAmount: 18, saturation: 1.16, chromaticAberration: 0.22, highlightAlpha: 0.9, highlightWidth: 2.4 },
    },
    interaction: { enabled: false },
};

export { lightColors, darkColors };

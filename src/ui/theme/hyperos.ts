import { Platform } from 'react-native';
import { componentTokens, darkColors, lightColors, opacity, radius, spacing, typography } from './tokens';
import type { AppTheme, ThemeFonts } from './types';

/**
 * HyperOS / Miuix theme — the first official theme of this Design System.
 *
 * Visual reference:
 *   miuix-vue/src/theme/tokens.scss (1:1 port of miuix Colors.kt / TextStyles.kt)
 *
 * Light primary #3482FF, Dark primary #277AF7. Surface hierarchy comes from
 * background / surface / surfaceVariant / surfaceContainer* — not shadow.
 */

const fonts: ThemeFonts = {
    regular: { fontFamily: Platform.select({ ios: 'System', default: 'sans-serif' })!, fontWeight: '400' },
    medium: { fontFamily: Platform.select({ ios: 'System', default: 'sans-serif' })!, fontWeight: '500' },
    bold: { fontFamily: Platform.select({ ios: 'System', default: 'sans-serif' })!, fontWeight: '700' },
    heavy: { fontFamily: Platform.select({ ios: 'System', default: 'sans-serif' })!, fontWeight: '800' },
};

const hyperosTheme = (dark: boolean): AppTheme => ({
    name: 'hyperos',
    dark,
    colors: dark ? darkColors : lightColors,
    typography,
    spacing,
    radius,
    opacity,
    components: componentTokens,
    fonts,
});

/** HyperOS light theme. */
export const hyperosLightTheme: AppTheme = hyperosTheme(false);

/** HyperOS dark theme. */
export const hyperosDarkTheme: AppTheme = hyperosTheme(true);

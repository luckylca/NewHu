import { colorosDarkTheme, colorosLightTheme } from './coloros';
import { hyperosDarkTheme, hyperosLightTheme } from './hyperos';
import { liquidGlassDarkTheme, liquidGlassLightTheme } from './liquidGlass';
import { resolveThemeVariant } from './registryCore';
import type { AppTheme, ThemeName } from './types';

export const themeRegistry: Record<ThemeName, { light: AppTheme; dark: AppTheme }> = {
    hyperos: { light: hyperosLightTheme, dark: hyperosDarkTheme },
    coloros: { light: colorosLightTheme, dark: colorosDarkTheme },
    liquidGlass: { light: liquidGlassLightTheme, dark: liquidGlassDarkTheme },
};

/** The only family/appearance resolver used by the app, previews, and providers. */
export function resolveBaseTheme(name: ThemeName, dark: boolean): AppTheme {
    return resolveThemeVariant(themeRegistry, name, dark);
}

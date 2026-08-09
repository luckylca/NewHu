import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { colorosDarkTheme, colorosLightTheme } from './coloros';
import { hyperosDarkTheme, hyperosLightTheme } from './hyperos';
import { liquidGlassDarkTheme, liquidGlassLightTheme } from './liquidGlass';
import type { AppTheme, ThemeName } from './types';

export type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeProviderProps {
    /** Named theme. Defaults to 'hyperos'. */
    theme?: ThemeName;
    /** Light / dark / system resolution. */
    mode?: ThemeMode;
    /**
     * Explicit theme instance. When provided it wins over `theme` + `mode`
     * (compatibility path for callers that pre-resolve dark/light).
     */
    value?: AppTheme;
    children: React.ReactNode;
}

const ThemeContext = createContext<AppTheme>(hyperosLightTheme);

function resolveTheme(name: ThemeName, dark: boolean): AppTheme {
    switch (name) {
        case 'coloros':
            return dark ? colorosDarkTheme : colorosLightTheme;
        case 'liquidGlass':
            return dark ? liquidGlassDarkTheme : liquidGlassLightTheme;
        case 'hyperos':
        default:
            return dark ? hyperosDarkTheme : hyperosLightTheme;
    }
}

/**
 * Design System theme provider.
 *
 * Prefer the named API:
 *   <ThemeProvider theme="hyperos" mode="system">…
 *
 * `value` is kept for the existing "resolve in a hook, pass the instance" flow.
 */
export function ThemeProvider({ theme = 'hyperos', mode = 'system', value, children }: ThemeProviderProps) {
    const systemScheme = useColorScheme();

    const resolved = useMemo(() => {
        if (value) return value;
        const dark = mode === 'dark' || (mode === 'system' && systemScheme === 'dark');
        return resolveTheme(theme, dark);
    }, [value, theme, mode, systemScheme]);

    return <ThemeContext.Provider value={resolved}>{children}</ThemeContext.Provider>;
}

/** Read the current Design System theme. */
export function useTheme(): AppTheme {
    return useContext(ThemeContext);
}

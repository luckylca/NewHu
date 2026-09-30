import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { resolveBaseTheme } from './registry';
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

const ThemeContext = createContext<AppTheme>(resolveBaseTheme('hyperos', false));

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
        return resolveBaseTheme(theme, dark);
    }, [value, theme, mode, systemScheme]);

    return <ThemeContext.Provider value={resolved}>{children}</ThemeContext.Provider>;
}

/** Read the current Design System theme. */
export function useTheme(): AppTheme {
    return useContext(ThemeContext);
}

import { lightTheme, type AppTheme } from '@/src/constants/theme';
import React, { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

const ThemeContext = createContext<AppTheme>(lightTheme);

export function ThemeProvider({ value, children }: { value: AppTheme; children: ReactNode }) {
    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** 读取当前应用主题（自建 ThemeProvider 提供的 useTheme） */
export function useTheme(): AppTheme {
    return useContext(ThemeContext);
}

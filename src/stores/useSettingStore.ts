// src/stores/useSettingStore.ts
// 这里面放的是设置相关的信息，比如自动播放，快进倍速，选中的频道ID等
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WallpaperBlurLevel } from '@/src/ui/theme/wallpaper';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

function migrateWallpaperBlurLevel(saved: unknown, legacy: unknown): WallpaperBlurLevel {
    if (saved === 'off' || saved === 'low' || saved === 'medium' || saved === 'high') return saved;
    if (legacy === 0) return 'off';
    if (typeof legacy === 'number' && legacy <= 15) return 'low';
    if (typeof legacy === 'number' && legacy > 35) return 'high';
    return 'medium';
}

interface SettingState {
    followSystemTheme: boolean;
    setFollowSystemTheme: (follow: boolean) => void;
    isDarkMode: boolean;
    setDarkMode: (isDark: boolean) => void;

    wallpaperUri: string | null;
    setWallpaperUri: (uri: string | null) => void;
    wallpaperBlurLevel: WallpaperBlurLevel;
    setWallpaperBlurLevel: (level: WallpaperBlurLevel) => void;

    disableAnimations: boolean; // 是否关闭动画
    setDisableAnimations: (disabled: boolean) => void; // 设置是否关闭动画
    commentDrawerAnimation: boolean;
    setCommentDrawerAnimation: (enabled: boolean) => void;

    cookie: string; // 自定义 cookie
    setCookie: (cookie: string) => void; // 设置 cookie

    isAds: boolean; // 是否开启广告过滤
    isPaid: boolean; // 是否开启付费内容过滤
    setAds: (enabled: boolean) => void;
    setPaid: (enabled: boolean) => void;

    mode: 'normal' | 'card';
    setMode: (mode: 'normal' | 'card') => void; // 设置模式的函数
}

export const useSettingStore = create<SettingState>()(
    persist(
        (set) => ({

            // 主题设置
            followSystemTheme: false,
            setFollowSystemTheme: (follow) => set({ followSystemTheme: follow }),
            isDarkMode: false, // 默认不是暗黑模式
            setDarkMode: (isDark) => set({ isDarkMode: isDark }),
            wallpaperUri: null,
            setWallpaperUri: (uri) => set({ wallpaperUri: uri }),
            wallpaperBlurLevel: 'medium',
            setWallpaperBlurLevel: (level) => set({ wallpaperBlurLevel: level }),

            disableAnimations: false,
            setDisableAnimations: (disabled) => set({ disableAnimations: disabled }),
            commentDrawerAnimation: true,
            setCommentDrawerAnimation: (enabled) => set({ commentDrawerAnimation: enabled }),

            cookie: '',
            setCookie: (cookie) => set({ cookie }),

            isAds: true,
            isPaid: true,
            setAds: (enabled) => set({ isAds: enabled }),
            setPaid: (enabled) => set({ isPaid: enabled }),

            mode: 'normal', // 默认模式
            setMode: (mode) => set({ mode }),

        }),
        {
            name: 'setting-store',
            storage: createJSONStorage(() => AsyncStorage),
            version: 1,
            migrate: (persistedState) => {
                const stored = (persistedState ?? {}) as Record<string, unknown>;
                const wallpaperBlurLevel = migrateWallpaperBlurLevel(stored.wallpaperBlurLevel, stored.wallpaperBlur);
                const migrated = { ...stored };
                delete migrated.wallpaperBlur;
                delete migrated.wallpaperColor;
                delete migrated.wallpaperOpacity;
                delete migrated.useMonetText;
                return { ...migrated, wallpaperBlurLevel } as unknown as SettingState;
            },
            // 所有设置字段都是可序列化的，整体持久化即可
        }
    )
);

// src/store/useUserStore.ts
// 用户账号与登录状态；Cookie 只保存在设备存储中，不写入源码。
import { createSecureZustandStorage } from '@/src/services/secureZustandStorage';
import { clearApiInstance } from '@/src/api/ZhihuApi';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface UserState {
    cookies?: string;
    setCookie: (cookie: string) => void;
    username: string;
    avatar: string;
    urlToken: string;
    isLoggedIn: boolean;
    setUrlToken: (urlToken: string) => void;
    login: (name: string, cookie: string, avatar: string, urlToken?: string) => void;
    logOut: () => void;
}

export const useUserStore = create<UserState>()(
    persist(
        (set) => ({
            cookies: undefined,
            username: '',
            avatar: '',
            urlToken: '',
            isLoggedIn: false,
            setCookie: (cookie) => set({ cookies: cookie }),
            setUrlToken: (urlToken) => set({ urlToken }),
            login: (name, cookie, avatar, urlToken = '') => set({
                username: name,
                cookies: cookie,
                avatar,
                urlToken,
                isLoggedIn: true,
            }),
            logOut: () => {
                clearApiInstance();
                set({
                    username: '',
                    cookies: undefined,
                    avatar: '',
                    urlToken: '',
                    isLoggedIn: false,
                });
            },
        }),
        {
            name: 'user-store',
            storage: createJSONStorage(() => createSecureZustandStorage('user-store', 'cookies', 'newhu.zhihu.auth-cookie')),
            partialize: (state) => ({
                cookies: state.cookies,
                username: state.username,
                avatar: state.avatar,
                urlToken: state.urlToken,
                isLoggedIn: state.isLoggedIn,
            }),
        }
    )
);

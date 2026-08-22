import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, View } from 'react-native';
import { WebView } from 'react-native-webview';
import CookieManager from '@react-native-cookies/cookies';
import { useUserStore } from '@/src/stores/useUserStore';
import { TopAppBar } from '@/src/ui';
import { Text } from '@/src/ui/primitives';
import { useTheme } from '@/src/ui/theme';
import { router } from 'expo-router';
import { getApiInstance } from '@/src/api/ZhihuApi';
import MiuixProgressIndicator from '@/src/components/MiuixProgressIndicator';
const ZhihuLoginWebView = () => {

    const userStore = useUserStore();
    const [modalVisible, setModalVisible] = useState(false);
    const [statusText, setStatusText] = useState('正在验证登录状态');
    const hasSeenSigninRef = useRef(false);
    const verifyInFlightRef = useRef(false);
    const loginCompletedRef = useRef(false);
    const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => () => {
        if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    }, []);

    // 只在 WebView 真正拿到登录态 Cookie 后验证，不能因为普通页面跳转就盖住登录页。
    const extractCookie = useCallback(async () => {
        if (verifyInFlightRef.current || loginCompletedRef.current) return;

        try {
            const cookies = await CookieManager.get('https://www.zhihu.com');
            const cookieString = Object.keys(cookies).map((key) => {
                const item = cookies[key];
                return `${key}=${item.value}`;
            }).join('; ');

            // 未登录时也可能存在匿名 Cookie。没有 z_c0 时保持登录页可操作，
            // 不显示验证弹层，也不改动本地账号状态。
            if (!cookies.z_c0?.value || !cookieString.includes('z_c0=')) return;

            verifyInFlightRef.current = true;
            setModalVisible(true);
            setStatusText('正在验证登录状态');

            const data: any = await getApiInstance(cookieString).getMe();
            if (!data?.name) throw new Error('登录 Cookie 无效');

            loginCompletedRef.current = true;
            userStore.login(data.name, cookieString, data.avatar_url, data.url_token ?? data.urlToken);
            setStatusText(`${data.name} 登录成功，即将返回`);
            redirectTimerRef.current = setTimeout(() => {
                setModalVisible(false);
                router.back();
            }, 1200);
        } catch (error) {
            console.error('Cookie 获取失败:', error);
            setModalVisible(false);
            setStatusText('登录验证失败，请继续登录');
        } finally {
            verifyInFlightRef.current = false;
        }
    }, [userStore]);

    const theme = useTheme();

    return (
        <View style={{ flex: 1 }}>
            <Modal visible={modalVisible} transparent>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.windowDimming }}>
                    <View style={{ width: 160 }}><MiuixProgressIndicator indeterminate /></View>
                    <Text type="body1" style={{ marginTop: theme.spacing.sm, color: theme.colors.onPrimary }}>{statusText}</Text>
                </View>
            </Modal>
            <TopAppBar title="登录知乎" back={() => router.back()} />
            <WebView
                source={{ uri: 'https://www.zhihu.com/signin' }}
                incognito={true} // 使用隐身模式，确保不使用之前的 Cookie
                userAgent="Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.181 Mobile Safari/537.36" // 建议固定 UA
                onNavigationStateChange={(navState) => {
                    const url = navState.url.toLowerCase();
                    if (!url.includes('zhihu.com')) return;

                    if (url.includes('/signin')) {
                        hasSeenSigninRef.current = true;
                        return;
                    }

                    // 只有从登录页离开后才尝试读取 Cookie；读取不到 z_c0 时
                    // extractCookie 会直接返回，WebView 仍可继续输入验证码/账号。
                    if (hasSeenSigninRef.current) void extractCookie();
                }}
            />
        </View>
    );
};

export default ZhihuLoginWebView;

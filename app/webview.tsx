import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewNavigation } from 'react-native-webview';
import { getCookieHeader } from 'expo-cookie-storage';
import { useUserStore } from '@/src/stores/useUserStore';
import { PageScaffold, TopAppBar } from '@/src/ui';
import { Text } from '@/src/ui/primitives';
import { useTheme } from '@/src/ui/theme';
import { router } from 'expo-router';
import { getApiInstance } from '@/src/api/ZhihuApi';
import ProgressIndicator from '@/src/components/ProgressIndicator';
import { getCookieValue } from '@/src/utils/cookieHeader';
const ZhihuLoginWebView = () => {

    const login = useUserStore((state) => state.login);
    const [modalVisible, setModalVisible] = useState(false);
    const [statusText, setStatusText] = useState('正在验证登录状态');
    const hasSeenSigninRef = useRef(false);
    const verifyInFlightRef = useRef(false);
    const loginCompletedRef = useRef(false);
    const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const source = useMemo(() => ({ uri: 'https://www.zhihu.com/signin' }), []);
    const handleBack = useCallback(() => router.back(), []);

    useEffect(() => () => {
        if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    }, []);

    // 只在 WebView 真正拿到登录态 Cookie 后验证，不能因为普通页面跳转就盖住登录页。
    const extractCookie = useCallback(async () => {
        if (verifyInFlightRef.current || loginCompletedRef.current) return;

        try {
            const cookieString = await getCookieHeader('https://www.zhihu.com');

            // 系统 CookieManager 可以读取 WebView 的 HttpOnly Cookie。
            // 未登录时也可能存在匿名 Cookie；只有拿到非空 z_c0 才验证登录态。
            if (!getCookieValue(cookieString, 'z_c0')) return;

            verifyInFlightRef.current = true;
            setModalVisible(true);
            setStatusText('正在验证登录状态');

            const data: any = await getApiInstance(cookieString).getMe();
            if (!data?.name) throw new Error('登录 Cookie 无效');

            loginCompletedRef.current = true;
            login(data.name, cookieString, data.avatar_url, data.url_token ?? data.urlToken);
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
    }, [login]);

    const handleNavigationStateChange = useCallback((navState: WebViewNavigation) => {
        const url = navState.url.toLowerCase();
        if (!url.includes('zhihu.com')) return;

        if (url.includes('/signin')) {
            hasSeenSigninRef.current = true;
            return;
        }

        if (hasSeenSigninRef.current) void extractCookie();
    }, [extractCookie]);

    const theme = useTheme();

    return (
        <PageScaffold topBar={<TopAppBar title="登录知乎" back={handleBack} />}>
            <Modal visible={modalVisible} transparent>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.windowDimming }}>
                    <View style={{ width: 160 }}><ProgressIndicator indeterminate /></View>
                    <Text type="body1" style={{ marginTop: theme.spacing.sm, color: theme.colors.onPrimary }}>{statusText}</Text>
                </View>
            </Modal>
            <WebView
                source={source}
                style={{ flex: 1 }}
                incognito={true} // 使用隐身模式，确保不使用之前的 Cookie
                userAgent="Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.181 Mobile Safari/537.36" // 建议固定 UA
                onNavigationStateChange={handleNavigationStateChange}
            />
        </PageScaffold>
    );
};

export default ZhihuLoginWebView;

import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import CookieManager from '@react-native-cookies/cookies';
import { useUserStore } from '@/src/stores/useUserStore';
import { Appbar, Portal,Text,ActivityIndicator,Modal } from 'react-native-paper';
import { router } from 'expo-router';
import { getApiInstance } from '@/src/api/ZhihuApi';
import { useTheme } from 'react-native-paper';
import { white } from 'react-native-paper/lib/typescript/styles/themes/v2/colors';

const ZhihuLoginWebView = () => {

    const theme = useTheme();

    const userStore = useUserStore();
    const [modalVisible, setModalVisible] = useState(false);
    const [statueText, setStatueText] = useState('正在检测cookie是否可用');
    // 提取并格式化 Cookie 的核心函数
    const extractCookie = async () => {
        try {
            const cookies = await CookieManager.get('https://www.zhihu.com');
            const cookieString = Object.keys(cookies).map((key) => {
                const item = cookies[key];
                const value = typeof item === 'object' ? item.value : item;
                return `${key}=${value}`;
            }).join('; ');
            console.log('✅ 成功获取完整 Cookie (包含 z_c0):', cookieString);
            if (cookieString.includes('z_c0')) {
                userStore.setCookie(cookieString);
                let apiInstance = getApiInstance(cookieString);
                const data:any = await apiInstance.getMe()
                if(data.name){
                    setStatueText(`${data.name} 登录成功，三秒后返回`);
                    userStore.login(data.name, cookieString, data.avatar_url);
                    
                    setTimeout(() => {
                        setModalVisible(false);
                        router.back();
                    }, 3000);
                }
            }
        } catch (error) {
            console.error('Cookie 获取失败:', error);
            setStatueText('登录失败，请重试');
        }
    };

    return (
        <View style={{ flex: 1 }}>
            <Portal>
                <Modal visible={modalVisible} dismissable={false} 
                    contentContainerStyle={{ backgroundColor: 'transparent', width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}
                >
                    <ActivityIndicator animating={true} size="large" color="white" />
                    <Text style={{ marginTop: 10, color: 'white' }}>{statueText}</Text>
                </Modal>
            </Portal>
            <Appbar.Header>
                <Appbar.BackAction onPress={() => router.back()} />
                <Appbar.Content title="登录知乎" />
            </Appbar.Header>
            <WebView
                source={{ uri: 'https://www.zhihu.com/signin' }}
                incognito={true} // 使用隐身模式，确保不使用之前的 Cookie
                userAgent="Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.181 Mobile Safari/537.36" // 建议固定 UA
                onNavigationStateChange={(navState) => {
                    if (navState.url.includes('zhihu.com') && !navState.url.includes('signin')) {
                        setModalVisible(true);
                        extractCookie();
                    }
                }}
            />
        </View>
    );
};

export default ZhihuLoginWebView;
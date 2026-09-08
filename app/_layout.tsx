// app/_layout.tsx
import { AppBackground } from '@/src/components/background/AppBackground';
import { GlobalNotificationHost } from '@/src/components/GlobalNotificationHost';
import { LaterReadFloatingBubble } from '@/src/components/LaterReadFloatingBubble';
import { useHyperosTheme } from '@/src/hooks/useHyperosTheme';
import { ThemeProvider as UiThemeProvider } from '@/src/ui/theme';
import { MotionProvider } from '@/src/ui/motion';
import { hasCurrentRequiredConsent, useConsentStore } from '@/src/stores/useConsentStore';
import { useStoreHydrated } from '@/src/hooks/useStoreHydrated';
import { ThemeProvider as NavigationThemeProvider } from '@react-navigation/native'; // React Navigation 的导航主题
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { AppState, StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useReducedMotion } from 'react-native-reanimated';
import { initializeDatabase } from '@/src/db/database';
import { recoverRunningJobs } from '@/src/db/repositories/offlineCacheRepository';
import { startNetworkMonitoring } from '@/src/services/networkService';
import { syncOutbox } from '@/src/services/syncService';
import { useNetworkStore } from '@/src/stores/useNetworkStore';
import { useSettingStore } from '@/src/stores/useSettingStore';
import { getWallpaperBase } from '@/src/ui/theme/wallpaper';
import { useUserStore } from '@/src/stores/useUserStore';
import { recoverSyncingActions } from '@/src/db/repositories/outboxRepository';
import { getApiInstance } from '@/src/api/ZhihuApi';

void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 180, fade: true });

export default function RootLayout() {
	const uiTheme = useHyperosTheme();
	const networkStatus = useNetworkStore((state) => state.status);
	const consentHydrated = useStoreHydrated(useConsentStore);
	const userHydrated = useStoreHydrated(useUserStore);
	const cookies = useUserStore((state) => state.cookies);
	const [databaseReady, setDatabaseReady] = React.useState(false);
	const consent = useConsentStore();
	const disableAnimations = useSettingStore((state) => state.disableAnimations);
	const systemReducedMotion = useReducedMotion();
	const reducedMotion = disableAnimations || systemReducedMotion;
	const persistedConsentReady = consentHydrated && hasCurrentRequiredConsent(consent);
	const consentReady = persistedConsentReady;
	const splashHidden = React.useRef(false);
	const routeBaseColor = getWallpaperBase(uiTheme.dark);
	const renderRouteScene = React.useCallback(({ children }: { children: React.ReactNode }) => (
		// Every native route owns an opaque wallpaper layer. A single wallpaper
		// behind a transparent stack lets the previous screen show through while
		// Android composes push/pop frames, which looks like a frozen afterimage.
		<AppBackground>{children}</AppBackground>
	), []);

	useEffect(() => {
		void initializeDatabase().then(async () => {
			await Promise.all([recoverRunningJobs(), recoverSyncingActions()]);
			setDatabaseReady(true);
		}).catch((error) => {
			console.error('离线数据库初始化失败', error);
		});
		return startNetworkMonitoring();
	}, []);

	useEffect(() => {
		if (databaseReady && userHydrated && cookies && networkStatus === 'online') void syncOutbox({ silent: true });
	}, [cookies, databaseReady, networkStatus, userHydrated]);

	useEffect(() => {
		const subscription = AppState.addEventListener('change', (state) => {
			if (state === 'active' && databaseReady && userHydrated && cookies && networkStatus === 'online') void syncOutbox({ silent: true });
		});
		return () => subscription.remove();
	}, [cookies, databaseReady, networkStatus, userHydrated]);
	// 自定义主题里已补齐 card/text/border/notification，可直接作为导航主题
	const navigationTheme = {
		dark: uiTheme.dark,
		colors: uiTheme.colors,
		fonts: uiTheme.fonts,
	};

	const handleRootLayout = React.useCallback(() => {
		if (!consentHydrated || !userHydrated || splashHidden.current) return;
		splashHidden.current = true;
		void SplashScreen.hideAsync();
	}, [consentHydrated, userHydrated]);

	// Do not mount business routes until the persisted user session is hydrated.
	// Detail routes call the shared API client in passive effects, so initializing
	// it synchronously here guarantees cold-start deep links cannot race ahead.
	if (!consentHydrated || !userHydrated) return null;
	if (cookies) getApiInstance(cookies);

	return (
		<GestureHandlerRootView style={{ flex: 1 }} onLayout={handleRootLayout}>
			<SafeAreaProvider>
				<UiThemeProvider value={uiTheme}>
					<MotionProvider reduced={reducedMotion}>
						<AppBackground>
							<NavigationThemeProvider value={navigationTheme}>
							<StatusBar
								barStyle={uiTheme.dark ? 'light-content' : 'dark-content'}
								backgroundColor="transparent"
								translucent
							/>
							<Stack
								screenLayout={renderRouteScene}
								screenOptions={{
									contentStyle: { backgroundColor: routeBaseColor },
									headerShown: false,
									animation: reducedMotion ? 'fade' : 'slide_from_right',
									presentation: 'card',
									freezeOnBlur: false,
								}}
							>
								<Stack.Protected guard={!consentReady}>
									<Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
								</Stack.Protected>
								<Stack.Screen name="legal" options={{ title: '协议' }} />
								<Stack.Protected guard={consentReady}>
								<Stack.Screen name="(tabs)" />
								<Stack.Screen name="settings" options={{ title: '设置' }} />
								<Stack.Screen name="privacy-personalization" options={{ title: '隐私与个性化' }} />
								<Stack.Screen name="product-v1" options={{ title: 'Product V1 推荐' }} />
								<Stack.Screen name="offline-cache" options={{ title: '离线缓存' }} />
								<Stack.Screen name="storage-management" options={{ title: '存储管理' }} />
								<Stack.Screen name="about" options={{ title: '关于 NewHU' }} />
								<Stack.Screen name="animationSettings" options={{ title: '动画设置' }} />
								<Stack.Screen name="devmode" options={{ title: '开发者模式' }} />
								<Stack.Screen name="like" options={{ title: '收藏列表' }} />
								<Stack.Screen name="like/[id]" options={{ title: '收藏内容' }} />
								<Stack.Screen name="history" options={{ title: '浏览历史' }} />
								<Stack.Screen name="knowledge-cards" options={{ title: '知识卡片' }} />
								<Stack.Screen name="drafts" options={{ title: '草稿箱' }} />
								<Stack.Screen name="webview" options={{ title: '登录' }} />
								<Stack.Screen name="search" options={{ title: '搜索' }} />
								<Stack.Screen name="userinfo" options={{ title: '用户信息' }} />
								<Stack.Screen name="item/[type]/[id]" options={{ title: '详情' }} />
				<Stack.Screen name="copy/[type]/[id]" options={{ title: '复制内容' }} />
				<Stack.Screen name="select-text/[type]/[id]" options={{ title: '划线与笔记' }} />
								<Stack.Screen name="people" options={{ title: '人物信息' }} />
								<Stack.Screen name="question" options={{ title: '问题详情' }} />
								<Stack.Screen name="dev/design-system" options={{ title: 'UI Showcase' }} />
								<Stack.Screen name="dev/hyper-glow" options={{ title: '动态柔光预览' }} />
								</Stack.Protected>
							</Stack>
						</NavigationThemeProvider>
						<GlobalNotificationHost />
						<LaterReadFloatingBubble />
					</AppBackground>
					</MotionProvider>
				</UiThemeProvider>
			</SafeAreaProvider>
		</GestureHandlerRootView>
	);
}

// app/_layout.tsx
import { AppWallpaper } from '@/src/components/AppWallpaper';
import { GlobalNotificationHost } from '@/src/components/GlobalNotificationHost';
import { useHyperosTheme } from '@/src/hooks/useHyperosTheme';
import { ThemeProvider as UiThemeProvider } from '@/src/ui/theme';
import { ThemeProvider as NavigationThemeProvider } from '@react-navigation/native'; // React Navigation 的导航主题
import { Stack } from 'expo-router';
import React from 'react';
import { StatusBar, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
	const uiTheme = useHyperosTheme();
	// 自定义主题里已补齐 card/text/border/notification，可直接作为导航主题
	const navigationTheme = {
		dark: uiTheme.dark,
		colors: uiTheme.colors,
		fonts: uiTheme.fonts,
	};

	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<SafeAreaProvider>
				<UiThemeProvider value={uiTheme}>
					<View style={{ flex: 1 }}>
						<AppWallpaper />
						<NavigationThemeProvider value={navigationTheme}>
							<StatusBar
								barStyle={uiTheme.dark ? 'light-content' : 'dark-content'}
								backgroundColor="transparent"
								translucent
							/>
							<Stack
								screenOptions={{
									contentStyle: { backgroundColor: uiTheme.colors.background },
									headerShown: false,
									animation: 'slide_from_right',
								}}
							>
								<Stack.Screen name="(tabs)" />
								<Stack.Screen name="settings" options={{ title: '设置' }} />
								<Stack.Screen name="about" options={{ title: '关于 NewHU' }} />
								<Stack.Screen name="animationSettings" options={{ title: '动画设置' }} />
								<Stack.Screen name="devmode" options={{ title: '开发者模式' }} />
								<Stack.Screen name="like" options={{ title: '收藏列表' }} />
								<Stack.Screen name="history" options={{ title: '浏览历史' }} />
								<Stack.Screen name="drafts" options={{ title: '草稿箱' }} />
								<Stack.Screen name="webview" options={{ title: '登录' }} />
								<Stack.Screen name="search" options={{ title: '搜索' }} />
								<Stack.Screen name="userinfo" options={{ title: '用户信息' }} />
								<Stack.Screen name="item/[type]/[id]" options={{ title: '详情' }} />
								<Stack.Screen name="people" options={{ title: '人物信息' }} />
								<Stack.Screen name="question" options={{ title: '问题详情' }} />
								<Stack.Screen name="dev/design-system" options={{ title: 'UI Showcase' }} />
							</Stack>
						</NavigationThemeProvider>
						<GlobalNotificationHost />
					</View>
				</UiThemeProvider>
			</SafeAreaProvider>
		</GestureHandlerRootView>
	);
}

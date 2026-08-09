// app/_layout.tsx
import { useAppTheme } from '@/src/hooks/useAppTheme';
import { ThemeProvider } from '@/src/theme/ThemeProvider';
import { PortalHost } from '@/src/components/ui/PortalHost';
import { ThemeProvider as NavigationThemeProvider } from '@react-navigation/native'; // React Navigation 的导航主题
import { Stack } from 'expo-router';
import React from 'react';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
	const theme = useAppTheme();
	// 自定义主题里已补齐 card/text/border/notification，可直接作为导航主题
	const navigationTheme = {
		dark: theme.dark,
		colors: theme.colors,
		fonts: theme.fonts,
	};

	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<ThemeProvider value={theme}>
				<NavigationThemeProvider value={navigationTheme}>
					<StatusBar
						barStyle={theme.dark ? 'light-content' : 'dark-content'}
						backgroundColor='transparent'
						translucent
					/>
					<PortalHost>
						<Stack
							screenOptions={{
								headerStyle: {
									backgroundColor: theme.colors.background,
								},
								contentStyle: {
									backgroundColor: theme.colors.background,
								},
								headerShown: false,
								animation: 'fade',
							}}
						>
							<Stack.Screen name="(tabs)" />
							<Stack.Screen name="settings" options={{ title: '设置' }} />
							<Stack.Screen name="devmode" options={{ title: '开发者模式' }} />
							<Stack.Screen name="like" options={{ title: '收藏列表' }} />
							<Stack.Screen name="history" options={{ title: '浏览历史' }} />
							<Stack.Screen name="webview" options={{ title: '登录' }} />
							<Stack.Screen name="search" options={{ title: '搜索' }} />
							<Stack.Screen name="userinfo" options={{ title: '用户信息' }} />
							<Stack.Screen name="item/[type]/[id]" options={{ title: '详情' }} />
							<Stack.Screen name="people" options={{ title: '人物信息' }} />
							<Stack.Screen name="question" options={{ title: '问题详情' }} />
						</Stack>
					</PortalHost>
				</NavigationThemeProvider>
			</ThemeProvider>
		</GestureHandlerRootView>
	);
}

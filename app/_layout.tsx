// app/_layout.tsx
import { Stack } from 'expo-router';
import React from 'react';
import {
	ThemeProvider,
	DarkTheme as NavigationDarkTheme,
	DefaultTheme as NavigationDefaultTheme
} from '@react-navigation/native'; // 引入 React Navigation 的默认主题
import {
	adaptNavigationTheme,
	PaperProvider,
	MD3DarkTheme,
	MD3LightTheme
} from 'react-native-paper'; // 引入适配器
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ImageBackground, StatusBar, View, StyleSheet } from 'react-native';
import { useAppTheme } from '@/src/hooks/useAppTheme';
import { useSettingStore } from '@/src/stores/useSettingStore';
const { LightTheme, DarkTheme } = adaptNavigationTheme({
	reactNavigationLight: NavigationDefaultTheme,
	reactNavigationDark: NavigationDarkTheme,
	materialLight: MD3LightTheme,
	materialDark: MD3DarkTheme,
});
export default function RootLayout() {

	const theme = useAppTheme();
	const navigationTheme = theme.dark ? DarkTheme : LightTheme;
	const combinedTheme = {
		...navigationTheme,
		colors: {
			...navigationTheme.colors,
			...theme.colors,
		},
		fonts: navigationTheme.fonts // 关键：使用适配后的 fonts 避免报错
	};
	const backgroundImage = useSettingStore((state) => state.backgroundImage);
	const backgroundOpacity = useSettingStore((state) => state.backgroundOpacity);

	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<PaperProvider
				theme={theme}
			>

				<ThemeProvider value={combinedTheme}>
					<StatusBar
						barStyle={theme.dark ? 'light-content' : 'dark-content'}
						backgroundColor='transparent'
						translucent
					/>
					{backgroundImage && (
						<View style={[StyleSheet.absoluteFill, { zIndex: -1, backgroundColor: theme.colors.background }]}>
							<ImageBackground
								source={{ uri: backgroundImage }}
								style={{ width: '100%', height: '100%', opacity: backgroundOpacity }}
								resizeMode="cover"
							>
								{/* <View style={{ flex: 1, backgroundColor: theme.colors.background, opacity: backgroundOpacity }} /> */}
							</ImageBackground>
						</View>
					)}
					<Stack
						screenOptions={{
							headerStyle: {
								backgroundColor: backgroundImage ? `transparent` : theme.colors.background,
							},
							contentStyle: {
								backgroundColor: backgroundImage ? `transparent` : theme.colors.background,
							},
							headerShown: false,
							animation: 'fade',
						}}
					>
						<Stack.Screen name="(tabs)" />
						<Stack.Screen name="settings" options={{ title: '设置' }} />
						<Stack.Screen name="like" options={{ title: '收藏列表' }} />
						<Stack.Screen name="history" options={{ title: '浏览历史' }} />
						<Stack.Screen name="webview" options={{ title: '登录' }} />
						<Stack.Screen name="search" options={{ title: '搜索' }} />
						<Stack.Screen name="userinfo" options={{ title: '用户信息' }} />
						<Stack.Screen name="item/[type]/[id]" options={{ title: '详情' }} />
					</Stack>
				</ThemeProvider>
			</PaperProvider>
		</GestureHandlerRootView>
	);
}
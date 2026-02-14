import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { useColorScheme } from 'react-native';
import { AppLightTheme, AppDarkTheme } from '@/src/constants/theme';
export default function RootLayout() {

	const colorScheme = useColorScheme();

	return (
		<PaperProvider
			theme={colorScheme === 'dark' ? AppDarkTheme : AppLightTheme}
		>
			<Stack>
				<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
				<Stack.Screen name="settings" options={{ title: '设置', headerShown: false }} />
				<Stack.Screen name="like" options={{ title: '收藏列表', headerShown: false }} />
				<Stack.Screen name="browse" options={{ title: '浏览历史', headerShown: false }} />
				<Stack.Screen name="webview" options={{ title: '登录', headerShown: false }} />
				<Stack.Screen name="search" options={{ title: '搜索', headerShown: false }} />
			</Stack>
		</PaperProvider>
	);
}
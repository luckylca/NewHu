import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { useLocalSearchParams, withLayoutContext } from "expo-router";

const { Navigator } = createMaterialTopTabNavigator();
const Tabs = withLayoutContext(Navigator);

export default function ItemLayout() {
	const params = useLocalSearchParams();
	return (
		<Tabs
			screenOptions={{
				swipeEnabled: true,              // ✅ 左右滑
				tabBarStyle: { display: "none" } // ✅ 隐藏 tab 栏，只保留 PageView 手势
			}}
		>
			{/* 这里的 name 对应同目录下的文件名 */}
			<Tabs.Screen name="index" initialParams={params as any} />
			<Tabs.Screen name="comment" initialParams={params as any} />
		</Tabs>
	);
}
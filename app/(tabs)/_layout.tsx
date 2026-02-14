import { Tabs } from 'expo-router';
import CustomTabNav from '@/src/components/CustomTabNav'; 

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabNav {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: '首页' }} />
      <Tabs.Screen name="user" options={{ title: '用户' }} />
    </Tabs>
  );
}
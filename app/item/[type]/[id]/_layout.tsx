import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useLocalSearchParams, withLayoutContext } from 'expo-router';

const { Navigator } = createMaterialTopTabNavigator();
const Tabs = withLayoutContext(Navigator);

export default function ItemLayout() {
    const params = useLocalSearchParams();

    return (
        <Tabs
            tabBar={() => null}
            screenOptions={{
                swipeEnabled: true,
            }}
        >
            <Tabs.Screen name="index" initialParams={params as any} />
            <Tabs.Screen name="comment" initialParams={params as any} />
        </Tabs>
    );
}

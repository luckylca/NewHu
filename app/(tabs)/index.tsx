import CustomTabNav, { tabRoute } from '@/src/components/CustomTabNav';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import HomeScreen from '../home';
import UserScreen from '../user';
import { useContentStore } from '@/src/stores/useContentStore';
import { MainTabLayoutProvider } from '@/src/components/MainTabLayout';
import { GLASS_TAB_BAR_CONTENT_INSET } from '@newhu/react-native-liquid-glass';
import { useTheme } from '@/src/ui/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MainScreens = () => {

    const [activeIndex, setActiveIndex] = React.useState(0);
    const pageViewRef = React.useRef<PagerView>(null);
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const bottomContentInset = theme.glass.enabled ? insets.bottom + GLASS_TAB_BAR_CONTENT_INSET : 0;
    const requestFeedRefresh = useContentStore((state) => state.requestFeedRefresh);
    const requestHomeScrollTop = useContentStore((state) => state.requestHomeScrollTop);

    const routes: tabRoute[] = React.useMemo(() => [
        { key: 'home', title: '首页', icon: 'home' },
        { key: 'user', title: '我的', icon: 'account' }
    ], []);

    const handlePageSelected = React.useCallback((e: any) => {
        setActiveIndex(e.nativeEvent.position);
    }, []);

    const handleTabPress = React.useCallback((index: number) => {
        if (index === 0) requestHomeScrollTop();
        setActiveIndex(index);
        pageViewRef.current?.setPageWithoutAnimation(index);
    }, [requestHomeScrollTop]);

    const handleDoubleSelect = React.useCallback((index: number) => {
        if (index === 0) requestFeedRefresh();
    }, [requestFeedRefresh]);

    return (
        <MainTabLayoutProvider value={bottomContentInset}>
        <View style={styles.container}>
            {/* 8. 身体部分：PagerView */}
            <PagerView
                ref={pageViewRef}           // 挂上钩子
                style={styles.pagerView} // 样式
                initialPage={0}          // 初始在第 0 页
                scrollEnabled={false}    // 关闭页面横向手势滑动；通过底部 Tab 点击切页
                onPageSelected={handlePageSelected} // 监听滑动结束事件
            >
                {/* 第 0 页：首页 */}
                <View key="home_page" style={styles.pageWrapper}>
                    <HomeScreen active={activeIndex === 0} />
                </View>
                {/* 第 1 页：用户 */}
                <View key="user_page" style={styles.pageWrapper}>
                    <UserScreen />
                </View>
            </PagerView>

            {/* 9. 遥控器部分：CustomTabBar */}
            <CustomTabNav
                activeIndex={activeIndex}      // 告诉它：现在哪一页是激活的（用来变色）
                onIndexChange={handleTabPress} // 告诉它：有人按按钮时，执行这个函数
                onDoubleSelect={handleDoubleSelect}
                routes={routes}                // 告诉它：有哪些按钮要渲染
            />
        </View>
        </MainTabLayoutProvider>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        position: 'relative',
        backgroundColor: 'transparent',
    },
    pagerView: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    pageWrapper: {
        flex: 1,
        backgroundColor: 'transparent',
    }
});

export default MainScreens;

import CustomTabNav, { tabRoute } from '@/src/components/CustomTabNav';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import HomeScreen from '../home';
import UserScreen from '../user';
import { useContentStore } from '@/src/stores/useContentStore';

const MainScreens = () => {

    const [activeIndex, setActiveIndex] = React.useState(0);
    const pageViewRef = React.useRef<PagerView>(null);
    const requestFeedRefresh = useContentStore((state) => state.requestFeedRefresh);

    const routes: tabRoute[] = React.useMemo(() => [
        { key: 'home', title: '首页', icon: 'home' },
        { key: 'user', title: '我的', icon: 'account' }
    ], []);

    const handlePageSelected = (e: any) => {
        setActiveIndex(e.nativeEvent.position);
    };

    const handleTabPress = (index: number) => {
        setActiveIndex(index);
        pageViewRef.current?.setPage(index);
    }

    return (
        <View style={styles.container}>
            {/* 8. 身体部分：PagerView */}
            <PagerView
                ref={pageViewRef}           // 挂上钩子
                style={styles.pagerView} // 样式
                initialPage={0}          // 初始在第 0 页
                scrollEnabled={false}    // 暂时关闭左右滑动，只保留点击 tab 切页
                onPageSelected={handlePageSelected} // 监听滑动结束事件
            >
                {/* 第 0 页：首页 */}
                <View key="home_page" style={styles.pageWrapper}>
                    <HomeScreen />
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
                onDoubleSelect={(index) => {
                    if (index === 0) requestFeedRefresh();
                }}
                routes={routes}                // 告诉它：有哪些按钮要渲染
            />
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
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

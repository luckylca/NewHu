import { useUserStore } from "@/src/stores/useUserStore";
import { useSettingStore } from "@/src/stores/useSettingStore";
import { router } from "expo-router";
import React, { useEffect, useRef } from "react";
import { ScrollView, TouchableOpacity, View, Animated, Dimensions, StyleSheet } from 'react-native';
import { Avatar, Button, Card, Surface, Text } from '@/src/components/ui';
import { useTheme } from '@/src/theme/ThemeProvider';

const { width } = Dimensions.get('window');
const TOGGLE_WIDTH = width * 0.8; // 80% 宽度
const TOGGLE_PADDING = 4;         // 内部留白
const SLIDER_WIDTH = (TOGGLE_WIDTH - TOGGLE_PADDING * 2) / 2; // 单块滑块宽度

const UserScreen = ({ navigation }: any) => {
    const theme = useTheme();
    const userStore = useUserStore();
    const settingStore = useSettingStore();
    
    const cardBgColor = theme.colors.surfaceVariant;
    const metaColor = theme.colors.onSurfaceVariant;
    
    // 滑块及选中状态的颜色
    const activeSliderColor = theme.colors.primaryContainer; 
    const activeTextColor = theme.colors.onPrimaryContainer;

    const isCardMode = settingStore.mode === 'card';

    // 动画参考值
    const slideAnim = useRef(new Animated.Value(isCardMode ? 0 : 1)).current;

    useEffect(() => {
        Animated.spring(slideAnim, {
            toValue: isCardMode ? 0 : 1,
            useNativeDriver: true,
            damping: 15,
            mass: 1,
            stiffness: 100,
        }).start();
    }, [isCardMode, slideAnim]);

    const translateX = slideAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, SLIDER_WIDTH]
    });

    const handlePress = () => {
        if(userStore.isLoggedIn){
            router.push('/userinfo');
        } else {
            router.push('/webview');
        }
    }

    return (
        <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', paddingBottom: 30, backgroundColor: theme.colors.background }}>
            <TouchableOpacity style={{ alignItems: 'center', marginTop: 30, width: '30%' }} activeOpacity={0.8} onPress={handlePress}>
                <Avatar.Image size={100} source={{ uri: userStore.avatar }} style={{ marginTop: 30, marginBottom: 10 }} />
                <Card mode="elevated" style={{ marginBottom: 30, height: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: cardBgColor }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{ margin: 8, textAlign: 'center', fontSize: 18, color: metaColor }}>{userStore.username || '请登录'}</Text>
                    </View>
                </Card>
            </TouchableOpacity>
            <Surface 
                mode="elevated" 
                style={[styles.toggleContainer, { backgroundColor: cardBgColor }]}
            >
                <View style={styles.sliderBgLayer} pointerEvents="none">
                    <Animated.View 
                        style={[
                            styles.activeSlider, 
                            { 
                                backgroundColor: activeSliderColor,
                                transform: [{ translateX }] 
                            }
                        ]} 
                    />
                </View>

                <TouchableOpacity 
                    style={styles.toggleItem} 
                    activeOpacity={0.8}
                    onPress={() => settingStore.setMode('card')}
                >
                    <Text style={{ 
                        fontSize: 15, 
                        color: isCardMode ? activeTextColor : metaColor,
                        fontWeight: isCardMode ? 'bold' : 'normal'
                    }}>
                        卡片模式
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    style={styles.toggleItem} 
                    activeOpacity={0.8}
                    onPress={() => settingStore.setMode('normal')}
                >
                    <Text style={{ 
                        fontSize: 15, 
                        color: !isCardMode ? activeTextColor : metaColor,
                        fontWeight: !isCardMode ? 'bold' : 'normal'
                    }}>
                        普通模式
                    </Text>
                </TouchableOpacity>
            </Surface>

            <Button 
                mode="elevated"
                onPress={() => router.push('/like')}
                style={{ width: '80%', marginBottom: 20, height: 60, justifyContent: 'center', backgroundColor: cardBgColor }}
                contentStyle={{ height: 60, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', backgroundColor: cardBgColor }}
                labelStyle={{ fontSize: 15, color: metaColor }}
                >
                收藏列表
            </Button>
            <Button 
                mode="elevated"
                style={{ width: '80%', marginBottom: 20, height: 60, justifyContent: 'center', backgroundColor: cardBgColor }}
                contentStyle={{ height: 60, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', backgroundColor: cardBgColor }}
                labelStyle={{ fontSize: 15, color: metaColor }}
                onPress={() => router.push('/history')}
                >
                浏览历史
            </Button>
            <Button
                mode="elevated"
                style={{ width: '80%', marginBottom: 20 ,height: 60, justifyContent: 'center', backgroundColor: cardBgColor }}
                contentStyle={{ height: 60, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', backgroundColor: cardBgColor }}
                labelStyle={{ fontSize: 15, color: metaColor }}
                onPress={() => router.push('/settings')}
                >
                设置
            </Button>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    toggleContainer: {
        width: TOGGLE_WIDTH,
        height: 60,
        marginBottom: 20,
        borderRadius: 30, // 使用大圆角让它看起来像一个按钮组
        flexDirection: 'row',
        position: 'relative',
    },
    sliderBgLayer: {
        ...StyleSheet.absoluteFillObject, // 绝对定位铺满整个容器
        padding: TOGGLE_PADDING,          // 留出内边距
        flexDirection: 'row',
    },
    activeSlider: {
        width: SLIDER_WIDTH,
        height: '100%',
        borderRadius: 26, // 滑块稍微比外壳小一点
    },
    toggleItem: {
        flex: 1,
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    }
});

export default UserScreen;
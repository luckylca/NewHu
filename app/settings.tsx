// Removed: /* eslint-disable react-native/no-inline-styles */
import React, { useRef } from "react";
import { Animated, Easing, ScrollView, View } from 'react-native';
import { Appbar, Button, Card, Dialog, Portal, Text, useTheme, Switch } from 'react-native-paper';
import Svg, { Path } from 'react-native-svg';
import { useUserStore } from '../src/stores/useUserStore';
import { router } from "expo-router";

const CURRENT_VERSION = 'v1.0.0';

const SettingsScreen = ({ navigation: _navigation }: any) => {

    const theme = useTheme();

    const userStore = useUserStore();
    const [updataDialogVisible, setUpdataDialogVisible] = React.useState(false);
    const [isAds, setIsAds] = React.useState(false);
    const [isSaltContent, setIsSaltContent] = React.useState(false);
    const onToggleAds = () => setIsAds(!isAds);
    const onToggleSaltContent = () => setIsSaltContent(!isSaltContent);
    const [updateInfo, setUpdateInfo] = React.useState({ loading: false, hasNew: false, serverVersion: '' });

    const hideUpdataDialog = () => setUpdataDialogVisible(false);

    const animaValues = useRef(
        [...Array(7)].map(() => ({
            fade: new Animated.Value(0),
            slide: new Animated.Value(50),
        }))
    ).current;

    React.useEffect(() => {
        const animations = animaValues.map((anim) => {
            return Animated.parallel([
                Animated.timing(anim.fade, {
                    toValue: 1,
                    duration: 600,
                    easing: Easing.linear,
                    useNativeDriver: true,
                }),
                Animated.timing(anim.slide, {
                    toValue: 0,
                    duration: 600,
                    easing: Easing.out(Easing.back(1.5)),
                    useNativeDriver: true,
                }),
            ])
        });
        Animated.stagger(100, animations).start();
    }, [animaValues]);

    const getAnimationStyle = (index: number) => ({
        opacity: animaValues[index].fade,
        transform: [{ translateY: animaValues[index].slide }],
    })

    const checkUpdate = async () => {
        setUpdataDialogVisible(true);
        setUpdateInfo({ ...updateInfo, loading: true });
        try {
            const response = await fetch('https://api.github.com/repos/luckylca/GirlVideo_ByReactNative/releases/latest');
            const data = await response.json();

            if (data.tag_name) {
                const isNew = data.tag_name !== CURRENT_VERSION;
                setUpdateInfo({
                    loading: false,
                    hasNew: isNew,
                    serverVersion: data.tag_name
                });
            }
        } catch (error) {
            console.error("检查更新失败", error);
            setUpdateInfo({ ...updateInfo, loading: false });
        }
    }

    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <Portal>
                <Dialog visible={updataDialogVisible} onDismiss={hideUpdataDialog}>
                    <Dialog.Title>检查更新</Dialog.Title>
                    <Dialog.Content>
                        {updateInfo.loading ? (
                            <Text>正在检查中...</Text>
                        ) : updateInfo.hasNew ? (
                            <View>
                                <Text style={{ color: theme.colors.error, fontWeight: 'bold' }}>发现新版本：{updateInfo.serverVersion}</Text>
                                <Text style={{ marginTop: 10 }}>当前版本：{CURRENT_VERSION}</Text>
                                <Text style={{ fontSize: 12, color: theme.colors.onSurfaceVariant, marginTop: 5 }}>建议立即更新以获取最优体验。</Text>
                            </View>
                        ) : (
                            <Text>当前已是最新版本 ({CURRENT_VERSION})</Text>
                        )}
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={hideUpdataDialog}>取消</Button>
                        {updateInfo.hasNew && (
                            <Button onPress={() => {/* 这里可以用 Linking.openURL 跳转到下载页 */ }}>
                                立即前往更新
                            </Button>
                        )}
                        {!updateInfo.hasNew && !updateInfo.loading && (
                            <Button onPress={hideUpdataDialog}>确定</Button>
                        )}
                    </Dialog.Actions>
                </Dialog>
            </Portal>
            <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 30, backgroundColor: theme.colors.background }}>
                <Appbar.Header style={{ backgroundColor: 'transparent', elevation: 0 }}>
                    <Appbar.BackAction onPress={() => router.back()} />
                    <Appbar.Content title="设置" />
                </Appbar.Header>
                <Animated.View style={getAnimationStyle(0)}>
                    <Button
                        mode="text"
                        onPress={() => { }}
                        style={{ width: '100%', marginTop: 20, borderRadius: 0, backgroundColor: 'transparent', elevation: 0, shadowColor: "transparent" }}
                        contentStyle={{ height: 80, justifyContent: 'flex-start', alignContent: 'center' }}
                        labelStyle={{ marginHorizontal: 0 }}
                    >
                        <View style={{ paddingLeft: 20, justifyContent: 'center', alignItems: 'center' }}>
                            <Svg width={36} height={36} viewBox="0 0 24 24">
                                <Path
                                    d="M10 4A4 4 0 0 0 6 8A4 4 0 0 0 10 12A4 4 0 0 0 14 8A4 4 0 0 0 10 4M10 6A2 2 0 0 1 12 8A2 2 0 0 1 10 10A2 2 0 0 1 8 8A2 2 0 0 1 10 6M17 12C16.84 12 16.76 12.08 16.76 12.24L16.5 13.5C16.28 13.68 15.96 13.84 15.72 14L14.44 13.5C14.36 13.5 14.2 13.5 14.12 13.6L13.16 15.36C13.08 15.44 13.08 15.6 13.24 15.68L14.28 16.5V17.5L13.24 18.32C13.16 18.4 13.08 18.56 13.16 18.64L14.12 20.4C14.2 20.5 14.36 20.5 14.44 20.5L15.72 20C15.96 20.16 16.28 20.32 16.5 20.5L16.76 21.76C16.76 21.92 16.84 22 17 22H19C19.08 22 19.24 21.92 19.24 21.76L19.4 20.5C19.72 20.32 20.04 20.16 20.28 20L21.5 20.5C21.64 20.5 21.8 20.5 21.8 20.4L22.84 18.64C22.92 18.56 22.84 18.4 22.76 18.32L21.72 17.5V16.5L22.76 15.68C22.84 15.6 22.92 15.44 22.84 15.36L21.8 13.6C21.8 13.5 21.64 13.5 21.5 13.5L20.28 14C20.04 13.84 19.72 13.68 19.4 13.5L19.24 12.24C19.24 12.08 19.08 12 19 12H17M10 13C7.33 13 2 14.33 2 17V20H11.67C11.39 19.41 11.19 18.77 11.09 18.1H3.9V17C3.9 16.36 7.03 14.9 10 14.9C10.43 14.9 10.87 14.94 11.3 15C11.5 14.36 11.77 13.76 12.12 13.21C11.34 13.08 10.6 13 10 13M18.04 15.5C18.84 15.5 19.5 16.16 19.5 17.04C19.5 17.84 18.84 18.5 18.04 18.5C17.16 18.5 16.5 17.84 16.5 17.04C16.5 16.16 17.16 15.5 18.04 15.5Z"
                                    fill={theme.colors.primary}
                                />
                            </Svg>
                        </View>
                        <View style={{ justifyContent: 'center', alignItems: 'flex-start', paddingLeft: 10 }}>
                            <Text style={{ textAlign: 'center', fontSize: 16, color: theme.colors.onSurface }}>账号管理</Text>
                            <Text style={{ textAlign: 'center', fontSize: 10, color: theme.colors.onSurfaceVariant }}>{userStore.isLoggedIn ? `已登录: ${userStore.username}` : '未登录'}</Text>
                        </View>
                    </Button>
                </Animated.View>
                <Animated.View style={getAnimationStyle(1)}>
                    <Card mode="contained" style={{ width: '100%', height: 90, justifyContent: 'center', backgroundColor: 'transparent' }}>
                        <Card.Content style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', }}>
                            <View style={{ justifyContent: 'center', alignItems: 'flex-start', flexDirection: 'row' }}>
                                <View style={{ justifyContent: 'center', alignItems: 'center' }}>
                                    <Svg width={39} height={39} viewBox="0 0 24 24">
                                        <Path
                                            d="M13.54 22H10C9.75 22 9.54 21.82 9.5 21.58L9.13 18.93C8.5 18.68 7.96 18.34 7.44 17.94L4.95 18.95C4.73 19.03 4.46 18.95 4.34 18.73L2.34 15.27C2.21 15.05 2.27 14.78 2.46 14.63L4.57 12.97L4.5 12L4.57 11L2.46 9.37C2.27 9.22 2.21 8.95 2.34 8.73L4.34 5.27C4.46 5.05 4.73 4.96 4.95 5.05L7.44 6.05C7.96 5.66 8.5 5.32 9.13 5.07L9.5 2.42C9.54 2.18 9.75 2 10 2H14C14.25 2 14.46 2.18 14.5 2.42L14.87 5.07C15.5 5.32 16.04 5.66 16.56 6.05L19.05 5.05C19.27 4.96 19.54 5.05 19.66 5.27L21.66 8.73C21.79 8.95 21.73 9.22 21.54 9.37L19.43 11L19.5 12V12.19C19 12.07 18.5 12 18 12C17.83 12 17.66 12 17.5 12.03C17.5 11.41 17.4 10.79 17.2 10.2L19.31 8.65L18.56 7.35L16.15 8.39C15.38 7.5 14.32 6.86 13.12 6.62L12.75 4H11.25L10.88 6.61C9.68 6.86 8.62 7.5 7.85 8.39L5.44 7.35L4.69 8.65L6.8 10.2C6.4 11.37 6.4 12.64 6.8 13.8L4.68 15.36L5.43 16.66L7.86 15.62C8.63 16.5 9.68 17.14 10.87 17.38L11.24 20H12.35C12.61 20.75 13 21.42 13.54 22M15.96 12.36C16 12.24 16 12.12 16 12C16 9.79 14.21 8 12 8S8 9.79 8 12 9.79 16 12 16C12.12 16 12.24 16 12.36 15.96C12.97 14.29 14.29 12.97 15.96 12.36M12 14C10.9 14 10 13.11 10 12S10.9 10 12 10 14 10.9 14 12 13.11 14 12 14M16 15V21L21 18L16 15Z"
                                            fill={theme.colors.primary}
                                        />
                                    </Svg>
                                </View>
                                <View style={{ justifyContent: 'center', alignItems: 'flex-start', paddingLeft: 10 }}>
                                    <Text style={{ fontSize: 16, textAlign: 'center' }}>去除广告推文</Text>
                                    <Text style={{ fontSize: 10, color: '#888' }}>离手刷小姐姐</Text>
                                </View>
                            </View>
                            <Switch value={isAds} onValueChange={onToggleAds} />
                        </Card.Content>
                    </Card>
                </Animated.View>
                <Animated.View style={getAnimationStyle(1)}>
                    <Card mode="contained" style={{ width: '100%', height: 90, justifyContent: 'center', backgroundColor: 'transparent' }}>
                        <Card.Content style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', }}>
                            <View style={{ justifyContent: 'center', alignItems: 'flex-start', flexDirection: 'row' }}>
                                <View style={{ justifyContent: 'center', alignItems: 'center' }}>
                                    <Svg width={39} height={39} viewBox="0 0 24 24">
                                        <Path
                                            d="M13.54 22H10C9.75 22 9.54 21.82 9.5 21.58L9.13 18.93C8.5 18.68 7.96 18.34 7.44 17.94L4.95 18.95C4.73 19.03 4.46 18.95 4.34 18.73L2.34 15.27C2.21 15.05 2.27 14.78 2.46 14.63L4.57 12.97L4.5 12L4.57 11L2.46 9.37C2.27 9.22 2.21 8.95 2.34 8.73L4.34 5.27C4.46 5.05 4.73 4.96 4.95 5.05L7.44 6.05C7.96 5.66 8.5 5.32 9.13 5.07L9.5 2.42C9.54 2.18 9.75 2 10 2H14C14.25 2 14.46 2.18 14.5 2.42L14.87 5.07C15.5 5.32 16.04 5.66 16.56 6.05L19.05 5.05C19.27 4.96 19.54 5.05 19.66 5.27L21.66 8.73C21.79 8.95 21.73 9.22 21.54 9.37L19.43 11L19.5 12V12.19C19 12.07 18.5 12 18 12C17.83 12 17.66 12 17.5 12.03C17.5 11.41 17.4 10.79 17.2 10.2L19.31 8.65L18.56 7.35L16.15 8.39C15.38 7.5 14.32 6.86 13.12 6.62L12.75 4H11.25L10.88 6.61C9.68 6.86 8.62 7.5 7.85 8.39L5.44 7.35L4.69 8.65L6.8 10.2C6.4 11.37 6.4 12.64 6.8 13.8L4.68 15.36L5.43 16.66L7.86 15.62C8.63 16.5 9.68 17.14 10.87 17.38L11.24 20H12.35C12.61 20.75 13 21.42 13.54 22M15.96 12.36C16 12.24 16 12.12 16 12C16 9.79 14.21 8 12 8S8 9.79 8 12 9.79 16 12 16C12.12 16 12.24 16 12.36 15.96C12.97 14.29 14.29 12.97 15.96 12.36M12 14C10.9 14 10 13.11 10 12S10.9 10 12 10 14 10.9 14 12 13.11 14 12 14M16 15V21L21 18L16 15Z"
                                            fill={theme.colors.primary}
                                        />
                                    </Svg>
                                </View>
                                <View style={{ justifyContent: 'center', alignItems: 'flex-start', paddingLeft: 10 }}>
                                    <Text style={{ fontSize: 16, textAlign: 'center' }}>盐选内容</Text>
                                    <Text style={{ fontSize: 10, color: '#888' }}>离手刷小姐姐</Text>
                                </View>
                            </View>
                            <Switch value={isSaltContent} onValueChange={onToggleSaltContent} />
                        </Card.Content>
                    </Card>
                </Animated.View>
                <Animated.View style={getAnimationStyle(1)}>
                    <Button
                        mode="elevated"
                        onPress={() => { router.push('/themeSet') }}
                        style={{ width: '100%', borderRadius: 0, backgroundColor: 'transparent', elevation: 0, shadowColor: "transparent" }}
                        contentStyle={{ height: 80, justifyContent: 'flex-start', alignContent: 'center' }}
                        labelStyle={{ marginHorizontal: 0 }}
                    >
                        <View style={{ justifyContent: 'center', alignItems: 'center', paddingLeft: 20 }}>
                            <Svg width={36} height={36} viewBox="0 0 24 24">
                                <Path
                                    d="M13 19C13 19.34 13.04 19.67 13.09 20H4C2.9 20 2 19.11 2 18V6C2 4.89 2.9 4 4 4H5L7 8H10L8 4H10L12 8H15L13 4H15L17 8H20L18 4H22V13.81C21.39 13.46 20.72 13.22 20 13.09V10H5.76L4 6.47V18H13.09C13.04 18.33 13 18.66 13 19M20 18V15H18V18H15V20H18V23H20V20H23V18H20Z"
                                    fill={theme.colors.primary}
                                />
                            </Svg>
                        </View>
                        <View style={{ justifyContent: 'center', alignItems: 'flex-start', paddingLeft: 10 }}>
                            <Text style={{ textAlign: 'center', fontSize: 16, color: theme.colors.onSurface }}>主题设置</Text>
                            <Text style={{ textAlign: 'center', fontSize: 10, color: theme.colors.onSurfaceVariant }}>让其他平台的小姐姐也住进来</Text>
                        </View>
                    </Button>
                </Animated.View>
                <Animated.View style={getAnimationStyle(2)}>
                    <Button
                        mode="elevated"
                        style={{ width: '100%', borderRadius: 0, backgroundColor: 'transparent', elevation: 0, shadowColor: "transparent" }}
                        contentStyle={{ height: 80, justifyContent: 'flex-start' }}
                        labelStyle={{ marginHorizontal: 0 }}
                    >
                        <View style={{ justifyContent: 'center', alignItems: 'flex-start', paddingLeft: 20 }}>
                            <Svg width={36} height={36} viewBox="0 0 24 24">
                                <Path d="M13,6V18L21.5,12M4,18L12.5,12L4,6V18Z" fill={theme.colors.primary} />
                            </Svg>
                        </View>
                        <View style={{ justifyContent: 'center', alignItems: 'flex-start', paddingLeft: 10 }}>
                            <Text style={{ fontSize: 16, color: theme.colors.onSurface }}>开发者模式</Text>
                            <Text style={{ fontSize: 10, color: theme.colors.onSurfaceVariant }}>快，更快一点</Text>
                        </View>
                    </Button>
                </Animated.View>
                <Animated.View style={getAnimationStyle(3)}>
                    <Button
                        mode="elevated"
                        onPress={checkUpdate}
                        style={{ width: '100%', borderRadius: 0, backgroundColor: 'transparent', elevation: 0, shadowColor: "transparent" }}
                        contentStyle={{ height: 80, justifyContent: 'flex-start', alignContent: 'center' }}
                        labelStyle={{ marginHorizontal: 0 }}
                    >
                        <View style={{ justifyContent: 'center', alignItems: 'flex-start', paddingLeft: 20 }}>
                            <Svg width={36} height={36} viewBox="0 0 24 24">
                                <Path
                                    d="M13 17.5C13 18.39 13.18 19.23 13.5 20H6.5C5 20 3.69 19.5 2.61 18.43C1.54 17.38 1 16.09 1 14.58C1 13.28 1.39 12.12 2.17 11.1S4 9.43 5.25 9.15C5.67 7.62 6.5 6.38 7.75 5.43S10.42 4 12 4C13.95 4 15.6 4.68 16.96 6.04C18.32 7.4 19 9.05 19 11C19.04 11 19.07 11 19.1 11C15.7 11.23 13 14.05 13 17.5M19 13.5V12L16.75 14.25L19 16.5V15C20.38 15 21.5 16.12 21.5 17.5C21.5 17.9 21.41 18.28 21.24 18.62L22.33 19.71C22.75 19.08 23 18.32 23 17.5C23 15.29 21.21 13.5 19 13.5M19 20C17.62 20 16.5 18.88 16.5 17.5C16.5 17.1 16.59 16.72 16.76 16.38L15.67 15.29C15.25 15.92 15 16.68 15 17.5C15 19.71 16.79 21.5 19 21.5V23L21.25 20.75L19 18.5V20Z"
                                    fill={theme.colors.primary}
                                />
                            </Svg>
                        </View>
                        <View style={{ justifyContent: 'center', alignItems: 'flex-start', paddingLeft: 10 }}>
                            <Text style={{ textAlign: 'center', fontSize: 16, color: theme.colors.onSurface }}>检查更新</Text>
                            <Text style={{ textAlign: 'center', fontSize: 10, color: theme.colors.onSurfaceVariant }}>记得更新获取最优的体验哦</Text>
                        </View>
                    </Button>
                </Animated.View>
                <Animated.View style={getAnimationStyle(4)}>
                    <Button
                        mode="elevated"
                        onPress={() => { }}
                        style={{ width: '100%', borderRadius: 0, backgroundColor: 'transparent', elevation: 0, shadowColor: "transparent" }}
                        contentStyle={{ height: 80, justifyContent: 'flex-start', alignContent: 'center' }}
                        labelStyle={{ marginHorizontal: 0 }}
                    >
                        <View style={{ justifyContent: 'center', alignItems: 'flex-start', paddingLeft: 20 }}>
                            <Svg width={36} height={36} viewBox="0 0 24 24">
                                <Path
                                    d="M20.37,8.91L19.37,10.64L7.24,3.64L8.24,1.91L11.28,3.66L12.64,3.29L16.97,5.79L17.34,7.16L20.37,8.91M6,19V7H11.07L18,11V19A2,2 0 0,1 16,21H8A2,2 0 0,1 6,19M8,19H16V12.2L10.46,9H8V19Z"
                                    fill={theme.colors.primary}
                                />
                            </Svg>
                        </View>
                        <View style={{ justifyContent: 'center', alignItems: 'flex-start', paddingLeft: 10 }}>
                            <Text style={{ textAlign: 'center', fontSize: 16, color: theme.colors.onSurface }}>清除缓存</Text>
                            <Text style={{ textAlign: 'center', fontSize: 10, color: theme.colors.onSurfaceVariant }}>洗干净</Text>
                        </View>
                    </Button>
                </Animated.View>
                <Animated.View style={getAnimationStyle(5)}>
                    <Button
                        mode="elevated"
                        onPress={() => { }}
                        style={{ width: '100%', marginBottom: 20, borderRadius: 0, backgroundColor: 'transparent', elevation: 0, shadowColor: "transparent" }}
                        contentStyle={{ height: 80, justifyContent: 'flex-start', alignContent: 'center' }}
                        labelStyle={{ marginHorizontal: 0 }}
                    >
                        <View style={{ justifyContent: 'center', alignItems: 'center', paddingLeft: 20 }}>
                            <Svg width={36} height={36} viewBox="0 0 24 24">
                                <Path
                                    d="M11 9H13V7H11V9M14 17V15H13V11H10V13H11V15H10V17H14M5 3H19C20.1 3 21 3.89 21 5V19C21 19.53 20.79 20.04 20.41 20.41C20.04 20.79 19.53 21 19 21H5C4.47 21 3.96 20.79 3.59 20.41C3.21 20.04 3 19.53 3 19V5C3 3.89 3.89 3 5 3M19 19V5H5V19H19Z"
                                    fill={theme.colors.primary}
                                />
                            </Svg>
                        </View>
                        <View style={{ justifyContent: 'center', alignItems: 'flex-start', paddingLeft: 10 }}>
                            <Text style={{ textAlign: 'center', fontSize: 16, color: theme.colors.onSurface }}>关于APP</Text>
                            <Text style={{ textAlign: 'center', fontSize: 10, color: theme.colors.onSurfaceVariant }}>获取信息</Text>
                        </View>
                    </Button>
                </Animated.View>
            </ScrollView>
        </View>
    );
}

export default SettingsScreen;
import { router } from "expo-router";
import React, { useRef } from "react";
import { Animated, Easing, ScrollView, View } from "react-native";
import { Appbar, Button, Card, Dialog, Portal, Switch, Text, TextInput, useTheme } from "react-native-paper";
import Svg, { Path } from "react-native-svg";
import { useSettingStore } from "../src/stores/useSettingStore";

const DevModeScreen = () => {
    const theme = useTheme();
    const disableAnimations = useSettingStore((state) => state.disableAnimations);
    const setDisableAnimations = useSettingStore((state) => state.setDisableAnimations);
    const cookie = useSettingStore((state) => state.cookie);
    const setCookie = useSettingStore((state) => state.setCookie);

    const [cookieDialogVisible, setCookieDialogVisible] = React.useState(false);
    const [cookieDraft, setCookieDraft] = React.useState(cookie);

    const animaValues = useRef(
        [...Array(2)].map(() => ({
            fade: new Animated.Value(0),
            slide: new Animated.Value(50),
        }))
    ).current;

    React.useEffect(() => {
        if (disableAnimations) {
            animaValues.forEach((anim) => {
                anim.fade.setValue(1);
                anim.slide.setValue(0);
            });
            return;
        }

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
            ]);
        });
        Animated.stagger(100, animations).start();
    }, [animaValues, disableAnimations]);

    const getAnimationStyle = (index: number) => ({
        opacity: animaValues[index].fade,
        transform: [{ translateY: animaValues[index].slide }],
    });

    const openCookieDialog = () => {
        setCookieDraft(cookie);
        setCookieDialogVisible(true);
    };

    const closeCookieDialog = () => setCookieDialogVisible(false);

    const confirmCookie = () => {
        setCookie(cookieDraft);
        setCookieDialogVisible(false);
    };

    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <Portal>
                <Dialog visible={cookieDialogVisible} onDismiss={closeCookieDialog}>
                    <Dialog.Title>设置 Cookie</Dialog.Title>
                    <Dialog.Content>
                        <TextInput
                            mode="outlined"
                            label="Cookie"
                            value={cookieDraft}
                            onChangeText={setCookieDraft}
                            placeholder="输入完整的 Cookie"
                            multiline
                            style={{ backgroundColor: "transparent" }}
                        />
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={closeCookieDialog}>取消</Button>
                        <Button onPress={confirmCookie}>确定</Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>

            <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 30, backgroundColor: theme.colors.background }}>
                <Appbar.Header style={{ backgroundColor: "transparent", elevation: 0 }}>
                    <Appbar.BackAction onPress={() => router.back()} />
                    <Appbar.Content title="开发者模式" />
                </Appbar.Header>

                <Animated.View style={getAnimationStyle(0)}>
                    <Card mode="contained" style={{ width: "100%", height: 90, justifyContent: "center", backgroundColor: "transparent" }}>
                        <Card.Content style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                            <View style={{ justifyContent: "center", alignItems: "flex-start", flexDirection: "row" }}>
                                <View style={{ justifyContent: "center", alignItems: "center" }}>
                                    <Svg width={39} height={39} viewBox="0 0 24 24">
                                        <Path
                                            d="M4 4V9H5V5H9V4H4M15 4V5H19V9H20V4H15M19 15V19H15V20H20V15H19M9 19H5V15H4V20H9V19M8 8L12 12L8 16L6.5 14.5L9 12L6.5 9.5L8 8M16 8L17.5 9.5L15 12L17.5 14.5L16 16L12 12L16 8Z"
                                            fill={theme.colors.primary}
                                        />
                                    </Svg>
                                </View>
                                <View style={{ justifyContent: "center", alignItems: "flex-start", paddingLeft: 10 }}>
                                    <Text style={{ fontSize: 16, textAlign: "center" }}>关闭动画</Text>
                                    <Text style={{ fontSize: 10, color: theme.colors.onSurfaceVariant }}>减少过渡动画，提升性能</Text>
                                </View>
                            </View>
                            <Switch value={disableAnimations} onValueChange={setDisableAnimations} />
                        </Card.Content>
                    </Card>
                </Animated.View>

                <Animated.View style={getAnimationStyle(1)}>
                    <Button
                        mode="elevated"
                        onPress={openCookieDialog}
                        style={{ width: "100%", borderRadius: 0, backgroundColor: "transparent", elevation: 0, shadowColor: "transparent" }}
                        contentStyle={{ height: 80, justifyContent: "flex-start", alignContent: "center" }}
                        labelStyle={{ marginHorizontal: 0 }}
                    >
                        <View style={{ justifyContent: "center", alignItems: "center", paddingLeft: 20 }}>
                            <Svg width={36} height={36} viewBox="0 0 24 24">
                                <Path
                                    d="M12 2C17.52 2 22 6.48 22 12C22 17.52 17.52 22 12 22C6.48 22 2 17.52 2 12C2 6.48 6.48 2 12 2M12 4C7.58 4 4 7.58 4 12C4 16.42 7.58 20 12 20C16.42 20 20 16.42 20 12C20 7.58 16.42 4 12 4M10.5 7H13.5V9H10.5V7M10 11H14V17H10V11Z"
                                    fill={theme.colors.primary}
                                />
                            </Svg>
                        </View>
                        <View style={{ justifyContent: "center", alignItems: "flex-start", paddingLeft: 10 }}>
                            <Text style={{ textAlign: "center", fontSize: 16, color: theme.colors.onSurface }}>设置 Cookie</Text>
                            <Text style={{ textAlign: "center", fontSize: 10, color: theme.colors.onSurfaceVariant }}>
                                {cookie ? "已设置 Cookie" : "用于调试接口请求"}
                            </Text>
                        </View>
                    </Button>
                </Animated.View>
            </ScrollView>
        </View>
    );
};

export default DevModeScreen;

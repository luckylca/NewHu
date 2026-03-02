import { useUserStore } from "@/src/stores/useUserStore";
import { router } from "expo-router";
import React from "react";
import { Dimensions, ScrollView, TouchableOpacity, View,Animated } from 'react-native';
import { Avatar, Button, Card, Portal, Text, useTheme } from 'react-native-paper';


const { width: WindowWidth,height: WindowHeight } = Dimensions.get('window');
const AnimatedButton = Animated.createAnimatedComponent(Button);

const UserScreen = ({ navigation }: any) => {
    const theme = useTheme();
    const userStore = useUserStore();
    const scale1 = React.useRef(new Animated.Value(1)).current;
    const scale2 = React.useRef(new Animated.Value(1)).current;
    const scale3 = React.useRef(new Animated.Value(1)).current;
    const [isSwitchOn, setIsSwitchOn] = React.useState(false);
    const onToggleSwitch = () => {
        setIsSwitchOn(!isSwitchOn)
    };
    const handlePressIn = (scale: any) => {
        Animated.spring(scale, {
            toValue: 0.95,
            useNativeDriver: true,
            bounciness: 10,
        }).start();
    };

    const handlePressOut = (scale: any) => {
        Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            bounciness: 10,
        }).start();
    };
    const [isLoading, setIsLoading] = React.useState(false);

    const handlePress = ()=>{
        if(userStore.isLoggedIn){
            router.push('/userinfo');
        }
        else{
            router.push('/webview');
        }
    }

    return (
            <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', paddingBottom: 30,backgroundColor: theme.colors.background  }}>
                <TouchableOpacity style={{ alignItems: 'center', marginTop: 30, width: '30%' }} activeOpacity={0.8} onPress={handlePress}>
                    <Avatar.Image size={100} source={{ uri: userStore.avatar }} style={{ marginTop: 30, marginBottom: 10 }} />
                    <Card mode="elevated" style={{ marginBottom: 30, height: 40, justifyContent: 'center', alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
                            <Text style={{ margin: 8, textAlign: 'center', fontSize: 18 }}>{userStore.username || '请登录'}</Text>
                        </View>
                    </Card>
                </TouchableOpacity>
                <AnimatedButton 
                    mode="elevated"
                    onPressIn={() => handlePressIn(scale1)}
                    onPressOut={() => handlePressOut(scale1)}
                    onPress={() => router.push('/like')}
                    style={{ width: '80%', marginBottom: 20,height: 60,justifyContent: 'center', transform: [{ scale: scale1 }] ,backgroundColor: theme.colors.primaryContainer }}
                    contentStyle={{ height: 60, justifyContent: 'center', alignItems: 'center',flexDirection: 'row',backgroundColor: theme.colors.primaryContainer }}
                    >
                    <Text style={{ fontSize: 15,height: 60,textAlignVertical: 'center' }}>收藏列表</Text>
                </AnimatedButton>
                <AnimatedButton 
                    mode="elevated"
                    style={{ width: '80%', marginBottom: 20,height: 60,justifyContent: 'center' ,backgroundColor: theme.colors.primaryContainer,transform: [{ scale: scale2 }] }}
                    contentStyle={{ height: 60, justifyContent: 'center', alignItems: 'center',flexDirection: 'row',backgroundColor: theme.colors.primaryContainer }}
                    onPressIn={() => handlePressIn(scale2)}
                    onPressOut={() => handlePressOut(scale2)}
                    onPress={() => router.push('/history')}
                    >
                    <Text style={{ fontSize: 15,height: 60,textAlignVertical: 'center' }}>浏览历史</Text>
                </AnimatedButton>
                <AnimatedButton
                    mode="elevated"
                    style={{ width: '80%', marginBottom: 20 ,height: 60,justifyContent: 'center' ,backgroundColor: theme.colors.primaryContainer,transform: [{ scale: scale3 }]  }}
                    contentStyle={{ height: 60, justifyContent: 'center', alignItems: 'center',flexDirection: 'row',backgroundColor: theme.colors.primaryContainer }}
                    onPressIn={() => handlePressIn(scale3)}
                    onPressOut={() => handlePressOut(scale3)}
                    onPress={() => router.push('/settings')}
                    >
                    <Text style={{ fontSize: 15,height: 60,textAlignVertical: 'center' }}>设置</Text>
                </AnimatedButton>
            </ScrollView>
    );
}

export default UserScreen;
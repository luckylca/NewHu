import { useUserStore } from "@/src/stores/useUserStore";
import { router } from "expo-router";
import React from "react";
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { Avatar, Button, Card, Text, useTheme } from 'react-native-paper';


const UserScreen = ({ navigation }: any) => {
    const theme = useTheme();
    const userStore = useUserStore();
    const cardBgColor = theme.colors.surfaceVariant;     // 卡片背景
    const metaColor = theme.colors.onSurfaceVariant;    // 文字和图标颜色

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
                    <Card mode="elevated" style={{ marginBottom: 30, height: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: cardBgColor }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
                            <Text style={{ margin: 8, textAlign: 'center', fontSize: 18, color: metaColor }}>{userStore.username || '请登录'}</Text>
                        </View>
                    </Card>
                </TouchableOpacity>
                <Button 
                    mode="elevated"
                    onPress={() => router.push('/like')}
                    style={{ width: '80%', marginBottom: 20,height: 60,justifyContent: 'center' ,backgroundColor: cardBgColor }}
                    contentStyle={{ height: 60, justifyContent: 'center', alignItems: 'center',flexDirection: 'row',backgroundColor: cardBgColor }}
                    labelStyle={{ fontSize: 15, color: metaColor }}
                    >
                    收藏列表
                </Button>
                <Button 
                    mode="elevated"
                    style={{ width: '80%', marginBottom: 20,height: 60,justifyContent: 'center' ,backgroundColor: cardBgColor }}
                    contentStyle={{ height: 60, justifyContent: 'center', alignItems: 'center',flexDirection: 'row',backgroundColor: cardBgColor }}
                    labelStyle={{ fontSize: 15, color: metaColor }}
                    onPress={() => router.push('/history')}
                    >
                    浏览历史
                </Button>
                <Button
                    mode="elevated"
                    style={{ width: '80%', marginBottom: 20 ,height: 60,justifyContent: 'center' ,backgroundColor: cardBgColor }}
                    contentStyle={{ height: 60, justifyContent: 'center', alignItems: 'center',flexDirection: 'row',backgroundColor: cardBgColor }}
                    labelStyle={{ fontSize: 15, color: metaColor }}
                    onPress={() => router.push('/settings')}
                    >
                    设置
                </Button>
            </ScrollView>
    );
}

export default UserScreen;
import { getUserInfo } from "@/src/api/ZhihuApi";
import { useAppTheme } from "@/src/hooks/useAppTheme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { Animated, Pressable, ScrollView, View } from "react-native";
import { Appbar, Divider, Surface, Text } from "react-native-paper";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PeopleParams = {
    urlToken:string
};

const PeopleScreen = () => {
    const {urlToken} = useLocalSearchParams<PeopleParams>()
    const theme = useAppTheme()
    const router = useRouter()
    const [userInfo, setUserInfo] = React.useState<any>(null)

    React.useEffect(() => {
        if (urlToken) {
            getUserInfo(urlToken).then((data) => {
                setUserInfo(data)
                console.log("User Info:", data)
            }).catch((error) => {
                console.error("Failed to fetch user info:", error)
            })
        }
    }, [urlToken])

    const renderStats = (label: string, value: number) => (
        <View style={{ alignItems: 'center', flex: 1 }}>
            <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>{value || 0}</Text>
            <Text variant="labelMedium" style={{ color: theme.colors.outline }}>{label}</Text>
        </View>
    );

    return (        
        <View style={{ flex: 1 ,backgroundColor: theme.colors.background}}>
            <Appbar.Header style={{ backgroundColor: theme.colors.surface }}>
                <Appbar.BackAction onPress={() => router.back()} />
                <Appbar.Content title={userInfo ? userInfo.name : "人物信息"} />
            </Appbar.Header>
            {userInfo ? (
                <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
                    <Image
                        source={{ uri: userInfo.cover_url }}
                        style={[{ width: '100%', height: 160 }, { backgroundColor: theme.colors.surfaceVariant }]}
                        contentFit="cover"
                    />
                    
                    <View style={{ paddingHorizontal: 16 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: -30, marginBottom: 16 }}>
                            <Image
                                source={{ uri: userInfo.avatar_url }}
                                style={[{ width: 80, height: 80, borderRadius: 40, borderWidth: 3 }, { borderColor: theme.colors.background }]}
                            />
                            <View style={{ flex: 1, marginLeft: 12, marginTop: 36 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Text variant="headlineSmall" style={{ fontWeight: 'bold' }}>
                                        {userInfo.name}
                                    </Text>
                                    {userInfo.vip_info?.is_vip && (
                                        <Image 
                                            source={{ uri: userInfo.vip_info.vip_icon?.url }} 
                                            style={{ width: 40, height: 16 }} 
                                            contentFit="contain" 
                                        />
                                    )}
                                </View>
                                {userInfo.headline ? (
                                    <Text variant="bodyMedium" numberOfLines={2} style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                                        {userInfo.headline}
                                    </Text>
                                ) : null}
                            </View>
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 }}>
                            {renderStats("关注了", userInfo.following_count)}
                            {renderStats("关注者", userInfo.follower_count)}
                            {renderStats("获赞同", userInfo.voteup_count)}
                            {renderStats("获收藏", userInfo.favorited_count)}
                        </View>
                        
                        <Divider style={{ marginVertical: 16 }} />

                        <View style={{ marginBottom: 20 }}>
                            {userInfo.description ? (
                                <Text variant="bodyMedium" style={{ marginBottom: 12 }}>
                                    {userInfo.description}
                                </Text>
                            ) : null}

                            <View style={{ gap: 8 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <MaterialCommunityIcons name="briefcase-outline" size={18} color={theme.colors.outline} />
                                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                                        {userInfo.business?.name || "未知行业"}
                                    </Text>
                                </View>
                                
                                {userInfo.locations?.[0]?.name && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <MaterialCommunityIcons name="map-marker-outline" size={18} color={theme.colors.outline} />
                                        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                                            {userInfo.locations[0].name}
                                        </Text>
                                    </View>
                                )}

                                {userInfo.ip_info && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <MaterialCommunityIcons name="ip-network-outline" size={18} color={theme.colors.outline} />
                                        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                                            {userInfo.ip_info}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>

                        <Surface style={{ borderRadius: 12, paddingLeft: 16,paddingRight: 16, marginVertical: 12 }} elevation={1}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                                <AnimatedPressable 
                                    style={{ alignItems: 'center' ,flex:1,paddingTop:16,paddingBottom:16}} 
                                    android_ripple={{ color: 'rgba(0,0,0,0.15)', foreground: true }}
                                    onPress={() => {}}
                                >
                                    <MaterialCommunityIcons name="frequently-asked-questions" size={24} color={theme.colors.primary} />
                                    <Text variant="titleMedium" style={{ marginTop: 4 }}>{userInfo.question_count || 0}</Text>
                                    <Text variant="labelMedium" style={{ color: theme.colors.outline }}>提问</Text>
                                </AnimatedPressable>
                                <AnimatedPressable 
                                    style={{ alignItems: 'center',flex:1,paddingTop:16,paddingBottom:16 }} android_ripple={{ color: 'rgba(0,0,0,0.15)', foreground: true }} 
                                    onPress={() => {}}>
                                    <MaterialCommunityIcons name="comment-text-multiple-outline" size={24} color={theme.colors.primary} />
                                    <Text variant="titleMedium" style={{ marginTop: 4 }}>{userInfo.answer_count || 0}</Text>
                                    <Text variant="labelMedium" style={{ color: theme.colors.outline }}>回答</Text>
                                </AnimatedPressable>
                                <AnimatedPressable 
                                    style={{ alignItems: 'center' ,flex:1,paddingTop:16,paddingBottom:16}} android_ripple={{ color: 'rgba(0,0,0,0.15)', foreground: true }} 
                                    onPress={() => {}}>
                                    <MaterialCommunityIcons name="file-document-outline" size={24} color={theme.colors.primary} />
                                    <Text variant="titleMedium" style={{ marginTop: 4 }}>{userInfo.articles_count || 0}</Text>
                                    <Text variant="labelMedium" style={{ color: theme.colors.outline }}>文章</Text>
                                </AnimatedPressable>
                                <AnimatedPressable 
                                    style={{ alignItems: 'center' ,flex:1,paddingTop:16,paddingBottom:16}} android_ripple={{ color: 'rgba(0,0,0,0.15)', foreground: true }} 
                                    onPress={() => {}}>
                                    <MaterialCommunityIcons name="video-outline" size={24} color={theme.colors.primary} />
                                    <Text variant="titleMedium" style={{ marginTop: 4 }}>{userInfo.zvideo_count || 0}</Text>
                                    <Text variant="labelMedium" style={{ color: theme.colors.outline }}>视频</Text>
                                </AnimatedPressable>
                            </View>
                        </Surface>
                    </View>
                </ScrollView>
            ) : (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Text>Loading...</Text>
                </View>
            )}
        </View>
    )
}

export default PeopleScreen
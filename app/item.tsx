import { useContentStore } from "@/src/stores/useContentStore";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef,useState } from "react";
import { Pressable, ScrollView, useWindowDimensions, View, TouchableOpacity, Image } from "react-native";
import { Appbar, Avatar, Divider, Portal, Text, useTheme } from "react-native-paper";
import RenderHtml from 'react-native-render-html';
import ImageReanimatedModal from "@/src/components/ImageReanimatedModal";

export default function Item() {
    const { id, type } = useLocalSearchParams();
    const contentStore = useContentStore();
    const router = useRouter();
    const theme = useTheme();
    const [orgin, setOrigin] = useState({ x: 0, y: 0, width: 0, height: 0 });
    const [modalVisible, setModalVisible] = useState(false);
    const [imageUrl, setImageUrl] = useState("");
    const { width } = useWindowDimensions();

    const readData = contentStore.feedList.find((item) => String(item.item.id) === String(id))?.item;

    if (!readData) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
                <Text>数据加载失败或不存在</Text>
            </View>
        );
    }

    const title = type === 'answer' ? readData.questionTitle : (readData.title || '未知标题');
    const htmlContent = readData.content || "<p>暂无正文内容</p>";

    const tagsStyles = {
        body: { color: theme.colors.onSurface, fontSize: 16, lineHeight: 28 },
        p: { marginBottom: 16 },
        figure: { margin: 0, marginTop: 8, marginBottom: 8 },
        img: { borderRadius: 12 }
    };

    const CustomImageRenderer = (props: any) => {
        // 从 tnode 中提取 src 和样式
        const imageRef = useRef<View>(null);
        const { src } = props.tnode.attributes;
        const { width: imgWidth, height: imgHeight } = props.tnode.attributes;

        const openImage = () => {
            if (imageRef.current) {
                imageRef.current.measure((x, y, width, height, pageX, pageY) => {
                    setOrigin({ x: pageX, y: pageY, width, height });
                });
            }
        };

        return (
            <View ref={imageRef} style={{ flex: 1, alignItems: 'center', marginVertical: 8 }}>
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                        console.log('图片地址:', src);
                        openImage();
                        setImageUrl(src);
                        setModalVisible(true);
                    }}
                >
                    <Image
                        source={{ uri: src }}
                        style={{
                            width: '100%',
                            // 如果 HTML 里没给高度，给个默认比例防止高度为 0
                            aspectRatio: imgWidth && imgHeight ? imgWidth / imgHeight : 16 / 9,
                            borderRadius: 8
                        }}
                        resizeMode="contain"
                    />
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <Portal>
                <ImageReanimatedModal
                    visible={modalVisible}
                    url={imageUrl}
                    origin={orgin}
                    onClose={() => setModalVisible(false)}
                />
            </Portal>
            {/* 顶部导航栏 */}
            <Appbar.Header elevated>
                <Appbar.BackAction onPress={() => router.back()} />
                <Appbar.Content title={type === 'answer' ? '回答详情' : '文章详情'} />
            </Appbar.Header>

            <ScrollView
                contentContainerStyle={{ padding: 10 }}
                showsVerticalScrollIndicator={false}
            >
                {/* 标题 */}
                <Pressable
                    onPress={() => console.log('点击了标题')}
                    android_ripple={{ color: 'rgba(0,0,0,0.15)', foreground: true }}
                    style={{
                        width: '100%',
                        borderRadius: 16,
                        height: 'auto',
                        overflow: 'hidden',
                        paddingTop: 8,
                        paddingBottom: 8,
                    }}
                >
                    <Text variant="headlineSmall" style={{ fontWeight: 'bold' }}>
                        {title}
                    </Text>
                </Pressable>

                {/* 作者信息区域 */}
                <Pressable
                    onPress={() => console.log(readData.updatedTime)}
                    android_ripple={{ color: 'rgba(0,0,0,0.15)', foreground: true }}
                    style={{
                        width: '100%',
                        borderRadius: 16,
                        height: 'auto',
                        overflow: 'hidden',
                        paddingTop: 8,
                        paddingBottom: 8,
                    }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {readData.authorAvatar ? (
                            <Avatar.Image size={40} source={{ uri: readData.authorAvatar }} />
                        ) : (
                            <Avatar.Text size={40} label={readData.authorName?.substring(0, 1) || '佚'} />
                        )}
                        <View style={{ marginLeft: 12, justifyContent: 'center' }}>
                            <Text variant="titleMedium">{readData.authorName}</Text>
                            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                                {readData.updatedTime ? new Date(readData.updatedTime * 1000).toLocaleDateString() : '最近更新'}
                            </Text>
                        </View>
                    </View>
                </Pressable>
                {/* 分割线 */}
                <Divider style={{ marginVertical: 16 }} />

                {/* HTML 正文渲染 */}
                <RenderHtml
                    contentWidth={width - 32}
                    source={{ html: htmlContent }}
                    tagsStyles={tagsStyles}
                    enableExperimentalMarginCollapsing={true}
                    renderers={{
                        img: CustomImageRenderer
                    }}
                    defaultTextProps={
                        { selectable: true }
                    }
                />

                {/* 底部留白 */}
                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}
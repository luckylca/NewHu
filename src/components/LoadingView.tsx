import { ActivityIndicator, Text, useTheme } from "react-native-paper";
import { View } from "react-native";

const LoadingView = ({ message = "正在加载…" }: { message?: string }) => {
    const theme = useTheme();

    return (
        <View
            style={{
                flex: 1,
                backgroundColor: theme.colors.background,
                justifyContent: "center",
                alignItems: "center",
                paddingHorizontal: 24,
            }}
        >
            <ActivityIndicator
                animating
                size="large"
                color={theme.colors.primary}
            />

            <Text
                variant="titleMedium"
                style={{ marginTop: 16, color: theme.colors.onBackground }}
            >
                {message}
            </Text>

            <Text
                variant="bodyMedium"
                style={{
                    marginTop: 6,
                    color: theme.colors.onSurfaceVariant,
                    textAlign: "center",
                }}
            >
                请稍候，正在为获取内容
            </Text>
        </View>
    );
}

export default LoadingView;
import { Text } from "@/src/ui/primitives";
import { useTheme } from "@/src/ui/theme";
import { View } from "react-native";
import MiuixProgressIndicator from "@/src/components/MiuixProgressIndicator";

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
            <View style={{ width: 160 }}>
                <MiuixProgressIndicator indeterminate />
            </View>

            <Text
                type="headline1"
                weight="medium"
                style={{ marginTop: 16, color: theme.colors.onBackground }}
            >
                {message}
            </Text>

            <Text
                type="body2"
                style={{
                    marginTop: 6,
                    color: theme.colors.onSurfaceVariantSummary,
                    textAlign: "center",
                }}
            >
                请稍候，正在为获取内容
            </Text>
        </View>
    );
}

export default LoadingView;

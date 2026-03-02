import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useRef, useState } from "react";
import { Animated, Pressable, View } from "react-native";
import { Snackbar, useTheme } from "react-native-paper";

type VoteUpProps = {
    voteCount: number;
    voted: boolean | number;
    onPress?: () => void;
};

export default function VoteUp({ voteCount, voted, onPress }: VoteUpProps) {
    const theme = useTheme();
    const [snackVisible, setSnackVisible] = useState(false);
    const [snackText, setSnackText] = useState("");
    const scale = useRef(new Animated.Value(1)).current;

    const playLikeAnimation = () => {
        scale.setValue(1);
        Animated.sequence([
            Animated.timing(scale, {
                toValue: 1.25,
                duration: 120,
                useNativeDriver: true,
            }),
            Animated.spring(scale, {
                toValue: 1,
                useNativeDriver: true,
                damping: 7,
                stiffness: 220,
                mass: 0.6,
            }),
        ]).start();
    };

    const handlePress = () => {
        playLikeAnimation();
        onPress?.();

        if (Boolean(voted)) {
            setSnackText(`已经点赞过了，当前已经有${voteCount}点赞`);
        } else {
            setSnackText(`点赞成功，当前已经有${voteCount}点赞`);
        }

        setSnackVisible(true);
    };

    return (
        <View style={{ alignSelf: "flex-start" }}>
            <Pressable
                onPress={handlePress}
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 4,
                    paddingHorizontal: 2,
                }}
            >
                <Animated.View style={{ transform: [{ scale }] }}>
                    <MaterialCommunityIcons
                        name={Boolean(voted) ? "arrow-up-bold-circle" : "arrow-up-bold-circle-outline"}
                        size={18}
                        color={Boolean(voted) ? theme.colors.primary : theme.colors.onSurfaceVariant}
                    />
                </Animated.View>
            </Pressable>

            <Snackbar
                visible={snackVisible}
                onDismiss={() => setSnackVisible(false)}
                duration={1400}
                style={{ marginBottom: 8 }}
            >
                {snackText}
            </Snackbar>
        </View>
    );
}

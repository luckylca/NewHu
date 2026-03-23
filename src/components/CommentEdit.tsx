import React from "react";
import { Animated, Pressable,View } from "react-native";
import { Appbar, Text } from "react-native-paper";

export default function CommentEdit(visible: boolean,name:string,onClose: () => void) {
    return (
        <View style={{ flex: 1, backgroundColor: "#fff" }}>
            <Text>回复 {name}</Text>
        </View>
    );
}
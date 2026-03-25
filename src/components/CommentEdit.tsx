import React, { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from "react-native";
import { Appbar, Button, useTheme } from "react-native-paper";
import { submitComment } from "../api/ZhihuApi";

const { height } = Dimensions.get("window");

export default function CommentEdit(visible: boolean, name: string, contentType: string, contentId: string, replyCommentId: string, onClose: () => void) {
    const theme = useTheme();
    const [content, setContent] = useState("");
    const slideAnim = useRef(new Animated.Value(height)).current;

    useEffect(() => {
        if (visible) {
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                speed: 14,
                bounciness: 4,
            }).start();
        } else {
            // onClose 时可以加退出动画，但通常父组件立刻销毁，所以直接设回
            slideAnim.setValue(height);
        }
    }, [visible, slideAnim]);

    if (!visible) return null;

    const handleSend = () => {
        if (!content.trim()) return;
        console.log("Submit comment:", content);
        // 调用发表评论的 API
        submitComment({
            contentType: contentType,
            contentId: contentId,
            text: content,
            replyCommentId: replyCommentId || undefined // 发送被回复的评论 ID
        }).then((res) => {
            console.log("Comment submitted successfully:", res);
            setContent("");
            onClose();
        });
    };

    return (
        <Animated.View style={{ flex: 1, transform: [{ translateY: slideAnim }] }}>
            <KeyboardAvoidingView 
                style={{ flex: 1, backgroundColor: theme.colors.background }}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <Appbar.Header style={{ backgroundColor: theme.colors.surface }}>
                    <Appbar.Action icon="close" onPress={onClose} />
                    <Appbar.Content title={name ? `回复 ${name}` : "回复回答"} />
                    <Button 
                        mode="contained" 
                        onPress={handleSend}
                        disabled={!content.trim()}
                        style={{ marginRight: 16 }}
                    >
                        发表
                    </Button>
                </Appbar.Header>

                <View style={{ flex: 1, padding: 16 }}>
                    <TextInput
                        style={[styles.input, { color: theme.colors.onSurface }]}
                        placeholder={name ? `回复 ${name}...` : "撰写你的评论..."}
                        placeholderTextColor={theme.colors.onSurfaceVariant}
                        multiline
                        autoFocus
                        value={content}
                        onChangeText={setContent}
                        textAlignVertical="top"
                    />
                </View>
            </KeyboardAvoidingView>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    input: {
        flex: 1,
        fontSize: 16,
        lineHeight: 24,
    },
});
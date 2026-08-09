import { useTheme } from '@/src/theme/ThemeProvider';
import React from 'react';
import type { ReactNode } from 'react';
import { Modal, Pressable, StyleProp, StyleSheet, TextStyle, View, ViewStyle } from 'react-native';
import { Text } from './Text';

export interface AppDialogProps {
    visible: boolean;
    onDismiss?: () => void;
    style?: StyleProp<ViewStyle>;
    children?: ReactNode;
}

function DialogBase({ visible, onDismiss, style, children }: AppDialogProps) {
    const theme = useTheme();
    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onDismiss}>
            <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
            {/* box-none：点击卡片外区域落到背景 Pressable，点卡片内部则交给卡片 */}
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} pointerEvents="box-none">
                <View
                    style={[
                        {
                            backgroundColor: theme.colors.surface,
                            borderRadius: 28,
                            elevation: 24,
                            shadowColor: '#000',
                            shadowOpacity: 0.3,
                            shadowRadius: 12,
                            shadowOffset: { width: 0, height: 6 },
                            overflow: 'hidden',
                            width: '80%',
                            maxWidth: 480,
                        },
                        style,
                    ]}
                >
                    {children}
                </View>
            </View>
        </Modal>
    );
}

function DialogTitle({ style, children }: { style?: StyleProp<TextStyle>; children?: ReactNode }) {
    return (
        <Text variant="headlineSmall" style={[{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 }, style]}>
            {children}
        </Text>
    );
}

function DialogContent({ style, children }: { style?: StyleProp<ViewStyle>; children?: ReactNode }) {
    return <View style={[{ paddingHorizontal: 24, paddingBottom: 20 }, style]}>{children}</View>;
}

function DialogActions({ style, children }: { style?: StyleProp<ViewStyle>; children?: ReactNode }) {
    return (
        <View style={[{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingBottom: 16 }, style]}>
            {children}
        </View>
    );
}

export const Dialog = Object.assign(DialogBase, {
    Title: DialogTitle,
    Content: DialogContent,
    Actions: DialogActions,
});

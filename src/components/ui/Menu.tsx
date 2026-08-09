import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/ThemeProvider';
import React, { isValidElement, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Modal, Pressable, StyleProp, StyleSheet, Text as RNText, TextStyle, View, ViewStyle, useWindowDimensions } from 'react-native';

export type MenuAnchor = React.ReactElement | { x: number; y: number };

export interface AppMenuProps {
    visible: boolean;
    onDismiss: () => void;
    /** 支持两种锚点：React 元素（测量其位置弹出）或坐标 {x, y}（长按菜单） */
    anchor?: MenuAnchor;
    style?: StyleProp<ViewStyle>;
    children?: ReactNode;
}

function MenuBase({ visible, onDismiss, anchor, style, children }: AppMenuProps) {
    const theme = useTheme();
    const { width: winW, height: winH } = useWindowDimensions();
    const anchorRef = useRef<View>(null);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const [size, setSize] = useState({ w: 0, h: 0 });
    const isCoord = !isValidElement(anchor);
    const coord = isCoord ? ((anchor ?? { x: 0, y: 0 }) as { x: number; y: number }) : { x: 0, y: 0 };

    // 只在 visible 由 false -> true 时测量一次，避免 anchor 每次渲染都是新引用导致死循环
    useEffect(() => {
        if (!visible) return;
        setSize({ w: 0, h: 0 }); // 先清零，避免用上一次的旧尺寸做 clamp
        if (isCoord) {
            setPos(coord);
        } else {
            anchorRef.current?.measureInWindow((x, y, _w, h) => {
                setPos((prev) => (prev.x === x && prev.y === y + h ? prev : { x, y: y + h }));
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    const left = Math.max(8, Math.min(pos.x, winW - size.w - 8));
    const top = Math.max(8, Math.min(pos.y, winH - size.h - 8));

    return (
        <>
            {!isCoord && (
                <View ref={anchorRef} collapsable={false}>
                    {anchor}
                </View>
            )}
            <Modal transparent visible={visible} animationType="fade" onRequestClose={onDismiss}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
                <View
                    onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
                    style={[
                        {
                            position: 'absolute',
                            left,
                            top,
                            minWidth: 120,
                            borderRadius: 8,
                            paddingVertical: 4,
                            backgroundColor: theme.colors.surface,
                            elevation: 8,
                            shadowColor: '#000',
                            shadowOpacity: 0.15,
                            shadowRadius: 10,
                            shadowOffset: { width: 0, height: 4 },
                            overflow: 'hidden',
                        },
                        style,
                    ]}
                >
                    {children}
                </View>
            </Modal>
        </>
    );
}

export interface AppMenuItemProps {
    title?: string;
    /** 字符串图标名，或返回 React 元素的函数（与原 RNP 行为一致） */
    leadingIcon?: string | (() => ReactNode);
    disabled?: boolean;
    onPress?: () => void;
    style?: StyleProp<ViewStyle>;
    titleStyle?: StyleProp<TextStyle>;
}

function MenuItem({ title, leadingIcon, disabled, onPress, style, titleStyle }: AppMenuItemProps) {
    const theme = useTheme();
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            android_ripple={{ color: 'rgba(0,0,0,0.08)' }}
            style={[
                { height: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, opacity: disabled ? 0.4 : 1 },
                style,
            ]}
        >
            {leadingIcon != null && (
                <View style={{ width: 32, marginRight: 8, alignItems: 'center', justifyContent: 'center' }}>
                    {typeof leadingIcon === 'function' ? (
                        leadingIcon()
                    ) : (
                        <MaterialCommunityIcons
                            name={leadingIcon as any}
                            size={20}
                            color={disabled ? theme.colors.onSurfaceDisabled : theme.colors.onSurfaceVariant}
                        />
                    )}
                </View>
            )}
            {title != null && (
                <RNText style={[{ color: theme.colors.onSurface, fontSize: 16 }, titleStyle]} numberOfLines={1}>
                    {title}
                </RNText>
            )}
        </Pressable>
    );
}

export const Menu = Object.assign(MenuBase, { Item: MenuItem });

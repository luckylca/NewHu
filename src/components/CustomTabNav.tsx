import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Keyboard, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface tabRoute {
    key: string;
    title: string;
    icon: string;
}

interface customTabNavProps {
    activeIndex: number;
    onIndexChange: (index: number) => void;
    routes: tabRoute[];
    visible?: boolean;
}

const { width } = Dimensions.get('window');

const TabItem = ({ route, index, activeIndex, onIndexChange, theme }: any) => {

    const isFocused = activeIndex === index;
    const onPress = () => {
        if (!isFocused) {
            onIndexChange(index);
        }
    };
    // Tab Item Animation
    const scale = useRef(new Animated.Value(0)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.spring(scale, {
                toValue: isFocused ? 1 : 0.9,
                useNativeDriver: true,
            }),
            Animated.timing(opacity, {
                toValue: isFocused ? 1 : 0.7,
                duration: 200,
                useNativeDriver: true,
            })
        ]).start();
    }, [isFocused, opacity, scale]);

    return (
        <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            onPress={onPress}
            style={styles.tabItem}
            activeOpacity={0.8}
        >
            <Animated.View style={{ transform: [{ scale }], opacity, alignItems: 'center' }}>
                <MaterialCommunityIcons
                    name={route.icon}
                    size={24}
                    color={isFocused ? theme.colors.primary : theme.colors.onSurfaceVariant}
                />
                {isFocused && (
                    <Animated.View style={{ opacity }}>
                        <Text variant="labelSmall" style={{ color: theme.colors.primary, fontWeight: 'bold', marginTop: 2 }}>
                            {route.title}
                        </Text>
                    </Animated.View>
                )}
            </Animated.View>
        </TouchableOpacity>
    );
};

const CustomTabNav = ({ activeIndex, onIndexChange, routes, visible = true }: customTabNavProps) => {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const [keyboardVisible, setKeyboardVisible] = useState(false);

    // Animation for active tab indicator
    const translateValue = useRef(new Animated.Value(0)).current;
    const visibilityAnim = useRef(new Animated.Value(1)).current;

    // Calculate tab width based on number of tabs
    const tabWidth = (width - 40) / routes.length;

    useEffect(() => {
        const keyboardDidShowListener = Keyboard.addListener(
            'keyboardDidShow',
            () => setKeyboardVisible(true)
        );
        const keyboardDidHideListener = Keyboard.addListener(
            'keyboardDidHide',
            () => setKeyboardVisible(false)
        );

        return () => {
            keyboardDidHideListener.remove();
            keyboardDidShowListener.remove();
        };
    }, []);

    useEffect(() => {
        Animated.spring(translateValue, {
            toValue: activeIndex * tabWidth,
            useNativeDriver: true,
            damping: 15,
            mass: 1,
            stiffness: 100,
        }).start();
    }, [activeIndex, tabWidth, translateValue]);

    useEffect(() => {
        Animated.timing(visibilityAnim, {
            toValue: visible ? 1 : 0,
            duration: 180,
            useNativeDriver: true,
        }).start();
    }, [visible, visibilityAnim]);

    if (keyboardVisible) return null; // Hide tab bar when keyboard is open

    return (
        <Animated.View
            pointerEvents={visible ? 'auto' : 'none'}
            style={[
                styles.container,
                {
                    bottom: 20 + insets.bottom,
                    opacity: visibilityAnim,
                    transform: [{ translateY: visibilityAnim.interpolate({ inputRange: [0, 1], outputRange: [100, 0] }) }],
                },
            ]}
        >
            <View style={[styles.tabBar, { backgroundColor: theme.colors.elevation.level3, shadowColor: theme.colors.shadow }]}>
                {/* Animated Indicator */}
                <Animated.View
                    style={[
                        styles.activeTab,
                        {
                            width: tabWidth - 10, // Slightly smaller than tab width
                            transform: [{ translateX: translateValue }],
                            backgroundColor: theme.colors.primaryContainer,
                        },
                    ]}
                />

                {routes.map((route, index) => (
                    <TabItem
                        key={route.key}
                        onIndexChange={onIndexChange}
                        route={route}
                        index={index}
                        activeIndex={activeIndex}
                        theme={theme}
                    />
                ))}
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 20,
        right: 20,
        alignItems: 'center',
    },
    tabBar: {
        flexDirection: 'row',
        height: 60,
        borderRadius: 30,
        elevation: 5,
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        alignItems: 'center',
        paddingHorizontal: 5, // Inner padding for the indicator
        width: '100%',
    },
    tabItem: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        zIndex: 1,
    },
    activeTab: {
        position: 'absolute',
        height: 60,
        borderRadius: 30,
        left: 5, // Match paddingHorizontal
    },
});

export default CustomTabNav;
export type { tabRoute };

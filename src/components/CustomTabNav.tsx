import { Icon, NavigationBar } from '@/src/ui';
import type { IconName } from '@/src/ui/primitives';
import { useTheme } from '@/src/ui/theme';
import { GlassTabBar } from '@newhu/react-native-liquid-glass';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface tabRoute {
    key: string;
    title: string;
    icon: string;
}

interface customTabNavProps {
    activeIndex: number;
    onIndexChange: (index: number) => void;
    onDoubleSelect?: (index: number) => void;
    routes: tabRoute[];
}

const CustomTabNav = ({ activeIndex, onIndexChange, onDoubleSelect, routes }: customTabNavProps) => {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const lastTapRef = useRef({ index: -1, time: 0 });

    const handleSelect = useCallback((index: number) => {
        const now = Date.now();
        const lastTap = lastTapRef.current;
        if (lastTap.index === index && now - lastTap.time <= 300) {
            lastTapRef.current = { index: -1, time: 0 };
            onDoubleSelect?.(index);
        } else {
            lastTapRef.current = { index, time: now };
        }
        onIndexChange(index);
    }, [onDoubleSelect, onIndexChange]);

    const handleDragSelect = useCallback((index: number) => {
        lastTapRef.current = { index: -1, time: 0 };
        onIndexChange(index);
    }, [onIndexChange]);

    const renderTabIcon = useCallback((index: number, selected: boolean, size = 26) => (
        <Icon
            name={routes[index].icon as IconName}
            size={size}
            color={theme.glass.enabled && selected ? theme.colors.primary : theme.colors.onSurfaceContainer}
        />
    ), [routes, theme.colors.onSurfaceContainer, theme.colors.primary, theme.glass.enabled]);

    useEffect(() => {
        const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
        const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
        return () => {
            show.remove();
            hide.remove();
        };
    }, []);

    if (keyboardVisible) return null;

    if (theme.glass.enabled) {
        return (
            <GlassTabBar
                items={routes.map((route) => ({ label: route.title }))}
                selected={activeIndex}
                bottomInset={insets.bottom}
                shellBackgroundColor={theme.colors.surfaceContainerHigh}
                onSelect={handleSelect}
                onSelectFromDrag={handleDragSelect}
                renderIcon={(_, index, selected) => renderTabIcon(index, selected)}
            />
        );
    }

    return (
        <NavigationBar
            items={routes.map((route) => ({ label: route.title }))}
            selected={activeIndex}
            onSelect={handleSelect}
            renderIcon={(_, index) => renderTabIcon(index, false)}
        />
    );
};

export default CustomTabNav;
export type { tabRoute };

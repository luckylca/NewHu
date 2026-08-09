import { Icon, NavigationBar } from '@/src/ui';
import type { IconName } from '@/src/ui/primitives';
import { useTheme } from '@/src/ui/theme';
import React, { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

interface tabRoute {
    key: string;
    title: string;
    icon: string;
}

interface customTabNavProps {
    activeIndex: number;
    onIndexChange: (index: number) => void;
    routes: tabRoute[];
}

const CustomTabNav = ({ activeIndex, onIndexChange, routes }: customTabNavProps) => {
    const theme = useTheme();
    const [keyboardVisible, setKeyboardVisible] = useState(false);

    useEffect(() => {
        const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
        const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
        return () => {
            show.remove();
            hide.remove();
        };
    }, []);

    if (keyboardVisible) return null;

    return (
        <NavigationBar
            items={routes.map((route) => ({ label: route.title }))}
            selected={activeIndex}
            onSelect={onIndexChange}
            renderIcon={(_, index) => (
                <Icon
                    name={routes[index].icon as IconName}
                    size={26}
                    color={theme.colors.onSurfaceContainer}
                />
            )}
        />
    );
};

export default CustomTabNav;
export type { tabRoute };

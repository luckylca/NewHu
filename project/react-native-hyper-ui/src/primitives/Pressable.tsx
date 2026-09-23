import React from 'react';
import { Pressable as NativePressable } from 'react-native';
import type { PressableProps, PressableStateCallbackType } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useTheme } from '../theme';
import { PressIndication } from './PressIndication';

export interface AppPressableProps extends PressableProps {
    /** Render the standard Miuix alpha overlay while this surface is pressed. */
    showIndication?: boolean;
    indicationColor?: string;
    indicationRadius?: number;
}

/** Generic Hyper tap surface for interactions without a semantic Button/ListRow/Card. */
export function Pressable({
    showIndication = true,
    indicationColor,
    indicationRadius,
    disabled,
    ...rest
}: AppPressableProps) {
    if (!showIndication || disabled || (!rest.onPress && !rest.onLongPress)) {
        return <NativePressable {...rest} disabled={disabled} />;
    }

    return (
        <InteractivePressable
            {...rest}
            disabled={disabled}
            indicationColor={indicationColor}
            indicationRadius={indicationRadius}
        />
    );
}

function InteractivePressable({
    indicationColor,
    indicationRadius,
    onPressIn,
    onPressOut,
    disabled,
    children,
    ...rest
}: Omit<AppPressableProps, 'showIndication'>) {
    const theme = useTheme();
    const pressed = useSharedValue(0);
    const renderChildren = (state: PressableStateCallbackType) => (
        <>
            {typeof children === 'function' ? children(state) : children}
            <PressIndication
                pressed={pressed}
                color={indicationColor ?? theme.colors.onBackground}
                radius={indicationRadius}
            />
        </>
    );

    return (
        <NativePressable
            {...rest}
            disabled={disabled}
            onPressIn={(event) => {
                pressed.value = 1;
                onPressIn?.(event);
            }}
            onPressOut={(event) => {
                pressed.value = 0;
                onPressOut?.(event);
            }}
        >
            {renderChildren}
        </NativePressable>
    );
}

import React from 'react';
import { Switch as RNSwitch, SwitchProps } from 'react-native';

export interface AppSwitchProps extends SwitchProps {
    /** 原 RNP Switch 的 color：开启时轨道颜色 */
    color?: string;
}

export function Switch({ color, trackColor, ...rest }: AppSwitchProps) {
    return <RNSwitch {...rest} trackColor={color ? { true: color, ...(trackColor as object) } : trackColor} />;
}

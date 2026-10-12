import React from 'react';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { PreferenceGroup } from '../PreferenceGroup';

export interface SettingsSectionProps {
    title: string;
    children: ReactNode;
    style?: StyleProp<ViewStyle>;
}

export const SettingsSection = React.memo(function SettingsSection({ title, children, style }: SettingsSectionProps) {
    return (
        <PreferenceGroup title={title} style={style}>
            {children}
        </PreferenceGroup>
    );
});

SettingsSection.displayName = 'HyperSettingsSection';

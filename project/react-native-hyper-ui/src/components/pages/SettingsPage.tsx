import React, { useMemo } from 'react';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import type { ScrollViewProps, StyleProp, ViewStyle } from 'react-native';
import { PageScaffold, PageSettingsList } from '../PageScaffold';
import { TopAppBar } from '../TopAppBar';

export interface SettingsPageSection {
    key: string;
    node: React.ReactElement;
}

export interface SettingsPageProps {
    title: string;
    back?: () => void;
    actions?: ReactNode;
    sections: readonly SettingsPageSection[];
    footer?: ReactNode;
    overlays?: ReactNode;
    contentContainerStyle?: StyleProp<ViewStyle>;
    keyboardShouldPersistTaps?: ScrollViewProps['keyboardShouldPersistTaps'];
    showsVerticalScrollIndicator?: boolean;
    testID?: string;
}

export const SettingsPage = React.memo(function SettingsPage({
    title,
    back,
    actions,
    sections,
    footer,
    overlays,
    contentContainerStyle,
    keyboardShouldPersistTaps,
    showsVerticalScrollIndicator,
    testID,
}: SettingsPageProps) {
    const footerElement = useMemo(() => footer == null ? null : <View>{footer}</View>, [footer]);

    return (
        <PageScaffold topBar={<TopAppBar title={title} back={back} actions={actions} />}>
            <PageSettingsList
                sections={sections}
                contentContainerStyle={contentContainerStyle}
                keyboardShouldPersistTaps={keyboardShouldPersistTaps}
                showsVerticalScrollIndicator={showsVerticalScrollIndicator}
                ListFooterComponent={footerElement}
                testID={testID ? `${testID}-scroll` : undefined}
            />
            {overlays}
        </PageScaffold>
    );
});

SettingsPage.displayName = 'HyperSettingsPage';

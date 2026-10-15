import React from 'react';
import type { ReactElement, ReactNode } from 'react';
import type { ScrollViewProps, StyleProp, ViewStyle } from 'react-native';
import { PageScaffold, PageScrollView } from '../PageScaffold';
import type { PageScaffoldProps, PageScrollViewProps } from '../PageScaffold';
import { TopAppBar } from '../TopAppBar';

export interface StaticSettingsPageProps extends Omit<PageScrollViewProps, 'children' | 'contentContainerStyle'> {
    title: string;
    back?: () => void;
    actions?: ReactNode;
    topBar?: ReactElement | null;
    contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
    footer?: ReactNode;
    overlays?: ReactNode;
    scaffoldStyle?: StyleProp<ViewStyle>;
    routeBackdropCaptureEnabled?: boolean;
    children: ReactNode;
}

/** Small settings and information routes share one non-virtualized scroll template. */
export const StaticSettingsPage = React.memo(function StaticSettingsPage({
    title,
    back,
    actions,
    topBar,
    contentContainerStyle,
    footer,
    overlays,
    scaffoldStyle,
    routeBackdropCaptureEnabled = true,
    children,
    ...scrollProps
}: StaticSettingsPageProps) {
    return (
        <PageScaffold
            topBar={topBar === undefined ? <TopAppBar title={title} back={back} actions={actions} /> : topBar}
            routeBackdropCaptureEnabled={routeBackdropCaptureEnabled}
            style={scaffoldStyle}
        >
            <PageScrollView contentContainerStyle={contentContainerStyle} {...scrollProps}>
                {children}
                {footer}
            </PageScrollView>
            {overlays}
        </PageScaffold>
    );
});

StaticSettingsPage.displayName = 'HyperStaticSettingsPage';

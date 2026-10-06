import React, { createContext, useContext, useMemo } from 'react';
import { RouteGlassCaptureScope, RouteGlassCaptureSource } from '@newhu/react-native-liquid-glass';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import type { FlatListProps, ListRenderItem, ScrollViewProps, StyleProp, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';

const ContentInsetContext = createContext(0);

/** Read the current page's theme-resolved initial content inset. */
export function usePageContentInset() {
    return useContext(ContentInsetContext);
}

export interface PageScaffoldProps {
    topBar?: React.ReactNode;
    /** Full top bar height, including the safe area. Defaults to the compact bar. */
    topBarHeight?: number;
    /** Search or another theme-governed functional accessory. */
    searchAccessory?: React.ReactNode;
    searchAccessoryHeight?: number;
    searchAccessoryTopSpacing?: number;
    searchAccessoryBottomSpacing?: number;
    style?: StyleProp<ViewStyle>;
    children: React.ReactNode;
}

/** Applies theme-level page composition while keeping page content shared. */
export const PageScaffold = React.memo(function PageScaffold({
    topBar,
    topBarHeight,
    searchAccessory,
    searchAccessoryHeight,
    searchAccessoryTopSpacing,
    searchAccessoryBottomSpacing,
    style,
    children,
}: PageScaffoldProps) {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const floatingTopBar = theme.presentation.topBar.mode === 'floating';
    const floatingSearch = theme.presentation.search.defaultMode === 'floating';
    const resolvedTopBarHeight = topBarHeight ?? insets.top + theme.components.navigationBar.topBarCollapsedHeight;
    const topBarInset = topBar && floatingTopBar && theme.presentation.topBar.contentUnderlay ? resolvedTopBarHeight : 0;
    const accessoryHeight = searchAccessoryHeight ?? theme.components.searchBar.minHeight;
    const accessoryTopSpacing = searchAccessoryTopSpacing ?? theme.spacing.sm;
    const accessoryBottomSpacing = searchAccessoryBottomSpacing ?? theme.spacing.sm;
    const searchInset = searchAccessory && floatingSearch
        ? insets.top + accessoryTopSpacing + accessoryHeight + accessoryBottomSpacing
        : 0;
    const contentInset = topBarInset + searchInset;
    const transparentPage = theme.presentation.page.background === 'transparent';

    return (
        <RouteGlassCaptureScope>
        <View style={[{ flex: 1, backgroundColor: theme.colors.surface }, style, transparentPage ? { backgroundColor: 'transparent' } : undefined]}>
            <View
                pointerEvents="box-none"
                style={floatingTopBar ? { position: 'absolute', left: 0, right: 0, top: 0, zIndex: 20 } : undefined}
            >
                {topBar}
            </View>
            {searchAccessory ? (
                <View
                    pointerEvents={floatingSearch ? 'box-none' : 'auto'}
                    style={floatingSearch
                        ? { position: 'absolute', left: 0, right: 0, top: insets.top + accessoryTopSpacing, zIndex: 10 }
                        : { paddingTop: insets.top + accessoryTopSpacing, paddingBottom: accessoryBottomSpacing }}
                >
                    {searchAccessory}
                </View>
            ) : null}
            <ContentInsetContext.Provider value={contentInset}>
                <View style={{ flex: 1 }}>
                    <RouteGlassCaptureSource>{children}</RouteGlassCaptureSource>
                </View>
            </ContentInsetContext.Provider>
        </View>
        </RouteGlassCaptureScope>
    );
});

/** ScrollView that reserves the initial space below a floating TopAppBar. */
export interface PageScrollViewProps extends ScrollViewProps {
    pageScrollRef?: React.Ref<ScrollView>;
}

export function PageScrollView({ pageScrollRef, contentContainerStyle, ...props }: PageScrollViewProps) {
    const inset = usePageContentInset();
    const adjustedStyle = useMemo(() => withTopInset(contentContainerStyle, inset), [contentContainerStyle, inset]);
    return <ScrollView {...props} ref={pageScrollRef} style={[styles.scroll, props.style]} contentContainerStyle={adjustedStyle} />;
}

/** FlatList equivalent of PageScrollView for pages built around virtualized data. */
export interface PageFlatListProps<ItemT> extends FlatListProps<ItemT> {
    listRef?: React.Ref<FlatList<ItemT>>;
}

export function PageFlatList<ItemT>({ listRef, ...props }: PageFlatListProps<ItemT>) {
    const inset = usePageContentInset();
    const adjustedStyle = useMemo(() => withTopInset(props.contentContainerStyle, inset), [props.contentContainerStyle, inset]);
    return (
        <FlatList
            {...props}
            ref={listRef}
            initialNumToRender={props.initialNumToRender ?? 5}
            maxToRenderPerBatch={props.maxToRenderPerBatch ?? 5}
            windowSize={props.windowSize ?? 5}
            updateCellsBatchingPeriod={props.updateCellsBatchingPeriod ?? 48}
            removeClippedSubviews={props.removeClippedSubviews ?? true}
            style={[styles.scroll, props.style]}
            contentContainerStyle={adjustedStyle}
        />
    );
}

export interface PageSettingsSection {
    key: string;
    node: React.ReactNode;
}

const renderPageSettingsSection: ListRenderItem<PageSettingsSection> = ({ item }) => <>{item.node}</>;

export interface PageSettingsListProps extends Omit<FlatListProps<PageSettingsSection>, 'data' | 'renderItem' | 'keyExtractor'> {
    sections: PageSettingsSection[];
    listRef?: React.Ref<FlatList<PageSettingsSection>>;
}

/** Virtualizes settings by complete visual group so grouped surfaces stay intact. */
export function PageSettingsList({ sections, listRef, contentContainerStyle, ...props }: PageSettingsListProps) {
    const inset = usePageContentInset();
    const adjustedStyle = useMemo(() => withTopInset(contentContainerStyle, inset), [contentContainerStyle, inset]);
    return (
        <FlatList
            {...props}
            ref={listRef}
            data={sections}
            keyExtractor={(section) => section.key}
            renderItem={renderPageSettingsSection}
            initialNumToRender={props.initialNumToRender ?? 2}
            maxToRenderPerBatch={props.maxToRenderPerBatch ?? 2}
            windowSize={props.windowSize ?? 3}
            removeClippedSubviews={props.removeClippedSubviews ?? false}
            style={[styles.scroll, props.style]}
            contentContainerStyle={adjustedStyle}
        />
    );
}

/** Non-scrolling page content that also clears a floating TopAppBar. */
export function PageContent({ style, children }: { style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
    const inset = usePageContentInset();
    const adjustedStyle = useMemo(() => withTopInset(style, inset), [style, inset]);
    return <View style={adjustedStyle}>{children}</View>;
}

function withTopInset(style: ScrollViewProps['contentContainerStyle'] | FlatListProps<unknown>['contentContainerStyle'], inset: number) {
    if (inset <= 0) return style;
    const flattened = StyleSheet.flatten(style) ?? {};
    const currentTop = typeof flattened.paddingTop === 'number' ? flattened.paddingTop : 0;
    return [style, { paddingTop: currentTop + inset }];
}

const styles = StyleSheet.create({
    scroll: { flex: 1 },
});

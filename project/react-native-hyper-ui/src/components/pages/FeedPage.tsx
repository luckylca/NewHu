import React from 'react';
import type { ReactElement, ReactNode } from 'react';
import type { FlashListProps, ListRenderItem } from '@shopify/flash-list';
import type { ScrollViewProps, StyleProp, ViewStyle } from 'react-native';
import { PageFeedList } from '../PageFeedList';
import { PageScaffold } from '../PageScaffold';
import { TopAppBar } from '../TopAppBar';

export interface FeedPageProps<ItemT> {
    title?: string;
    back?: () => void;
    actions?: ReactNode;
    topBar?: ReactElement | null;
    searchAccessory?: ReactNode;
    searchAccessoryHeight?: number;
    searchAccessoryTopSpacing?: number;
    searchAccessoryBottomSpacing?: number;
    data?: readonly ItemT[];
    renderItem?: ListRenderItem<ItemT>;
    keyExtractor?: NonNullable<FlashListProps<ItemT>['keyExtractor']>;
    header?: ReactElement | null;
    footer?: ReactElement | null;
    refreshing?: boolean;
    onRefresh?: () => void;
    onEndReached?: () => void;
    onEndReachedThreshold?: number;
    onScrollBeginDrag?: FlashListProps<ItemT>['onScrollBeginDrag'];
    emptyContent?: ReactElement | null;
    contentContainerStyle?: StyleProp<ViewStyle>;
    keyboardShouldPersistTaps?: ScrollViewProps['keyboardShouldPersistTaps'];
    testID?: string;
    children?: ReactNode;
}

/** Shared Feed route shell and list runtime. Custom feed layouts may supply children. */
export function FeedPage<ItemT>({
    title,
    back,
    actions,
    topBar,
    searchAccessory,
    searchAccessoryHeight,
    searchAccessoryTopSpacing,
    searchAccessoryBottomSpacing,
    data,
    renderItem,
    keyExtractor,
    header,
    footer,
    refreshing,
    onRefresh,
    onEndReached,
    onEndReachedThreshold,
    onScrollBeginDrag,
    emptyContent,
    contentContainerStyle,
    keyboardShouldPersistTaps,
    testID,
    children,
}: FeedPageProps<ItemT>) {
    const feedList = data != null && renderItem != null && keyExtractor != null ? (
        <PageFeedList
            data={data}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            ListHeaderComponent={header}
            ListFooterComponent={footer}
            ListEmptyComponent={emptyContent}
            refreshing={refreshing}
            onRefresh={onRefresh}
            onEndReached={onEndReached}
            onEndReachedThreshold={onEndReachedThreshold}
            onScrollBeginDrag={onScrollBeginDrag}
            contentContainerStyle={[{ flexGrow: 1 }, contentContainerStyle]}
            keyboardShouldPersistTaps={keyboardShouldPersistTaps}
            testID={testID}
        />
    ) : null;

    return (
        <PageScaffold
            topBar={topBar === undefined
                ? title == null ? undefined : <TopAppBar title={title} back={back} actions={actions} />
                : topBar}
            searchAccessory={searchAccessory}
            searchAccessoryHeight={searchAccessoryHeight}
            searchAccessoryTopSpacing={searchAccessoryTopSpacing}
            searchAccessoryBottomSpacing={searchAccessoryBottomSpacing}
        >
            {children ?? feedList}
        </PageScaffold>
    );
}

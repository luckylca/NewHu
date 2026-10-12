import React, { useMemo } from 'react';
import { FlashList } from '@shopify/flash-list';
import { StyleSheet } from 'react-native';
import type { FlashListProps } from '@shopify/flash-list';
import { usePageContentInset, withTopInset } from './PageScaffold';

/** Shared virtualized runtime for recycled feed cards. */
export interface PageFeedListProps<ItemT> extends FlashListProps<ItemT> {}

/** Feed list with the same page inset and route capture as other page content. */
export function PageFeedList<ItemT>({ testID, contentContainerStyle, style, ...props }: PageFeedListProps<ItemT>) {
    const inset = usePageContentInset();
    const adjustedStyle = useMemo(() => withTopInset(contentContainerStyle, inset), [contentContainerStyle, inset]);

    return (
        <FlashList
            {...props}
            testID={testID ? testID.concat('-scroll') : undefined}
            style={[styles.scroll, style]}
            contentContainerStyle={adjustedStyle}
        />
    );
}

const styles = StyleSheet.create({
    scroll: { flex: 1 },
});

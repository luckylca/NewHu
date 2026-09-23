import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Text } from '@/src/ui/primitives';
import { useTheme } from '@/src/ui/theme';

function escapeAttribute(value: string) {
    return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function createPlayerHtml(uri: string, posterUri: string) {
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"><style>
html,body{margin:0;width:100%;height:100%;background:#000;overflow:hidden}video{display:block;width:100%;height:100%;object-fit:contain;background:#000}
</style></head><body><video src="${escapeAttribute(uri)}" poster="${escapeAttribute(posterUri)}" controls playsinline webkit-playsinline preload="metadata"></video></body></html>`;
}

export function VideoPlaybackSurface({ uri, posterUri, loading }: {
    uri: string;
    posterUri?: string;
    loading?: boolean;
}) {
    const theme = useTheme();
    const isZhihuVideoPage = /^https?:\/\/www\.zhihu\.com\/(?:video|zvideo)\//i.test(uri);

    if (loading || !uri) {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
                <ActivityIndicator color={theme.colors.primary} />
                <Text type="footnote1" color="#ffffff" style={{ marginTop: 12 }}>正在加载视频…</Text>
            </View>
        );
    }

    return (
        <WebView
            key={uri}
            source={isZhihuVideoPage ? { uri } : { html: createPlayerHtml(uri, posterUri || ''), baseUrl: 'https://www.zhihu.com/' }}
            style={{ flex: 1, backgroundColor: '#000' }}
            originWhitelist={['*']}
            javaScriptEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction
            scrollEnabled={false}
            bounces={false}
            setSupportMultipleWindows={false}
        />
    );
}

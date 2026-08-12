import { resolveImageUri } from '@/src/services/resourceService';
import { useNetworkStore } from '@/src/stores/useNetworkStore';
import React, { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import type { ImageProps } from 'react-native';

export default function OfflineImage({ source, ...props }: ImageProps) {
    const networkStatus = useNetworkStore((state) => state.status);
    const remoteUri = typeof source === 'object' && source && 'uri' in source ? source.uri : undefined;
    const [uri, setUri] = useState<string | null>(remoteUri || null);

    useEffect(() => {
        let active = true;
        if (!remoteUri) {
            setUri(null);
            return () => { active = false; };
        }
        void resolveImageUri(remoteUri, networkStatus === 'online').then((resolved) => {
            if (active) setUri(resolved);
        });
        return () => { active = false; };
    }, [networkStatus, remoteUri]);

    if (!uri) return <View style={props.style} />;
    return <Image {...props} source={{ uri }} />;
}

import React, { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

interface PortalContextValue {
    mount: (key: string, node: ReactNode) => void;
    unmount: (key: string) => void;
}

const PortalContext = createContext<PortalContextValue | null>(null);

export function usePortalContext() {
    const ctx = useContext(PortalContext);
    if (!ctx) {
        throw new Error('Portal 必须在 PortalHost 内部使用（检查 app/_layout.tsx 是否挂载了 <PortalHost />）');
    }
    return ctx;
}

/**
 * Portal 宿主：在 _layout 中挂载一次，位于 <Stack> 之后，
 * 保证所有 Portal 子节点永远盖在页面之上，且空白区域不拦截触摸。
 */
export function PortalHost({ children }: { children?: ReactNode }) {
    const [portals, setPortals] = useState<Record<string, ReactNode>>({});

    const value = useMemo<PortalContextValue>(
        () => ({
            mount: (key, node) => setPortals((prev) => ({ ...prev, [key]: node })),
            unmount: (key) =>
                setPortals((prev) => {
                    const next = { ...prev };
                    delete next[key];
                    return next;
                }),
        }),
        []
    );

    return (
        <PortalContext.Provider value={value}>
            {children}
            <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
                {Object.values(portals)}
            </View>
        </PortalContext.Provider>
    );
}

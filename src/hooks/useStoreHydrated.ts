import { useEffect, useState } from 'react';

/**
 * 判断某个 persist store 是否已完成异步水合（hydration）。
 *
 * AsyncStorage 的恢复是异步的：冷启动早期从 store 读到的仍是默认值。
 * 任何「依赖持久化数据」的初始化逻辑（例如用 Cookie 初始化 API 单例），
 * 都应该等这个 hook 返回 true 再执行，否则会用到旧的默认值。
 */
export function useStoreHydrated(store: {
    persist: {
        hasHydrated: () => boolean;
        onFinishHydration: (cb: () => void) => () => void;
    };
}) {
    const [hydrated, setHydrated] = useState<boolean>(() => store.persist.hasHydrated());

    useEffect(() => {
        const unsub = store.persist.onFinishHydration(() => setHydrated(true));
        return unsub;
    }, [store]);

    return hydrated;
}

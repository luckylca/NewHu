import { useEffect, useId } from 'react';
import type { ReactNode } from 'react';
import { usePortalContext } from './PortalHost';

/** 把子节点渲染到最上层的 PortalHost（自建 Portal 实现） */
export function Portal({ children }: { children: ReactNode }) {
    const { mount, unmount } = usePortalContext();
    const key = useId();

    useEffect(() => {
        mount(key, children);
        return () => unmount(key);
    }, [mount, unmount, key, children]);

    return null;
}

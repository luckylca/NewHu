import { Menu } from '@/src/ui';
import type { AppMenuItem } from '@/src/ui';
import ImageReanimatedModal from '@/src/components/ImageReanimatedModal';
import React, { createContext, useCallback, useContext, useState } from 'react';

type ImageOrigin = { x: number; y: number; width: number; height: number };
type MenuAnchor = ImageOrigin;

type CommentInteractionContextValue = {
    openImagePreview: (url: string, origin: ImageOrigin) => void;
    openMenu: (anchor: MenuAnchor, items: AppMenuItem[], selectedIndex?: number) => void;
};

const CommentInteractionContext = createContext<CommentInteractionContextValue | null>(null);

/** One image modal and one popup menu serve every mounted comment row on this screen. */
export function CommentInteractionHost({ children }: { children: React.ReactNode }) {
    const [imagePreview, setImagePreview] = useState<{ url: string; origin: ImageOrigin } | null>(null);
    const [imageVisible, setImageVisible] = useState(false);
    const [menu, setMenu] = useState<{ anchor: MenuAnchor; items: AppMenuItem[]; selectedIndex?: number } | null>(null);
    const [menuVisible, setMenuVisible] = useState(false);

    const openImagePreview = useCallback((url: string, origin: ImageOrigin) => {
        setImagePreview({ url, origin });
        setImageVisible(true);
    }, []);
    const openMenu = useCallback((anchor: MenuAnchor, items: AppMenuItem[], selectedIndex?: number) => {
        setMenu({ anchor, items, selectedIndex });
        setMenuVisible(true);
    }, []);
    const closeImagePreview = useCallback(() => setImageVisible(false), []);
    const closeMenu = useCallback(() => setMenuVisible(false), []);
    const contextValue = React.useMemo(() => ({ openImagePreview, openMenu }), [openImagePreview, openMenu]);

    return (
        <CommentInteractionContext.Provider value={contextValue}>
            {children}
            <Menu
                visible={menuVisible}
                onClose={closeMenu}
                anchor={menu?.anchor}
                items={menu?.items}
                selectedIndex={menu?.selectedIndex}
            />
            <ImageReanimatedModal
                url={imagePreview?.url ?? ''}
                origin={imagePreview?.origin ?? { x: 0, y: 0, width: 0, height: 0 }}
                visible={imageVisible}
                onClose={closeImagePreview}
            />
        </CommentInteractionContext.Provider>
    );
}

export function useCommentInteractionHost() {
    return useContext(CommentInteractionContext);
}

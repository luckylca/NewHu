import React, { createContext, useContext } from 'react';

/** Shared visual offset below the status-bar safe area on main tab pages. */
export const MAIN_PAGE_TOP_SPACING = 10;

const MainTabBottomContentInsetContext = createContext(0);

export function MainTabLayoutProvider({ value, children }: { value: number; children: React.ReactNode }) {
    return (
        <MainTabBottomContentInsetContext.Provider value={value}>
            {children}
        </MainTabBottomContentInsetContext.Provider>
    );
}

/** Scroll clearance owned by the main tabs layout, including its safe-area offset. */
export function useMainTabBottomContentInset() {
    return useContext(MainTabBottomContentInsetContext);
}

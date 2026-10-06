import React, { createContext, useContext } from 'react';

export type SurfaceEnvironment = 'page' | 'glassOverlay';

const SurfaceEnvironmentContext = createContext<SurfaceEnvironment>('page');

/** Marks content whose parent is already the large Glass overlay surface. */
export function GlassOverlayContentScope({ children }: { children: React.ReactNode }) {
    return (
        <SurfaceEnvironmentContext.Provider value="glassOverlay">
            {children}
        </SurfaceEnvironmentContext.Provider>
    );
}

export function useSurfaceEnvironment() {
    return useContext(SurfaceEnvironmentContext);
}

import React, { createContext, useContext } from 'react';

const MotionContext = createContext(false);

export function MotionProvider({ reduced, children }: { reduced: boolean; children: React.ReactNode }) {
    return <MotionContext.Provider value={reduced}>{children}</MotionContext.Provider>;
}

/** True when either the operating system or the in-app setting requests less motion. */
export function useReducedMotionPreference() {
    return useContext(MotionContext);
}


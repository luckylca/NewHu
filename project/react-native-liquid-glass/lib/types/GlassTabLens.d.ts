import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
export interface GlassTabLensProps {
    visible: boolean;
    label: string;
    icon: ReactNode;
    labelColor: string;
    style?: StyleProp<ViewStyle>;
}
/** Standalone preview surface for callers that need one; GlassTabBar uses its selection lens instead. */
export declare function GlassTabLens({ visible, label, icon, labelColor, style }: GlassTabLensProps): import("react/jsx-runtime").JSX.Element | null;

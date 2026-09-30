import type { ThemePresentation } from './types';

/** HyperOS keeps navigation and controls inside normal content flow. */
export const hyperosPresentation: ThemePresentation = {
    page: { background: 'surface' },
    topBar: { mode: 'inFlow', material: 'solid', contentUnderlay: false },
    search: { defaultMode: 'inFlow', material: 'solid' },
    bottomNavigation: { style: 'navigationBar', floating: false, selectedIconColor: 'onSurfaceContainer' },
    content: { groupStyle: 'solid', groupMaterial: 'solid', cardMaterial: 'solid', dividerStyle: 'normal', iconStyle: 'filled' },
    controls: { buttonMaterial: 'solid', switchThumb: 'solid', sliderThumb: 'solid', floatingActionForeground: 'onPrimary' },
    overlays: { menu: 'solid', notification: 'solid', floatingAction: 'solid', dialog: 'solid', sheet: 'solid' },
};

/** ColorOS currently reuses HyperOS visuals but remains an independent family entry. */
export const colorosPresentation: ThemePresentation = {
    ...hyperosPresentation,
    page: { ...hyperosPresentation.page },
    topBar: { ...hyperosPresentation.topBar },
    search: { ...hyperosPresentation.search },
    bottomNavigation: { ...hyperosPresentation.bottomNavigation },
    content: { ...hyperosPresentation.content },
    controls: { ...hyperosPresentation.controls },
    overlays: { ...hyperosPresentation.overlays },
};

/** Liquid Glass reserves optical surfaces for navigation and functional controls. */
export const liquidGlassPresentation: ThemePresentation = {
    page: { background: 'transparent' },
    topBar: { mode: 'floating', material: 'glass', contentUnderlay: true },
    search: { defaultMode: 'floating', material: 'glass' },
    bottomNavigation: { style: 'glassTabBar', floating: true, selectedIconColor: 'primary' },
    content: { groupStyle: 'softGrouped', groupMaterial: 'glass', cardMaterial: 'glass', dividerStyle: 'subtle', iconStyle: 'light' },
    controls: { buttonMaterial: 'glass', switchThumb: 'solid', sliderThumb: 'glass', floatingActionForeground: 'onGlass' },
    overlays: { menu: 'glass', notification: 'glass', floatingAction: 'glass', dialog: 'glass', sheet: 'glass' },
};

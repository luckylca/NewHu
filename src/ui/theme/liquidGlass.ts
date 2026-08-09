import { hyperosDarkTheme, hyperosLightTheme } from './hyperos';
import type { AppTheme } from './types';

/**
 * Liquid Glass theme — structural placeholder.
 *
 * Only the structure exists for now (per task §10 / §83): it inherits the
 * HyperOS tokens so the theme switch keeps working. A real Liquid Glass
 * theme should add explicit glass surface variants when the task asks for it.
 *
 * TODO(liquidGlass): implement a real Liquid Glass palette.
 */
const withName = (dark: boolean): AppTheme => ({
    ...(dark ? hyperosDarkTheme : hyperosLightTheme),
    name: 'liquidGlass',
});

export const liquidGlassLightTheme: AppTheme = withName(false);
export const liquidGlassDarkTheme: AppTheme = withName(true);

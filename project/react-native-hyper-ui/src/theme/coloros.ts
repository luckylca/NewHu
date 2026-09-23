import { hyperosDarkTheme, hyperosLightTheme } from './hyperos';
import type { AppTheme } from './types';

/**
 * ColorOS theme — structural placeholder.
 *
 * Only the structure exists for now (per task §10 / §83): it inherits the
 * HyperOS tokens so the theme switch keeps working. A real ColorOS palette
 * should be implemented here when the task explicitly asks for it.
 *
 * TODO(coloros): implement a real ColorOS palette.
 */
const withName = (dark: boolean): AppTheme => ({
    ...(dark ? hyperosDarkTheme : hyperosLightTheme),
    name: 'coloros',
});

export const colorosLightTheme: AppTheme = withName(false);
export const colorosDarkTheme: AppTheme = withName(true);

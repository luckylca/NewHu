import { useTheme } from './useTheme';
import type { ComponentTokens } from '../theme';

/**
 * Read the current theme's component tokens (Button / Card / Switch /
 * SearchBar / TabRow / NavigationBar / BottomSheet / Dialog geometry).
 *
 *   const c = useComponentStyles();
 *   c.button.radius  // 16
 *
 * This is sugar over useTheme().components — pages and components should take
 * geometry from here instead of hardcoding numbers.
 */
export function useComponentStyles(): ComponentTokens {
    return useTheme().components;
}

import { folmeSpring } from './folmeSpring';

/**
 * Miuix `folmeSpring(damping, response)` — response-based spring spec.
 *
 *   stiffness = (2π / response)²
 *
 * Visual reference:
 *   miuix-vue/src/anim/folmeSpring.ts (`folmeSpringByResponse`)
 *   miuix `anim/MiuixEasing.kt` folmeSpring(damping, response)
 *
 * Used by e.g. TopAppBar small-title (1.0 / 0.3, 1.0 / 0.15), Dialog
 * large enter (0.9 / 0.3) and BottomSheet enter (0.9 / 0.38) / settle
 * (0.85 / 0.4).
 */
export function folmeSpringByResponse(damping: number, response: number) {
    const stiffness = (2 * Math.PI) / response;
    return folmeSpring(damping, stiffness * stiffness);
}

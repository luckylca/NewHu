import type { WithSpringConfig } from 'react-native-reanimated';

/**
 * Miuix folme spring — converts the Compose-style
 * `spring(dampingRatio, stiffness)` spec to a Reanimated spring config.
 *
 *   damping = 2 * dampingRatio * sqrt(stiffness)   (mass = 1)
 *
 * Visual reference:
 *   miuix-vue/src/anim/folmeSpring.ts (motion-v spring conversion)
 *   miuix `anim/Spring.kt` spring(dampingRatio, stiffness)
 *
 * ⚠️ Use the exact (dampingRatio, stiffness) pairs from the reference
 * components — never approximate them.
 */
export function folmeSpring(dampingRatio: number, stiffness: number): WithSpringConfig {
    return {
        damping: 2 * dampingRatio * Math.sqrt(stiffness),
        stiffness,
        mass: 1,
    };
}

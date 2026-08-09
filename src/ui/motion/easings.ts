import { Easing } from 'react-native-reanimated';

export type EasingFn = (t: number) => number;

/**
 * Miuix custom easings — 1:1 ports of `anim/easings.kt`.
 *
 * Visual reference:
 *   miuix-vue/src/anim/easings.ts
 *   miuix `anim/Easings.kt`
 *
 * Pass results directly as `withTiming` easing.
 */

/**
 * LinearEasing: x → x. Shared so every linear `withTiming` uses one worklet.
 */
export const linearEasing: EasingFn = (t) => {
    'worklet';
    return t;
};

/**
 * AccelerateEasing: x^(2 * factor). Default factor 1 → x².
 */
export const accelerateEasing = (factor = 1.0): EasingFn => {
    if (factor === 1.0) {
        return (x) => {
            'worklet';
            return x * x;
        };
    }
    const exp = 2 * factor;
    return (x) => {
        'worklet';
        return x ** exp;
    };
};

/**
 * DecelerateEasing: 1 - (1-x)^(2 * factor). Default factor 1.
 * Dialog dim uses factor = 1.5.
 */
export const decelerateEasing = (factor = 1.0): EasingFn => {
    if (factor === 1.0) {
        return (x) => {
            'worklet';
            return 1 - (1 - x) * (1 - x);
        };
    }
    const exp = 2 * factor;
    return (x) => {
        'worklet';
        return 1 - (1 - x) ** exp;
    };
};

/**
 * SinOutEasing: sin(x * π / 2).
 */
export const sinOutEasing: EasingFn = (x) => {
    'worklet';
    return Math.sin((x * Math.PI) / 2);
};

/**
 * FastOutSlowIn — used for the 50ms title color tween in TopAppBar.
 * bezierFn (not bezier) returns the plain easing function; `bezier` returns an
 * EasingFunctionFactory (the withTiming sugar) which isn't a (t) => number.
 */
export const fastOutSlowIn: EasingFn = Easing.bezierFn(0.4, 0, 0.2, 1);

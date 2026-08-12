import { decelerateEasing, fastOutSlowIn, linearEasing, sinOutEasing, EasingFn } from './easings';
import { folmeSpring } from './folmeSpring';
import { folmeSpringByResponse } from './folmeSpringByResponse';

/**
 * Named motion presets for every Miuix component.
 *
 * Components must consume these presets instead of writing ad-hoc
 * `withSpring(...)` calls, so the folme parameters stay exact and greppable.
 *
 * ⚠️ These values are the reference implementation — do not unify them into
 * one spring preset (they are intentionally different per component).
 */

// ---- Springs (folme) ----

/** Switch thumb offset. folmeSpring(0.7, 987). */
export const switchThumbOffset = folmeSpring(0.7, 987);
/** Switch thumb scale. folmeSpring(0.6, 987). */
export const switchThumbScale = folmeSpring(0.6, 987);
/** Switch track color. folmeSpring(0.99, 438.6). */
export const switchTrackColor = folmeSpring(0.99, 438.6);

/** Slider progress while dragging. folmeSpring(0.9, 1755). */
export const sliderProgressDrag = folmeSpring(0.9, 1755);
/** Slider progress while settling. folmeSpring(0.96, 322). */
export const sliderProgressIdle = folmeSpring(0.96, 322);
/** Slider knob active scale 1 → 1.127. folmeSpring(0.6, 987). */
export const sliderThumbScale = folmeSpring(0.6, 987);

/** Card sink feedback. scale 1.0 → 0.94. folmeSpring(0.8, 600). */
export const cardSink = folmeSpring(0.8, 600);
/** Card tilt feedback. folmeSpring(0.6, 400). */
export const cardTilt = folmeSpring(0.6, 400);

/** BottomSheet enter / exit slide. folmeSpring(damping 0.9, response 0.38). */
export const bottomSheetEnter = folmeSpringByResponse(0.9, 0.38);
/** BottomSheet drag-settle return. folmeSpring(damping 0.85, response 0.4). */
export const bottomSheetSettle = folmeSpringByResponse(0.85, 0.4);

/** Dialog large-screen enter. scale 0.8→1. folmeSpring(damping 0.9, response 0.3). */
export const dialogLargeEnter = folmeSpringByResponse(0.9, 0.3);
/** Dialog mobile slide-up. folmeSpring(0.88, 450). */
export const dialogMobileEnter = folmeSpring(0.88, 450);

/** TopAppBar small-title show. folmeSpring(damping 1.0, response 0.3). */
export const topAppBarShow = folmeSpringByResponse(1.0, 0.3);
/** TopAppBar small-title hide. folmeSpring(damping 1.0, response 0.15). */
export const topAppBarHide = folmeSpringByResponse(1.0, 0.15);

/** SearchBar cancel / results reveal. spring(stiffness 400, damping 40). */
export const searchBarReveal = folmeSpring(1, 400);

/** Snackbar enter / exit. folmeSpring(1, 400). */
export const snackbarMotion = folmeSpring(1, 400);

/** Input focus / label float. Compose default spring. folmeSpring(1, 1500). */
export const inputMotion = folmeSpring(1, 1500);

/** Menu / ListPopup popup fraction. spring(dampingRatio 0.82, stiffness 362.5). */
export const menuFraction = folmeSpring(0.82, 362.5);

/** Storage page sections and donut settle. folmeSpring(damping 0.9, response 0.38). */
export const storageEnter = folmeSpringByResponse(0.9, 0.38);
/** Storage management controls. folmeSpring(damping 0.88, response 0.3). */
export const storageManage = folmeSpringByResponse(0.88, 0.3);

// ---- Tweens ----

export interface TweenConfig {
    duration: number;
    easing: EasingFn;
}

/** MiuixIndication overlay. 120ms linear. */
export const pressIndication: TweenConfig = { duration: 120, easing: linearEasing };

/** Slider drag overlay. 150ms FastOutSlowIn. */
export const sliderDragOverlay: TweenConfig = { duration: 150, easing: fastOutSlowIn };

/** TabRow indicator slide. 200ms linear. */
export const tabIndicator: TweenConfig = { duration: 200, easing: linearEasing };

/** TopAppBar title color. 50ms FastOutSlowIn. */
export const titleColorTween: TweenConfig = { duration: 50, easing: fastOutSlowIn };

/** Dialog dim enter. 300ms DecelerateEasing(1.5). */
export const dialogDimEnter: TweenConfig = { duration: 300, easing: decelerateEasing(1.5) };
/** Dialog dim exit. 250ms DecelerateEasing(1.5). */
export const dialogDimExit: TweenConfig = { duration: 250, easing: decelerateEasing(1.5) };
/** Dialog content exit. 260ms DecelerateEasing(1.5). */
export const dialogContentExit: TweenConfig = { duration: 260, easing: decelerateEasing(1.5) };

/** BottomSheet drag-handle press. 100ms. */
export const sheetHandlePress: TweenConfig = { duration: 100, easing: linearEasing };
/** BottomSheet drag-handle release. 150ms. */
export const sheetHandleRelease: TweenConfig = { duration: 150, easing: linearEasing };

/** Menu / ListPopup alpha in. tween 200ms FastOutSlowIn. */
export const menuAlphaIn: TweenConfig = { duration: 200, easing: fastOutSlowIn };
/** Menu / ListPopup alpha out. tween 150ms FastOutSlowIn. */
export const menuAlphaOut: TweenConfig = { duration: 150, easing: fastOutSlowIn };
/** Menu / ListPopup dim in. tween 300ms SinOut. */
export const menuDimIn: TweenConfig = { duration: 300, easing: sinOutEasing };
/** Menu / ListPopup dim out. tween 150ms SinOut. */
export const menuDimOut: TweenConfig = { duration: 150, easing: sinOutEasing };

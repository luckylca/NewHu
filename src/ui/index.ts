/**
 * NewHu Design System
 * ===================
 * Project-owned UI layer replacing react-native-paper. Visual language is a
 * strict port of miuix (HyperOS): see .reference/miuix-vue for the sources.
 *
 * Layering (task.md §2):
 *   theme      — colors / typography / spacing / radius / opacity / component tokens
 *   motion     — folme springs + tween presets (the only place timings live)
 *   primitives — Text / Icon / Surface / Divider / PressIndication / PressableScale
 *   components — Button / Card / Switch / ListRow / NavigationBar / TopAppBar + P1…
 *
 * Business pages compose components; they do NOT define the visual language.
 */

export * from './theme';
export * from './motion';
export * from './primitives';
export * from './components';
export * from './hooks';

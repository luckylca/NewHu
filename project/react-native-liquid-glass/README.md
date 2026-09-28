# NewHu Liquid Glass

NewHu's Android Liquid Glass material adapter. This package owns local
procedural surfaces, opt-in backdrop capture, glass token types, and the
maintained patch for the upstream `liquid-glass-kit` Android renderer. Theme
families pass their glass tokens and appearance into `GlassMaterialProvider`.

On Android with glass enabled, `GlassSurface` defaults to the native backdrop
renderer. It samples and re-images the content behind the surface with the AGSL
SDF displacement pipeline. `renderMode="local"` is an explicit low-cost or
cross-platform fallback and does not sample the changing page behind it.

`GlassTabBar` owns a local backdrop provider around an opaque shell and the
actual tab icons. Its one selected lens is a sibling above that scene, so it
refracts the tab bar's own icon pixels rather than the page below. Idle
capture is dirty-driven and cached; the lens requests continuous capture only
during long-press drag/settle. Each capture is limited to the moving lens plus
the native 28 dp optical margin. Balanced mode caps capture at 60 Hz; High mode
may follow the display cadence up to 120 Hz. The gesture, edge springs, and
per-tab active color interpolation run on the UI thread.

On Android 13+, AGSL evaluates a rounded-rectangle SDF, derives a convex height
profile and surface normal, remaps backdrop coordinates across the full lens,
then adds a stronger rim bend. Red, green, and blue are sampled at separate
coordinates; Fresnel, specular, and the inner compression shade use the same
height-field normal. `displacementOnlyDebug` bypasses tint and lighting so the
displaced background can be checked directly. Android 12 and older remain on
the native renderer's lower-fidelity compatibility path.

The live backdrop renderer is `liquid-glass-kit` 1.0.0. The patch in `patches/`
avoids recording route backdrops without active consumers and caps Balanced
backdrop capture at 60 Hz on high refresh-rate displays. All mounted Android
backdrop surfaces retain the native shader in Balanced mode; capture stays
dirty-driven except for surfaces that explicitly request continuous updates.
Open **高级设置 → Liquid Glass 光学调试** to view checkerboard, text and line
targets, tune the material, and switch to displacement-only mode.

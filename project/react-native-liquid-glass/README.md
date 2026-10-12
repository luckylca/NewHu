# NewHu Liquid Glass

`@newhu/react-native-liquid-glass` contains the React Native API and Android Liquid Glass renderer. NewHu's product materials and theme-role tokens belong in `react-native-hyper-ui`; this package only accepts generic Glass material values.

## Installation

```bash
npm install @newhu/react-native-liquid-glass
```

In Expo projects, run the native prebuild after adding or changing the package so Expo autolinking includes its Android module. The package targets React 19, React Native 0.81, Reanimated 4, and Expo 54.

Add the package's config plugin to `app.json` so the Android app includes the separate Core Gradle project:

```json
{
  "expo": {
    "plugins": ["@newhu/react-native-liquid-glass"]
  }
}
```

Then run `npx expo prebuild --platform android` and rebuild the native app.

**Current migration status:** the first-party Android Core library and native sample are in place, with an internal Core/legacy A/B switch. Core remains experimental in NewHu; the compatibility `liquid-glass-kit@1.0.0` path and install-time patches remain as rollback until page-level parity is accepted.

## React Native API

The existing JS API remains compatible while the native implementation migrates:

```tsx
<GlassMaterialProvider
    tokens={theme.glass}
    dark={theme.isDark}
    backdrop={pageContent}
    themeBackdrop={themeBackdrop}
>
    <PageForeground />
</GlassMaterialProvider>
```

`GlassSurface` continues to use theme roles such as `variant="card"` and `variant="tabBar"`. Hyper UI resolves those roles to generic optical material tokens; the engine does not know about NewHu cards, comments, or theme names. `GlassOverlay`, `GlassAppearanceProvider`, and `LocalGlassMaterial` remain exported.

For route transitions, import `glassController` through the optional route adapter and call its imperative `oneShot`, `freeze`, or `resume` methods with the provider ID. Navigation events do not belong in the Android Core.

## Android Core API

The package-owned renderer under `android-core/src/main/java/com/newhu/liquidglass` can run without React Native or Expo. Its pure Android entry points are:

```kotlin
val engine = GlassEngine(rootView)
val source = engine.createBackdropSource(contentView)
val surface = engine.createBackdropSurface(source, material)
val frozen = engine.prepareFrozenBackdrop(source.id, blurRadiusDp = 32f)

val local = LocalGlassView(context)
local.setMaterial(localMaterial)
```

The Expo bindings should remain a thin JS/native prop adapter over those classes. The native sample consumes the standalone `android-core` Gradle library, without React Native, Expo, or `liquid-glass-kit` on its compile classpath. The Expo module declares `implementation project(':liquidglass-core')`; the config plugin links the package's `android-core` project into the consuming app's Gradle settings.

## Native sample and build

```bash
cd project/react-native-liquid-glass
npm run build
npm pack

cd example/android-native
ANDROID_HOME="$HOME/Library/Android/sdk" ./gradlew :liquidglass-core:assembleDebug :app:assembleDebug
```

The sample is a native `RecyclerView` with comment-like rows, a native `LocalGlassView` per row, and a native backdrop top bar. It accepts `count=5|20|80` and `mode=live|frozen`; it auto-scrolls for 12 seconds and reports FrameMetrics, gfxinfo artifacts, capture telemetry, shader pool counts, and frozen snapshot counters. See [the native sample README](example/android-native/README.md) and `docs/performance/runs/` for device records.

## Materials and rendering

`GlassMaterial` is generic: blur, refraction, chromatic aberration, saturation, tint, highlight, Fresnel, inner shadow, and corner radius. NewHu's role presets and theme-specific Light/Dark tokens belong in `react-native-hyper-ui`.

`opticsModel` is optional and defaults to `heightField`, preserving existing callers. The experimental `sdfScaleLens` model maps a rounded-rectangle signed-distance field through a nonlinear scalar scale before sampling the backdrop once; its color pass applies light contrast, brightness, saturation, and analytic outer/inset shadows. It intentionally omits chromatic separation and Fresnel highlights. The browser fixture and MIT attribution are in `reference/` and `THIRD_PARTY_NOTICES.md`; this is calibrated against the default `liquid-glass.js`, not the separate `liquid-diamond.js` model. The current Liquid Glass theme uses it only for functional top-bar and search backdrops; cards, TabBar interactions, and frozen BottomSheet rendering keep their existing renderers.

The Android Core uses the AGSL RuntimeShader path on API 33+, RenderEffect blur on API 31–32, and lower-tier compatibility rendering on API 24–30. The package's JS layer may provide a Skia fallback when native rendering is unavailable.

## Performance guidance

- Keep each backdrop source stable and exclude the Glass foreground from its own source; otherwise the foreground text refracts itself.
- Use local Glass for numerous static cards and backdrop Glass for functional floating layers such as a top bar or selected lens.
- Derive region RenderNodes from the already-recorded route node; do not traverse the React/native tree a second time to crop it.
- Reuse a frozen RenderNode/RenderEffect during overlays and gestures instead of recapturing the route.
- Prefer a recycler for long, variable-height lists; avoid using capture frequency, shader quality, or list-window reductions to conceal mounting costs.
- Keep telemetry opt-in and use the native benchmark before attributing a regression to shaders or React Native.

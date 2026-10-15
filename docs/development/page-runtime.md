# Page Runtime

Ordinary screens should use a page template from `react-native-hyper-ui` instead of choosing their own scroll container, recycler settings, or TopBar composition.

## Settings screens

Use `SettingsPage` with keyed section nodes. Use `SettingsSection` for standard grouped preferences; it wraps the existing `PreferenceGroup` surface without changing its visual treatment.

```tsx
<SettingsPage
    title="动画设置"
    back={() => router.back()}
    sections={[
        {
            key: 'animation',
            node: (
                <SettingsSection title="动画">
                    <ListRow title="减少界面动画" onPress={toggleAnimations} />
                </SettingsSection>
            ),
        },
    ]}
/>
```

`SettingsPage` owns `PageScaffold` and `PageSettingsList`. The list virtualizes whole section nodes (not individual rows), uses `initialNumToRender=2`, `maxToRenderPerBatch=2`, and `windowSize=3`, and keeps `removeClippedSubviews=false` because clipping regressed the measured settings workload. Store or screen state must own values that must survive section unmounts. Put dialogs and other overlays in `overlays`; put trailing copy/actions in `footer`.

Special previews, account heroes, and other content-specific sections may use custom nodes or Cards. Do not use a non-interactive `Card` as a replacement for a normal settings group. Long text/legal pages and special animated pages may use a future specialized template rather than being forced into `SettingsPage`.

`storage-management` is a specialized, data-driven selection screen with a fixed animated action bar and destructive overlays. It remains on its dedicated list composition until a management-page template exists; do not copy that exception into ordinary preference pages.

## Feed screens

Use `FeedPage` for the TopBar/list shell. Keep data normalization and item UI in a business component such as `ActivityFeed`; do not import FlatList, FlashList, or `PageFeedList` into a route.

`PageFeedList` owns the feed recycler configuration: initial render 5, batch size 5, window size 5, batching period 48 ms, and clipped subviews enabled. Business screens cannot override those settings. FlatList is the runtime default. The benchmark-only `pageBenchRenderer=flashList` query switches the renderer inside `PageFeedList` for A/B testing without changing feed business code.

Use `header`, `footer`, and `emptyContent` for list-adjacent content. Keep business state, API calls, and actions outside the shared runtime.

## Checks and benchmarks

Run npm run check for TypeScript, lint and unit tests. The old architecture checker is not present; review PageScaffold/SettingsPage/FeedPage ownership for new routes, and add real automated architectural tests before relying on a structural CI gate.

The Android runner uses a warmed route and a synthetic animated `scrollToOffset` trajectory; it does not inject ADB gestures. Example:

```bash
ADB="$HOME/Library/Android/sdk/platform-tools/adb" \
DEVICE_ID=a4976c80 RUNS=5 \
./scripts/performance/benchmark-page-android.sh settings
```

`question` and `people` require a real `BENCHMARK_QUERY`, such as `id=<question-id>` or `urlToken=<user-token>`. Pages with no scrollable range are reported as route-render smoke only; `n/a` is not a scroll-performance result. Use the same device, build type, route data, requested distance, and duration when comparing pages or FlatList/FlashList.

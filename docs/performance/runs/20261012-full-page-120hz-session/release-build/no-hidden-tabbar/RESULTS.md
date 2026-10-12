# Hidden MaterialTopTabBar Release A/B/A

Device: Xiaomi 23117RK66C (`9ea3b4d2`), Android 16 / HyperOS, display 120 Hz. All app replacements used `adb install -r`; app data was retained.

## Reproduction

Repeated hot-route sequence on baseline Release A:

1. Cold-open `newhu://product-v1`.
2. While the app remains running, deliver `newhu://item/answer/2007768642545283777/comment`.

The app crashed three times with `TypeError: Cannot read property 'isPrototypeOf' of null`. The crash stack consistently contains `Animated(View) → TabBar → MaterialTopTabBar → PagerViewAdapter → ItemLayout`. The first two occurrences are in [`baseline hot-route crash traces`](../device-release/comments/reply-interaction/hot-route-repro-2-crash.txt); the third, after returning to A, is in [`A3 crash trace`](baseline-A3-crash-buffer.txt). Cold-opening the Comments URI succeeded.

## Change and B verification

[`app/item/[type]/[id]/_layout.tsx`](../../../../../../app/item/%5Btype%5D/%5Bid%5D/_layout.tsx) now supplies `tabBar={() => null}` because the route never displays tab labels. `swipeEnabled: true` stays enabled. This removes the hidden default animated tab-bar subtree; it does not change the PagerView pages, horizontal navigation, row behavior, or glass material.

The candidate Release APK is [`app-release-no-hidden-tabbar.apk`](app-release-no-hidden-tabbar.apk), SHA-256 `cd696aac668a4597c3e5b0a79e53eae2ebf480044497a5da9d4723eeb469906d`. It uses the same signing certificate as A. TypeScript, ESLint for the route file, and `git diff --check` pass.

The same product-to-Comments hot transition succeeded for B, then failed again after reinstalling A3, and succeeded after restoring B. Candidate screenshots are [`B1`](product-to-comments-hot-1.png), [`B2`](product-to-comments-hot-2.png), and [`B3`](product-to-comments-hot-3.png); the crash buffer after B contains only the three earlier A failures. The liquid-glass Comments screen and content render normally. In B, a tap on the first reply count opened the five-reply glass sheet and Android Back closed it ([`reply panel open`](reply-panel-open-after-horizontal.png), [`reply panel dismissed`](reply-panel-after-back.png)). A horizontal swipe from Answer detail opened Comments ([`detail before swipe`](item-detail-before-horizontal.png), [`Comments after swipe`](comments-after-horizontal-swipe.png)), confirming the PagerView gesture still works.

## Scroll regression check

The three candidate 24-second Release Perfetto windows are [`comments-window-1`](comments-window-1/), [`comments-window-2`](comments-window-2/), and [`comments-window-3`](comments-window-3/). Their actual present p95 intervals were 8.93, 8.84, and 8.84 ms; intervals over 16.67 ms were 3, 1, and 3; app deadline misses were 3, 4, and 5. `UPDATE_PROPS` p95 was 1.88–1.94 ms and `mountViews` max was 6.91–8.09 ms.

Compared with the three baseline Release windows in [`device-release/comments`](../device-release/comments/), B shows no scroll regression. These samples do not establish a frame-rate gain: A and B vary by run, and B still misses deadlines. The 490.7 ms no-submit interval seen once in A did not recur in these three B windows; that single-event difference is not enough to assign causality to removing the invisible tab bar. The ready-state list crop in [`screenshot-comparison-matched-top.json`](screenshot-comparison-matched-top.json) differs by mean 0.059 RGB/channel with 0.079% channel values over 4; one later old-A screenshot captured a visibly warped chip-header transition, so that mismatched frame is preserved separately in [`screenshot-comparison.json`](screenshot-comparison.json) and is excluded from the matched visual comparison.

All input was ADB-injected and is not physical touch. The bottom sheet was checked with a synthetic tap and Android Back.

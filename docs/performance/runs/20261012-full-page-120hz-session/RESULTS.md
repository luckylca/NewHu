# NewHu Android 120 Hz 全页面性能阶段结果

日期：2026-10-12 至 2026-10-13（设备本地时间，Asia/Shanghai）  
状态：Comments 根因定位和最小列表修复已完成 Debug A/B/A；原 Release 与候选 Release 各完成三轮 FrameTimeline，原 Release 完成 60 秒持续滚动；11 个主要路由均完成 24 秒 Release FrameTimeline 窗口，Home 与 Product v1 再各做两轮；AnimationSettings 另测开关交互。嵌套评论路由的隐藏 TabBar 崩溃已通过 Release A/B/A 重复验证并修复。120 Hz 全页面验收仍未完成。

## 结论

Comments 的主要可复现长帧来源是分页新增行导致的 Fabric 挂载、状态和布局批次。将相同的 43 条根评论、同一行组件与视觉结构放进 FlashList v2 后，三组隔离的内存追加对照都降低了 >16.67 ms 的 present 间隔、deadline miss 以及 Fabric 批次峰值。保留了评论正文、回复、点赞、Swipeable、按压反馈和玻璃材质。

这项改动没有达到稳定 120 Hz：Debug FlashList 追加场景的 present p95 仍为约 20–26 ms，仍存在 >16.67 ms 长间隔和最高 565 ms 的单个间隔。滚动中的 Fabric `UPDATE_PROPS` 仍有最高 22.66 ms 的批次，具体到哪个原生 view/组件仍未确定。没有证据支持把历史 `UPDATE_PROPS numInstructions=351` 归咎于 Swipeable、玻璃、JS 或 shader。

真实 Release 连续滚动的三轮 FrameTimeline 结果波动较大：present p95 为 8.84–16.17 ms，三个 24 秒窗口仍分别有 3、6、16 个 >16.67 ms 间隔；一个窗口观测到 490.7 ms 的无提交间隔，FrameTimeline 未将其归类为 missed deadline，成因仍待确认。普通 present 中位数接近 8.33 ms，但高分位、Fabric mount 与 SurfaceFlinger 真正 present cadence 仍未满足余量目标。故当前结论是“Comments 列表新增挂载负载已显著下降”，不是“应用已稳定 120 fps”。

## 保护基线

- HEAD：`acfd172ab17447e2312910f4e6e9c1ec549ba45f`；本轮以该提交上的实际脏工作区为基准，没有 reset、clean、checkout 或提交。
- 设备：Xiaomi 23117RK66C，Android 16 / HyperOS，1440×3200，560 dpi，面板最大刷新率 120 Hz；ADB serial `9ea3b4d2`。
- 原工作区、关键源码 hash、设备信息和原 APK 信息在 [`baseline/`](baseline/)；原 `android/app/build/outputs/apk/release/app-release.apk` SHA-256 为 `64f2001b59ae0decd787e0737d554a2ff904de7f45b63d174ae3b5ac5ae7b127`，本轮构建输出被隔离，未覆盖它。
- 设备应用数据未清除。每个实验子目录保存环境、手势动作、Trace、framestats/GfxInfo、截图或日志及源文件 hash；新结果全部位于本目录。

## Comments A/B/A 与列表追加对照

### 数据与动作

使用 answer `2007768642545283777` 的 43 条根评论（5 页：10+10+10+10+3；评论 ID 指纹 `7a891738`）。它比早期目标 `2088003765030892535` 的 10 条样本更适合验证分页追加。严格序列为：完整缓存列表 A、触发真实后续页请求的 B、回到完整缓存列表 A2。有效 B 抵达与 A 相同的 43 条评论指纹，网络分页模式没有写本地数据库。

C 通过纯内存追加隔离网络和缓存写入：`apiMs=0`、`cacheWriteMs=0`。FlatList 与 FlashList 使用相同内容、组件、header、分页结构和手势；按 FlatList → FlashList → FlatList 的顺序做匹配对照，并对追加实验各重复两轮以上。动作由 `adb shell input swipe` 注入，记录中明确标为 synthetic；它不是物理手指输入。

### 重复指标

以下是三个 FlatList / FlashList 配对的 Perfetto FrameTimeline 与 Fabric 主线程 slice 导出值。present 间隔来自 `actual-frame-timeline.csv`；Fabric 耗时来自 `fabric-main-slices.csv`。测试包含快速滚动和追加，不应与静止帧率混用。

| 配对 | 引擎 | Present p50 / p95 (ms) | >16.67 ms 间隔 | App deadline miss | UPDATE_STATE max (ms) | UPDATE_LAYOUT max (ms) | mountViews max (ms) |
|---|---|---:|---:|---:|---:|---:|---:|
| C1 / C2 | FlatList | 11.05 / 26.70 | 399 | 448 | 36.16 | 25.05 | 65.53 |
| C1 / C2 | FlashList v2 | 8.57 / 24.39 | 204 | 318 | 8.14 | 4.82 | 33.59 |
| C3 / C4 | FlatList | 8.50 / 22.99 | 229 | 268 | 36.29 | 23.70 | 64.77 |
| C3 / C4 | FlashList v2 | 8.45 / 20.48 | 110 | 147 | 9.63 | 5.36 | 35.36 |
| C5 / C6 | FlatList | 11.54 / 29.24 | 434 | 488 | 42.79 | 31.80 | 79.86 |
| C5 / C6 | FlashList v2 | 8.74 / 25.56 | 226 | 370 | 7.33 | 5.23 | 31.67 |

每一对 FlashList 的 >16.67 ms 间隔分别减少 49%、52%、48%；deadline miss 分别减少 29%、45%、24%。挂载批次峰值分别减少约 49%、45%、60%。present p95 仍超过一个 120 Hz 周期，且 FrameTimeline 有明显运行间波动，因此只把方向性、重复出现的列表收益归给虚拟列表，不声称全帧稳定。

FlashList 的 `UPDATE_PROPS` p95 在三轮分别为 9.61、8.53、10.16 ms，最大值为 21.46、19.78、22.66 ms；这说明 props 更新仍然是待查尾部开销。当前 Perfetto slice 只记录 `IntBufferBatchMountItem::mountInstructions::UPDATE_PROPS numInstructions=...` 和批次时长，没有 view tag / React component 映射，无法认定批次里是哪类 view。与之同时，FlatList 追加的 `UPDATE_STATE`、`UPDATE_LAYOUT`、`mountViews` 峰值明显更高，故将它们作为当前已被 A/B 支持的根因。

### 输入频率、线程与内容刷新

显示刷新、应用 present、滚动 offset 和触摸派发被分开统计。独立 C6 16 秒 trace 的 display 约 120.64 Hz；effective content FPS 约 57.03，拖动阶段约 54.71，手势结束后的惯性阶段约 72.06；touch move 派发约 55.56 Hz，native scroll event 约 56.84 Hz。ADB synthetic 拖动的派发率不能作为应用 60 fps 上限证据。C6 offset interval p95 约 33.25 ms，最大停顿约 199 ms。

另一段同窗口 16 秒 Perfetto + simpleperf 采样（仍为 Debug，Trace 会增加观察开销）得到：实际 present interval p50 8.33 ms、p95 15.44 ms、p99 33.41 ms，42 个 >16.67 ms 间隔、57 个 app deadline miss。UI `UPDATE_PROPS` p95 14.08 ms / max 21.65 ms；`mountViews` p95 19.57 ms / max 31.79 ms。该窗口证明长批次与长 present 尾部并存，但仅凭汇总不能把每个 missed frame 映射到单个组件。原始 trace、CSV、SQL 和 simpleperf 数据在 [`comments/native-profile-updateprops/correlated-run-1/`](comments/native-profile-updateprops/correlated-run-1/)。

CommentText 在追加期间的解析累计 2.1–2.8 ms / 43 条评论（约 0.05 ms/条），当前证据不支持它是批次长帧主因。截图全屏直接比较会受状态栏和系统 toast 干扰；对齐后的列表区域 crop（x=0..1440、y=320..2650）中，A1/B ready、C1/C2 after、C5/C6 after 完全一致；C3/C4 after 的平均每通道绝对差 0.024，差值超过 4 的通道占 0.079%，可见行、卡片和玻璃背景一致。结果和可复现脚本见 [`screenshot-comparison.json`](comments/list-engine/screenshot-comparison.json) 与 [`compare-comments-screenshots.py`](../../../../scripts/performance/compare-comments-screenshots.py)。

完整 A/B/A 原始数据见 [`A1 full-cache`](comments/A1-core-full-cache-v2/)、[`B network pagination`](comments/B-network-pagination-v2/)、[`A2 full-cache`](comments/A2-full-cache/)，内存追加与 FlatList/FlashList A/B/A 结果见 [`comments/list-engine/`](comments/list-engine/)；C6 的 append event 与 Fabric slice 时间关联在 [`fabric-append-correlations.json`](comments/list-engine/C6-flashlist-state-reset/fabric-append-correlations.json)。运行工具为 [`run-phase.sh`](comments/run-phase.sh)。首个无效的 network 分页尝试保留在目录中，但不计入上表。

## 实施改动

- Comments 的默认虚拟列表改用 FlashList v2；调试比较可通过 `perfListEngine=flatlist` 使用 FlatList。
- 新增 `PageFlashList`，共享 `PageScaffold` 的顶部 inset、样式和同一 `CommentItem` renderer。
- `CommentItem` 的点赞、票数、菜单可见状态和菜单锚点改用 FlashList `useRecyclingState`，按 comment ID 初始化；复用到新 ID 时收起 swipeable 并重置按压共享值，避免 recycled row 把上条评论状态带到新行。
- Debug-only 评论挂载/render/解析计数，以及 full-cache、network-page、append-only 对照入口只用于实验；Release 不运行该调试计数。
- `app/item/[type]/[id]/_layout.tsx` 改为 `tabBar={() => null}`，不再挂载永远隐藏的 MaterialTopTabBar Animated 子树；仍保留 MaterialTopTabNavigator 的 `swipeEnabled: true`、左右翻页和原屏幕转场。原 Release 从 Product 热切 Comments 三次都在 `Animated(View) → TabBar → MaterialTopTabBar` 崩溃；候选 Release 同一路径 A/B/A 热切成功，横向滑动和五条回复 sheet 也正常。实验与截图在 [`no-hidden-tabbar/RESULTS.md`](release-build/no-hidden-tabbar/RESULTS.md)。
- 没有修改玻璃 shader、材质参数、动画帧率、Swipeable、按压效果或 provider 捕获策略。共享玻璃实现保留 Core `oneShotPassThrough`。

相关实现：[comment.tsx](../../../../app/item/%5Btype%5D/%5Bid%5D/comment.tsx)、[CommentItem.tsx](../../../../src/components/CommentItem.tsx)、[PageScaffold.tsx](../../../../project/react-native-hyper-ui/src/components/PageScaffold.tsx)。

## 共享 Liquid Glass 绘制观察

C6 玻璃 telemetry 约 37 秒统计：7,050 次 descendant invalidation，7,014 次避免 source rerecord；滚动中 `sourceRerecordRequired=0`、`sourceRerecordExecuted=1`（启动时单次捕获）、`scrollSettleRerecord=0`、route tree traversal 为 1、consumer-only refresh 395、scroll reuse frame 971。它显示滚动文字和子 RenderNode 更新期间复用了 source RenderNode，未发现每滚一帧重录整个源树。当前未改 provider/recorder 调度。

已保存的 A1/B/C ready 与 after 页面截图显示列表内容不变；尚未完成覆盖动态高对比背景、图片、玻璃边缘 blur/refraction/chromatic sampling、列表增删与对话框/BottomSheet 转场的完整视觉矩阵。此处证据仅支持当前 Comments 动态滚动，不外推到所有页面。

## Release 真机滚动、长时与路由转场

原 Release APK SHA-256：`35ab7329d67282a84cc1865aab8373065f6c7b45a61e5899d6f7edf752e6cf16`；隐藏 TabBar 修复后的 Release APK SHA-256：`cd696aac668a4597c3e5b0a79e53eae2ebf480044497a5da9d4723eeb469906d`。两者签名相同，均不是 debuggable 包；通过 `adb install -r` 安装，用户数据未清除。APK 和安装记录在 [`release-build/device-release/`](release-build/device-release/) 与 [`release-build/no-hidden-tabbar/`](release-build/no-hidden-tabbar/)。

每个窗口暖机后录制 24 秒 Perfetto FrameTimeline，执行 10 秒连续 ADB swipe、4 次快速 swipe/fling；scroll driver 是合成输入。FrameTimeline `actual_present_interval_ms` 是应用 layer 的真实 present 间隔。下表分别列出原 Release A 和修复后的候选 Release B：

| 版本/轮次 | Present p50 / p95 (ms) | Present max (ms) | >16.67 ms 间隔 | App deadline miss | Present work p95 (ms) | UPDATE_PROPS p95 / max (ms) | mountViews max (ms) |
|---|---:|---:|---:|---:|---:|---:|---:|
| A 原包 / 1 | 8.336 / 16.168 | 66.669 | 16 | 14 | 13.56 | 1.95 / 4.98 | 10.69 |
| A 原包 / 2 | 8.328 / 8.840 | 490.697 | 6 | 3 | 12.40 | 1.61 / 3.96 | 6.62 |
| A 原包 / 3 | 8.331 / 8.902 | 66.872 | 3 | 3 | 16.60 | 1.97 / 3.49 | 10.35 |
| B 修复 / 1 | 8.328 / 8.931 | 58.222 | 3 | 3 | 12.72 | 1.88 / 3.43 | 8.09 |
| B 修复 / 2 | 8.319 / 8.839 | 41.660 | 1 | 4 | 13.34 | 1.86 / 3.21 | 6.91 |
| B 修复 / 3 | 8.327 / 8.837 | 49.776 | 3 | 5 | 12.75 | 1.94 / 3.41 | 7.79 |

A 原包有一次 490.7 ms 无提交间隔；FrameTimeline 没有将该空档标记为 missed deadline。B 三轮没再出现相近长空档，但 A/B 窗口本身波动明显，不能将这次未复现归因于 TabBar 改动。候选窗口 present p95 仍约 8.84–8.93 ms，普通 present work p95 为 12.72–13.34 ms，deadline miss 每轮 3–5 个；目前只确认转场崩溃已稳定消失，滚动性能没有可重复的量化提升。

原 Release 的 60 秒持续滚动样本中，GfxInfo 全样本 p95 约 11 ms、GPU p95 7 ms、deadline missed 1、legacy 16 ms janky 236/14,206（1.66%）；累计 `Total frames rendered` 不作 FPS。FrameStats analyzer 的尾部 0.999 秒包含约 120.11 Hz 的采样帧，只代表该尾部窗口。Thermal status 前后均为 0，raw skin 传感器由 40.086°C 升至 40.706°C；进程 PSS 从 305,030 KB 升至 355,420 KB（+50,390 KB），测试时列表继续分页，需更长测试分辨缓存增长与泄漏。日志没有采集到可用于判断 Hermes/JS GC 的事件，因此 GC 状态未测量。原始数据见 [`release-sustained-60s/`](release-build/device-release/comments/release-sustained-60s/)。

所有 Release 窗口的 `SurfaceFlinger --latency` tail 均无有效样本；present cadence 采用 Perfetto FrameTimeline，而不是 ADB 输入频率或 `Total frames rendered` 总数。Release 滚动 offset 与输入派发频率尚未以同窗口探针采集；Debug 单独探针的 input、native scroll 与 offset 数据仍见上一节。

## 其他主要页面基线

- Question 的既有匹配数据实验显示 FlatList 约 25–36 fps，FlashList v2 约 108–110 fps；继续保留已有 FlashList 改动。来源：[Question list A/B RESULTS](../20261009-question-effectivefps-list-ab/RESULTS.md)。
- Home 既有对照约 112.5 fps；本轮 Release 保留为共享回归页。Settings 保留现有 FlashList v2，没有重复做列表替换。
- 当前 Release 包已对 11 个主要页面各做一轮 6 秒 ADB 合成滑动、暖机后 GfxInfo/FrameStats 采样。此表是路由烟测和异常筛查，不是逐页 FPS 证明：SurfaceFlinger tail 无可用样本，故没有将输入拖动频率换算成内容 FPS。GfxInfo p95 是整段样本的毫秒取整分位数；FrameStats p95 是窗口内渲染工作时长；deadline miss 使用设备提供的 HWUI 计数。

| Release 页面 | FrameStats work p95 (ms) | GfxInfo p95 (ms) | GPU p95 (ms) | Deadline miss |
|---|---:|---:|---:|---:|
| Home | 11.216 | 10 | 10 | 1 |
| Settings | 12.251 | 12 | 9 | 1 |
| ThemeSet | 11.900 | 13 | 8 | 1 |
| Question（真实 id `2087632646973276815`） | 10.258 | 10 | 9 | 1 |
| People（`mai-bu-cong-rong-yue`） | 10.708 | 11 | 9 | 1 |
| 个人页 | 8.438 | 10 | 8 | 10 |
| AnimationSettings | 6.763 | 9 | 7 | 3 |
| Privacy personalization | 10.137 | 10 | 8 | 1 |
| DevMode | 10.046 | 10 | 7 | 1 |
| AI analysis settings | 5.508 | 9 | 8 | 2 |
| Product v1 | 13.688 | 13 | 11 | 1 |

每页 artifacts 在 [`release-build/device-release/pages/`](release-build/device-release/pages/)。两个 Question 烟测目录因首次使用错误参数名仍显示加载态，已排除；有效采样使用 `id=2087632646973276815`。Settings、ThemeSet、Question、People、个人页和 Home 的 route launch 与内容截图已确认。6 秒单轮不能代表长时间热态或原生惯性滚动。

## 全页面 Release FrameTimeline 与输入/滚动回调

在同一候选 Release APK 上，使用 [`run-page-frame-timeline.sh`](../../../../scripts/performance/run-page-frame-timeline.sh) 为 11 个主要路由分别录制 24 秒 Perfetto。每轮先冷路由启动并暖机 8 秒，再执行 10 秒纵向 ADB swipe、4 次 180ms 反向快速 swipe，最后等待页面稳定并截图。ADB 输入是合成触摸；快速 swipe 抬手后由 Android 原生滚动容器处理惯性。实际 app layer present、Expected FrameTimeline、应用主线程 Fabric slices、UI/RenderThread/JS 线程状态，以及页面内 `dispatchInputEvent ACTION_MOVE` 都从同一 Perfetto trace 导出。

`ReactScrollView.onScrollChanged` slice 的起始间隔作为 native offset-update callback 间隔代理：记录真实 Android scroll-offset 变化回调的频率，但这组 Release trace 没有探针写出 y 值本身。Activity 主线程 `dispatchInputEvent MotionEvent ACTION_MOVE` slice 间隔单独代表输入事件派发；它不等同于 present 或 scroll offset。静止且没有内容更新的页面不要求持续 present，因此超长 app-layer present 空档会保留在数据中，但不能单独算成 missed deadline。表中的 Present gap/max 和计数覆盖完整 trace，包括手势结束后的静止段；app deadline miss 列采用 FrameTimeline 的应用截止期分类。

每页首轮摘要如下。`Scroll cb` 和 `Move dispatch` 分别是 native scroll callback 与 Activity ACTION_MOVE 间隔 p50/p95；无 scroll callback 的页面用“—”表示。`Fabric` 为 `UPDATE_PROPS` p95/max 与 `mountViews` 最大批次。输入间隔没有把合成手势派发率当作应用内容帧率。

| Release 路由 | App present p50/p95/max (ms) | >16.67ms gaps / missed deadline | Scroll cb p50/p95 (ms) | Move dispatch p50/p95 (ms) | `UPDATE_PROPS` p95/max; mount max (ms) |
|---|---:|---:|---:|---:|---:|
| Home | 8.33 / 9.21 / 58.31 | 13 / 14 | 8.22 / 9.83 | 8.33 / 8.98 | 0.69 / 3.49; 19.44 |
| Settings | 8.35 / 16.65 / 18.27 | 47 / 5 | 8.43 / 16.87 | 8.37 / 16.73 | 0.71 / 1.37; 1.57 |
| ThemeSet | 8.42 / 16.70 / 2140.26 | 52 / 3 | 8.44 / 16.82 | 8.40 / 16.69 | 0.85 / 1.40; 1.51 |
| Question (`2087632646973276815`) | 8.34 / 11.70 / 241.32 | 18 / 5 | 8.20 / 15.76 | 8.35 / 16.53 | 0.55 / 1.82; 7.43 |
| People (`mai-bu-cong-rong-yue`) | 8.36 / 16.51 / 17.16 | 34 / 0 | 8.68 / 17.04 | 8.37 / 16.70 | 0.23 / 0.39; 0.50 |
| 个人页 | 8.34 / 8.89 / 383.12 | 11 / 0 | — | 8.34 / 8.99 | — |
| AnimationSettings（静止/无滚动） | 8.35 / 16.51 / 774.35 | 1 / 0 | — | 8.33 / 8.62 | 0.26 / 0.29; 0.37 |
| Privacy personalization | 8.40 / 16.82 / 333.43 | 92 / 0 | — | 8.42 / 16.86 | 0.26 / 0.33; 0.41 |
| DevMode | 8.36 / 16.51 / 341.53 | 26 / 0 | — | 8.36 / 16.59 | 0.24 / 0.30; 0.38 |
| AI analysis settings（静止/无滚动） | 8.41 / 16.79 / 391.30 | 79 / 0 | — | 8.42 / 16.81 | — |
| Product v1 | 8.32 / 8.68 / 16.78 | 1 / 228 | 8.35 / 16.72 | 8.34 / 16.68 | 1.37 / 7.70; 9.84 |

路由首轮和原始 trace 位于 [`pages/`](release-build/no-hidden-tabbar/pages/)。页面间的可见内容帧与输入事件回调频率均不是固定 60Hz；scroll callback 中位数在可滚动页面约 8.2–8.7ms，说明这些合成动作能驱动约 120Hz 的 native offset 更新。p95 通常接近 16.7ms，代表一部分更新跨过一个显示周期。A/B/A 的 Comments Debug 有效帧尾部仍高于 8.33ms；本表不是“已达到稳定 120Hz”的证明。

### Home 和 Product v1 复测

Home 的 r1/r3 都记录到 10 秒 swipe 期间约 1,200 次 `ReactScrollView.onScrollChanged`，scroll callback p95 9.83/9.65ms、Activity move dispatch p95 8.98/8.97ms。两轮分别有 14/8 个 FrameTimeline app deadline miss，`mountViews` 峰值 19.44/19.19ms；missed frame 与 Fabric mount/layout/update-state 批次时间重合。r2 只有 69 个 ACTION_MOVE slice、present 最大 gap 5.53 秒且 after 截图仍在首屏，判定为输入没有持续驱动的无效滚动轮次，不参与 A/B 归因。

Home r1/r3 长批次的出现可复现，但 Perfetto 没有 view tag / React component 映射；代码路径中有自定义瀑布流 `ScrollView` 的窗口挂载与 `onLayout` 实测高度回写。现有证据支持“瀑布流滚动期间出现与 deadline miss 重合的较大 Fabric mount/layout/state 批次”，尚不足以证明是哪一类 item 或高度回写是唯一原因。没有为 Home 改动渲染窗口或估算高度，以免内容空洞/卡片重叠；还需要受控 A/B/A 才能进行此处代码优化。

Product v1 三轮的 present p95 为 8.63–8.70ms；>16.67ms gap 为 1/0/0，deadline miss 为 228/2/0。首轮 Fabric mount 峰值 9.84ms 且 `UPDATE_PROPS` 峰值 7.70ms，后两轮相应峰值降至 2.26/1.93ms 与 2.18/1.83ms。单轮 228 次 missed-frame 标记不重复，故保留为离散异常，不归因给产品页、玻璃或任何线程。

AnimationSettings 的首轮 24 秒动作没有滚动偏移：内容全在首屏，62 个 app layer frame 均无 deadline miss，最大 gap 774ms 属于静止状态样本。随后用 [`animationSettings-toggle-r1/`](release-build/no-hidden-tabbar/pages/animationSettings-toggle-r1/) 做 6 次 Reduce UI Animations 开/关配对（12 次 ADB tap，改变后立即恢复；after 截图开关状态和 ready 相同），Perfetto 10 秒窗口内提交 589 个 app layer frame，活动段 present p50/p95/max 8.33/8.71/16.07ms，>16.67ms gap 0、deadline miss 0；`UPDATE_PROPS` p95/max 0.75/1.17ms、mount max 2.47ms。这个短时动画控件交互样本不是整页或真实手指验收。

ThemeSet 的 r1 after 截图曾有一张标题错位/重复的瞬态。相同 Release 路由重新做两次 10 秒纵向 swipe，并在抬手后 0.3、1、3、10 秒取截图；两轮所有时点标题和卡片布局正常，未复现该图像。截图和时间点保存在 [`themeSet-screenshot-repro/`](release-build/no-hidden-tabbar/themeSet-screenshot-repro/)。没有因单张截图修改 glass recorder / RenderNode 缓存。

每页 analyzer 还导出 `input-dispatch-slices.csv`，`trace-analysis-summary.json` 同时包含 native scroll callback 与 Activity move-dispatch 的间隔分布；计算方式在 [`analyze-comments-trace.py`](../../../../scripts/performance/analyze-comments-trace.py)。Perfetto app/thread 层未导出可稳定解释的 GPU 执行时间；每路由单独 GPU p95 仍只有前一节 GfxInfo 烟测的近似值。逐页 Release scroll-offset 数值序列、物理触摸派发、Hermes GC、热态长时间轮次仍未完成。
- 2026-10-06 的 Release route sweep 覆盖部分 Settings / ThemeSet 子页，但不是当前工作区的逐帧滚动证明，且其记录已明确呈现长尾并警告不能归因。来源：[route smoke summary](../20261006-page-virtualization-release-smoke/summary.md)。

## 验证状态

- Comments 更改文件 TypeScript 定向检查通过；相关 TSX ESLint 通过；`npm test` 通过，162 项；`git diff --check` 通过。
- 全量 `npm run check` 的 TypeScript 步骤被 `docs/performance/runs/settings-debug-root-cause/` 下 15 个归档快照 TSX 缺失相对导入阻断，均不在本轮改动代码路径。`npm run lint` 通过，无 error，保留 13 个已有 warning。
- 新改动的 `_layout.tsx` 已重新通过目标 TypeScript、ESLint 和 `git diff --check`；候选 APK Release assemble 成功、签名与原包相同、`debuggable=false`。原包/候选包 Release 热切 Comments 转场按 A/A → B/B → A → B 的顺序复验（A 崩溃三次，B 成功三次），候选包的 24 秒 scroll trace 重复三轮。
- 同签名 Release APK 仅通过 `adb install -r` 原地替换；未清空应用数据。原始 APK hash 保留并未覆盖。旧 Release 的 60 秒热态样本与候选的 3×24 秒 trace、11 页 Release smoke 已归档。
- `npm test` 162 项、`npm run lint` 无 error（13 个既有 warning）；全量 `npm run check` 的 TypeScript 步骤仍被 `docs/performance/runs/settings-debug-root-cause/` 中 15 个归档快照 TSX 缺少相对导入阻断。GC 未测量，不能从当前 logcat 缺少 GC 行推断运行期间没有 GC。
- 没有真实手指自动化结果。本轮 `adb shell input swipe`、tap 均标注为 synthetic；回复面板用 Android Back 关闭。

## 未解决项

1. FlashList Release 滚动的 present p95 仍约 8.84–8.93 ms，present work p95 仍约 12.72–13.34 ms；需继续把 Fabric mount item 的 view tag / component 与同一 FrameTimeline 时间窗关联，查清剩余长尾 props 来源。Home r1/r3 可复现的 19ms mount/layout 峰值尚未按 item 高度测量和窗口挂载做受控 A/B/A。
2. 三轮候选 Release trace 仍有 missed deadline 与 >16.67 ms 间隔；一次性 490.7 ms 原包间隔的成因尚不明确。Release 实际 scroll offset 与触摸派发还没有同窗口测量；Debug synthetic offset p95 约 33 ms。
3. 11 个页面已有各一轮短时 Release FrameTimeline；Home 与 Product v1 有额外复测，另有一轮 Home 输入不足作废。Question、People、Settings、Home、ThemeSet、个人页还需要在相同数据集下做多轮稳定滚动和快速惯性复验。物理触摸、GC、持续滚动后的 JS heap 与更长时间 thermal/内存曲线也未覆盖。
4. 玻璃高对比动态背景、图片更新、列表增删，以及 TopAppBar、TabBar、BottomSheet、Dialog 转场的完整截图和逐帧正确性矩阵尚未完成。当前截图只确认 Comments/Replies/Answer detail 的液态玻璃外观和滚动内容正常。

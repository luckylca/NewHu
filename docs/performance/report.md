# NewHu Liquid Glass 性能架构修复报告

日期：2026-09-29（历史架构报告）。所有频率和耗时来自连接的 Android 真机；自动滚动/切换场景为 benchmark route 合成操作，不是手指输入。

## 2026-10-13 全页面 120Hz 跟进

当前全页面验证针对 Xiaomi `23117RK66C`（Android 16 / HyperOS，1440×3200，120Hz，ADB serial `9ea3b4d2`）和当前脏工作区 `acfd172ab17447e2312910f4e6e9c1ec549ba45f`。本节数据在单独目录 [`20261012-full-page-120hz-session/RESULTS.md`](runs/20261012-full-page-120hz-session/RESULTS.md)；没有用旧提交覆盖工作区。原始 APK、工作区状态、源文件 hash、候选 Release APK 和签名信息均保留在对应实验 artifacts。

- Comments 的分页新增挂载是当前有 A/B/A 支持的页面根因：相同 43 条评论内存追加下，FlashList v2 三组匹配对照的 >16.67ms present interval 减少 48–52%，deadline miss 减少 24–45%；p95 仍高于 8.33ms，没有达到稳定 120Hz。
- 候选 Release 在 11 个主要路由各完成 24 秒 FrameTimeline 窗口；Home 和 Product v1 另作两轮复测。FrameTimeline app layer cadence、native `ReactScrollView.onScrollChanged` 回调、Activity MOVE 派发与 Fabric slice 独立汇总，ADB synthetic input 不当作实际内容 FPS。Question/People/Settings/Home/ThemeSet/Product 的 native scroll callback 中位间隔约 8.2–8.7ms；多页面仍有 p95 跨两个显示周期的尾部。Home 约 19ms mount 批次多轮可复现但 view/component 归属尚无证据；Product 首轮 228 次 deadline miss 后两轮为 2/0，不归因。
- Core `oneShotPassThrough` 和 glass shader/material/recorder/scheduler 本轮未改。Comments Debug telemetry 约37秒记录 7,050 descendant invalidation、7,014 次避免 source rerecord；scroll 期间 source rerecord 为0，整个窗口仅启动时录制1次，没有证据支持每帧重录共享 backdrop。ThemeSet 的一次标题错位截图经两轮分时复拍未复现。
- Comments 行复用和隐藏 TabBar 的路由修复保留正文、回复、点赞、Swipeable、按压反馈、玻璃材质、PageView 左右滑动和 sheet 转场。隐藏默认 TabBar 修复通过 Release A/B/A 消除了热路由重复崩溃；没有得到可重复的滚动性能提升。
- 当前全页面 120Hz 验收仍未完成：真实手指输入未测，GC/更长热态曲线未测，Release 每页 offset y 数值没有直接 trace，Home mount attribution 和高对比背景/图片/列表增删/所有浮层视觉矩阵尚未完成。测试和构建状态见上述 `RESULTS.md`。

以下部分保留 2026-09-29 在另一台 Xiaomi `2405CPX3DC` 的 Glass 共享架构实验记录，不应与 23117RK66C 的全页面 Trace 合并比较。

## 验收结论

这轮修复去掉了 Balanced 模式 60Hz capture 上限，加入 source dirty 与玻璃 optical sampling region 的相交判断、帧级 capture 合并、RenderNode 缓存和 consumer 几何缓存；debug、release 均已构建，Release APK 已安装到真机。无玻璃基线接近 120Hz，覆盖滚动内容的 1～3 个玻璃场景约 116Hz，Tab 程序化切换约 119Hz。

**完整 120Hz 验收尚未通过。** 用与设置页相同、TopAppBar 与 ScrollView 紧邻的精确 Scene C 测试时，光学采样外扩区域与 ScrollView 相交，因此每次滚动仍会触发保守的整场景 RenderNode 重录：559 次/11 秒；要求的“非重叠滚动时约 0 capture”没有达到。Dialog 的 FrameTimeline trace 也有明显长帧。当前实现没有降低材质质量或改动画，但不能据此宣称设计系统页已稳定 120fps。

## 设备、构建和测量边界

- 设备：Xiaomi `2405CPX3DC`，Android 16 / HyperOS 3，分辨率 1224×2912，density 520。
- 系统 active display mode 实测 120.00001Hz，支持 120/90/60/40/30/24Hz；`peak_refresh_rate=120`，系统 min/user 值未显式设置。`dumpsys display` 的 app frameRateOverride 为空、override config disabled，没有发现 app 单独 60Hz cap。Window preferred rate 字段未由该 ROM 明确回报；主屏 active mode 与 app 前台运行时仍是 120Hz。
- 完成的性能基线是**当前改动后的 0-glass A 场景**，Debug 和 Release 各测 3 轮、每轮 11 秒；没有改动前留存的同一套 FrameTimeline 基线，所以不能伪造“修复前后”的数值对比。
- Android shell 注入触摸被系统以 `SecurityException: INJECT_EVENTS` 拒绝，当前控制面也没有真机触摸能力。A–H runner 使用 `scrollTo(animated)`, 程序化 Tab 选择和 modal toggle；所以 Tab H 是程序化切换，不是快速手指拖动，未测 RNGH 的真实 touch cadence。
- `SurfaceFlinger --latency` 为最近呈现帧的环形尾窗；GfxInfo 百分位是整个样本、精度为整数毫秒；FrameStats stage 百分位是尾窗。静态 Scene B 不提交连续帧，因此 FPS/百分位为 N/A，不能把它说成 120fps。

## 架构改动

### P1：刷新率不再取决于质量预设

`GlassSurface` route provider 和 `GlassTabBar` 局部 provider 的 capture 上限不再根据 `quality === high` / `balanced` 二选一；Balanced 不会再被写死在 60Hz。native scheduler 通过 display refresh 信息和 Choreographer 帧回调调度，并将内部上限封顶 120Hz。设备只有 60/90Hz 时由实际 display cadence 决定，不强行请求 120。没有改 shader quality、材质、采样数、透明度或动画参数。

### P2：按 source dirty bounds 与 optical sampling bounds 求交

新增 `DirtyRegionTracker`。descendant invalidation 被映射到 Provider 坐标，并沿祖先 `clipChildren` / `clipToPadding` 裁剪；tracker 用可复用的几何对象和有界缓存保存失效 View 的 source bounds。只有 dirty bounds 与 active consumer optical sampling bounds 有交集才将 backdrop 标 dirty；无交集记为 `captureSkippedNoIntersection`。

光学 margin 以 density 转像素，包含 blur、surface/body refraction、折射高度、chromatic displacement 与 8dp safety margin：

```text
blurExtent      = max(blurRadiusDp, 0) * 2
                  + |refractionAmountDp| * 1.38
                  + |bodyRefractionAmountDp| * 1.35
edgeExtent      = |refractionHeightDp| * 1.42
chromaticExtent = |chromaticAberration| * 1.85
                  * (|refractionHeightDp| * 0.12
                     + |bodyRefractionAmountDp| * 0.08)
marginPx        = ceil((max(blurExtent, edgeExtent)
                  + chromaticExtent + 8) * density)
```

这些 bounds 是保守的 sampling envelope，保持折射、模糊、色散边缘正确；dirty View bounds 还会外扩 `ceil(max(2px, elevation*1.5 + 2*density))` 的绘制安全边距，并经过祖先 clip。当前 invalidation API 给 tracker 的是 target View bounds，不是像素级 damage rect，所以这是偏保守的判定，也会产生 false positive。本轮不是 cropped recording：dirty intersect 后仍以**一次** `dispatchDraw` 录制完整 source scene 到缓存 RenderNode，避免 cropped recording 导致同帧双遍历 RN View 树；无交集或无 source dirty 时直接复用玻璃 backdrop RenderNode。

精确 Scene C 的外扩 envelope 碰到紧邻 ScrollView，故它被正确分类成可能影响玻璃的 source 变化并重录。忽略 margin 虽可把该数字变为零，却不能证明玻璃边缘的 blur/refraction/chromatic samples 不会看见滚动内容，也可能制造边缘陈旧；因此没有以破坏光学正确性换零 capture。C 是当前首要未完成项。

### P3：capture request 合并和 dirty 分类

新增 `CaptureScheduler`，用 Choreographer / `postInvalidateOnAnimation` 安排帧级工作，合并 pending dirty regions，同一帧多次 request 不会多次排队。离开最后一个 consumer 时清 dirty、释放 recorder；没有 consumer 时走普通 `super.dispatchDraw`，不录制 RenderNode。

Provider 分辨 source content、consumer geometry、optics 和 material 更新。consumer movement 不要求 capture（RN 配置 `requiresCaptureOnConsumerMovement=false`）；Lens/press/motion 更新 uniform/consumer draw。blur/refraction/tint 更新效果或 uniform，仅 sampling extent 改变时重算 bounds。consumer mount 可以引发一次初始 capture。多个 request 被 `alreadyDirty` 合并计数。

### P4：consumer 几何缓存

加入 geometry version 与 Matrix/Rect 重用，普通稳态 draw 不再每帧为每个 consumer 调 `getLocationInWindow`；祖先 layout、scroll 和 transform/scale/rotation 变更时更新映射，fallback 只在逆矩阵映射失败时使用。Dialog、Sheet、拖动等位置变化仍会更新 consumer sampling coordinates，但本身不标记 source dirty。稳态 A/C/D/E 记录的 geometry lookup 为 0；Tab Lens 有实际动画变换，H 有几何查找（约 1084 次/11 秒/轮），这是动态 consumer 更新而非 source capture。

### Telemetry 与 Release 日志

native opt-in 低频 telemetry 每秒输出 request/capture/source dirty/geometry dirty/optics/material/no-intersection/already-dirty/scheduled/glass draw/effect build/geometry lookup/UI frame/refresh 增量。JS benchmark overlay 500ms 采样、500ms（2Hz）刷新；Release 的 `console.info` / benchmark log 已受 `__DEV__` 限制。稳态 D/E 的 `effectBuilds=0`，但没有 Android Studio allocation profiler 的 bytes/frame 数据，故不宣称 zero allocation/frame。

## A–H 真机结果

每个 runner 样本 11 秒，每场景 3 轮。帧间隔为 SurfaceFlinger 呈现尾窗；工作时长是 FrameStats 尾窗。数值是三轮分析汇总。

| Scene | 描述 | SF/活动 trace Hz | 呈现间隔 P50/P90/P95/P99 ms | FrameStats work P50/P90/P95/P99 ms | >1.5×周期间隔 | HWUI deadline miss | capture/轮 (11s) |
|---|---|---:|---|---|---:|---:|---:|
| A | 无玻璃 ScrollView | 116.59 | 8.313/8.315/8.316/16.626 | 5.182/7.886/9.005/11.738 | 4 | 0 | 0 |
| A-wallpaper | 无玻璃 + WallpaperLayer | 116.60 | 8.313/8.315/8.316/16.625 | 6.351/8.958/10.163/11.303 | 4 | 0 | 0 |
| B | 静态页面 + 单玻璃 | 静态，无持续提交 | N/A | N/A | 0 | 0 | 0 |
| C | TopAppBar glass + 紧邻 ScrollView | 116.54 | 8.317/8.319/8.320/16.635 | 8.784/9.767/10.159/10.913 | 4 | 0 | **559** |
| D | Glass 覆盖滚动内容 | 115.68 | 8.314/8.316/8.317/16.630 | 10.336/11.776/12.136/13.121 | 5 | 0 | 559 |
| E | 3 个 GlassSurface + 内容滚动 | 116.52 | 8.312/8.315/8.316/16.626 | 10.144/11.811/12.086/12.977 | 4 | 0 | 561 |
| F | Dialog enter/exit 合成 toggle | 87.07（含静止段，不代表动画 cadence） | 8.316/8.318/8.320/74.843 | 7.995/11.708/12.204/12.821 | 2 | 0 | 0 |
| G | BottomSheet enter/exit 合成 toggle | SF 总样本稀疏，见活动 trace | 活动段见下方 | 8.592/12.622/13.308/16.097 | 活动段 0 | 0 | 0 |
| H | 每 320ms 程序化选择 Tab（非手指拖动） | 119.30 | 8.316/8.318/8.318/8.320 | 7.123/8.242/8.559/10.242 | 1 | 0 | 666 |

| Scene | GfxInfo P50/P90/P95/P99 ms | GPU GfxInfo P50/P90/P95/P99 ms | FrameStats UI/RenderThread/GPU P95 ms |
|---|---|---|---|
| A | 5/9/10/13 | 2/2/3/4 | 2.585/3.465/1.814 |
| A-wallpaper | 6/9/11/13 | 3/3/4/5 | 2.264/3.277/3.137 |
| B | N/A（静态无提交） | N/A | N/A |
| C（精确布局） | 9/10/10/12 | 4/5/5/6 | 1.852/2.667/4.286 |
| D | 11/12/13/16 | 6/7/7/8 | 1.835/2.844/6.545 |
| E | 10/12/12/13 | 5/6/6/6 | 2.234/4.208/5.263 |
| F | 9/12/14/16 | 4/6/7/11 | 2.247/2.097/5.753 |
| G | 8/12/13/15 | 3/5/6/6 | 5.023/2.863/5.253 |
| H | 7/9/9/11 | 3/3/3/4 | 1.097/2.340/2.864 |

Native 低频 telemetry 的三轮平均值（每轮约 11 秒；表中 request/capture/draw/lookup/no-intersection/already-dirty 换算为每秒）：

| Scene | request/s | capture/s | no intersection/s | already dirty/s | glass draw/s | effect builds/run | geometry lookups/s |
|---|---:|---:|---:|---:|---:|---:|---:|
| A / A-wallpaper / B | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| C（精确布局） | 101.6 | 50.8 | 0 | 50.8 | 50.8 | 0 | 0 |
| D | 101.6 | 50.8 | 0 | 50.8 | 50.8 | 0 | 0 |
| E | 102.0 | 51.0 | 0 | 51.0 | 152.9（三消费者） | 0 | 0 |
| F | 0 | 0 | 0 | 0 | 1.6 | 90 | 0 |
| G | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| H（程序化选择） | 1021.8 | 60.5 | 89.8 | 961.2 | 118.8 | 0 | 98.6 |

F 每轮有 18 geometry dirty、144 material dirty、90 effect builds，capture 为 0。90 次 effect builds 来自 Dialog 反复 mount/transition 生命周期，不是 steady-state 每帧值；需要继续查明是否有重复 effect 构建。H 每轮约 11239 requests、666 captures、10706 source dirty、943 geometry dirty、988 no-intersection、10574 already-dirty、533 scheduled、1306 glass draws、1084 geometry lookups；optics/material dirty 为 0。相交判断确实跳过了 Tab provider 约 90 次/秒的无关失效；Tab 场景仍有约 60.5 captures/秒，且其高 request 数与镜头/图标焦点动画源变化并发，不能据此声称静态 source + moving consumer 为零 capture。

P95 三元组顺序为 UI / RenderThread / GPU。GfxInfo GPU 是整数毫秒取整；它与 Perfetto 中 GPU completion 的 CPU running time 不是同一种度量。

### FrameTimeline trace

完整 trace processor 导出：

| Trace | 有效 app surface 呈现 | Present interval P50/P90/P95/P99 ms | 长间隔 | Janky presentations | deadline miss |
|---|---:|---|---:|---:|---:|
| D Release 滚动 | 421 帧 / 3.598s，116.72Hz | 8.336/8.716/8.856/16.651 | 13 | 31 | 2 |
| F Dialog 活动窗口 | 492 帧 / 6.046s，81.21Hz（含转场/空档） | 8.331/8.681/8.903/96.272 | 12 | 146 | 6 |
| G BottomSheet 活动呈现段 | 543 帧 / 4.507s，120.26Hz | 8.324/8.673/8.767/9.094 | 0 | 0 | 1 |

Perfetto 整段 CPU running time（D / 12 秒 trace）：Main UI 1.620s、RenderThread 1.750s、JS 0.555s、GPU completion 0.079s；未见某单一线程在整个 trace 持续饱和。该值是 trace-wide CPU running time，不能当作单帧耗时。F 的长间隔和 deadline miss 表明 Dialog 仍有明显 hitch；G 的活动段接近 120Hz。Android Dalvik GC slice 查询在这些 trace 中没有观测到 GC event；这不能替代 allocation/frame profiler。

新增 FrameTimeline 窗口内的线程 CPU-running 关联查询（窗口为 app expected frame 到 actual present 结束，线程间可能并行，不能把这些数相加当 frame time）：

| Trace | Main UI CPU P95/P99 ms | RenderThread CPU P95/P99 ms | JS CPU P95/P99 ms（有运行的窗口） | GPU completion CPU P95 ms | GPU GfxInfo P95 ms |
|---|---|---|---|---:|---:|
| D | 4.405/4.946 | 7.118/8.203 | 2.977/3.566（414） | 0.359 | 7 |
| F Dialog | 6.201/9.516 | 6.952/8.018 | **9.767/9.977（26）** | 0.383 | 6 |
| G BottomSheet | 5.381/6.246 | 5.315/6.636 | 9.225/9.991（21） | 0.318 | 6 |

括号为该线程有 CPU running 片段的 frame 窗口数。F 的 JS 活动帧 P95 已超过 8.33ms，UI/RenderThread 高分位也有超过预算的 outlier，是 Dialog hitch 的可疑路径；但 96ms 的 present gap 不能从这些汇总值归因到单一线程。GPU GfxInfo P95 与 FrameStats GPU stage P95 都低于 8.33ms，现有数据不支持 GPU 为持续瓶颈。Scene D 的 CPU/GPU P95 单项也低于预算，但呈现间隔 P95 8.856ms、FrameStats work P95 12.136ms；更像多个阶段与 vsync 排队合成超时，而不是已证明某一个独占 stage 超预算。查询脚本见 [perfetto-frame-cpu.sql](../../scripts/performance/perfetto-frame-cpu.sql)。

JS RAF overlay 的额外诊断轮：A 中位约 118.5fps、间隔 P95 10.7ms，超过 8.33ms 的间隔约 50%；D 中位约 120.1fps、间隔 P95 9.56ms、超预算间隔约 48.9%。overlay 自身每 500ms 更新 React 状态，诊断数据受测量开销影响，不作为主结果。Release 正式样本中 JS log 已关闭。Perfetto D 的 JS thread CPU running 为 0.555s / 12 秒 trace（4.65% trace wall time）；这不是 JS 帧耗时，也没有证据表明 JS thread 持续饱和。

## 各场景解释

- **A / A-wallpaper**：Release 无玻璃基线 SF 尾窗 116.59Hz，FrameStats work P95 9.005ms；Debug A SF 116.57Hz，work P95 7.827ms，GfxInfo P95 9ms、GPU P95 2ms、HWUI deadline miss 1。Wallpaper 场景比 A 的 GfxInfo P95 高 1ms、GPU P95 高 1ms。基线接近设备呈现 cadence，但 SF 尾窗仍有 4 个超过 1.5 个周期的间隔，故不是每帧稳定 120 的证据。
- **B**：静止无 capture；静态 layer 不持续提交，所以没有 FPS 百分位样本。
- **C**：这次是修正后的精确布局（TopAppBar 后直接接 ScrollView，没有人为留白，符合设置页布局）。每轮 559 capture / 11 秒，约 51 次/秒；source dirty 约 1117 次、`alreadyDirty` 约 558 次/轮，`noIntersection=0`。捕获数未达到目标的约 0。旧的带 80dp 间距 Scene C 数据已废弃，不用于验收。
- **D**：约 559 capture / 11 秒（约 51/s），source dirty 约 1117、already-dirty 合并约 559；capture 频率受合成滚动产生的 source invalidation cadence 限制，不是玻璃 quality 的 60Hz cap。FrameTimeline 仍有 31 个 janky presentations 和 2 个 deadline miss，P99 16.651ms。
- **E**：约 561 capture / 11 秒、三玻璃总计约 1682 次 consumer draw；未限制为单玻璃。帧工作 P95 12.086ms，高于 8.33ms 预算。
- **F / G**：Dialog 20 次合成进出过程中 capture 为 0，说明 consumer movement 没把 source 标脏；但 Dialog transition 的 FrameTimeline 有明显长帧。BottomSheet capture 也为 0，活动呈现段约 120.26Hz、无长间隔。不能把 F/G 的整段混合静止时间平均值当作动画 FPS。
- **H**：程序化 Tab 选择的 SF 尾窗 119.30Hz；tab/lens glass draw 约 1306 次/11秒（约 119/s），局部 provider 仍局限于 Tab 和 optical margin。该场景约 666 capture/11秒并有约 1084 次动态几何查找，且它不是 RNGH 手指快拖数据，不能宣称 touch cadence 通过。

## 验证与复现

- `npm run check`：通过；TypeScript、lint 0 errors（13 个已有 warning）、157 tests passed。
- `npm run build --prefix project/react-native-liquid-glass`：通过。
- `cd android && ./gradlew :liquid-glass-kit:compileDebugKotlin :app:assembleDebug`：通过（最终 Debug 构建）。
- `npm run android:release:arm64`：通过；最终 Release APK 在精确 Scene C fixture 后重新构建并安装到真机。
- `npx patch-package --patch-dir project/react-native-liquid-glass/patches`：最终重放通过。只有 `project/react-native-liquid-glass/patches/liquid-glass-kit+1.0.0.patch` 一份 liquid-glass-kit patch；没有根目录 `/patches` 临时补丁。
- benchmark：`bash scripts/performance/benchmark-android-glass.sh`；解析：`python3 scripts/performance/analyze-android-glass.py`。默认 A–H 各 3 轮 × 11 秒。输入注入权限被系统拒绝，故当前 runner 的动作仍是 route-auto 合成动作。

当前 patch 统一 diff 中包含原 vendored native 源文件的空白行，导致把 patch 文件本身也纳入 `git diff --check` 时出现尾随空白提示；这是 patch 内容格式/上游空白，不影响 patch-package 重放。benchmark TS 源文件的真实尾随空格已清理。其余工程源文件需单独运行 `git diff --check -- . ':!project/react-native-liquid-glass/patches/liquid-glass-kit+1.0.0.patch'` 检查。

## 工件

- Runner、解析器、FrameTimeline SQL：[benchmark runner](../../scripts/performance/benchmark-android-glass.sh)、[analyzer](../../scripts/performance/analyze-android-glass.py)、[FrameTimeline SQL](../../scripts/performance/perfetto-frame-timeline.sql)、[per-frame CPU SQL](../../scripts/performance/perfetto-frame-cpu.sql)
- Release A–H 三轮：[summary](runs/release-final-sf-cleared/summary.md)（其中旧 C 行已被精确布局 C 替代）
- 精确布局 Scene C：[summary](runs/release-scene-C-exact-topbar/summary.md)
- Debug A 基线：[summary](runs/debug-final-sf-cleared/summary.md)
- Perfetto D/F/G：[trace 输出目录](traces/)
- 最终 Release APK：[app-release.apk](../../android/app/build/outputs/apk/release/app-release.apk)
- Design System 最终 Release 截图：[design-system-final-release.png](design-system-final-release.png)；最终安装包在该页面额外静置采样 11 秒，GfxInfo `Total frames rendered=0`、deadline miss=0，表示页面没有持续提交帧。静止状态下的 FPS 百分位无定义，不能据此声称滚动/交互稳定 120fps。原始文件在 `runs/design-system-final-release/`。

## 仍需完成的验收

1. 进一步缩紧采样影响判定，同时保住 glass 周边 blur/refraction/chromatic 的边缘采样正确性，使设置页精确 Scene C 在滚动时达到近零 capture。
2. Dialog hitch 仍未解决；当前 trace 的 P99 间隔 96.272ms、6 个 deadline miss。需用可控手势/逐阶段 trace 定位 RN overlay、RenderThread、系统合成及 dim/source 层级，再修复后复测。
3. 接入真实手势自动化或在设备上手动完成快速滚动、Lens 拖动、Tab 快拖及 Dialog/BottomSheet 各 10 次；当前 Android shell 注入限制使其无法通过本 runner 完成。
4. 对最终 `app/dev/design-system.tsx` 做 Release 至少 10 秒 FrameTimeline 捕获，并报告 120Hz touch interaction 下 UI/RenderThread/GPU/JS 与 allocation/frame。当前静态页面截图/静止样本和 A–H synthetic route 不能代替这项验收。

因此，本次可确认 P1、dirty intersection、request coalescing、consumer movement 不触发 source capture、无 consumer 低成本路径以及 Debug/Release 构建已落地；**“设计系统页肉眼稳定接近 120Hz”的最终目标仍未完成**。

# AGENTS.md — NewHu 工程约定与性能经验

> 本文件提炼 2026 年 9–10 月 Android Liquid Glass、Settings、ThemeSet、Home、Storage、Question 的性能实验。历史报告只是特定版本证据；结论必须与当前源码和设备重新核对。

## 工程结构与不可破坏的功能

- Expo / React Native：`app/` 路由，`src/` 业务，`project/react-native-hyper-ui/` 页面模板/主题组件，`project/react-native-liquid-glass/` Native Core 玻璃引擎。`modules/expo-theme-preview/`、`modules/expo-file-integrity/` 是实际引用的原生模块，不是实验废件。
- 普通页面优先 `PageScaffold`、`SettingsPage`、`StaticSettingsPage`、`FeedPage`；不要给业务页面随意复制列表参数或 TopBar。其他细节见 `docs/development/page-runtime.md`。
- Android 玻璃 Core 应在任何 Provider 挂载前固定，主题切换不应更换底层 Surface 组件树。ThemeSet 的 `TopAppBar` 仍需 `samplingSource="routeScene"`，动态折射下方正文；换成 `themeBackdrop` 虽能绕开一类卡顿，但不是视觉等价修复。
- 不牺牲玻璃折射、模糊、色散、高光、材质、动态背景和动画，也不能为求分数直接限制刷新率。优化必须保留业务数据、设置和回退/取消操作。

## 已验证的根因及容易复发的错误

1. **跨 Provider 假滚动（主要根因）**：`ViewTreeObserver.OnScrollChangedListener` 属于窗口级，不代表本 Provider 的 scrollY 已变化。原来仅因 `host.hasBackdropConsumers` 为真就触发 `onScrollMoved()`，兄弟 Provider 导致错误滚动活跃/玻璃刷新。`GlassBackdropCoordinator.kt` 必须以真实 `trackedMovement`、明确的外部滚动活动或一次性新发现且具有实际滚动范围的 target 为依据。见修复提交 `0c2017a`（2026-10-15）。
2. **保持显式捕获模式**：route-transition 的 imperative resume 不得把 `oneShotPassThrough` 擅自改为 `live`。React Native ScrollView 要持续沿屏幕原生绘制路径工作；玻璃 route-scene 可单独按需录制局部 RenderNode，供 Consumer 取样。
3. **正确合并失效通知**：区分 source paint、structure、geometry、revision 和 Consumer/mat/optics 的 dirty；descendant paint 不能逐帧升级为整棵 route 重录制。`recordOnly()` 已安排 consumer invalidation 时不要再重复 invalidate。简单删除 Consumer 失效通知虽曾恢复内容帧，却造成顶部玻璃拉伸/错位；无条件在每个复用帧 invalidate Provider 曾出现“有帧但页面不动”，均不可采用。
4. **采样位置与内容位置同步**：局部裁剪、RenderNode `originX/originY`、录制窗口、ScrollView offset、Consumer bounds 必须统一坐标；不能只看 Present 帧数而忽略实际页面位移、玻璃采样拉伸、残影和高亮位置。关键代码：`android-core/.../backdrop/{GlassBackdropCoordinator.kt,BackdropRecorder.kt}`、`android/.../{ExpoGlassProviderCoreView.kt,ExpoGlassSurfaceCoreView.kt}`。
5. **ThemeSet 特殊结构**：它在普通 ScrollView 外还含多个主题 Provider、独立玻璃/原生预览、动态背景与壁纸，因此比简单设置页更易触发 Glass 状态机问题。历史未获稳定收益/已拒绝：盲目换 FlashList、ThemeStyleCard memo、装饰 SVG、硬件纹理层、壁纸 `resizeMethod`、简单删 invalidate、粗暴重采样或一味关动画。除非有新证据，勿再机械重复这些方向。
6. **隐藏 Home 任务**：PagerView 中 Home 即使不可见也可能返回推荐并进行 Native512 个性化排序，使 ThemeSet 竞争 JS/Fabric。`app/home.tsx` 应在不可见时暂存 Feed 结果并延后排序，返回 Home 后按刷新代次补齐；不能丢数据、理由标签、排序/持久化或覆盖其他来源的更新。
7. **Recycler 选择因页面而异**：StorageManagement 的 19 条离线内容在 Release A/B/A 中 FlashList v2 惯性更密；Question 的同数据对照没有证明 FlashList 稳定优于 FlatList。Settings 按 section 虚拟化，不要直接复制 Feed 的 recycler 参数；关 `removeClippedSubviews` 等策略也必须用真实测量证实。
8. **Storage 与 Dialog**：离线统计中的 SQLite 往返和目录扫描要分开量测；runtime 文件状态改为异步并行，不能把 Promise 墙钟耗时都算作 JS 同步占用。Storage 删除确认框曾在取消后使底页消失；`inlineBackdrop` + 只在 Dialog 使用的 `intrinsicInlineBackdrop` 修复，切勿全局更换 GlassSurface 根布局。保留 Donut Spring、背景和交互。
9. **正确交互语义**：不响应点击的 Card / ListRow 不应无意义注册 Pressable/responder；仍可交互的 Card 必须保留操作/反馈。任何视觉优化都要核对截图，禁止为了数字省掉用户可见的玻璃效果。

## 真实性能排查与验收协议

- 先分清：①触摸未传到 ScrollView / 已触边界，②`scrollY` 改变而屏幕没有实际 present，③内容帧持续但超过预算，④冷进入 Fabric mount/layout/图片 decode。不同故障不能都叫“页面锁 60fps”。
- 同步观测 ACTION_DOWN/MOVE/UP、真实 `scrollY`/scrollRange、onScrollChanged、Provider `dispatchDraw`、Consumer invalidate/draw、recordWindow/recordOnly 时间与 origin、UI/RenderThread、Perfetto FrameTimeline 的 Activity layer present。界定顶部和底部边界，无实际位移的正常停止不可算冻结。
- 120Hz 约 8.33ms 为显示 VSync。ADB 注入 ACTION_MOVE 约 60Hz 并不代表呈现只能 60fps；`gfxinfo` P95、Frame duration、FrameTimeline present interval、SurfaceFlinger 等指标不能相互偷换。包含导航/idle 的整条 trace P95 不能当作滚动 FPS。
- 比较应当是**相同数据/同设备/同构建类型/同 APK/同触摸距离/同采样窗口**的 A/B/A（必要时 A/B/A/B），每组至少三次有效重复。按 ACTION_UP 后仍真正滚动的区间独立统计 offset、Activity present、deadline miss 和截图像素变化；只见帧或只见回调不足以认定可见内容正常移动。
- 每轮记录 Git HEAD+dirty 状态、源码文件 SHA-256、构建 APK SHA-256 和设备安装 `base.apk` SHA-256、设备模式/温度、触摸时刻、截图和 trace。PID、手势失败、冷启动未进目标页、trace 环形缓冲覆盖、零滚动范围必须标记无效，不能挑最好看的数据。
- ThemeSet 至少覆盖冷启动、热重入、从最近任务划掉后启动、上下中段与边界反向、切到 HyperOS 再切回 Liquid Glass。顶栏必须动态采样滑过的正文且无错位/拉伸。Home、Settings、Question、Storage 同一 Release 至少做回归；测试 Storage 删除弹窗只打开/取消，不能真的删除内容或误触用户数据。
- ADB 合成手势不是物理手指测试，真实手感验证应另外报告。运行 `npm run typecheck`、`npm run lint`、`npm test`、`git diff --check`；Release 构建用 `npm run android:release:arm64`。自动化测试/长期脚本保留，不要将 `.tsx` 实验源快照放进 TypeScript 编译范围。

## 测试工具、产物与 Git 卫生

- 正式脚本位于 `scripts/performance/`，通用 Perfetto 配置位于 `scripts/performance/configs/`。ThemeSet 回归脚本为 `run-theme-release-repeat.py`，页面逐帧测试脚本为 `run-page-frame-timeline.sh`。新测试应允许显式指定 DEVICE_ID/输出目录，不能依赖已删除的某个实验目录或特定实验 APK。
- `.pftrace`、APK、日志、CSV、JSON、截图、截屏、编译缓存、源码实验快照全部是一次性产物，写到忽略追踪的 `.perf-runs/` 或 `docs/performance/runs/`，提炼结论后清理，不进 Git。2026-10-15 整理时清除了约 40GB/5.3 万件此类历史归档；旧报告中的临时路径与候选结论不可作为现行默认。
- 保留 `tests/` 真正单元/回归测试、本地原生模块源代码、必要的性能脚本、维护文档。不要把构建产物/测试副本当成产品源码，更不要删除尚被 `package.json` 引用的模块。
- 任何操作先核对 `git status --short`、`git branch -vv` 与 ADB 设备；不得 `git reset --hard`、`git clean -fdx`、清除 App 数据或覆盖其他 Agent 改动。先确认需保留的未提交用户修改，再提交。
- `git commit` 仅提交本地历史，`git push` 才上传远端 GitHub。报告必须区分已提交与已推送，不得声称未执行的工作。

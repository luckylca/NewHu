# NewHU MIUIX / Motion System

本规范用于新增页面和组件。视觉语言由项目内 `.reference/miuix-vue` 提炼，动画以 Reanimated 为主，复杂手势使用 Gesture Handler，导航继续由 Expo Router / Native Stack 管理。

## 颜色与层级

- 页面使用语义色 `background` / `surface`，卡片使用 `surfaceContainer`。
- 主操作使用 `primary`，文字必须使用对应的 `on*` 语义色。
- 次级文字使用 `onSurfaceVariantSummary`，三级操作使用 `onSurfaceVariantActions`。
- 壁纸模式依赖透明表面与留白形成层次；不在全局背景、卡片、Header、Modal、Sheet 上叠加多层 Blur。

## Radius / Spacing / Typography

- Button / Card / Input：16dp。
- Bottom Sheet 顶部：28dp；Dialog：32dp；圆形控件：full。
- 间距只使用 `xs 4 / sm 8 / md 12 / lg 16 / xl 24 / xxl 32`。
- 页面大标题使用 `title1 32`，普通标题使用 `title3 20` / `title4 18`，正文使用 `body1 16`，摘要使用 `body2 14`。

## Motion token

- 通用时长：instant 0、fast 120ms、normal 200ms、slow 300ms。
- 组件参数保留 MIUIX 的独立 Folme spring，不强行压成一条曲线。
- `press`：Card sink `folmeSpring(0.8, 600)`。
- `standard`：damping 0.9 / response 0.38。
- `soft`：damping 0.86 / response 0.46。
- `sheet`：damping 0.9 / response 0.38。
- 动画数值只能放在 `src/ui/motion`，业务页面不得新增任意 duration/spring 常量。

## Press behavior

- Button、ListItem 使用 120ms 的 onBackground alpha indication，press opacity 0.10，不缩放。
- Card sink 从 1 到 0.94；只有明确需要空间感的卡片使用 tilt。
- IconButton 可用约 0.84 → 1.10 → 1 的短状态反馈；不延迟业务动作。
- Haptic 只用于 Switch、完成引导、删除确认、收藏/重要状态，不用于普通跳转和列表点击。

## 组件规则

- Card：16dp、无默认重阴影；长列表不批量 entering。
- ListItem：min-height 56、padding 16、gap 8；标题 17 medium、摘要 14。
- Switch：49×28、thumb 20、travel 21；track、thumb offset、thumb scale 各用源码 Folme 参数。
- Checkbox：26dp 圆形；背景 300ms，check 10ms in / 150ms out，按压 sink 0.85。
- Dialog：必要确认/危险操作；手机底部进入，大屏居中 scale。
- Bottom Sheet：选择/操作列表；handle 可拖动、150dp dismiss threshold、向上拖动有阻尼。
- Navigation：使用 Native Stack push；内部内容不重复套全屏 translate/fade。底栏不 remount 页面。

## Enter / Exit / Layout

- Onboarding 每一步只对单个内容容器做 opacity + translateY，避免 PPT 式逐字动画。
- Feed 首屏最多允许少量轻 stagger；当前为保证 Android 性能不启用批量进入动画。
- 删除或新增单项时才考虑 Layout Transition；长列表和 HTML 正文保持稳定布局。
- 图片预览允许 transform/opacity；不引入不稳定 shared-element 方案。

## Reduced Motion

- 统一由 `MotionProvider` 合并系统 Reduce Motion 与“减少界面动画”设置。
- 关闭大幅 translate、3D tilt、spring scale、stagger。
- 保留 100–120ms 的必要 opacity 状态反馈。
- Navigation 使用短 fade；Dialog/Sheet 不再从屏幕外大幅移动。

## Loading 与空状态

- 页面首次加载使用 `LoadingView` + MIUIX 线性进度。
- 下拉刷新保留列表原生刷新语义；分页只在底部显示小型状态。
- 按钮提交在按钮内反馈，不覆盖整页。
- 图片加载不让整个正文重排；失败时保留占位尺寸。

## Android 性能原则

- 高频动画只用 transform / opacity，运行在 UI thread。
- 不持续动画 width、height、margin、padding、shadow 或 blur。
- SQLite / 大列表加载通过 `InteractionManager` 与路由动画错峰。
- 120Hz 下优先减少首帧布局与纹理上传；如果动画本身引起 jank，应直接移除。
- 开发模式结果只用于定位，最终还需用 release 构建复核。


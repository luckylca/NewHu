# TASK — UI Design System 重构与 Miuix / HyperOS 精确复刻

> **本文件是本次 UI 重构任务的最高优先级说明。**
>
> 执行本任务时，不要把目标理解为“把现有页面改得更像 HyperOS”，也不要只做颜色、圆角、毛玻璃等表层视觉修改。
>
> 本次任务的真正目标是：
>
> 1. 彻底结束当前以 `react-native-paper` API 兼容为核心的临时 UI 层；
> 2. 建立项目自己的 React Native / Expo Design System；
> 3. 将颜色、Typography、圆角、Surface、组件尺寸、交互状态、动画等集中管理；
> 4. 让业务页面只负责业务和布局，而不负责定义视觉语言；
> 5. 第一套正式视觉主题严格参考 `YuKongA/miuix-vue` / Miuix；
> 6. 最终达到：
>
> ```text
> 知乎业务结构 × Miuix / HyperOS 设计系统
> ```
>
> 而不是：
>
> ```text
> Material Design 去掉 react-native-paper
> + 大圆角
> + 蓝色
> + 毛玻璃
> ```
>
> **非常重要：这不是一次简单的换肤，而是一次 UI Architecture Refactor + Design System 重建。必须保证业务功能不被破坏。**

---

# 1. 当前背景

当前项目为：

```text
React Native
Expo
TypeScript
```

此前为了移除 `react-native-paper`，项目中建立了：

```text
src/components/ui/
```

这一层主要用 React Native 原生组件重新实现了过去 RNP 提供的一些组件/API，例如：

```text
Appbar.Header
Appbar.Content
Appbar.BackAction
Card
Card.Content
Dialog
Dialog.Title
Dialog.Content
Dialog.Actions
Menu
Menu.Item
Text variant="..."
Button
Switch
Snackbar
Surface
IconButton
Avatar
```

这一层解决了“移除 react-native-paper 依赖”的问题，但它仍然有一个核心问题：

> 它本质上还是在维持 React Native Paper 的 API 形状。

而且业务页面中还存在不少：

```text
直接 View / Pressable 写视觉组件
重复 Animated Pressable
重复 SearchBar
重复 Segmented Control
重复 List Row
重复 BottomSheet
重复 Tag / Badge
硬编码颜色
硬编码圆角
硬编码字体
硬编码动画
```

因此当前状态不是最终设计。

---

# 2. 本次重构最终目标

最终业务页面应该接近：

```tsx
<View style={styles.page}>
  <NavigationBar
    variant="large"
    title="知乎"
  />

  <SearchBar
    value={query}
    onChangeText={setQuery}
  />

  <FeedCard>
    ...
  </FeedCard>
</View>
```

而不是：

```tsx
<View
  style={{
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    shadowOpacity: 0.1,
  }}
>
```

业务页面中可以存在：

```tsx
View
FlatList
ScrollView
SafeAreaView
KeyboardAvoidingView
```

但这些组件应该主要承担：

```text
布局
滚动
虚拟列表
容器关系
安全区
```

而不是视觉语言。

---

# 3. 核心架构原则

必须牢记：

> **页面可以直接使用 RN 原生布局组件，但页面不能自己创造设计语言。**

## 3.1 可以直接使用 RN 原生组件的情况

例如：

```tsx
<View style={{ flex: 1 }}>
```

```tsx
<View style={{ flexDirection: 'row' }}>
```

```tsx
<FlatList />
<ScrollView />
<SafeAreaView />
```

这些属于 layout primitives，不需要为了“100% 自建组件库”而写成：

```tsx
<UI.View />
<UI.FlatList />
<UI.ScrollView />
```

如果只是透明转发 React Native props，就不要封装。

## 3.2 必须进入 Design System 的内容

如果一个东西包含：

```text
颜色
圆角
字体
字号
字重
边框
Surface
Shadow
Blur
Pressed
Selected
Disabled
动画
Spring
反馈
视觉尺寸
```

它就已经属于 Design System 范畴。

例如：

```text
Button
Card
SearchBar
Switch
Dialog
BottomSheet
NavigationBar
ListRow
Tag
SegmentedControl
Input
Snackbar
```

应统一进入：

```text
src/ui/
```

---

# 4. 判断一个组件是否应该抽象

满足下面任意一点，即应优先考虑进入 Design System：

1. 多个页面重复使用；
2. 有明确 UI 语义；
3. 换主题时需要改变；
4. 有统一颜色；
5. 有统一 radius；
6. 有统一 typography；
7. 有统一尺寸；
8. 有统一 Press 状态；
9. 有统一 Selected 状态；
10. 有统一 Disabled 状态；
11. 有动画；
12. 有手势；
13. 是一个完整交互控件。

---

# 5. 推荐的新目录结构

最终建议整理为：

```text
src/ui/

├── theme/
│   ├── types.ts
│   ├── tokens.ts
│   ├── hyperos.ts
│   ├── coloros.ts
│   ├── liquidGlass.ts
│   ├── ThemeProvider.tsx
│   └── index.ts
│
├── motion/
│   ├── folmeSpring.ts
│   ├── easings.ts
│   ├── presets.ts
│   └── index.ts
│
├── primitives/
│   ├── Text.tsx
│   ├── Surface.tsx
│   ├── Icon.tsx
│   ├── Divider.tsx
│   ├── PressIndication.tsx
│   └── PressableScale.tsx
│
├── components/
│   ├── Button.tsx
│   ├── IconButton.tsx
│   ├── Card.tsx
│   ├── SearchBar.tsx
│   ├── Input.tsx
│   ├── Switch.tsx
│   ├── SegmentedControl.tsx
│   ├── NavigationBar.tsx
│   ├── ListRow.tsx
│   ├── Tag.tsx
│   ├── Avatar.tsx
│   ├── Dialog.tsx
│   ├── BottomSheet.tsx
│   ├── Menu.tsx
│   └── Snackbar.tsx
│
├── hooks/
│   ├── useTheme.ts
│   ├── useComponentStyles.ts
│   └── index.ts
│
└── index.ts
```

如果结合当前真实代码发现部分目录命名可以更合理，可以微调，但必须保持：

```text
theme
motion
primitives
semantic components
统一出口
```

这四层。

---

# 6. UI 导入方式

未来业务页面优先：

```tsx
import {
  Text,
  Card,
  Button,
  SearchBar,
  NavigationBar,
  ListRow,
  Switch,
} from '@/src/ui';
```

不要让业务页面知道组件内部使用 `Pressable`、`Animated.View`、Reanimated、`expo-blur`、vector-icons 等具体实现。

---

# 7. 淘汰 RNP Compatibility API

当前类似：

```tsx
<Appbar.Header>
  <Appbar.BackAction />
  <Appbar.Content title="设置" />
</Appbar.Header>
```

应该逐步迁移为：

```tsx
<NavigationBar title="设置" back />
```

当前：

```tsx
<Card>
  <Card.Content>
    ...
  </Card.Content>
</Card>
```

逐步迁移为：

```tsx
<Card>
  ...
</Card>
```

当前：

```tsx
<Dialog>
  <Dialog.Title />
  <Dialog.Content />
  <Dialog.Actions />
</Dialog>
```

迁移为符合项目自身习惯的简单 API。

允许迁移期间保留旧 compatibility adapter，但是需要：

```text
标记 deprecated
不再新增调用
迁移完成后删除
```

不要永久维护两套 API。

---

# 8. Theme 不允许只有 colors

新的 Theme 至少应拥有：

```ts
theme.colors
theme.typography
theme.spacing
theme.radius
theme.opacity
theme.components
```

Motion 可以放入 `theme.motion`，也可以单独放 `src/ui/motion`，只要结构清晰即可。

推荐类型：

```ts
export interface AppTheme {
  name: 'hyperos' | 'coloros' | 'liquidGlass';
  dark: boolean;
  colors: ThemeColors;
  typography: ThemeTypography;
  spacing: ThemeSpacing;
  radius: ThemeRadius;
  opacity: ThemeOpacity;
  components: {
    button: ButtonTokens;
    card: CardTokens;
    switch: SwitchTokens;
    searchBar: SearchBarTokens;
    preference: PreferenceTokens;
    tabRow: TabRowTokens;
    navigationBar: NavigationBarTokens;
    dialog: DialogTokens;
    bottomSheet: BottomSheetTokens;
  };
}
```

不要强制完全照这个 interface，但要保留这样的分层思想。

---

# 9. Theme 切换目标

未来应该可以：

```tsx
<ThemeProvider theme="hyperos">
  <App />
</ThemeProvider>
```

切换为：

```tsx
<ThemeProvider theme="coloros">
```

或者：

```tsx
<ThemeProvider theme="liquidGlass">
```

业务页面无需改 `Button / Card / SearchBar / ListRow`。

---

# 10. 本次只完整实现 HyperOS / Miuix

Theme 架构可以预留：

```text
hyperos
coloros
liquidGlass
```

但是：

> 本次任务不要同时做三套半成品 UI。

本次重点：

```text
HyperOS / Miuix = 完整实现
ColorOS = 只保留结构
LiquidGlass = 只保留结构
```

除非当前项目已经有其它主题实现需要保留。

---

# 11. 第一套正式 Theme 的唯一参考

严格参考：

```text
https://github.com/YuKongA/miuix-vue
```

项目：

```text
YuKongA/miuix-vue
```

`miuix-vue` 本身是将 `miuix` Compose Multiplatform UI 的视觉设计与动画曲线移植到 Web。

因此第一套正式 Theme：

```text
HyperOS / Miuix
```

不允许根据印象自由设计。

---

# 12. 建议建立本地只读参考仓库

如果当前环境可以联网：

```bash
mkdir -p .reference
git clone https://github.com/YuKongA/miuix-vue.git .reference/miuix-vue
```

将：

```text
.reference/
```

加入 `.gitignore`。

这个仓库仅用于读取源码、token、动画、尺寸和交互。

严禁：

```text
安装 miuix-vue
import Vue
复制 Vue runtime
把 Web CSS 当 RN 依赖
修改参考仓库
```

---

# 13. Miuix 复刻铁律

## 铁律 1

只要 `miuix-vue` 有这个组件：

> **先看源码，再实现。**

不要直接开始写。

## 铁律 2

视觉与动画参数尽可能从源码原值翻译。

禁止：

```text
“差不多”
“更漂亮”
“更现代”
“我觉得 24 比 16 好看”
“我觉得 0.96 比 0.94 舒服”
```

## 铁律 3

API 使用 React Native 风格。

例如 Vue：

```vue
<MiuixSwitch v-model="enabled" />
```

RN：

```tsx
<Switch
  value={enabled}
  onValueChange={setEnabled}
/>
```

复制的是视觉、尺寸、状态、动画和交互，而不是复制 Vue API。

## 铁律 4

如果参考里没有 Glass、Blur、Gradient、Heavy Shadow、Glow，不要擅自添加。

---

# 14. 每次实现组件前的固定流程

例如要实现 Switch：

先读：

```text
.reference/miuix-vue/src/components/switch/Switch.vue
```

先总结：

```text
尺寸
颜色
圆角
布局
状态
动画
Spring
Drag
Pressed
Disabled
```

再实现：

```text
src/ui/components/Switch.tsx
```

Button、Card、SearchBar、Dialog、BottomSheet、TabRow、NavigationBar、Preference 都执行同样流程。

---

# 15. Theme Color Tokens

优先根据：

```text
.reference/miuix-vue/src/theme/tokens.scss
```

建立。

如果参考仓库已经更新，以真实源码为最高优先级，不要死守本文件中的旧值。

---

# 16. Light Color Tokens

至少包含：

```ts
primary: '#3482FF',
onPrimary: '#FFFFFF',
primaryVariant: '#3482FF',
onPrimaryVariant: '#AECDFF',

error: '#E94634',
onError: '#FFFFFF',
errorContainer: '#FDF6F4',
onErrorContainer: '#410002',

disabledPrimary: '#C2D9FF',
disabledOnPrimary: '#F3F8FF',
disabledPrimaryButton: '#C2D9FF',
disabledOnPrimaryButton: '#FFFFFF',
disabledPrimarySlider: '#B8CFF5',

primaryContainer: '#5D9BFF',
onPrimaryContainer: '#FFFFFF',

secondary: '#E6E6E6',
onSecondary: '#FFFFFF',
secondaryVariant: '#F0F0F0',
onSecondaryVariant: '#303030',

disabledSecondary: '#F0F0F0',
disabledOnSecondary: '#FCFCFC',
disabledSecondaryVariant: '#F2F2F2',
disabledOnSecondaryVariant: '#B2B2B2',

secondaryContainer: '#F0F0F0',
onSecondaryContainer: '#A9A9A9',
secondaryContainerVariant: '#F0F0F0',
onSecondaryContainerVariant: '#A8A8A8',

tertiaryContainer: '#EAF2FF',
onTertiaryContainer: '#3482FF',

background: '#FFFFFF',
onBackground: '#000000',
onBackgroundVariant: '#8C93B0',

surface: '#F7F7F7',
onSurface: '#000000',
surfaceVariant: '#FFFFFF',

surfaceContainer: '#FFFFFF',
onSurfaceContainer: '#000000',
surfaceContainerHigh: '#E8E8E8',
onSurfaceContainerHigh: '#A2A2A2',
surfaceContainerHighest: '#E8E8E8',
onSurfaceContainerHighest: '#000000',

outline: '#D9D9D9',
dividerLine: '#E0E0E0',
windowDimming: 'rgba(0,0,0,0.30)',
```

以及语义透明颜色：

```ts
onSurfaceSecondary: 'rgba(0,0,0,0.80)',
onSurfaceVariantSummary: 'rgba(0,0,0,0.60)',
onSurfaceVariantActions: 'rgba(0,0,0,0.40)',
sliderBackground: 'rgba(0,0,0,0.06)',
```

---

# 17. Dark Color Tokens

至少包含：

```ts
primary: '#277AF7',
onPrimary: '#FFFFFF',
primaryVariant: '#0073DD',
onPrimaryVariant: '#99C7F1',

error: '#F12522',
onError: '#FFFFFF',
errorContainer: '#2E0603',

secondary: '#505050',
secondaryVariant: '#434343',

background: '#242424',
onBackground: 'rgba(255,255,255,0.90)',

surface: '#000000',
onSurface: '#F2F2F2',
surfaceVariant: '#242424',

surfaceContainer: '#242424',
onSurfaceContainer: 'rgba(255,255,255,0.90)',
surfaceContainerHigh: '#242424',
surfaceContainerHighest: '#2D2D2D',

outline: '#404040',
dividerLine: '#393939',
windowDimming: 'rgba(0,0,0,0.60)',
```

必须保留 `background / surface / surfaceVariant / surfaceContainer / surfaceContainerHigh / surfaceContainerHighest` 的语义。

不要简单做成：

```text
background = #000
card = #111
text = #fff
```

---

# 18. Typography

参考 Miuix token：

```ts
typography: {
  paragraph: {
    fontSize: 17,
    lineHeightRatio: 1.2,
  },
  body1: { fontSize: 16 },
  body2: { fontSize: 14 },
  button: { fontSize: 17 },
  footnote1: { fontSize: 13 },
  footnote2: { fontSize: 11 },
  headline1: { fontSize: 17 },
  headline2: { fontSize: 16 },
  subtitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  title1: { fontSize: 32 },
  title2: { fontSize: 24 },
  title3: { fontSize: 20 },
  title4: { fontSize: 18 },
}
```

Text 建议 API：

```tsx
<Text type="headline1" weight="medium">
```

或者：

```tsx
<Text variant="headline1" weight="medium">
```

不要继续复制 RNP 的 `titleMedium / bodyLarge / labelSmall` 作为长期命名。迁移期可以兼容，完成后逐步删除。

---

# 19. Radius

Miuix 基础 radius 不是“越大越好”。

典型：

```text
Button      = 16
Card        = 16
TextField   = 16
TabRow      = 12
Contour Tab = 8
BottomSheet = 28
Dialog      = 32
SearchBar   = full
Switch      = full
```

建议：

```ts
radius: {
  component: 16,
  tab: 12,
  tabContour: 8,
  bottomSheet: 28,
  dialog: 32,
  full: 9999,
}
```

---

# 20. Surface 层级

这是 Miuix 视觉最重要的部分之一。

不要依靠大量 Shadow、Border、Glass 制造层次。

优先依赖：

```text
background
surface
surfaceVariant
surfaceContainer
surfaceContainerHigh
surfaceContainerHighest
```

---

# 21. Surface 组件

默认：

```text
background = surface
radius = 0
shadow = 0
```

不要默认 border、shadow、blur、glass。

普通页面根容器大量情况下应该就是 Surface，而不是 Card。

---

# 22. Card

参考：

```text
.reference/miuix-vue/src/components/card/Card.vue
```

基础：

```text
background = surfaceContainer
radius = 16
overflow = hidden
```

不要默认加明显阴影。

---

# 23. Press Indication

Miuix 普通 Press Feedback 很重要。

参考 Button、Surface、BasicComponent、Card indication。

采用 `onBackground` 颜色的透明 overlay。

Web 参考：

```text
hover = 0.06
focus = 0.08
press = 0.10
```

动画：

```text
120ms linear
```

移动端至少：

```text
normal = 0
pressed = 0.10
```

Expo Web 可以增加 hover。

RN 没有 `::after`，使用绝对定位 overlay View。

---

# 24. 不要给所有 Pressable 加 scale

这是重要禁令。

不要建立全局：

```text
Pressable => scale 0.96
```

Miuix 中 Button、Preference、普通 Surface 主要依赖 Indication overlay。

只有 Card sink、Switch thumb、Slider thumb 等特定组件才使用 scale。

---

# 25. Button

参考：

```text
.reference/miuix-vue/src/components/button/Button.vue
```

尺寸：

```text
minWidth = 58
minHeight = 40
paddingHorizontal = 16
paddingVertical = 13
radius = 16
fontSize = 17
```

Default：

```text
background = secondaryVariant
text = onSecondaryVariant
```

Primary：

```text
background = primary
text = onPrimary
```

Disabled Default：

```text
background = disabledSecondaryVariant
text = disabledOnSecondaryVariant
```

Disabled Primary：

```text
background = disabledPrimaryButton
text = disabledOnPrimaryButton
```

Press：

```text
overlay opacity = 0.10
transition = 120ms linear
```

默认不要 Scale、Shadow、Gradient、Blur。

---

# 26. Card Press Feedback

支持：

```text
none
sink
tilt
```

API 建议：

```tsx
<Card feedback="none">
<Card feedback="sink">
<Card feedback="tilt">
```

## 26.1 Sink

Pressed：

```text
scale 1.0 → 0.94
```

Spring：

```text
dampingRatio = 0.8
stiffness = 600
```

不要改成 0.96 / 0.97。

## 26.2 Tilt

Pressed：

```text
rotateX / rotateY = ±8°
```

根据触摸位置判断方向。

Spring：

```text
dampingRatio = 0.6
stiffness = 400
```

RN 可根据 `locationX / locationY / component width / component height` 判断象限。

Perspective 如果无法与 Compose/Web 完全一致，允许平台近似，但 ±8° 保持。

---

# 27. Switch 必须自绘

不能直接使用 RN 系统默认外观作为最终实现。

目标 API：

```tsx
<Switch
  value={enabled}
  onValueChange={setEnabled}
/>
```

但内部自绘。

---

# 28. Switch 尺寸

```text
track width  = 49
track height = 28
thumb = 20 × 20
top = 4
off left = 4
on left = 25
travel = 21
```

---

# 29. Switch 动画

Thumb offset：

```text
dampingRatio = 0.7
stiffness = 987
```

Thumb scale：

```text
dampingRatio = 0.6
stiffness = 987
```

Track color：

```text
dampingRatio = 0.99
stiffness = 438.6
```

---

# 30. Switch Press Scale

正常：

```text
1
```

Pressed / Hover / Drag：

```text
1.127
```

注意：Miuix Switch Thumb 是放大，不是缩小。

---

# 31. Switch Drag

如果条件允许，实现拖拽。

Travel：21。

Snap threshold：10.5，也就是 50%。

超过一半切换状态。

移动端至少支持 Tap + Drag。

---

# 32. SearchBar

参考：

```text
.reference/miuix-vue/src/components/search-bar/SearchBar.vue
```

规格：

```text
minHeight = 45
radius = full
background = surfaceContainerHigh
outside horizontal = 12
```

Leading Search icon：

```text
left padding = 16
right padding = 8
```

Input：

```text
fontSize = 17
fontWeight = 500
caret = primary
```

Clear：

```text
left padding = 8
right padding = 16
```

---

# 33. SearchBar Expanded 行为

Collapsed：

```text
无 query + 未 expanded => 显示 label
```

Focus 后：

```text
expanded = true
```

右侧出现 Cancel。

Cancel：

```text
fontSize = 17
fontWeight = 700
color = primary
```

搜索结果区域展开。

动画参考：

```text
spring stiffness = 400
damping = 40
```

不要简单 `display none -> display flex`。

---

# 34. Preference / ListRow

Settings、DevMode、Theme、用户设置页面统一使用 `ListRow` 或内部 Preference。

参考：

```text
.reference/miuix-vue/src/components/basic-component/BasicComponent.vue
```

基础：

```text
minHeight = 56
padding = 16
gap = 8
```

Title：

```text
fontSize = 17
fontWeight = 500
color = onBackground
```

Summary：

```text
fontSize = 14
color = onSurfaceVariantSummary
```

---

# 35. ListRow API

建议：

```tsx
<ListRow
  icon={<Icon name="..." />}
  title="深色模式"
  summary="跟随系统"
  trailing={<Switch />}
/>
```

或者：

```tsx
<ListRow
  title="主题"
  summary="HyperOS"
  value="HyperOS"
  showChevron
/>
```

页面不得自己决定 padding、title font、summary font、gap、press overlay、disabled color。

---

# 36. Settings 分组方式

不要每一行都是独立 Card。

推荐：

```tsx
<SettingsSection>
  <ListRow ... />
  <ListRow ... />
  <ListRow ... />
</SettingsSection>
```

SettingsSection：

```text
background = surfaceContainer
radius = 16
overflow = hidden
```

ListRow：

```text
minHeight = 56
padding = 16
```

---

# 37. SegmentedControl / TabRow

如果项目 API 使用 `<SegmentedControl />` 可以，但视觉参考：

```text
.reference/miuix-vue/src/components/tab-row/TabRow.vue
```

普通 TabRow：

```text
height = 42
radius = 12
tab minWidth = 76
tab maxWidth = 98
spacing = 9
text = 16
```

未选中：

```text
color = onSurfaceVariantSummary
fontWeight = 400
```

选中：

```text
background = surfaceContainer
color = onBackground
fontWeight = 700
```

Indicator：

```text
200ms linear
```

Contour：

```text
height = 45
tab radius = 8
tab minWidth = 62
tab maxWidth = 84
spacing = 5
outer padding = 5
text = 14
outer radius = 13
```

---

# 38. TopAppBar / NavigationBar

页面顶部导航必须统一。

参考：

```text
.reference/miuix-vue/src/components/top-app-bar/TopAppBar.vue
```

支持 small/pinned 和 large/collapsing。

---

# 39. Small TopAppBar

高度：52。

标题：

```text
title3
20
Medium / 500
```

居中。

Subtitle：

```text
body2
14
```

---

# 40. Large TopAppBar

展开：

```text
Large Title = 32
left aligned
```

滚动时折叠。

```text
collapsedFraction = scroll / expansion
```

Large title alpha：

```text
1 - clamp(collapsedFraction * 3, 0, 1)
```

所以大标题在折叠前 1/3 过程内淡出。

---

# 41. Small Title 出现动画

当：

```text
collapsedFraction * 3 >= 1
```

显示。

动画：

```text
opacity 0 -> 1
translateY 20 -> 0
```

Show：

```text
damping = 1.0
response = 0.3
```

Hide：

```text
damping = 1.0
response = 0.15
```

---

# 42. Large AppBar 实现要求

在 RN 中可以使用 Animated.ScrollView、Reanimated scroll handler、FlatList scroll offset 实现。

不要为了 1:1 API 强行模仿 Web DOM。

但大标题、小标题、前 1/3 fade、translationY 的视觉逻辑要保留。

---

# 43. Bottom Navigation

参考：

```text
.reference/miuix-vue/src/components/navigation-bar/NavigationBar.vue
```

Item：

```text
height = 64
```

Icon：

```text
26 × 26
marginTop = 8
```

Label：

```text
fontSize = 12
marginBottom = 8
```

Selected：

```text
opacity = 1
fontWeight = 700
```

Unselected：

```text
opacity = 0.4
```

Pressed Selected：0.5。

Pressed Unselected：0.6。

顶部 Divider。

不要自动套 Material 3 selected pill。

---

# 44. Dialog

参考：

```text
.reference/miuix-vue/src/components/dialog/Dialog.vue
```

大屏判定：

```text
width >= 840
AND
height >= 480
```

---

# 45. Dialog 大屏

```text
center aligned
maxWidth = 420
maxHeight = viewportHeight * 2/3
padding = 24
radius = 32
outsideMargin = 12
```

Title：

```text
fontSize = 18
fontWeight = 500
textAlign = center
marginBottom = 12
```

Summary：

```text
fontSize = 16
textAlign = center
color = onSurfaceSecondary
marginBottom = 12
```

---

# 46. Dialog 大屏进入动画

```text
scale 0.8 -> 1
opacity 0 -> 1
```

Spring：

```text
damping = 0.9
response = 0.3
```

---

# 47. Dialog 手机形态

手机不要默认居中 Dialog。

参考 Bottom aligned，从屏幕底部滑入。

Spring：

```text
dampingRatio = 0.88
stiffness = 450
```

---

# 48. Dialog Backdrop

Light：

```text
rgba(0,0,0,0.30)
```

Dark：

```text
rgba(0,0,0,0.60)
```

Dim：

```text
enter = 300ms
exit = 250ms
```

使用 `DecelerateEasing(1.5)`。

Content Exit：260ms + `DecelerateEasing(1.5)`。

---

# 49. BottomSheet

参考：

```text
.reference/miuix-vue/src/components/bottom-sheet/BottomSheet.vue
```

基础：

```text
maxWidth = 640
top radius = 28
horizontal padding = 24
background = background
```

---

# 50. BottomSheet Drag Handle

```text
45 × 4
radius = 2
```

Normal：opacity 0.20。

Pressed：

```text
width 45 -> 55
scaleY -> 1.15
opacity 0.20 -> 0.35
```

Press transition：100ms。

Release：150ms。

---

# 51. BottomSheet Enter / Exit

```text
translateY: 100% -> 0
```

Spring：

```text
damping = 0.9
response = 0.38
```

---

# 52. BottomSheet Drag Dismiss

向下拖 >150 关闭，否则回弹。

Return Spring：

```text
damping = 0.85
response = 0.4
```

向上拖时使用阻尼：

```text
dy * 0.1
```

不要直接完全 clamp。

---

# 53. Motion System 必须单独建立

不要每个组件自己乱写 `withSpring(...)`。

建立：

```text
src/ui/motion/
```

例如：

```text
folmeSpring.ts
folmeSpringByResponse.ts
easings.ts
```

提供：

```ts
folmeSpring(dampingRatio, stiffness)
folmeSpringByResponse(damping, response)
```

然后各组件使用参考值。

---

# 54. 不要把所有动画统一成一个 Spring Preset

例如：

```text
Switch offset = 0.7 / 987
Switch scale = 0.6 / 987
Switch track = 0.99 / 438.6
Card sink = 0.8 / 600
Card tilt = 0.6 / 400
BottomSheet = damping 0.9 / response 0.38
```

它们本来就不同。

---

# 55. Tween 也必须保留

不是所有东西都 Spring。

例如：

```text
Press Indication = 120ms linear
Tab Indicator = 200ms linear
部分 color = 50ms FastOutSlowIn
Dialog dim = Decelerate
```

不要把全部动画 Reanimated spring 化。

---

# 56. Easing

实现：

Accelerate：

```text
x^(2 * factor)
```

Decelerate：

```text
1 - (1-x)^(2 * factor)
```

SinOut：

```text
sin(x * PI / 2)
```

Dialog 使用 `DecelerateEasing(1.5)`。

如果能准确实现公式，就不要换成“差不多的 easeOut”。

---

# 57. Icon 统一入口

目前可能存在 `ui/Icon`、MaterialCommunityIcons 直接调用、react-native-svg。

以后业务页面优先：

```tsx
<Icon />
```

统一：

```text
size
color
opacity
disabled
weight
```

底层短期仍可以使用 `@expo/vector-icons`。

不要为了本次重构一次性替换全部图标素材。

未来可考虑 Miuix Icons。

---

# 58. Blur / Glass 必须克制

不要因为 HyperOS 就：

```text
所有 Card = Blur
所有 Dialog = Glass
所有 Navigation = Glass
```

Miuix 基础组件不是靠全屏 Glassmorphism 建立风格。

第一阶段普通组件不要默认 Blur。

以后可以新增 `glass` variant，但必须是明确的特殊 variant。

---

# 59. Shadow 同样克制

禁止把所有 Card 做成：

```text
shadowOpacity 0.15
shadowRadius 20
elevation 8
```

Surface hierarchy 优先。

如果参考组件没有明显 Shadow，就不要主动增加。

---

# 60. 页面背景

Settings 类页面推荐：

```text
Screen = surface
```

Settings Section：

```text
surfaceContainer
radius = 16
```

Preference：

```text
minHeight = 56
padding = 16
```

自然形成浅灰 Surface 页面 + 白色 SurfaceContainer 分组 + 黑色标题 + 60% Summary。

---

# 61. FeedCard

知乎 FeedCard 属于业务组件。

不要为了 Miuix 把 Feed 变成 Settings Row。

应该：

```text
保留知乎的信息结构
+
使用 Miuix Design Tokens
+
使用 Miuix Card / Typography / Press Feedback
```

例如：

```tsx
<Card feedback="sink">
  <FeedCardContent />
</Card>
```

是否所有 FeedCard 都用 sink，需要结合当前 UX 判断，不要机械套动画。

---

# 62. Tag / Badge

当前页面如果存在：

```tsx
borderRadius: 999
paddingHorizontal: ...
backgroundColor: ...
```

表示 Tag / Badge。

统一：

```tsx
<Tag />
```

Tag 的 radius、padding、font、background、text color 进入 Design System。

---

# 63. Input

输入框不要继续散落：

```text
borderColor
focus color
radius
padding
font
```

如果当前项目用到普通 Input，统一 `<Input />`。

参考 `miuix-vue` TextField / Input。

如果本轮没有大量使用，可以 P1/P2 实现。

---

# 64. Snackbar

迁移现有 Snackbar compatibility layer 为项目自己的 API。

页面不再依赖 RNP API 形状。

保持消息、action、duration、queue 等现有行为。

视觉参考 Miuix Snackbar。

---

# 65. Menu

`Menu.Item` 属于 RNP 兼容形状。

新 API 可使用：

```tsx
<Menu items={...} />
```

或者：

```tsx
<Menu>
  <MenuItem />
</Menu>
```

选择更符合当前项目的方式。

视觉参考 Miuix。

---

# 66. 原生 View 什么时候允许写视觉值

不是绝对禁止。

页面专属图片尺寸、业务插图 position、视频容器比例、特殊 HUD、媒体 overlay 等可以在页面写。

但如果多个页面可能复用，或者换主题会改变，就应该进入 Design System。

---

# 67. 全面扫描现有项目

真正改代码前先扫描：

```text
app/
src/
```

输出一份分析，至少包括：

```text
1. 当前 src/components/ui 所有组件
2. 每个 ui 组件的调用位置
3. 所有旧 RNP compatibility API
4. 所有直接 MaterialCommunityIcons 调用
5. 所有硬编码颜色
6. 所有硬编码 borderRadius
7. 所有 shadow / elevation
8. 所有重复 AnimatedPressable
9. 所有手写 SearchBar
10. 所有 SegmentedControl
11. 所有 BottomSheet / Modal
12. 所有 Settings Row
13. 所有 Tag / Badge
14. 所有页面独立 typography
```

---

# 68. 不允许只扫描，不改代码

扫描只是第一步。

完成分析后立即执行迁移。

不要停在“我建议你这样做”。

本任务要求实际修改工程。

---

# 69. 推荐迁移顺序

严格按照低风险到高风险推进。

## Phase 0 — 基线

执行：

```text
git status
type-check
lint（如果已有）
测试（如果已有）
Expo build / start 能力检查
```

记录当前已有错误，不要把原来就存在的错误误认为本次新增。

## Phase 1 — Theme

建立：

```text
src/ui/theme
```

包括 types、Light Miuix、Dark Miuix、ThemeProvider、useTheme。

## Phase 2 — Motion

建立：

```text
src/ui/motion
```

实现 folmeSpring、folmeSpringByResponse、accelerateEasing、decelerateEasing、sinOutEasing。

## Phase 3 — Primitives

实现：

```text
Text
Icon
Surface
Divider
PressIndication
```

## Phase 4 — P0 Components

实现：

```text
Button
Card
Switch
ListRow / Preference
NavigationBar / TopAppBar
```

## Phase 5 — P1 Components

实现：

```text
SearchBar
SegmentedControl
Dialog
BottomSheet
Snackbar
Input
```

## Phase 6 — UI Showcase

建立开发页面，例如：

```text
app/dev/ui-showcase.tsx
```

或者挂入现有 DevMode。

## Phase 7 — Settings

优先迁移 settings、devmode、themeSet 等设置类页面。

## Phase 8 — Home / Feed

迁移 Home、Feed、Search，保持业务信息结构。

## Phase 9 — User / Question / Comment

继续迁移剩余页面。

## Phase 10 — 删除 compatibility

当旧组件没有调用后，删除 `src/components/ui` 中对应旧兼容组件，最终尽量移除整个旧目录。

## Phase 11 — 全局清理

重新扫描 Appbar、Card.Content、Dialog、Menu.Item、旧 Text variants、硬编码颜色、硬编码 radius、重复 press animation。

---

# 70. 每个 Phase 后必须验证

至少：

```text
TypeScript
Expo 编译
导入路径
运行时基本页面
```

如果项目有 lint/test，也执行。

不要一次性改几十个页面，最后才编译。

---

# 71. UI Showcase 必须存在

建议：

```text
app/dev/design-system.tsx
```

所有基础组件集中展示。

未来改 Theme 时只需要打开这个页面即可检查。

至少展示：

```text
Colors
Typography
Button
Card
Switch
SearchBar
SegmentedControl
ListRow
Dialog
BottomSheet
Navigation
Snackbar
Input
```

并展示：

```text
Light
Dark
Normal
Pressed
Disabled
Selected
Unselected
```

---

# 72. Miuix 对照测试

如果可以同时运行 `miuix-vue example` 和 Expo Web / App，建议并排对比。

比较：

```text
尺寸
字体
间距
radius
颜色
按下反馈
Spring
动画速度
视觉层级
```

验收标准是：是否接近参考实现，而不是 AI 觉得哪一个更漂亮。

---

# 73. 每个复刻组件顶部注明来源

例如：

```ts
/**
 * Visual reference:
 * miuix-vue/src/components/switch/Switch.vue
 *
 * Track: 49x28
 * Thumb: 20
 * Travel: 21
 *
 * Keep behavior aligned with Miuix.
 */
```

Card：

```ts
/**
 * Visual reference:
 * miuix-vue/src/components/card/Card.vue
 *
 * radius: 16
 * sink: 0.94
 * tilt: ±8deg
 */
```

这样未来 AI 不会随意“优化”数值。

---

# 74. 性能要求

本次去掉 RNP 的目标之一就是减少 UI 层复杂度。

因此：

```text
不要重新引入大型 UI Framework
不要大量无意义 Provider
不要大量 Wrapper
不要滥用 memo
不要所有列表项都建立复杂 Reanimated graph
不要破坏 FlatList 虚拟化
不要在 render 中大量创建对象
```

---

# 75. Animation 性能

优先使用 `react-native-reanimated` 驱动 transform、opacity、gesture-driven animation、scroll animation。

避免 JS Thread 上高频 setState 驱动动画。

Switch Drag 应尽可能在 UI Thread 完成。

FeedCard 数量很大时，只给真正需要的交互 Card 启用复杂动画。

---

# 76. Portal / Modal

如果现有 PortalHost 已稳定工作，可以复用底层 Portal 基础能力。

但是公开 API 不需要维持 RNP 形式。

不要为了架构洁癖重写已经稳定的 Portal infrastructure。

---

# 77. 业务逻辑禁止修改

不要主动修改：

```text
API
请求参数
Store
路由
登录
Cookie
缓存
分页
评论
点赞
收藏
图片
WebView
历史记录
数据 schema
```

UI 组件迁移中如果必须改 props，只做最小变化。

---

# 78. 禁止自由发挥清单

除非任务之后另有明确要求：

```text
❌ 不要增加 Gradient
❌ 不要给所有东西 Blur
❌ 不要大面积 Glassmorphism
❌ 不要增加 Glow
❌ 不要给所有 Card Heavy Shadow
❌ 不要把 radius 统一改成 24/28/32
❌ 不要把 Button 改成 scale press
❌ 不要修改 Miuix spring 参数
❌ 不要把所有动画改成一个 preset
❌ 不要改 primary blue
❌ 不要使用 Material 3 默认组件尺寸
❌ 不要恢复 react-native-paper
❌ 不要直接使用系统默认 Switch 作为最终视觉
❌ 不要引入另一个大型 UI Library
❌ 不要为了组件化封装 View / FlatList / ScrollView
```

---

# 79. 特别禁止“AI 美化”

如果参考是：

```text
Card radius = 16
Button minHeight = 40
Switch = 49 × 28
Card sink = 0.94
```

就按参考做。

如果参考 Button 使用 Press Indication，就不要自己加 scale。

---

# 80. Web / RN 无法 1:1 映射时

遵守：

> **视觉语义优先于 API 形式。**

Web `::after` → RN absolute overlay View。

CSS hover → Mobile 忽略 hover，保留 press；Expo Web 再补 hover。

CSS variable → RN `theme.colors.*`。

motion-v → RN Reanimated。

DOM pointer drag → RN Gesture / PanResponder / Gesture Handler，根据项目已有依赖选择。

不要为了一个 Switch 专门引入巨大新手势框架，除非项目本身已有。

---

# 81. Theme 组件 Token

可以建立：

```ts
components: {
  button: {
    minWidth: 58,
    minHeight: 40,
    radius: 16,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  card: {
    radius: 16,
  },
  switch: {
    width: 49,
    height: 28,
    thumbSize: 20,
    thumbOffset: 4,
    travel: 21,
  },
  searchBar: {
    height: 45,
    radius: 9999,
  },
  preference: {
    minHeight: 56,
    padding: 16,
    gap: 8,
  },
  tabRow: {
    height: 42,
    radius: 12,
    minTabWidth: 76,
    maxTabWidth: 98,
    gap: 9,
  },
  navigationBar: {
    itemHeight: 64,
    iconSize: 26,
    labelSize: 12,
  },
  bottomSheet: {
    radius: 28,
    maxWidth: 640,
    horizontalPadding: 24,
    handleWidth: 45,
    handleHeight: 4,
  },
  dialog: {
    radius: 32,
    maxWidth: 420,
    padding: 24,
    outsideMargin: 12,
  },
}
```

---

# 82. 不要把所有行为参数塞进 Theme

例如：

```text
Switch snap threshold 50%
Card tilt ±8°
BottomSheet dismiss threshold 150
```

这些属于 component behavior，可以放组件内部常量。

Theme 主要负责视觉可换肤参数。

---

# 83. ColorOS / Liquid Glass 的处理

建立类型兼容：

```text
colorosTheme
liquidGlassTheme
```

如果目前没有实现，可以临时继承 HyperOS tokens 或标记 TODO。

但是不要为了“支持主题”硬写两套假 UI。

---

# 84. 迁移现有 Text

当前 RNP 风格：

```tsx
<Text variant="titleMedium">
```

迁移到项目自身语义，例如：

```tsx
<Text type="title3">
```

或者：

```tsx
<Text variant="headline1">
```

先建立映射兼容层也可以，但最终不保留 RNP 命名为核心 API。

---

# 85. 迁移现有 Icon

扫描：

```text
MaterialCommunityIcons
Ionicons
FontAwesome
```

如果页面直接调用，尽量改成 `<Icon />`。

特殊 SVG 插图、Logo、业务图形不用强制塞入 Icon 系统。

---

# 86. 迁移现有 Pressable

扫描：

```text
createAnimatedComponent(Pressable)
AnimatedPressable
onPressIn
onPressOut
scale
```

如果重复实现相同反馈，抽到 UI primitive/component。

但是不要建立一个全局强制 scale Pressable。

---

# 87. 迁移 SearchBar

如果当前 home 等页面存在手写 SearchBar，替换成 Design System SearchBar。

保留业务 query、search callback、navigation，不保留页面视觉代码。

---

# 88. 迁移 SegmentedControl

例如“卡片 / 普通”这种切换，统一 SegmentedControl，视觉映射 Miuix TabRow。

---

# 89. 迁移 BottomSheet

例如 ChildComment、CommentEdit 等存在重复底部弹层，底层容器统一 BottomSheet。

业务组件只传 content、title、actions、open state。

---

# 90. 迁移 Tag / Badge

评论页等重复 pill/status/label 抽 `<Tag />`。

---

# 91. 迁移 Settings / DevMode List Row

典型：

```text
Icon
Title
Summary
Chevron
Switch
Value
```

全部统一 `<ListRow />`，不要两个页面各写一套。

---

# 92. Avatar / Image

Avatar 如果已有自建组件，迁移到 `src/ui/components/Avatar`。

业务图片使用 expo-image / Image 不需要全部组件化。

---

# 93. Divider

统一 Design System Divider。

颜色使用 `dividerLine`，不要页面写 `#E0E0E0`。

---

# 94. Accessibility

重构不能破坏：

```text
accessibilityRole
accessibilityLabel
disabled
selected
switch state
button state
```

Switch：

```tsx
accessibilityRole="switch"
accessibilityState={{ checked }}
```

Button：

```tsx
accessibilityRole="button"
```

Dialog / Sheet 保持合理 accessibility。

---

# 95. Touch Target

视觉尺寸必须参考 Miuix。

如果实际交互 hit target 过小，可以通过 `hitSlop` 扩大点击区域。

不要为了 accessibility 直接篡改可见尺寸。

---

# 96. Safe Area

TopAppBar / Bottom Navigation / BottomSheet 正确处理 Safe Area。

不要把 Miuix Web 的 52 / 64 高度直接包括刘海区。

视觉内容高度与 Safe Area padding 分开处理。

---

# 97. Platform 差异

Android / iOS / Web 尽可能视觉一致。

字体渲染、StatusBar、Keyboard、SafeArea、backdrop、pointer hover 等允许平台处理。

不要因为 Platform.OS === 'ios' 就完全换成 iOS Design。

第一套 Theme 仍然是 Miuix。

---

# 98. StatusBar

根据 Light / Dark Theme 正确设置 status bar content style。

不要页面各自控制，最好由 Theme / Root Layout 统一。

---

# 99. 主题持久化

如果项目已有 Theme 设置，保留现有持久化逻辑，迁移到新 ThemeProvider。

不要因为重构把用户主题偏好丢掉。

---

# 100. Demo / DevMode

UI Showcase 可以挂到现有 devmode 中。

不要在生产 UI 暴露开发入口，除非项目本来就有 DevMode 机制。

---

# 101. 代码风格

遵守当前工程 ESLint、Prettier、TypeScript config、path alias、Expo Router convention。

不要为了 UI 重构顺便格式化整个仓库。

---

# 102. Diff 控制

每个 Phase 尽量聚焦一类改动。

避免 UI 重构 + 业务重构 + 文件重命名 + API 重构 + 格式化整个项目同时发生。

---

# 103. 不允许删除不理解的代码

遇到 demo mode、special animation、gesture、image modal、portal host、webview handling，先理解用途。

不要因为“Design System 没有这个”直接删除。

---

# 104. 现有行为优先

如果新 UI 组件视觉正确，但导致评论不能点、菜单打不开、返回失效、输入框焦点异常、BottomSheet 无法滚动、FlatList 卡顿，就不算完成。

---

# 105. 最终业务页面目标

例如：

```tsx
<View style={styles.page}>
  <NavigationBar
    variant="large"
    title="设置"
  />

  <SettingsSection>
    <ListRow
      title="深色模式"
      trailing={
        <Switch
          value={darkMode}
          onValueChange={setDarkMode}
        />
      }
    />

    <ListRow
      title="主题"
      summary="HyperOS"
      showChevron
    />
  </SettingsSection>
</View>
```

而不是页面自己写 `backgroundColor / borderRadius / fontSize / shadow`。

---

# 106. P0 组件优先级

第一批必须完成：

```text
Theme
Text
Icon
Surface
Divider
PressIndication
Button
Card
Switch
ListRow / Preference
NavigationBar / TopAppBar
```

这些决定整个 UI 的基本气质。

---

# 107. P1

随后：

```text
SearchBar
SegmentedControl
Dialog
BottomSheet
Snackbar
Input
Menu
```

---

# 108. P2

只有项目实际需要时：

```text
Slider
Checkbox
Radio
ProgressIndicator
NumberPicker
ColorPicker
```

不要为了“做一个完整 UI 库”提前造当前没有使用场景的组件。

---

# 109. Miuix 视觉验收 — Button

```text
[ ] minWidth 58
[ ] minHeight 40
[ ] radius 16
[ ] font 17
[ ] default colors
[ ] primary colors
[ ] disabled colors
[ ] press indication 0.10
[ ] 120ms linear
[ ] 没有擅自 scale
[ ] 没有默认 heavy shadow
```

---

# 110. Miuix 视觉验收 — Card

```text
[ ] radius 16
[ ] surfaceContainer
[ ] overflow hidden
[ ] sink = 0.94
[ ] sink spring = 0.8 / 600
[ ] tilt = ±8°
[ ] tilt spring = 0.6 / 400
[ ] 没有默认 heavy shadow
```

---

# 111. Miuix 视觉验收 — Switch

```text
[ ] 49 × 28
[ ] thumb 20
[ ] offset 4
[ ] on left 25
[ ] travel 21
[ ] press scale 1.127
[ ] offset spring 0.7 / 987
[ ] scale spring 0.6 / 987
[ ] track spring 0.99 / 438.6
[ ] disabled colors
[ ] 50% drag snap
```

---

# 112. Miuix 视觉验收 — SearchBar

```text
[ ] minHeight 45
[ ] capsule
[ ] surfaceContainerHigh
[ ] icon padding 16 / 8
[ ] text 17 medium
[ ] primary caret
[ ] clear control
[ ] expanded Cancel
[ ] 400 / 40 spring
```

---

# 113. Miuix 视觉验收 — Preference / ListRow

```text
[ ] minHeight 56
[ ] padding 16
[ ] gap 8
[ ] title 17 medium
[ ] summary 14
[ ] correct semantic colors
[ ] press indication
```

---

# 114. Miuix 视觉验收 — TabRow

```text
[ ] height 42
[ ] radius 12
[ ] min/max 76/98
[ ] spacing 9
[ ] text 16
[ ] selected bold
[ ] indicator 200ms linear
```

---

# 115. Miuix 视觉验收 — TopAppBar

```text
[ ] collapsed height 52
[ ] small title 20 medium
[ ] large title 32
[ ] large title fade first 1/3
[ ] small title translateY 20 -> 0
[ ] show response 0.3
[ ] hide response 0.15
```

---

# 116. Miuix 视觉验收 — Bottom Navigation

```text
[ ] item height 64
[ ] icon 26
[ ] label 12
[ ] unselected 0.4
[ ] selected 1
[ ] pressed alpha correct
[ ] top Divider
```

---

# 117. Miuix 视觉验收 — Dialog

```text
[ ] radius 32
[ ] maxWidth 420
[ ] padding 24
[ ] outsideMargin 12
[ ] large centred
[ ] mobile bottom aligned
[ ] scale 0.8 -> 1
[ ] correct springs
[ ] dim animation
```

---

# 118. Miuix 视觉验收 — BottomSheet

```text
[ ] radius 28
[ ] maxWidth 640
[ ] padding 24
[ ] handle 45 × 4
[ ] handle pressed 55 / 1.15 / .35
[ ] threshold 150
[ ] upward damping 0.1
[ ] sheet spring correct
```

---

# 119. Architecture 验收

最终必须满足：

```text
[ ] 不依赖 react-native-paper
[ ] 新 Design System 位于 src/ui
[ ] Theme 不只有 colors
[ ] Light / Dark Miuix Theme 都存在
[ ] Motion 独立集中
[ ] UI 有统一 barrel export
[ ] 页面允许原生 View / FlatList
[ ] 页面不再大量定义视觉语言
[ ] RNP compatibility API 显著减少/清零
[ ] 重复 SearchBar 消失
[ ] 重复 ListRow 消失
[ ] 重复 BottomSheet 消失
[ ] 重复 SegmentedControl 消失
[ ] 硬编码视觉颜色显著减少
[ ] 硬编码 radius 显著减少
[ ] 直接 MaterialCommunityIcons 调用显著减少
[ ] UI Showcase 存在
```

---

# 120. 性能验收

```text
[ ] FlatList 行为没有退化
[ ] Feed 滚动没有明显掉帧
[ ] Switch / Card animation 不靠 React setState 每帧驱动
[ ] 没有大规模无意义 Wrapper
[ ] 没有新增大型 UI Framework
[ ] 没有新增多余 animation library
[ ] 没有明显 bundle 体积异常增长
```

---

# 121. 功能回归验收

至少检查：

```text
[ ] 首页能正常浏览
[ ] 搜索可用
[ ] Question 可打开
[ ] Answer / Item 可打开
[ ] Comment 可打开
[ ] Child Comment 可打开
[ ] Comment Edit 可用
[ ] User 页可用
[ ] Settings 可用
[ ] Theme 设置可用
[ ] Menu 可打开
[ ] Dialog 可关闭
[ ] BottomSheet 可关闭/拖拽
[ ] WebView 正常
[ ] 图片查看正常
[ ] 返回导航正常
```

根据当前项目真实功能补充。

---

# 122. 开始工作前必须做的事情

先输出：

```text
UI REFACTOR AUDIT
```

至少包含：

```text
当前 UI 架构
现有 ui 组件
RNP compatibility 残留
重复视觉模式
硬编码颜色
硬编码 radius
动画重复
Settings Row
SearchBar
BottomSheet
SegmentedControl
Icon 直接调用
```

然后立即开始实际修改。

---

# 123. 工作过程中输出

每完成一个 Phase，简短说明：

```text
完成什么
改了哪些文件
下一阶段是什么
TypeScript / Build 状态
```

不要每改一个文件都长篇报告。

---

# 124. 最终输出报告

任务完成后必须给出：

## Architecture

```text
新的 src/ui 结构
Theme 架构
Motion 架构
```

## Components

```text
新增组件
迁移组件
删除兼容组件
```

## Pages

```text
已迁移页面
暂未迁移页面
```

## Cleanup

```text
剩余硬编码颜色
剩余旧 RNP API
剩余直接图标调用
```

## Verification

```text
type-check
lint
test
expo build
```

的结果。

---

# 125. 如果无法一次完成所有页面

如果任务规模太大：

> 不允许为了“看起来完成”而批量做低质量替换。

优先完整完成：

```text
Theme
Motion
P0 Components
UI Showcase
Settings
```

然后继续迁移高频页面。

必须明确记录 TODO，而不是把旧组件静默保留并宣称完成。

---

# 126. 不允许只换 import

本次目标不是：

```text
from src/components/ui
```

换成：

```text
from src/ui
```

如果内部还是 RNP API shape、旧 typography、旧视觉，就没有完成。

---

# 127. 不允许只换颜色

如果只是：

```text
primary -> #3482FF
radius -> 16
```

但 Press、Switch、SearchBar、TopAppBar、Dialog、Sheet 都没按 Miuix 做，也不算完成。

---

# 128. 不允许把 Miuix 理解成 Glassmorphism

再次强调：

```text
Miuix != Glassmorphism
```

核心应该是：

```text
Surface hierarchy
Typography
Precise dimensions
Miuix Indication
Folme Spring
Preference layout
System navigation
Motion language
```

Glass 只能是特殊效果。

---

# 129. 不允许把 Miuix 理解成“大圆角”

再次强调：

```text
Miuix != borderRadius 28 everywhere
```

很多基础组件使用 16。

---

# 130. 不允许把 Miuix 理解成“所有组件都弹”

再次强调：

```text
Miuix != withSpring everywhere
```

需要保留：

```text
linear
tween
decelerate
spring
```

多种 motion。

---

# 131. 参考源码优先级

如果本文件参数与当前 `miuix-vue` 最新源码冲突：

```text
miuix-vue 当前源码
>
本 task.md
>
AI 自己猜测
```

如果参考项目注明其值来自上游 `miuix`，不要自行“修正”为 Material 或系统默认值。

---

# 132. 当前工程代码优先级

业务行为方面：

```text
当前工程真实行为
>
本 task.md 中举例
```

例如实际没有 SettingsSection，就按真实结构迁移。

不要为了照文档而破坏业务。

---

# 133. 最终代码质量原则

最终 Design System 应该：

```text
薄
明确
语义化
可维护
可换主题
性能好
不绑 RNP
不绑 Vue
不绑 Material
```

---

# 134. 最终目标一句话

> **建立一套真正属于这个知乎客户端的 React Native Design System；第一套主题严格复刻 Miuix / HyperOS 的视觉、尺寸、Surface 层级和 Folme 动画，同时保留知乎现有业务信息结构。**

---

# 135. 立即开始

执行顺序：

```text
1. Audit 当前项目
2. 获取 / 阅读 miuix-vue 参考
3. 建立 src/ui/theme
4. 建立 src/ui/motion
5. 建立 primitives
6. 建立 P0 components
7. 建立 UI Showcase
8. 迁移 Settings / DevMode / Theme
9. 迁移 Home / Feed
10. 迁移剩余页面
11. 删除 RNP compatibility layer
12. 全局扫描清理
13. TypeScript / lint / build / regression
14. 输出最终报告
```

不要停留在方案阶段。

**开始实际修改。**

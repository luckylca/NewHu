# Task: 实现 HyperOS 风格粉蓝白动态柔光背景

请在当前 Expo / React Native 项目中实现一个可复用的动态柔光背景组件，视觉目标参考 HyperOS / 澎湃 OS 3 的柔和渐变光效。

## 视觉目标

最终效果由三个主要柔光团组成：

* 粉色柔光
* 蓝色柔光
* 白色高光

三个光团需要：

* 大面积覆盖
* 边缘非常柔和
* 彼此自然融合
* 不出现明显边界
* 不像普通 `linear-gradient`
* 不像霓虹灯
* 不要高饱和
* 不要赛博朋克感
* 整体应该轻盈、柔和、干净、现代

希望视觉效果类似：

```text
┌────────────────────────────┐
│                  淡蓝蓝蓝   │
│             白白白蓝蓝      │
│       白白白白白            │
│   粉粉粉白白                │
│ 粉粉粉粉                    │
└────────────────────────────┘
```

但实际效果不能是明显分区，而应该像光线在磨砂玻璃或白色材质下面扩散。

---

# 技术方案

优先使用：

```bash
@shopify/react-native-skia
```

如果项目中还没有安装：

```bash
npx expo install @shopify/react-native-skia
```

不要使用：

* WebView
* HTML
* CSS
* WebGL 网页组件
* React Bits 直接嵌入
* Three.js

需要直接使用 React Native Skia 原生绘制。

---

# 组件

新建类似：

```text
src/components/effects/HyperGlowBackground.tsx
```

组件名称：

```tsx
HyperGlowBackground
```

它需要作为普通 React Native 背景组件使用，例如：

```tsx
<View style={{ flex: 1 }}>
  <HyperGlowBackground />

  <View style={styles.content}>
    ...
  </View>
</View>
```

或者：

```tsx
<HyperGlowBackground style={StyleSheet.absoluteFill} />
```

它不能阻挡任何触摸事件。

---

# 核心实现

背景首先使用非常浅的白色：

```text
#FBFBFD
```

然后叠加三个巨大的 Radial Gradient。

## 粉色光团

颜色建议从下面范围开始调：

```text
中心：
#FFB7D5

中层：
rgba(255, 196, 222, 0.55)

外层：
rgba(255, 220, 236, 0)
```

光团应该比较大，半径建议约为：

```text
屏幕宽度的 55% ~ 80%
```

默认位置：

```text
屏幕左下方
```

但不要完全固定在角落，应有一部分进入屏幕中央。

---

## 蓝色光团

颜色建议：

```text
中心：
#AFCBFF

中层：
rgba(185, 215, 255, 0.55)

外层：
rgba(210, 230, 255, 0)
```

默认位置：

```text
屏幕右上方
```

半径略大于粉色。

蓝色整体应该：

* 很淡
* 很通透
* 偏天空蓝
* 不要偏紫
* 不要偏青

---

## 白色光团

白色不是普通背景，而是用于制造一种局部 Bloom / 高光。

颜色：

```text
rgba(255,255,255,0.95)
rgba(255,255,255,0.5)
rgba(255,255,255,0)
```

默认位于：

```text
屏幕中央附近
```

白色光团可以比粉蓝稍小。

它的作用是让粉色和蓝色之间产生：

```text
粉 → 粉白 → 白 → 蓝白 → 蓝
```

这种柔和过渡。

---

# 光团形状

不要让三个光团看起来像三个明显的圆。

虽然可以使用 RadialGradient 实现，但最终效果需要通过：

* 大半径
* 多层透明渐变
* 部分重叠
* Blur
* 位置偏移
* 非均匀缩放

让它看起来更像：

```text
不规则的大面积光雾
```

而不是：

```text
⭕ ⭕ ⭕
```

可以考虑使用：

```tsx
<Group transform={[{ scaleX: ... }, { scaleY: ... }]}>
```

或者椭圆形区域。

粉色可以稍微横向拉宽。

蓝色可以稍微纵向拉宽。

白色可以比较圆。

---

# Blur

需要适量使用 Blur，让光团边缘彻底消失。

建议从：

```text
blur = 25 ~ 50
```

开始调。

不要 Blur 得过度，以至于整个屏幕只剩下一片均匀颜色。

最终仍然应该隐约能感觉到：

```text
粉色来源于左下
蓝色来源于右上
白色位于中间
```

---

# 动画

三个光团需要非常缓慢地漂移。

重点：

**不要做明显动画。**

用户应该是过几秒之后才会意识到背景正在变化。

推荐动画周期：

```text
18 ~ 35 秒
```

不要：

```text
2 秒
4 秒
6 秒
```

这种快速循环。

---

# 粉色动画

大致运动轨迹：

```text
左下
↓
向右上移动一点
↓
稍微放大
↓
再缓慢回去
```

移动范围不要超过屏幕尺寸的：

```text
8% ~ 15%
```

Scale 建议：

```text
1.0 → 1.08 → 1.0
```

---

# 蓝色动画

与粉色方向错开。

例如：

```text
右上
↓
向左下轻微移动
↓
稍微缩小
↓
再返回
```

不要让粉蓝两个光团同步运动。

否则视觉效果会像整个背景在平移。

---

# 白色动画

白色高光运动幅度最小。

例如：

```text
左右漂移 3% ~ 6%
上下漂移 2% ~ 5%
```

白色主要负责改变光线融合关系。

---

# 动画节奏

必须使用：

```text
easeInOut
```

或者非常接近自然呼吸感的曲线。

不要使用：

```text
linear
```

做明显机械移动。

三个光团的：

```text
duration
delay
movement range
scale range
```

都应该略有差异。

例如：

```text
粉色：24 秒
蓝色：31 秒
白色：19 秒
```

避免出现明显周期同步。

---

# 颜色控制

整体颜色一定要保持低饱和。

错误效果：

```text
#FF00AA
#0066FF
```

这种颜色太亮、太电子、太廉价。

应该更接近：

```text
粉：
#F7BFD8
#FFD4E5

蓝：
#BFD5FF
#D5E5FF

白：
#FFFFFF
```

整个画面的最终效果应该主要仍然是：

```text
白色
```

粉蓝只作为柔光。

大致视觉占比可以理解为：

```text
白色 55%

蓝色 25%

粉色 20%
```

这里不是严格面积比例，只是视觉权重。

---

# 避免渐变色带

如果出现明显：

```text
banding
色阶
一圈一圈的渐变
```

需要继续调整：

* gradient stops
* opacity
* blur
* radius

尽量使变化非常平滑。

如果 Skia 实现方便，也可以加入非常微弱的噪点来减少 banding，但不要让用户肉眼看到噪点。

---

# 层级关系

建议大致结构：

```text
Canvas

└── Base white background

    ├── Pink glow

    ├── Blue glow

    ├── White bloom

    └── optional very subtle overlay
```

粉蓝两个光团需要明显重叠。

不要：

```text
粉色在左边
蓝色在右边
中间没有交集
```

重叠区域才是整个效果最重要的地方。

---

# Blend

如果 Skia 的 BlendMode 效果自然，可以尝试：

```text
screen
plus
softLight
```

但必须实际观察效果。

不要为了使用 BlendMode 而使用。

如果普通透明叠加已经很好看，就保持简单实现。

最终标准只有：

```text
看起来像柔光，而不是彩色图层。
```

---

# 尺寸适配

禁止写死：

```text
390
844
```

这种设备尺寸。

必须通过组件实际宽高动态计算：

```tsx
onLayout
```

或者其他可靠方式获取容器大小。

横屏、竖屏、平板都要能够正常扩展。

---

# Reduce Motion

需要尊重：

```text
Reduce Motion
```

如果系统开启减少动态效果：

* 保留粉蓝白柔光
* 停止漂移动画
* 使用静态位置

不要直接移除整个背景。

---

# API

组件至少支持：

```tsx
<HyperGlowBackground
  animated
  intensity={1}
  speed={1}
/>
```

建议 Props：

```ts
interface HyperGlowBackgroundProps {
  animated?: boolean;
  intensity?: number;
  speed?: number;

  pinkColor?: string;
  blueColor?: string;

  style?: StyleProp<ViewStyle>;
}
```

默认：

```text
animated = true
intensity = 1
speed = 1
```

---

# Preset

如果方便，可以额外支持：

```tsx
<HyperGlowBackground preset="hyperos" />
```

默认 preset 就按照本 Task 中描述的粉蓝白效果实现。

---

# 性能要求

这个效果不会在 App 中大量出现，因此：

**优先保证视觉效果。**

不需要为了极端优化而：

* 删除 Blur
* 删除动画
* 降低到非常粗糙的渐变

但仍然避免明显不合理的实现，例如：

* 每帧 React setState
* 大量 JS 对象创建
* JS 定时器驱动 60 FPS
* 每一帧重新生成 Gradient
* 多个全屏 Canvas 嵌套

动画尽量在 UI / Skia / Reanimated 层完成。

---

# 使用区域

该组件未来主要用于：

* Hero 区域
* AI 功能页
* 大型特殊卡片
* 弹窗背景
* 欢迎页
* 设置页面顶部
* 特殊状态页面

不会作为每一个普通列表 Item 的背景。

因此可以适当提高视觉质量。

---

# 最终视觉检查

完成后请认真检查以下问题。

## 正确效果

应该让人感觉：

```text
白色空间中，
粉色与蓝色柔和的光正在缓慢流动，
中央有白色光照亮两者，
光线彼此融合，
画面非常轻盈、柔软、通透。
```

用户第一眼应该觉得：

```text
“这个背景很好看。”
```

而不是：

```text
“这里有三个渐变圆。”
```

---

## 必须避免

禁止做成：

### 1. RGB 灯效

```text
高饱和粉
+
高饱和蓝
```

不要。

### 2. 极光

不要出现非常明显的：

```text
波浪
条带
山峰
```

这不是 Aurora。

### 3. 彩虹渐变

只能围绕：

```text
粉
蓝
白
```

不要加入：

```text
绿
黄
橙
红
```

### 4. 快速动画

不能让背景抢用户注意力。

### 5. 明显圆形

不能看到三个圆。

### 6. 纯线性渐变

不要退化成：

```css
linear-gradient(pink, blue)
```

那不是目标效果。

---

# 最终交付

完成后请给出：

1. `HyperGlowBackground.tsx` 完整实现
2. 所有新增依赖
3. 一个独立 Demo 页面
4. Demo 中展示白色内容卡片叠在光效之上的效果
5. 保证 TypeScript 无错误
6. 保证 Expo Android / iOS 可运行
7. 不要改动与本任务无关的页面或组件

视觉效果优先于极端性能优化。

最重要的目标：

> 做出一种类似澎湃 OS 3 的粉色、蓝色、白色大面积柔光互相融合，并以极慢速度自然漂移的背景效果。它应该像光线在白色磨砂材质下面流动，而不是三个普通渐变圆。

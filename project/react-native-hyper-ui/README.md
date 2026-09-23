# react-native-hyper-ui

受 HyperOS 与 Miuix 启发的 React Native 组件库，从 NewHu 的 `src/ui` 抽离。当前覆盖主题、动效、基础元素、表单、导航、弹层、通用按压反馈、NumberWheel 和 ProgressIndicator。

## 当前阶段

这是可在仓库内编译并由 NewHu 本地依赖使用的独立 npm package 工程。包名和版本是暂定值；发布到 npm 前请设置正式许可证、仓库地址、变更记录，并检查所依赖的商标和设计资源使用权。

## 安装

```sh
npm install react-native-hyper-ui
```

安装包声明的 peer dependencies 后，Reanimated 4 项目还要按其官方要求配置 Worklets Babel 插件，并将交互组件放在 `GestureHandlerRootView` 下。

## 使用

```tsx
import { Button, Card, ThemeProvider } from 'react-native-hyper-ui';

export function Example() {
  return (
    <ThemeProvider theme="hyperos" mode="system">
      <Card><Button type="primary">开始阅读</Button></Card>
    </ThemeProvider>
  );
}
```

主题 Provider 有一个上下文实例。应用只需包一次；组件根据 Provider 读取颜色、圆角、间距和组件 tokens。支持 `hyperos`、`coloros` 和 `liquidGlass` 主题，以及浅色和深色模式。

## 开发

```sh
npm install
npm run typecheck
npm run build
```

打包前 `prepack` 会生成 CommonJS、ES module 和声明文件；Metro / React Native 消费 `src`，Web 工具消费编译输出。`npm pack --dry-run` 可检查最终包内容。

## 目录

- `src/theme`：配色、文字、尺寸和主题上下文
- `src/motion`：Folme 弹簧、动效预设和减少动效上下文
- `src/primitives`：文本、图标、表面和按压反馈
- `src/components`：可组合 UI 组件
- `example`：最小使用示例

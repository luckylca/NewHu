# NewHU

NewHU is an Android-first React Native and Expo client focused on reading,
offline content, and on-device recommendation experiments.

## Development

```sh
npm install
npm run android
```

Use `npm run lint`, `npm run typecheck`, and `npm test` before committing.
The login flow uses the local `expo-cookie-storage` Android module, backed by
`android.webkit.CookieManager`, to read the WebView cookie header including
HttpOnly session cookies and to clear WebView cookies on logout.

## Current status

已落地的主要能力：

- [x] 评论区与正文切换、子评论、评论回复、问题页与评论图片查看。
- [x] 首页普通 / 卡片 / 瀑布流三种显示模式。
- [x] 知乎内容搜索与首页分享。
- [x] 本地已推送列表与重复推荐过滤。
- [x] SQLite 内容缓存、批量离线缓存、离线首页与存储管理。
- [x] 稍后阅读：详情页快速加入、可拖动悬浮球、多页面式列表、本地持久化。
- [x] Product V1 本地推荐：Tiny Encoder、兴趣画像、搜索种子、破圈与高质量策略。
- [x] Product V1 推荐原因解释：首页/详情展示兴趣命中、语义匹配、质量信号与破圈原因，并随 Feed 本地持久化。
- [x] 本地 AI 写作特征检测：TAIDTF1 模型、设置开关、首页/详情页“疑似 AI”胶囊。
- [x] AI 检测三档标定灵敏度：保守 / 平衡 / 高召回，使用冻结模型报告中的正式 operating points。
- [x] 本地内容领域识别：首页与详情页支持最多 3 个不同颜色的领域胶囊。
- [x] 登录 Cookie 原生桥接：本地 `expo-cookie-storage` 直接使用 Android `CookieManager`，已移除停止维护的第三方 Cookie 包。
- [x] 回答/文章基础导出能力。

## Roadmap

### P0 — 当前收尾

- [ ] Android 真机回归：覆盖稍后阅读、AI 检测、领域胶囊、三种首页模式、暗色主题和离线切换。
- [x] 领域识别结果持久缓存，避免 App 重启后对同一内容重复跑 Tiny Encoder。
- [x] 领域识别调度优化：可见卡片优先、离屏任务低优先级/可取消，减少首页胶囊延迟。
- [x] 推荐原因解释：复用 Product V1 的兴趣命中、semantic score、质量信号和破圈信息。
- [x] 已移除停止维护的 `@react-native-cookies/cookies`，改用本地 Android Cookie bridge。

### P1 — 阅读体验

- [ ] 阅读进度：记录每篇文章/回答的滚动位置、已读完状态并支持继续阅读。
- [ ] 本地划线、摘录和笔记：保存出处、标题、作者、链接和时间。
- [ ] 知识卡片：原文摘录、我的理解、标签、复习状态，并与笔记联动。
- [ ] 本地全文搜索：覆盖已读、收藏、离线缓存、稍后阅读、笔记和评论草稿。
- [ ] 稍后阅读增强：可选离线正文保存、批量管理、排序与已读状态。
- [ ] 评论区增强：作者评论高亮、作者回复聚合、高赞/争议/认真讨论筛选。
- [ ] 评论回复表情与回复辅助。

### P2 — AI 与推荐

- [ ] 文章/回答 AI 分析面板：AI 写作特征风险、关键词、核心观点、信息密度和收藏价值。
- [ ] AI 摘要第一版：本地轻量结构化提取，小标题、关键词、核心句。
- [ ] AI 摘要第二版：可选模型生成一句话总结、三条核心观点、反方观点和适合谁看。
- [ ] 内容质量评分：结构清晰度、标题党风险、广告/软文风险、模板化程度和评论区质量。
- [ ] 推荐反馈细化：多看这个、少看这个、很有价值、不感兴趣、不是我想看的。
- [ ] 今日知识流：强相关、破圈、高质量长文和短内容的每日聚合。
- [ ] 阅读画像：最近 7 天阅读/收藏领域、高质量内容比例、兴趣变化趋势。
- [ ] 每日内容通知与本地推荐推送。
- [ ] 当前文章聊天：只围绕当前文章、收藏和笔记进行问答。

### P3 — UI、性能与工程

- [ ] 实现真正的 ColorOS palette；当前 `coloros.ts` 仍复用 HyperOS tokens。
- [ ] 实现真正的 Liquid Glass 主题与 glass surface tokens；当前仍为结构占位。
- [ ] 安装包大小、启动速度、首页内存与长列表性能优化。
- [ ] 统一设置页与高级功能的信息架构。
- [ ] 建立更完整的真机 smoke / regression 测试清单。

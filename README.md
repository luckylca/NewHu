# NewHU

NewHU is an Android-first React Native and Expo client focused on reading,
offline content, and on-device recommendation experiments.

## Development

```sh
npm install
npm run android
```

Use `npm run lint`, `npm run typecheck`, and `npm test` before committing.
The login flow depends on `@react-native-cookies/cookies` to read HttpOnly
session cookies. It currently runs through React Native's native-module
interop; replace the unmaintained dependency before that compatibility layer
is removed.

## Backlog

滑动切换评论区和主界面,✅
评论区子评论查看，✅
评论区回复，✅
加入问题界面✅
评论区查看图片优化，✅
加入抖音小红书知乎三种页面风格模式
优化设置
加入分享
加入通知， 每日内容推送
本地悄悄维护一个已读列表
加入搜索
回复评论表情包
加入聊天
本地 AI加入推送
缓存下载文章
本地笔记，导出笔记，导出文章
AI 摘要
安装包大小减小，性能优化
今日知识流，记录阅读位置
阅读性格分析
更换 UI 风格

## Suggested TODO

- 文章/回答 AI 分析面板：AI 写作特征风险分、摘要、核心观点、关键词、收藏价值、水文/营销提示。
- 接入 tiny-chinese-ai-detector：在详情页本地计算 AI-like score，文案只表达“AI 写作特征风险”，不做绝对判定。
- 本地划线、摘录和笔记：长按选中文本，保存出处、标题、作者、链接和时间。
- 知识卡片：原文摘录、我的理解、AI 摘要、标签、复习状态。
- 笔记/文章导出增强：支持 Markdown、PDF、图片卡片等格式。
- 今日知识流：每天聚合值得阅读的内容，包含强相关、破圈、高质量长文和短内容。
- 推荐原因解释：展示推荐命中的兴趣、相似内容、质量信号和探索/破圈原因。
- 推荐反馈细化：多看这个、少看这个、这篇很有价值、不感兴趣、不是我想看的。
- 本地全文搜索：搜索已读、收藏、离线缓存、笔记、评论草稿。
- 稍后读：区别于收藏和离线缓存，支持快速加入、移除和批量管理。
- 阅读进度：记录每篇文章/回答阅读位置，支持继续阅读、已读完状态。
- AI 摘要第一版：先做轻量结构化摘要，例如前几段提取、小标题、关键词、核心句。
- AI 摘要第二版：后续可接服务端模型，生成一句话总结、三条核心观点、反方观点、适合谁看、是否值得收藏。
- 评论区增强：作者评论高亮、作者回复聚合、高赞评论筛选、争议评论筛选、认真讨论筛选。
- 评论回复辅助：回复前润色为更友好、更简短、更有逻辑、更委婉反驳等风格。
- 阅读画像页面：展示最近 7 天阅读领域、收藏领域、高质量内容比例、未点击领域和兴趣变化趋势。
- 内容质量评分：信息密度、结构清晰度、标题党风险、广告/软文风险、模板化程度、评论区质量、收藏价值。
- 当前文章聊天：只围绕当前文章、收藏、笔记进行问答，不做普通通用聊天页。

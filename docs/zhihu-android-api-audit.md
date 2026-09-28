# 知乎 Web / Android API 接入审计

审计日期：2026-09-25  
目标工程：Mac 上的 NewHu 正式客户端。当前默认数据源仍为 Web；Android 推荐是可切换的额外召回源。

## 当前登录与 API 链路

登录页使用 WebView 登录知乎，随后从 `https://www.zhihu.com` 读取 Cookie header，校验 `z_c0` 并调用现有 Web `/api/v4/me` 校验登录态。完整 Cookie header 字符串存入 `useUserStore.cookies`，由 SecureStore 持久化。`getApiInstance(cookies)` 将同一字符串同步给 Web client 与 Android client。

Web Transport 保留 `www.zhihu.com`、现有 GET/POST 逻辑和 `x-zse-96` 签名：签名函数从 Cookie 中提取 `d_c0`，生成 Web API 所需签名。Web 推荐仍为 `/api/v3/feed/topstory/recommend` 并使用响应中的 `paging.next`。

Android Transport 的 NewHu 业务用途严格限于首页推荐候选召回：独立请求 `api.zhihu.com/topstory/recommend`，直接发送完整 Cookie header（游客请求则不发送 Cookie），不做 Web 签名，也不调用 Web client 的 `canLoad` 状态。当前 Android headers 依据 `zhurl --android` 源码，包括 Android UA、`x-api-version`、`x-app-version`、`x-app-za`、`x-page-id`、`x-app-bundleid`、`x-app-flavor`、`x-app-build`、`x-network-type` 和 `_xsrf` 对应的 `x-xsrftoken`。分页使用 Android 响应完整的 `paging.next`，并限制后续地址仍是 HTTPS 的 `api.zhihu.com/topstory/recommend`。

Answer / Article / Question 详情与正文继续使用现有 Web API 路径；客户端没有 Android 详情 transport。登录态完整回答/文章详情通过 `www.zhihu.com/api/v4/...` 和现有 `d_c0` / `x-zse-96` Web 签名读取。游客没有 Web Cookie 时保留推荐卡片摘要，不请求 Android 详情接口；本轮匿名实测样本的 Web 正文也受知乎登录限制，因此不承诺匿名完整正文。

## 上游实现核对

核对了 [Zhihu++ 当前 master 源码](https://github.com/zly2006/zhihu-plus-plus)、[zhurl 当前 main 源码](https://github.com/zly2006/zhurl/blob/main/src/main.rs) 和 [zhurl 信息流 API 文档](https://github.com/zly2006/zhurl/blob/main/docs/apis/feeds-search-history.md)。zhurl 的 Android 模式明确把 Android headers 与 Web 签名单独组装；推荐 API 文档称 `d_c0` 签名不是 Android 首页推荐的要求，登录 Cookie 可选，登录后结果更个性化，翻页地址取 `paging.next`。

当前两个上游项目的模拟客户端版本字符串并不一致：zhurl main 使用 API 3.0.93 / App 10.100.0；Zhihu++ 的 Android `AccountData.kt` 目前是 API 3.1.8 / App 10.61.0。NewHu 采用了用户点名要求重点核对的 `zhurl --android` 当前 headers，并以匿名 live 200 作为初步兼容证据；登录态测试结果见下方记录。若 Android endpoint 后续对版本号敏感，应按登录态状态码和响应变化重新核验，不应同时混用两组版本。

## API 审计表

| 功能 | Endpoint | 请求模式 | Web Cookie 可否使用 | NewHu 是否需要 | 实测状态 |
|---|---|---|---|---|---|
| Android 首页推荐 | `GET https://api.zhihu.com/topstory/recommend` | Android headers，不做 ZSE | 同一 Web Cookie 实测可用 | 是，P0 新候选源 | 请求携带经 `/api/v4/me` 验证的 Cookie，HTTP 200 × 3 页；raw 18，归一化 12，跨页重复 0 |
| Android 游客首页推荐 | `GET https://api.zhihu.com/topstory/recommend` | Android headers，不发送 Cookie | 不需要 | 是，游客首页 | 不带 Cookie 实测 HTTP 200，raw 6 且含 `paging.next` |
| Android 回答详情 | `GET https://api.zhihu.com/answers/{answer_id}` | Android headers，不发送 Cookie | 这些样本要求登录 | 不接入；NewHu 详情统一走 Web | 仅用于确认匿名正文限制：从匿名推荐流取两条真实 Answer ID 请求，均 HTTP 403、`need_login=true` / code `40353` |
| 游客回答完整正文 | `GET https://www.zhihu.com/tardis/zm/ans/{answer_id}` | 知乎 Web SSR HTML；不带 Cookie / ZSE | 不需要（公开回答） | 是，游客详情 | 真实公开回答实测 HTTP 200，约 29 KB；`g_initialProps.renderHtml.content` 含约 7.6k 字符正文 |
| 游客文章完整正文 | `GET https://zhuanlan.zhihu.com/p/{article_id}` | 知乎 Web SSR HTML；不带 Cookie / ZSE | 不需要（公开文章） | 是，游客详情 | 真实公开文章实测 HTTP 200，`js-initialData.initialState.entities.articles[id].content` 含约 30.8k 字符正文 |
| Web 首页推荐 | `GET https://www.zhihu.com/api/v3/feed/topstory/recommend` | Web Cookie + `d_c0` + `x-zse-96` | 是 | 是，现有主源 | 账号态 HTTP 200 × 3 页；raw 20，归一化 16，跨页重复 0；原行为保持 |
| 知乎 Web 搜索 | `GET https://www.zhihu.com/api/v4/search_v3` | Web Cookie + Web ZSE | 是 | 是，现有 Search Seed Router | 现有代码路径保留；没有在此轮单独重复请求 |
| Web 关注动态 | `GET https://www.zhihu.com/api/v3/moments` | Web + ZSE | 是，要求登录 | 可作为 P1 候选源 | 现有 API 方法存在；当前未作为推荐候选源接入，未实测 |
| 关注页推荐想法 | `GET https://api.zhihu.com/moments_v3?feed_type=recommend` | 文档按 Web 签名路径记录；不是首页 Android 推荐 | 需要登录 Cookie 与 Web 签名 | P1，需独立验证 | 未接入、未实测；该 endpoint 的推荐 feed 有单独 read-feedback 记录，不能套用到 topstory 推荐 |
| 关注推荐已读反馈 | `POST https://api.zhihu.com/moments/recent/read?brief={moments_feed.id}` | Web Cookie + ZSE | 是 | 只在接入上述 moments 推荐后需要 | Zhihu++ issue 记录了账号态 HTTP 200 试验；NewHu 未调用、未独立验证 |
| 热榜 | `GET https://api.zhihu.com/topstory/hot-lists/total` | NewHu 当前走公开 Web client 入口 | 不需要 | 不是本次候选源范围 | NewHu 已有公开读取方法；本次未实测 |
| Answer / Article 账号态详情 | 现有 `www.zhihu.com/api/v4/answers/...`、`/api/v4/articles/...` | Web + ZSE | 使用当前账号 Cookie | 是，登录态唯一 API 详情 transport | 现有路径保持 |
| 游客文章 Tardis fallback | `GET https://www.zhihu.com/tardis/zm/art/{article_id}` | Web SSR HTML；不带 Cookie / ZSE | 未确认 | 暂不接入 | 两个样本返回 200 但只有约 1.2 KB 通用错误页；主路径使用专栏公开页面 hydration |

本机账号态结果来自 MixFlip 上 NewHu 当前 SecureStore 里的既有 Web Cookie；设置页先通过 `/api/v4/me` 校验会话，再并行翻取 Web 与 Android 两侧最多三页。最终一次对比为：

| 指标 | Web | Android |
|---|---:|---:|
| HTTP 状态 | 200 / 200 / 200 | 200 / 200 / 200 |
| Content-Type | Web JSON | `application/json` |
| 原始条目 | 20 | 18 |
| 归一化条目 | 16 | 12 |
| 跨页重复 | 0 | 0 |
| 类别（原始类型 / 归一化类型） | answer 16、pin 2、feed_advert 2 | answer 12；6 条暂不支持的 card 被跳过 |

两源按 `feedType + ID` 比较：共有 1 条，Web 独有 15 条，Android 独有 11 条，合并后 27 条，Jaccard 重合度 0.037。这个样本说明 Android 源确实补入了 Web 三页之外的 11 个候选 ID（相对 Web 的 16 个归一化条目，合并候选数增加约 69%）；它不是 CTR 或排序质量结论。

本次三页请求都成功，分页 `next` 可连续使用；没有观察到跨页重复、401、403 或需要上报 `topstory/recommend` 曝光的证据。它只证明本账号、本设备、该时段内三页可用，不代表长期不会受限。匿名 Android API 早先也实测 HTTP 200、每页 6 个 ComponentCard。原始响应不进入仓库；fixture 已脱敏并替换为合成数据。

另用不带 Cookie 的 `GET https://www.zhihu.com/` 检查 d_c0 初始化：首页返回 HTTP 302 → 200，Set-Cookie 仅观察到 `_zap`、`_xsrf`、`BEC`，未下发 `d_c0`。因此 NewHu 不能把“匿名访问首页即可取得 d_c0”当作稳定流程。标准 `/api/v4/answers/{id}` 仍需要 `d_c0` 参与 `x-zse-96`；此前无登录会话样本的签名 API 请求返回 403，但由于没有拿到有效匿名 `d_c0`，这不足以证明该 API 在所有条件下都必须有登录态。

由于上游文档说明此 endpoint 匿名也可访问，且本轮没有做同一时段“有 Cookie / 无 Cookie”的受控内容对照，所以 HTTP 200 证明的是 NewHu 的现有 Web Cookie 可随 Android 请求发送、且不妨碍分页；它不能单独证明服务端因此返回了个性化内容。上述 11 个 Android 独有 ID 是相对于 Web 的新增候选，不等同于个性化证据。

## 游客浏览范围

未登录首页现已直接调用同一个 Android 推荐 endpoint，但显式删除 `Cookie` header；即使 API 单例里残留旧会话状态，guest 调用也不会发送它。匿名实测首页返回 HTTP 200、6 条回答卡片和下一页地址。游客点开回答时读取知乎 Web Tardis SSR 页面；点开文章时读取专栏 Web 页面中的 `js-initialData`。两种请求都不带 Cookie、不生成 Android headers，也不写阅读历史；若来源内容公开且正文完整，就展示正文，否则保留卡片摘要。

匿名正文并不一定要靠 d_c0 签名 API：本次匿名 Tardis 回答页与专栏文章 SSR 都返回了正文。它们是知乎首方 Web 页面结构，但未公开为稳定 API，页面结构或访问策略变化时，游客详情会退回推荐卡摘要。登录态仍使用现有 Web `/api/v4/...` API。付费、要求登录或文章标记正文截断的内容不会被匿名读取器展示为完整正文。Question 卡片仍展示公开问题摘要；问题回答列表匿名请求本次未验证成功。

## Android 首页推荐响应与归一化

本次匿名实测返回 `data` 中的 `ComponentCard`，通过 `action.parameter.route_url` 判定 Answer、Article、Question ID，从 card 的 Text / Line / Avatar / Reaction 节点提取标题、摘要、作者、头像和互动计数。无法识别的 card 安全跳过并计入 unsupported 数量。`paging.next` 原样进入 Android client；响应 `feed_request_id` 只用于批次诊断和分页状态，不伪造点赞、收藏、关注等用户行为。

归一化后进入现有 `FeedItemInfo`，与 Web 按 `feedType + content id` 去重；相同内容合并 `candidateSources` 来源集合。问题卡片走 NewHu 已有 Question 页面。最终仍调用 `processProductV1Feed`，不会直接在 Android Feed/UI 中绕过 Native512。

## Candidate / Native512 保持情况

- `recommendationSourceMode` 支持 `web`、`android`、`mixed`，旧配置缺字段或值无效时回到 `web`。默认 Web 保持升级前行为。
- Mixed 同时请求两个推荐 endpoint，统一按稳定内容 ID 去重；没有固定 50/50 拼接。失败或到末页的数据源会从当前加载周期中退出，由另一源继续翻页。
- CandidateArticle 的宽来源类别仍为现有 recommendation / search；具体来源保存为 `web_recommend`、`android_recommend`、`search`、`bubble_break` 等 origin，避免影响现有 ranker 语义。
- `FeedItemInfo.candidateSources` 会向前兼容旧内容；SQLite v8 为 `feed_entries` 增加可空来源 JSON，新字段缺失的旧行仍可读取。
- Native512 原 512D profile、2706 Seed Bank、Topic Graph、Search Router、按领域 supply/deficit 主动检索、显式领域比例、Bubble Break 和多样性路径未重写。本次只是扩大推荐召回源。`ProductV1Trace` 记录来源入池/去重/选中统计，并新增 Native512 active pool 按来源的分数 count/mean/min/max。当前真实对比只抓取并比较了候选，没有运行账号上的 Mixed 排序周期，因此这里还没有可报告的 live source score 数值或最终选中比例。

## 需进一步验证的 API

优先将 Web 关注流与 Zhihu++ 已研究的 `moments_v3` 分开验证，再决定是否纳入 Candidate Acquisition。Zhihu++ 的 [issue #553](https://github.com/zly2006/zhihu-plus-plus/issues/553) 报告的是“关注 → 推荐”动态流的读取反馈，指出 `moments/recent/read` 会影响该动态候选是否重复；这是另一条 endpoint 链路，不构成本次 `topstory/recommend` 缺少反馈的证据。本次 Android 首页推荐没有发现必须主动上报曝光/阅读的协议，NewHu 只推进 `paging.next`，不伪造真实阅读或互动。

候选 API 后续建议顺序：P1 `/api/v3/moments` 与 `moments_v3`（先确认数据类型、Cookie 与 read-feedback）；P1 Topic / Hot 候选来源；P2 Answer / Article / Question 详情字段补充。互动写接口不属于本次范围。

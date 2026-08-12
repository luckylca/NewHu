# NewHu 离线缓存 / Local-First 数据层实施任务

## 0. 任务目标

请直接开始对当前 Expo / React Native 项目实施完整的本地数据层和离线能力。

这次不是调研任务。

你需要在充分阅读当前源码的基础上，实际修改项目，实现：

1. SQLite 本地数据层
2. 在线浏览数据的临时缓存
3. 用户主动离线缓存文章
4. 根评论 / 子评论缓存
5. 图片本地文件缓存
6. 离线模式浏览
7. 离线点赞
8. 离线发表评论 / 回复
9. 网络恢复后的 Outbox 自动同步
10. 本地缓存自动清理
11. 为未来自适应推荐算法保存必要的数据基础
12. 为未来文章 Embedding 预留数据库结构

最终目标不是简单做一个“下载文章”按钮。

而是把当前 App 的数据架构逐步改造成：

```text
                Zhihu API
                    │
                    ↓
                Repository
                    │
           ┌────────┴────────┐
           │                 │
         SQLite          FileSystem
           │                 │
           │                 └── 图片等大文件
           │
           ├── 内容
           ├── 评论
           ├── Feed
           ├── 缓存状态
           ├── 用户行为
           └── Outbox
                    │
                    ↓
                    UI
```

但是：

**Repository / SQLite 是统一的数据层，不代表每次网络请求都必须 INSERT 后再 SELECT 才能刷新 UI。**

允许：

```text
API 返回
   ├──→ UI 立即更新
   └──→ SQLite upsert
```

之后再次进入页面：

```text
SQLite
   ↓
快速显示旧数据
   ↓
后台网络刷新
   ↓
UI 更新 + SQLite 更新
```

即：

```text
首次：
Network First

已有缓存：
Local First + Network Refresh

无网络：
Local Only
```

---

# 1. 当前项目背景

当前项目已经确认：

```text
Expo: ~54.0.33
React Native: 0.81.5
React: 19.1.0
TypeScript: strict
Router: Expo Router
State: Zustand
HTTP: 原生 fetch + 自定义知乎 Client
Storage: AsyncStorage + expo-file-system
Database: 当前没有 expo-sqlite
HTML: react-native-render-html
Build: Development Build / Prebuild
Android: 已存在 android/
```

项目已经存在：

```text
src/api/
src/stores/
src/components/
src/ui/
src/types/
src/utils/
```

并且已有：

```text
src/stores/useNotificationStore.ts
src/components/GlobalNotificationHost.tsx
src/ui/components/Snackbar.tsx
```

不要重新造 Toast 系统。

离线提示继续复用现有全局 Snackbar。

---

# 2. 总体设计原则

整个系统必须明确区分以下四种数据生命周期：

```text
TRANSIENT
普通在线浏览产生的临时缓存
→ 可以自动删除

PINNED
用户明确点击“缓存到本地”的数据
→ 禁止自动删除
→ 只能用户主动取消缓存 / 删除

BEHAVIOR
未来推荐算法需要的用户行为数据
→ 不属于普通 Cache
→ 不跟随“清理浏览缓存”删除

OUTBOX
用户已经执行、但尚未成功同步到知乎的操作
→ 同步成功前绝对禁止自动删除
```

不要使用一个简单的：

```ts
isCached: boolean
```

来承担全部含义。

---

# 3. SQLite 与 FileSystem 分工

## SQLite 保存

所有结构化数据：

```text
文章 / 回答 metadata
文章正文 HTML
Feed 顺序
评论
评论关系
分页状态
离线缓存配置
缓存任务状态
图片资源索引
用户行为
待同步操作
Embedding metadata / vector
```

## FileSystem 保存

大文件：

```text
正文图片
评论图片
头像
其他需要保证离线可读的网络图片
```

图片不要存 Base64 到 SQLite。

图片不要存 BLOB 到 SQLite。

应该：

```text
SQLite
remote_url
local_uri
size
mime_type
...

↓

FileSystem
offline/images/xxxxx.webp
```

---

# 4. 安装和初始化 SQLite

为项目加入与当前 Expo SDK 兼容的：

```text
expo-sqlite
```

安装前先检查当前 `package.json` 和 Expo SDK。

使用 Expo 当前 SDK 推荐的 SQLite API。

不要照抄旧版本 Expo SQLite 教程。

数据库建议：

```text
newhu.db
```

放在 App 私有目录。

数据库初始化应该是全局单例，不允许每个页面自己打开一个新的数据库实例。

建议新增类似：

```text
src/db/
├── database.ts
├── migrations.ts
├── schema.ts
└── repositories/
```

具体目录允许根据当前项目风格调整。

必须支持 migration。

不要写：

```ts
CREATE TABLE IF NOT EXISTS ...
```

然后永远不管理版本。

至少通过：

```text
PRAGMA user_version
```

或同等级 migration 机制维护 schema version。

---

# 5. 数据库 Schema

不要机械照抄下面 SQL。

请根据 Expo SQLite API 和当前 TypeScript 数据结构实现。

但最终必须包含以下概念。

---

## 5.1 contents

保存文章 / 回答的长期 metadata。

至少包括：

```text
id
type

title
excerpt

authorName
authorUrlToken
authorAvatar

questionId
questionTitle

voteCount
commentCount
favoriteCount

isVoted

createdAt
updatedAt

firstSeenAt
lastSeenAt
lastAccessedAt

hasBody
```

主键必须同时考虑：

```text
id + type
```

因为项目存在：

```text
answer
article
```

不要假设不同 content type 的 ID 永远没有冲突。

---

# 5.2 content_bodies

把完整正文和轻量 metadata 分开。

例如：

```text
content_id
content_type

html

fetched_at
last_accessed_at

cache_state
```

其中：

```text
cache_state:
transient
pinned
```

这样以后清理缓存时可以：

删除：

```text
正文 HTML
评论
图片
```

但仍保留：

```text
文章 ID
标题
摘要
用户行为
embedding
```

用于推荐算法。

---

# 5.3 feed_entries

当前 `useContentStore.feedList` 只存在内存。

现在需要增加 Feed 的本地记录能力。

至少记录：

```text
id
content_id
content_type

source
position

session_id / batch_id（如果需要）
fetched_at
last_accessed_at
```

用途：

```text
在线：
保存最近推荐流

离线：
可以从最近缓存 Feed 构造主页
```

不要保存知乎无限历史 Feed 到永久状态而完全不清理。

它属于：

```text
TRANSIENT
```

允许 LRU 清理。

---

# 5.4 comments

评论统一使用一张表。

必须支持：

```text
根评论
子评论
本地待同步评论
```

至少：

```text
id

content_id
content_type

parent_comment_id
root_comment_id

content_html

author_url_token
author_name
author_avatar

vote_count
is_voted

is_author
is_hot
is_top

created_at

child_comment_count
reply_to_author_name

cache_state

sync_status
local_only

fetched_at
last_accessed_at
```

其中：

```text
parent_comment_id = NULL
```

表示根评论。

子评论：

```text
parent_comment_id = 根评论 ID
```

本地尚未上传成功的评论 ID 使用：

```text
local:<uuid>
```

不要用负数 ID。

---

# 5.5 comment_list_entries

不能只把评论塞进 comments 表然后：

```sql
ORDER BY created_at
```

因为当前知乎评论支持：

```text
score
ts
```

不同排序。

同时在线 API 本身通过：

```text
paging.next
offset
```

进行分页。

因此需要保存“评论属于哪个列表、处于什么位置”。

设计类似：

```text
content_id
content_type

parent_comment_id nullable

order_by

comment_id
position

fetched_at
```

根评论：

```text
parent_comment_id = NULL
```

子评论：

```text
parent_comment_id = root comment id
```

这样才能正确恢复缓存列表顺序。

---

# 5.6 comment_page_state

需要缓存分页状态。

至少：

```text
content_id
content_type

parent_comment_id nullable

order_by

next_offset
is_end

total_count
loaded_count

updated_at
```

不要根据：

```text
loaded_count / 20
```

自己计算下一页。

必须尊重当前知乎 API 返回的：

```text
paging.next
paging.is_end
```

---

# 5.7 offline_pins

用户主动缓存文章以后，不是简单：

```text
contents.isPinned = true
```

需要单独记录缓存策略。

至少：

```text
content_id
content_type

root_comment_mode
root_comment_limit

child_comment_limit

with_images

created_at
updated_at

status
```

其中根评论策略至少支持：

```text
none
limit
all
```

当前 UI：

```text
评论缓存：

○ 不缓存评论
● 100 条
○ 全部评论
```

当选择：

```text
100 条
```

表示：

```text
最多缓存 100 条根评论
```

每一个根评论：

```text
子评论最多缓存 100 条
```

当选择：

```text
全部评论
```

表示：

```text
根评论一直请求到 paging.is_end
```

但是：

```text
每一条根评论的子评论仍然最多 100 条
```

这点必须严格区分。

---

# 5.8 cache_jobs

离线下载可能持续较久。

不能把所有逻辑绑死在一个 React Component 生命周期中。

需要缓存任务状态。

例如：

```text
id

content_id
content_type

status

root_target
root_cached

child_cached

image_total
image_cached

created_at
updated_at

last_error
```

状态：

```text
pending
running
paused
completed
partial
failed
cancelled
```

用户离开文章页面以后，缓存任务不应该因为 Component unmount 就直接丢失状态。

App 异常关闭后，再次进入可以识别：

```text
partial
```

并允许继续。

不要求现在实现 Android 真后台下载 Service。

只需要保证：

```text
App 进程存在时可以继续
App 重启后可以恢复状态并重新继续
```

---

# 5.9 resources

图片资源索引。

至少：

```text
id

remote_url
local_uri

mime_type
file_size

status

created_at
last_accessed_at
```

不要直接把本地路径写死进正文 HTML。

保留原始：

```html
<img src="https://pic.zhimg.com/...">
```

渲染时通过：

```text
remote URL
    ↓
ResourceRepository
    ↓
有本地文件？
    │
    ├─ yes → file://...
    └─ no  → remote URL
```

这样：

在线：

```text
本地有 → 优先本地
本地无 → 网络
```

离线：

```text
本地有 → 显示
本地无 → placeholder
```

不要永久修改原始正文 HTML。

---

# 5.10 resource_refs

同一张图片可能被多个地方引用。

至少建立：

```text
resource_id

owner_type
owner_id

purpose
```

例如：

```text
article_body
comment_body
author_avatar
comment_avatar
```

清理资源时，不允许：

```text
删除一篇文章
↓
直接删除所有关联图片
```

必须确认该图片没有被其他 pinned 内容使用。

---

# 5.11 pending_actions

实现 Outbox Pattern。

至少：

```text
id

action_type

target_type
target_id

payload_json

status

retry_count

depends_on_action_id

created_at
updated_at
last_attempt_at

last_error
```

status：

```text
pending
syncing
synced
failed
needs_user_action
```

action_type 至少为未来支持：

```text
SET_CONTENT_VOTE
SET_COMMENT_VOTE

CREATE_COMMENT
CREATE_REPLY
```

如果当前知乎 API 已支持其他写动作，可以合理扩展。

---

# 5.12 user_events

从现在开始为未来推荐算法留下行为数据结构。

至少：

```text
id

content_id
content_type

event_type

value_real
value_text

created_at
```

event_type 预留：

```text
impression
open
dwell_seconds
scroll_ratio

vote
unvote

comment

share

dislike
```

本阶段：

**不要实现推荐算法。**

但是数据库和调用接口要预留好。

如果当前页面很容易接入：

```text
open
dwell_seconds
scroll_ratio
vote
comment
dislike
```

可以开始记录。

不要为了行为记录大规模重写 UI。

---

# 5.13 content_embeddings

为未来本地推荐算法预留。

至少：

```text
content_id
content_type

model_version

embedding BLOB

created_at
updated_at
```

本阶段：

```text
不运行 Encoder
不生成 embedding
不引入 ONNX
不引入神经网络
```

只预留 Repository / Schema。

---

# 6. 网络状态层

当前项目没有真正的网络状态检测。

新增一个独立网络 Store，例如：

```text
src/stores/useNetworkStore.ts
```

不要塞到：

```text
useSettingStore
useContentStore
```

网络状态至少区分：

```text
unknown
online
offline
```

如果使用的网络库可以提供：

```text
isConnected
isInternetReachable
```

则分别保存。

不要把：

```text
403
401
知乎 API 5xx
```

误判为“用户没有网络”。

网络状态应该来自系统网络监听 / Internet reachability，而不是：

```text
fetch 报错 = offline
```

---

# 7. 首页离线模式

当前主页：

```text
app/home.tsx
```

需要接入网络状态。

当主页发现从：

```text
online
↓
offline
```

时：

通过现有：

```text
useNotificationStore
GlobalNotificationHost
Snackbar
```

显示：

```text
当前无网络，已进入离线模式
```

同一次离线状态不要每次 render 都弹。

只在：

```text
online → offline
```

状态转换时提示。

如果 App 冷启动就是 offline：

第一次进入主页时提示一次。

---

# 8. 离线主页数据

离线不能出现：

```text
Loading 永远转圈
```

离线时：

```text
HomeRepository
    ↓
SQLite
    ↓
最近 Feed / 可浏览缓存
```

优先展示：

```text
最近浏览过
且仍然存在本地内容的 Feed
```

可以混合：

```text
TRANSIENT
PINNED
```

但是：

用户主动 PIN 的内容不能因为 Feed 清理被删除。

如果某条 Feed 只剩 metadata、没有正文：

允许在主页显示。

点击后：

如果本地没有正文：

显示明确提示：

```text
该内容未完整缓存，当前无法离线打开
```

不要进入无限 Loading。

---

# 9. 在线主页

在线模式继续使用当前知乎推荐 API。

不要破坏：

```text
下拉刷新
无限加载
卡片模式
普通模式
session_token 分页
```

网络返回 `FeedItemInfo` 以后：

```text
1. UI 正常更新
2. 异步 upsert contents
3. 写入 feed_entries
```

不要为了 SQLite 让首页明显变慢。

---

# 10. 文章详情页

当前：

```text
app/item/[type]/[id]/index.tsx
```

现状为：

```text
needToGet = true
→ 网络重新请求
```

改造后：

## 有本地缓存

```text
进入详情
↓
SQLite 查找
↓
立即显示
↓
如果 online
    ↓
后台 getAnswer / getArticle
    ↓
更新 UI
    ↓
upsert SQLite
```

## 无本地缓存 + online

```text
正常网络请求
↓
显示
↓
写 SQLite transient
```

## 无本地缓存 + offline

显示：

```text
该内容未缓存，当前无法离线查看
```

不能无限 Loading。

---

# 11. 在线评论

这是一个关键要求：

**SQLite 不得限制在线评论只能有 100 条。**

100 条是：

```text
离线 PIN 的缓存策略
```

不是：

```text
数据库容量限制
```

在线用户可以：

```text
20
40
60
...
500
1000
...
```

持续滑动。

所有实际加载过的评论都允许写入 SQLite：

```text
cache_state = transient
```

例如：

```text
用户在线查看了 386 条评论
↓
386 条全部可以进入 SQLite
```

之后由清理服务决定是否淘汰。

---

# 12. 在线评论分页

不要破坏现有：

```text
limit=20
paging.next
paging.is_end
offset
order_by
```

流程。

每次网络加载：

```text
API
↓
normalizeComment()
↓
UI append
↓
upsert comments
↓
写 comment_list_entries
↓
更新 comment_page_state
```

下次打开评论页：

```text
先 SQLite 显示已有评论
↓
如果 online
继续刷新 / 加载
```

---

# 13. 主动缓存文章入口

在：

```text
app/item/[type]/[id]/index.tsx
```

现有右上角三点菜单中加入：

```text
缓存到本地
```

如果已经缓存：

显示：

```text
管理离线缓存
```

或：

```text
更新离线缓存
删除离线缓存
```

保持当前项目 UI 风格。

不要引入 React Native Paper。

优先复用：

```text
src/ui/
```

现有组件。

---

# 14. 缓存设置 UI

用户点击：

```text
缓存到本地
```

显示项目风格的 BottomSheet / Modal。

至少：

```text
缓存评论

○ 不缓存
● 100 条根评论
○ 全部根评论

────────────────

每条根评论的回复：
最多 100 条

────────────────

缓存图片

[✓] 正文及评论图片

────────────────

[开始缓存]
```

图片选项开启时：

至少缓存：

```text
正文图片
评论正文图片
文章作者头像
评论作者头像
```

评论中遇到远程 emoji：

可以按普通 resource 处理。

不要主动批量下载与当前文章无关的 emoji 全库。

---

# 15. 100 × 100 评论规则

例如用户选择：

```text
100 条根评论
```

规则：

```text
根评论：
最多 100 条

对于每一个根评论：

子评论：
min(真实数量, 100)
```

因此理论最大评论数：

```text
100 + 100 × 100
```

这是允许的。

下载逻辑必须复用已有数据。

例如数据库已经有：

```text
根评论 1~72
```

那么缓存 100 时：

不要重新请求 1~72。

继续从已有 paging state / 正确 offset 拉到 100。

子评论同理。

---

# 16. “全部评论”

用户选择：

```text
全部根评论
```

则：

```text
持续分页
↓
直到 paging.is_end === true
```

或：

```text
paging.next 不存在
```

每个根评论：

```text
子评论仍然最多 100
```

如果：

```text
counts.total_counts
```

非常大：

在 UI 中提示用户：

```text
该内容评论较多，缓存可能需要较长时间和较多存储空间
```

但不要随意修改用户选择。

---

# 17. 缓存升级

如果一条数据当前：

```text
TRANSIENT
```

用户后来缓存文章：

不要重新创建重复数据。

应该升级：

```text
TRANSIENT
↓
PINNED
```

例如：

```text
在线已经浏览：

根评论 1~80

用户点击：
缓存 100 条

↓

1~80 标记 PINNED
再下载 81~100
```

图片同理。

---

# 18. 图片缓存

建议目录：

```text
Paths.document/
└── offline/
    └── images/
```

文件名不要直接用 URL。

使用稳定 hash：

```text
sha256(url)
```

或项目中方便且稳定的 hash。

保留合理扩展名。

必须防止：

```text
?参数
/
:
超长文件名
```

造成文件路径问题。

---

# 19. 图片下载并发

不要：

```text
Promise.all(几千张图片)
```

必须限制并发。

建议：

```text
3~5
```

之间。

实现简单下载队列。

失败：

```text
记录 failed
```

文章缓存仍然可以：

```text
partial
```

用户可以之后：

```text
重试缺失资源
```

不要因为一张头像失败导致整篇文章缓存全部失败。

---

# 20. 图片渲染

当前正文使用：

```text
CustomImageRenderer
```

评论使用：

```text
CommentText
```

在这些现有入口加入统一：

```text
resolveImageUri(remoteUrl)
```

行为：

```text
本地文件存在
→ localUri

本地不存在 + online
→ remoteUrl

本地不存在 + offline
→ placeholder
```

不要复制多份解析逻辑。

抽成：

```text
ResourceRepository / ImageResolver
```

---

# 21. 离线点赞

用户离线时：

```text
点赞文章
取消文章点赞

点赞评论
取消评论点赞
```

UI 必须立即响应。

例如：

```text
isVoted = true
voteCount += 1
```

同时写入：

```text
pending_actions
```

不要显示：

```text
网络错误，操作失败
```

因为这是设计支持的离线行为。

---

# 22. 点赞 Outbox 合并

例如用户离线：

```text
点赞
取消
点赞
取消
点赞
```

不要产生 5 个请求。

对：

```text
同一个 target
同一种 vote 状态类型
```

采用 last-write-wins。

最终 Outbox：

```text
SET_CONTENT_VOTE
voted = true
```

或：

```text
SET_COMMENT_VOTE
voted = false
```

即可。

---

# 23. 不要猜知乎写接口

正式实现之前：

必须阅读：

```text
src/api/ZhihuApi.ts
src/api/api.ts
src/api/client.ts
```

以及项目所有：

```text
vote
comment
reply
POST
PUT
DELETE
```

相关代码。

如果当前项目已经实现：

```text
点赞
取消点赞
评论
回复
```

直接复用真实接口。

如果缺少某个接口：

先沿现有知乎请求实现方式分析。

不要凭空编造 endpoint。

不要根据 REST 常识猜：

```text
POST /comments
DELETE /vote
```

必须依据项目已有代码或当前真实接口实现。

---

# 24. 离线发表评论

用户离线发表新评论：

先本地创建：

```text
id = local:<uuid>
```

写入 `comments`：

```text
local_only = true
sync_status = pending
```

并立即显示在 UI。

同时写：

```text
pending_actions
CREATE_COMMENT
```

UI 在这条评论上显示弱提示：

```text
待同步
```

不要把它做成醒目的错误状态。

---

# 25. 离线回复

回复已有服务器评论：

```text
CREATE_REPLY
```

记录：

```text
parent_comment_id
reply_to_author
```

并创建本地：

```text
local:<uuid>
```

如果未来支持：

```text
回复另一条尚未同步的 local 评论
```

则 Outbox 使用：

```text
depends_on_action_id
```

等待父评论先获得服务器真实 ID。

如果当前 UI 没有这种操作入口，不需要为了这个极端情况重写整个评论系统。

但数据库设计必须允许未来扩展。

---

# 26. 评论同步成功

例如：

```text
local:123
```

成功上传以后服务器返回：

```text
987654321
```

需要正确处理：

```text
local id
↓
server id
```

并更新：

```text
comments
comment_list_entries
pending_actions
parent references（如果存在）
```

这个过程必须放在 transaction 中。

不能出现一半更新成功一半失败。

---

# 27. Outbox SyncService

新增统一：

```text
SyncService
```

不要把同步逻辑写进某一个 Screen。

触发时机至少：

```text
App 启动
App 回到前台
offline → online
用户主动点击重试
```

不要求现在实现真正 Android 后台常驻同步。

---

# 28. Outbox 同步顺序

按照：

```text
created_at
```

基本顺序执行。

但是：

点赞状态可以合并。

评论 / 回复需要尊重依赖。

例如：

```text
CREATE_COMMENT A
↓
CREATE_REPLY B depends A
```

A 未成功以前不能执行 B。

---

# 29. 同步失败处理

区分：

```text
网络错误
服务器 5xx
401 / 403
其他永久 4xx
```

## 网络错误

保持：

```text
pending
```

下次网络恢复继续。

## 5xx

允许稍后重试。

## 401 / 403

不要无限重试。

标记：

```text
needs_user_action
```

提示登录状态 / 权限可能失效。

## 永久 4xx

标记：

```text
failed
```

保留用户本地数据。

绝对不能因为同步失败删除用户写的评论。

---

# 30. CREATE_COMMENT 的重复提交问题

发表评论不是天然幂等操作。

如果请求发生：

```text
客户端 timeout
```

无法确认服务器：

```text
到底成功还是失败
```

不要无限自动重发导致重复评论。

如果当前知乎接口没有 client idempotency：

对此类“不确定状态”采用保守策略：

```text
needs_user_action
```

让用户：

```text
重新发送
删除本地评论
```

如果可以通过重新读取最新评论可靠确认服务器已经存在该评论，则可以做 reconciliation。

但不要通过脆弱的纯文本模糊匹配直接删除本地记录。

---

# 31. 网络恢复提示

offline → online 时：

可以使用现有 Snackbar：

```text
网络已恢复，正在同步离线操作
```

如果没有 pending action：

不需要额外打扰用户。

同步成功：

如果只有少量操作：

可以静默完成。

如果存在失败：

提示：

```text
部分离线操作同步失败
```

并提供进入管理页面的入口。

---

# 32. Cache 清理服务

新增：

```text
CacheCleanupService
```

职责：

```text
计算缓存占用
清理 transient
维护图片引用
保护 pinned
保护 outbox
```

不能简单：

```text
rm -rf offline/
```

作为自动清理。

---

# 33. 缓存分类

设置页面显示至少：

```text
离线下载
浏览缓存
图片缓存
推荐学习数据
待同步数据
```

概念必须区分。

---

# 34. 自动缓存上限

在设置中加入：

```text
自动缓存上限

○ 500 MB
● 1 GB
○ 2 GB
○ 5 GB
○ 不限制
```

默认：

```text
1 GB
```

这个限制只针对：

```text
TRANSIENT 浏览缓存
```

不要把：

```text
PINNED 离线下载
```

算进去然后自动删除 PINNED。

界面可以同时显示总占用。

---

# 35. LRU 清理

TRANSIENT 使用：

```text
last_accessed_at
```

实现 LRU。

例如：

```text
超过 1 GB
↓
从最久未访问内容开始
↓
清理正文 / 评论 / 图片
↓
直到低于目标
```

建议使用：

```text
高水位 → 低水位
```

例如：

```text
上限 1 GB
触发清理

清到约 800 MB
```

不要每增加 1 MB 就马上重复清理。

---

# 36. 清理优先级

建议：

```text
第一优先：
TRANSIENT 图片

第二优先：
TRANSIENT 评论

第三优先：
TRANSIENT 正文

第四优先：
旧 Feed entries
```

`contents` 的轻量 metadata：

尽量晚删除。

因为未来推荐算法可能需要：

```text
title
excerpt
author
content id
```

---

# 37. 永远不能自动删除的数据

以下数据自动清理服务禁止删除：

```text
PINNED

OUTBOX pending / syncing / failed / needs_user_action

用户尚未同步成功的本地评论

正在执行的 cache_job

SQLite migration metadata
```

`user_events`：

不属于普通 Cache。

只能通过单独：

```text
清理推荐学习数据
```

处理。

---

# 38. 手动清理页面

当前：

```text
app/settings.tsx
```

已有：

```text
清理临时缓存
```

将其扩展成：

```text
离线与存储
```

进入缓存管理页面。

至少展示：

```text
浏览缓存       xxx MB
离线内容       xxx MB
图片           xxx MB
推荐数据       xxx MB
待同步操作     N 条
```

按钮：

```text
[清理浏览缓存]

[清理未固定图片]

[管理离线内容]

[清理推荐学习数据]
```

其中：

```text
清理推荐学习数据
```

必须二次确认。

---

# 39. 离线内容管理

新增页面：

```text
已缓存内容
```

展示：

```text
标题
作者
缓存时间
评论缓存情况
图片缓存情况
占用空间
状态
```

状态：

```text
已完成
缓存中
部分完成
失败
```

允许：

```text
继续缓存
重试
删除离线缓存
```

删除 PIN 时：

如果内容同时是 transient 最近访问数据：

允许降级成：

```text
PINNED → TRANSIENT
```

而不是必须立刻删除所有记录。

---

# 40. SQLite 文件空间

删除大量 SQLite row 后：

数据库文件不一定立即缩小。

不要每次普通 LRU 清理都执行：

```sql
VACUUM
```

这样会造成不必要 I/O。

可以：

```text
用户手动执行大规模清理后
```

再考虑运行一次维护操作。

前提是当前 Expo SQLite API 支持且不会阻塞 UI。

---

# 41. 推荐算法数据预留

当前不要实现推荐算法。

但是从现在开始应尽量不要丢失以下信息：

```text
推荐曝光
点击文章
停留时间
滚动比例
点赞 / 取消点赞
发表评论
不喜欢
```

新增一个薄的：

```text
UserEventRecorder
```

例如：

```ts
recordEvent(...)
```

业务页面不要直接自己写 SQL。

---

# 42. 行为数据与缓存解耦

例如用户看过文章：

```text
A
```

之后 CacheCleanup 删除：

```text
HTML
评论
图片
```

仍然允许保留：

```text
文章 metadata
user_events
```

未来推荐算法依然知道：

```text
用户看过 A
停留 80 秒
滚动 95%
点赞
```

---

# 43. Repository 分层

页面禁止大量直接出现：

```ts
db.runAsync(...)
db.getAllAsync(...)
```

SQL 集中在：

```text
Repository
```

至少建议：

```text
ContentRepository
FeedRepository
CommentRepository
ResourceRepository
OfflineCacheRepository
OutboxRepository
UserEventRepository
```

Service：

```text
OfflineCacheService
SyncService
CacheCleanupService
NetworkService
```

页面负责：

```text
展示
调用
```

而不是数据规则。

---

# 44. API 与 Repository

现有：

```text
src/api/ZhihuApi.ts
src/api/api.ts
src/api/client.ts
```

不要大规模推翻。

API 层继续负责：

```text
知乎网络
```

Repository 负责：

```text
网络数据
+
SQLite
```

目标不是一次性重写整个 API。

采用渐进式改造。

---

# 45. Zustand 的职责

不要把几千篇文章和几万条评论全塞 Zustand。

Zustand 只保存：

```text
当前 UI 状态
当前页面状态
网络状态
设置
登录态
通知
```

大数据：

```text
SQLite
```

不要再使用 Zustand persist 保存：

```text
整篇 HTML
几百条评论
```

---

# 46. AsyncStorage

继续用于：

```text
设置
用户状态
Cookie
轻量配置
```

不要把：

```text
文章正文
评论
Outbox
Feed 历史
```

放 AsyncStorage。

---

# 47. 原有功能不能被破坏

改造过程中必须持续保持：

```text
登录
推荐流
下拉刷新
加载更多
文章详情
评论分页
评论排序
子评论
点赞
主题
壁纸
导出
Snackbar
卡片模式
```

可用。

不要以“重构”为理由删除现有功能。

---

# 48. TypeScript

当前项目：

```text
strict: true
```

新增数据库代码不要大量使用：

```ts
any
```

为 DB Row 明确定义类型。

知乎 API 原始 response 中已有 `any` 的地方：

本任务不要求一次全部消灭。

但是新写的：

```text
Repository
DB
Outbox
Cache
```

必须尽量强类型。

---

# 49. Transaction

以下操作必须使用 transaction：

```text
缓存文章状态切换

local comment → server comment id 替换

删除 pinned 内容及资源引用

Outbox 成功后更新本地状态

批量写入一个评论分页

Migration
```

避免数据库半成功状态。

---

# 50. Index

给常用查询建立必要 index。

至少关注：

```text
comments(content_id, content_type, parent_comment_id)

comment_list_entries(...)

feed_entries(fetched_at)

contents(last_accessed_at)

content_bodies(cache_state, last_accessed_at)

resources(last_accessed_at)

pending_actions(status, created_at)

user_events(content_id, created_at)
```

不要给所有字段无脑建 index。

---

# 51. 外键与删除规则

能使用外键的地方合理使用。

数据库初始化开启：

```text
foreign_keys
```

如果当前 Expo SQLite 和 Android 环境支持：

可以使用 WAL。

但请以当前项目实际运行兼容性为准。

不要为了 WAL 引入额外不稳定修改。

---

# 52. Cache 下载失败策略

缓存过程中：

```text
正文成功
80 条根评论成功
第 81 条请求失败
```

不要删除前面成功的数据。

标记：

```text
partial
```

以后：

```text
继续缓存
```

从现有进度继续。

---

# 53. 缓存进度

缓存时 UI 至少显示：

```text
正在缓存正文

根评论 72 / 100

回复 438 / ...

图片 21 / 37
```

不要必须精确预测“全部评论”的最终子评论总数。

能算多少显示多少。

---

# 54. 取消缓存任务

用户允许：

```text
取消正在下载
```

取消后：

已经下载的普通数据可以：

```text
降级为 TRANSIENT
```

除非用户明确选择保留。

不要留下：

```text
status=running
```

永久卡住。

---

# 55. App 重启恢复

启动数据库以后检查：

```text
cache_jobs
```

如果发现：

```text
running
```

但上次 App 已经退出：

转换成：

```text
paused / partial
```

然后允许：

```text
继续
```

不要直接假定仍有后台线程在执行。

---

# 56. 首页 offline Snackbar

复用：

```text
notify('当前无网络，已进入离线模式')
```

不要新建第二套 Notification Provider。

---

# 57. 设置页 UI 风格

严格复用当前项目：

```text
src/ui/
```

不要引入：

```text
react-native-paper
NativeBase
Tamagui
```

等新的 UI 框架。

不要为了这个功能改变现有整体美学。

---

# 58. 日志

开发阶段给关键 Service 加有意义日志。

例如：

```text
[OfflineCache]
[Sync]
[CacheCleanup]
[DB]
```

不要每 INSERT 一行就疯狂输出。

关键日志：

```text
DB migration
缓存任务开始/结束
网络状态变化
Sync 开始/结果
Cleanup 删除多少数据 / 释放多少空间
```

---

# 59. 错误处理

新增统一错误分类。

至少区分：

```text
NetworkError
AuthError
ApiError
DatabaseError
FileSystemError
SyncError
```

不要求重构整个项目所有历史 Error。

新模块应采用清晰错误语义。

---

# 60. 第一阶段实施顺序

严格建议按照这个顺序推进。

不要一上来同时修改十几个页面。

## Phase 1

```text
expo-sqlite
database
migration
schema
repository 基础
```

先确保：

```text
数据库创建成功
Migration 正常
读写正常
```

---

## Phase 2

实现：

```text
NetworkStore
NetworkService
```

然后接：

```text
Global Snackbar
```

做到：

```text
offline → 首页提示
online → 状态恢复
```

---

## Phase 3

实现：

```text
ContentRepository
FeedRepository
CommentRepository
```

先让在线请求：

```text
正常工作
+
写 SQLite transient
```

此阶段不要先做 PIN。

---

## Phase 4

让：

```text
文章详情
评论页
```

支持：

```text
SQLite 快速显示
+
在线后台刷新
```

并完成真正离线浏览。

---

## Phase 5

实现：

```text
OfflineCacheService
offline_pins
cache_jobs
```

加入：

```text
缓存到本地
```

以及：

```text
100 根评论
全部根评论
每根最多 100 子评论
```

---

## Phase 6

实现：

```text
resources
resource_refs
FileSystem image cache
ImageResolver
```

完成离线图片。

---

## Phase 7

实现：

```text
pending_actions
OutboxRepository
SyncService
```

接入：

```text
离线点赞
离线评论
离线回复
```

---

## Phase 8

实现：

```text
CacheCleanupService
缓存管理页面
离线内容管理
```

---

## Phase 9

加入：

```text
UserEventRepository
content_embeddings schema
```

只做未来推荐算法的数据准备。

不实现推荐模型。

---

# 61. 每完成一个 Phase 都要验证

不要等所有代码写完再：

```text
npm run typecheck
```

每个阶段都至少检查：

```text
TypeScript
Lint（如果项目存在）
Expo 构建
Android Development Build
```

如果项目已有测试：

运行相关测试。

---

# 62. 数据迁移安全

这是用户已有项目。

不能因为加入数据库：

```text
清空 AsyncStorage
清空 Cookie
清空设置
删除壁纸
```

当前已有：

```text
user-store
setting-store
content-store
draft-store
```

保持兼容。

---

# 63. 不要过度重构

禁止在本任务中：

```text
重写整个 Router
替换 Zustand
替换现有 UI 系统
替换 fetch
重新实现登录
重写知乎签名
```

仅修改离线数据层真正需要的部分。

---

# 64. 最终用户体验

## 在线第一次打开文章

```text
API
↓
UI
↓
SQLite transient
```

## 在线再次打开

```text
SQLite
↓
瞬间显示

同时：

API
↓
刷新 UI
↓
更新 SQLite
```

## 离线打开

```text
SQLite
↓
直接显示
```

## 离线点赞

```text
立即修改本地 UI / SQLite
↓
Outbox
```

## 恢复联网

```text
SyncService
↓
知乎
↓
同步完成
```

---

# 65. 缓存生命周期示例

```text
文章 A
在线阅读
↓
TRANSIENT

用户点击“缓存到本地”
↓
PINNED

────────────────────

文章 B
在线阅读
↓
TRANSIENT

30 天没有访问
+
Cache 超过上限
↓
LRU 删除正文 / 评论 / 图片

metadata + user_events
可以继续保留

────────────────────

评论 C
离线发表
↓
OUTBOX

即使执行清理缓存
↓
禁止删除

同步成功
↓
转为普通 server comment
```

---

# 66. 完成标准

本任务完成以后，必须实际满足以下场景。

### Case 1

联网打开文章。

关闭 App。

断网。

重新打开。

能重新看到之前缓存过的文章。

---

### Case 2

用户主动：

```text
缓存文章
100 条评论
缓存图片
```

断网后：

```text
正文正常
前 100 条根评论正常
每个已缓存根评论最多 100 条回复
图片正常
```

---

### Case 3

一篇文章在线浏览了：

```text
300 条根评论
```

数据库允许保存 300 条 transient。

不能因为离线默认 100 而丢掉后 200 条。

---

### Case 4

300 条中：

```text
前 100 条被 PINNED
后 200 条 TRANSIENT
```

自动清理：

只允许删后 200。

---

### Case 5

离线点赞文章。

UI 立即显示点赞。

恢复联网。

自动同步。

---

### Case 6

离线：

```text
点赞
取消
点赞
```

联网以后：

不要发送三个无意义请求。

只同步最终状态。

---

### Case 7

离线发表评论。

评论立刻出现在评论区：

```text
待同步
```

恢复联网：

成功后转换成服务器评论。

---

### Case 8

同步失败。

本地评论仍然存在。

显示：

```text
同步失败
```

允许：

```text
重试
删除
```

---

### Case 9

浏览缓存超过用户设置的容量。

自动 LRU 清理。

不能删除：

```text
PINNED
OUTBOX
```

---

### Case 10

点击：

```text
清理浏览缓存
```

不能造成：

```text
离线下载丢失
待同步评论丢失
登录状态丢失
主题设置丢失
```

---

# 67. 最终代码质量要求

完成以后：

```text
npm / Expo 项目可以正常启动
TypeScript 无新增错误
数据库 migration 可重复运行
App 重启后数据库正常
网络恢复后 Sync 不重复执行同一个已成功 action
缓存任务能够识别 partial
缓存清理不会删除 protected data
```

---

# 68. 最终汇报

全部完成以后，不要只说：

```text
完成了
```

给我一份实施报告。

格式：

# Local-First / Offline 实施报告

## 1. 新增依赖

## 2. 新增文件

## 3. 修改文件

## 4. SQLite Schema

列出所有表及用途。

## 5. Migration

说明当前 schema version。

## 6. Online 数据流

## 7. Offline 数据流

## 8. 评论缓存规则

明确说明：

```text
根评论 100 / all
每根子评论最多 100
```

## 9. 图片缓存

## 10. Outbox Sync

## 11. Cache Cleanup

## 12. 推荐算法预留

## 13. 实际运行过的检查命令

列出：

```text
typecheck
lint
build
test
```

及结果。

## 14. 尚未完成 / 存在风险的部分

必须如实写。

不要隐藏失败。

---

# 69. 开始工作

现在请开始执行本任务。

不要再次给我写一份设计方案。

不要只告诉我“建议如何实现”。

请：

```text
阅读当前真实源码
↓
确认调用关系
↓
按照 Phase 顺序修改代码
↓
持续运行检查
↓
解决编译错误
↓
最终给出实施报告
```

如果某个细节与本文描述和真实源码存在冲突：

**以保证现有功能和真实 API 行为为优先。**

但不能擅自取消以下核心需求：

```text
SQLite
TRANSIENT / PINNED
100 × 100 评论规则
FileSystem 图片
离线浏览
离线点赞 / 评论
Outbox
联网同步
LRU 清理
用户行为数据预留
```

不要因为任务较大只完成空壳文件。

请实际完成能够运行的实现。

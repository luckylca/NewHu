/**
 * 知乎内容归一化后的统一类型定义
 *
 * 所有 feed 项（回答 / 文章）在进入 store 之前，都会先经过
 * home.tsx 的 processFeedItem（或详情页里的归一化逻辑）统一映射成
 * camelCase 的 FeedItem 结构，因此这里只描述「归一化之后」的形状，
 * 而不是知乎 API 的原始响应结构。
 */

export type FeedType = 'answer' | 'article';

/** 归一化后的单条 feed 内容（回答与文章统一形状） */
export interface FeedItem {
    id: string;
    title: string;
    authorName: string;
    authorUrlToken: string;
    authorAvatar: string;
    excerpt: string;
    updatedTime: number;
    // 统计字段
    voteCount: number;
    favoriteCount: number;
    /** 当前登录用户是否已收藏；部分列表接口不会返回此字段。 */
    favorited?: boolean;
    commentCount: number;
    // 正文（HTML）
    content: string;
    // 所属问题字段（文章可能没有 question，归一化时已填充默认值）
    questionTitle: string;
    questionId: string;
    questionAuthorName: string;
    questionAuthorAvatar: string;
    questionAuthorUrlToken: string;
    questionAnswerCount: number;
    questionCreatedTime: number;
}

/** 推荐流中的一条记录：内容 + 类型标记 + 广告/付费标记 */
export interface FeedItemInfo {
    feedType: FeedType;
    isAds: boolean;
    isPaid: boolean;
    item: FeedItem;
}

/** 详情页读取的数据：在 FeedItem 基础上额外携带当前用户的点赞关系 */
export interface FeedDetail extends FeedItem {
    voted?: boolean;
}

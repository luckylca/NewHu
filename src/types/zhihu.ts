interface PeopleInfo {
    name: string;
    headline: string;
    avatar_url: string;
    gender: number;             //基本信息
    follower_count: number;

    id: string;
    url_token: string;              //用户唯一的信息，通过这个访问用户的主页

    is_following: boolean;
    is_followed: boolean;           //用户和当前登录用户的关系
}

interface SimpleAnswer {
    id: string;
    excerpt: string;
    authorName: string;

    voteCount: number;
    favoriteCount: number;
    commentCount: number;

    questionId: string;
    questionTitle: string;
}
interface SimpleArticle {
    id: string;
    title: string;
    excerpt: string;
    authorName: string;
    voteCount: number;
    favoriteCount: number;
    commentCount: number;
}

type FeedType = 'answer' | 'article';

// 先定义 Answer 和 Article 的类型
interface Answer {
    id: string;
    excerpt: string;
    content: string;
    visited_count: number;
    updatedTime: number;
      // 统计数据
    voteup_count: number;
    comment_count: number;
    favorite_count: number;
    authorName: string;
    authorUrlToken: string;
    authorAvatar: string;
    isVisited: boolean; // 这个字段需要我们自己添加，用于标记是否已访问过

    questionId: string;
    questionTitle: string;
    questionAuthorName: string;
    questionAuthorAvatar: string;
    questionAuthorUrlToken: string;
    questionAnswerCount: number;
    questionCreatedTime: number;
}

interface Article {
    id: string;
    title: string;
    excerpt: string;
    authorName: string;
    authorUrlToken: string;
    authorAvatar: string;
    voteup_count: number;
    comment_count: number;
    favorite_count: number;
     // 统计数据
    updatedTime: number;
    content:string;
    isVisited: boolean; // 这个字段需要我们自己添加，用于标记是否已访问过
}

// 使用判别联合
type FeedItemInfo =
    | {
        feedType: 'answer';
        isAds: boolean;
        isPaid: boolean;
        item: Answer;
    }
    | {
        feedType: 'article';
        isAds: boolean;
        isPaid: boolean;
        item: Article;
    };


export type { PeopleInfo, SimpleAnswer, SimpleArticle, FeedType, Answer, Article, FeedItemInfo };
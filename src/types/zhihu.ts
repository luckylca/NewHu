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
    voteup_count: number;
    comment_count: number;
    question: {
        id: string;
        title: string;
    };
}
interface SimpleArticle {
    id: string;
    title: string;
    excerpt: string;
}

type FeedType = 'answer' | 'article';

// 先定义 Answer 和 Article 的类型
interface Answer {
    id: string;
    excerpt: string;
    content: string;
    visited_count: number;
    created_time: number;
      // 统计数据
    voteup_count: number;
    comment_count: number;
    favorite_count: number;
    author: PeopleInfo;
    isVisited: boolean; // 这个字段需要我们自己添加，用于标记是否已访问过
    question: {
        id: string;
        title: string;
        author: PeopleInfo;
        answer_count: number;
        created_time: number;
    };
}

interface Article {
    id: string;
    title: string;
    excerpt: string;
    author: PeopleInfo;

    voteup_count: number;
    comment_count: number;
    favorite_count: number;
     // 统计数据
    created_time: number;

    isVisited: boolean; // 这个字段需要我们自己添加，用于标记是否已访问过
}

// 使用判别联合
type FeedItemInfo =
    | {
        feedType: 'answer';
        isAds: boolean;
        isPaid: boolean;
        item: SimpleAnswer;
    }
    | {
        feedType: 'article';
        isAds: boolean;
        isPaid: boolean;
        item: SimpleArticle;
    };

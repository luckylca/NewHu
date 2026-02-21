import ZhihuAPI from "./api";

let apiInstance: ZhihuAPI | null = null;

function requireApiInstance(): ZhihuAPI {
    if (!apiInstance) {
        throw new Error("API instance not initialized. Please set cookie first.");
    }
    return apiInstance;
}

export function getApiInstance(cookie?: string): ZhihuAPI {
    if (!apiInstance) {
        apiInstance = new ZhihuAPI(cookie ?? "");
    }
    return apiInstance;
}

// 设置共享 API 实例的 Cookie。
export function setCookie(cookie: string) {
    if (apiInstance) {
        apiInstance.setCookie(cookie);
    } else {
        apiInstance = new ZhihuAPI(cookie);
    }
}

// 根据用户的 URL Token 获取用户信息。
export async function getUserInfo(url_token: string) {
    const data = await requireApiInstance().getUserInfo(url_token);
    return data;
}

// 获取当前登录用户信息。
export async function getMe() {
    const data = await requireApiInstance().getMe();
    return data;
}

// 获取用户的收藏夹列表。
export async function getUserCollections(username: string, offset: number = 0) {
    const data = await requireApiInstance().getUserCollections(username, offset);
    return data;
}

// 获取收藏夹内的内容列表。
export async function getCollectionItems(collectionId: string, offset: number = 0) {
    const data = await requireApiInstance().getCollectionItems(collectionId, offset);
    return data;
}

// 获取推荐流内容。
export async function getRecommend(session_token: string = "") {
    const data = await requireApiInstance().getRecommend(session_token);
    return data;
}

// 获取关注动态。
export async function getFollowingFeed(offset: number = 0) {
    const data = await requireApiInstance().getFollowingFeed(offset);
    return data;
}

// 获取回答详情。
export async function getAnswer(answerId: string) {
    const data = await requireApiInstance().getAnswer(answerId);
    return data;
}

// 点赞回答。
export async function voteupAnswer(answerId: string) {
    const data = await requireApiInstance().voteupAnswer(answerId);
    return data;
}

// 取消点赞回答。
export async function cancelVoteupAnswer(answerId: string) {
    const data = await requireApiInstance().cancelVoteupAnswer(answerId);
    return data;
}

// 获取问题详情。
export async function getQuestion(questionId: string) {
    const data = await requireApiInstance().getQuestion(questionId);
    return data;
}

// 获取问题的回答列表。
export async function getQuestionAnswers(
    questionId: string,
    offset: number = 0,
    sort: string = "default"
) {
    const data = await requireApiInstance().getQuestionAnswers(questionId, offset, sort);
    return data;
}

// 获取内容的根评论列表。
export async function getComments(id: string, type: string, offset: number = 0) {
    const data = await requireApiInstance().getComments(id, type, offset);
    return data;
}

// 收藏回答。
export async function favoriteAnswer(answerId: string) {
    const data = await requireApiInstance().favoriteAnswer(answerId);
    return data;
}

// 取消收藏回答。
export async function unfavoriteAnswer(answerId: string) {
    const data = await requireApiInstance().unfavoriteAnswer(answerId);
    return data;
}

// 搜索内容。
export async function search(keyword: string, offset: number = 0, type: string = "general") {
    const data = await requireApiInstance().search(keyword, offset, type);
    return data;
}

// 添加阅读历史。
export async function addReadHistory(contentToken: string, contentType = "article") {
    const data = await requireApiInstance().addReadHistory(contentToken, contentType);
    return data;
}

// 获取阅读历史列表。
export async function getReadHistory(offset: number = 0) {
    const data = await requireApiInstance().getReadHistory(offset);
    return data;
}
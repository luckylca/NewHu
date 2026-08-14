import ZhihuAPI from "./api";
import type { SearchOptions } from './api';

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
    } else if (cookie) {
        // 实例已存在时同步最新 Cookie，避免登录/切换账号后仍使用旧凭据
        apiInstance.setCookie(cookie);
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
export async function getRecommend(cursor: string = "") {
    const data = await requireApiInstance().getRecommend(cursor);
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

// 获取文章详情。
export async function getArticle(articleId: string) {
    const data = await requireApiInstance().getArticle(articleId);
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

export async function voteupArticle(articleId: string) {
    const data = await requireApiInstance().voteupArticle(articleId);
    return data;
}

export async function cancelVoteupArticle(articleId: string) {
    const data = await requireApiInstance().cancelVoteupArticle(articleId);
    return data;
}

// 不喜欢（踩）回答。
export async function dislikeAnswer(answerId: string) {
    const data = await requireApiInstance().dislikeAnswer(answerId);
    return data;
}

// 取消不喜欢回答。
export async function cancelDislikeAnswer(answerId: string) {
    const data = await requireApiInstance().cancelDislikeAnswer(answerId);
    return data;
}

// 不喜欢（踩）文章。
export async function dislikeArticle(articleId: string) {
    const data = await requireApiInstance().dislikeArticle(articleId);
    return data;
}

// 取消不喜欢文章。
export async function cancelDislikeArticle(articleId: string) {
    const data = await requireApiInstance().cancelDislikeArticle(articleId);
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
export async function getRootComments(id: string, type: string, offset: string = "", sort: string = "score") {
    const data = await requireApiInstance().getRootComments(id, type, offset, sort);
    return data;
}

export async function getChildComments(commentId: string, offset: string = "", sort: string = "ts") {
    const data = await requireApiInstance().getChildComments(commentId, offset, sort);
    return data;
}

//发表评论
export async function submitComment(params: { contentType: string; contentId: string; text: string; replyCommentId?: string }) {
    const data = await requireApiInstance().submitComment(params);
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
export async function search(keyword: string, offset: number = 0, type: string = "general", options: SearchOptions = {}) {
    const data = await requireApiInstance().search(keyword, offset, type, options);
    return data;
}

// 获取搜索候选词。
export async function getSearchSuggestions(keyword: string) {
    return requireApiInstance().getSearchSuggestions(keyword);
}

// 获取搜索筛选项。
export async function getSearchCustomize(keyword: string) {
    return requireApiInstance().getSearchCustomize(keyword);
}

// 请求知乎 AI 搜索流。
export async function streamSearchAi(keyword: string, onChunk: (chunk: string) => void) {
    return requireApiInstance().streamSearchAi(keyword, onChunk);
}

// 添加阅读历史。
export async function addReadHistory(contentToken: string, contentType: string) {
    const data = await requireApiInstance().addReadHistory(contentToken, contentType);
    return data;
}

// 获取阅读历史列表。
export async function getReadHistory(offset: number = 0) {
    const data = await requireApiInstance().getReadHistory(offset);
    return data;
}

export async function likeComment(commentId: string) {
    const data = await requireApiInstance().likeComment(commentId);
    return data;
}

export async function cancelLikeComment(commentId: string) {
    const data = await requireApiInstance().cancelLikeComment(commentId);
    return data;
}

export async function getUserAnswers(urlToken: string, offset: number = 0, limit: number = 20, sortBy: string = "created") {
    const data = await requireApiInstance().getUserAnswers(urlToken, offset, limit, sortBy);
    return data;
}

export async function getUserQuestions(urlToken: string, offset: number = 0, limit: number = 20) {
    const data = await requireApiInstance().getUserQuestions(urlToken, offset, limit);
    return data;
}

export async function getUserArticles(urlToken: string, offset: number = 0, limit: number = 20, sortBy: string = "created") {
    const data = await requireApiInstance().getUserArticles(urlToken, offset, limit, sortBy);
    return data;
}

export async function getUserActivities(urlToken: string, offset: string = "", pageNum: number = 1) {
    const data = await requireApiInstance().getUserActivities(urlToken, offset, pageNum);
    return data;
}

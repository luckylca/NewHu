/**
 * 知乎 API 封装
 * 提供常用的知乎 API 接口调用
 */

import ZhihuClient from './client';

interface ZhihuAPI {
    client: ZhihuClient;
    setCookie(cookie: string): void;
    getMe(): Promise<any>;
    getUserInfo(urlToken: string): Promise<any>;
    getUserCollections(username: string, offset?: number): Promise<any>;
    getCollectionItems(collectionId: string, offset?: number): Promise<any>;
    getRecommend(session_token?: string): Promise<any>;
    getFollowingFeed(offset?: number): Promise<any>;
    getAnswer(answerId: string): Promise<any>;
    voteupAnswer(answerId: string): Promise<any>;
    cancelVoteupAnswer(answerId: string): Promise<any>;
    getQuestion(questionId: string): Promise<any>;
    getQuestionAnswers(questionId: string, offset?: number, sort?: string): Promise<any>;
    getRootComments(id: string, type: string, offset?: string, sort?: string): Promise<any>;
    getChildComments(commentId: string, offset?: string, sort?: string): Promise<any>;
    favoriteAnswer(answerId: string): Promise<any>;
    unfavoriteAnswer(answerId: string): Promise<any>;
    search(keyword: string, offset?: number, type?: string): Promise<any>;

}

function normalizeCommentType(contentType:string) {
    const type = String(contentType).toLowerCase();
    switch (type) {
        case 'answer':
        case 'answers':
            return 'answers';
        case 'article':
        case 'articles':
            return 'articles';
        case 'pin':
        case 'pins':
            return 'pins';
        case 'question':
        case 'questions':
            return 'questions';
        default:
            throw new Error(`不支持的评论内容类型: ${contentType}`);
    }
}

function escapeHtml(text:string) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}


class ZhihuAPI {
    constructor(cookie: string) {
        this.client = new ZhihuClient(cookie);
    }

    /**
     * 设置 Cookie
     */
    setCookie(cookie: string) {
        this.client.setCookie(cookie);
    }

    // ==================== 用户相关 ====================

    /**
     * 获取当前用户信息
     */
    async getMe() {
        const include = 'follower_count,voteup_count';
        return this.client.get(`https://www.zhihu.com/api/v4/me?include=${include}`);
    }

    /**
     * 获取用户信息
     * @param {string} urlToken - 用户的 URL token
     */
    async getUserInfo(urlToken: string) {
        const include = 'locations,employments,gender,educations,business,voteup_count,thanked_Count,follower_count,following_count,cover_url,following_topic_count,following_question_count,following_favlists_count,following_columns_count,answer_count,articles_count,pins_count,question_count,commercial_question_count,favorite_count,favorited_count,logs_count,marked_answers_count,marked_answers_text,message_thread_token,account_status,is_active,is_force_renamed,is_bind_sina,sina_weibo_url,sina_weibo_name,show_sina_weibo,is_blocking,is_blocked,is_following,is_followed,mutual_followees_count,vote_to_count,vote_from_count,thank_to_count,thank_from_count,thanked_count,description,hosted_live_count,participated_live_count,allow_message,industry_category,org_name,org_homepage,badge[?(type=best_answerer)].topics';
        return this.client.get(`https://www.zhihu.com/api/v4/members/${urlToken}?include=${include}`);
    }
    /**
     * 获取用户的收藏夹列表
     * @param {string} username - 用户名 (例如: lcaluckily)
     * @param {number} offset - 偏移量
     */
    async getUserCollections(username: string, offset: number = 0) {
        // 你提供的 URL 中的 include 参数解码后如下：
        const include = 'data[*].updated_time,answer_count,follower_count,creator,description,is_following,comment_count,created_time;data[*].creator.kvip_info;data[*].creator.vip_info';

        // 使用 encodeURIComponent 确保特殊字符被正确编码
        return this.client.get(`https://www.zhihu.com/api/v4/people/${username}/collections?include=${encodeURIComponent(include)}&offset=${offset}&limit=20`);
    }
    /**
     * 获取收藏夹内的具体内容列表
     * @param {string} collectionId - 收藏夹 ID
     * @param {number} offset - 偏移量
     */
    async getCollectionItems(collectionId: string, offset: number = 0) {
        // include 参数非常重要，它决定了你能拿到多少详细内容（包括回答全文 content）
        const include = 'data[*].content,intro,comment_count,voteup_count,created_time,updated_time,author,url,question,answer_count';

        return this.client.get(`https://www.zhihu.com/api/v4/collections/${collectionId}/items?offset=${offset}&limit=20&include=${encodeURIComponent(include)}`);
    }
    // ==================== 推荐流相关 ====================

    /**
     * 获取首页推荐流
     * @param {string} session_token - 分页 token（可选）
     */
    async getRecommend(session_token = '') {
        let url = 'https://www.zhihu.com/api/v3/feed/topstory/recommend?limit=10&action=down&after_id=5&desktop=true';
        if (session_token) {
            url += `?session_token=${session_token}`;
        }
        return this.client.get(url);
    }

    /**
     * 获取关注动态
     * @param {number} offset - 偏移量
     */
    async getFollowingFeed(offset: number = 0) {
        return this.client.get(`https://www.zhihu.com/api/v4/moments?limit=20&offset=${offset}`);
    }

    // ==================== 回答相关 ====================

    /**
     * 获取回答详情
     * @param {string} answerId - 回答 ID
     */
    async getAnswer(answerId: string) {
        const include = 'author,content,voteup_count,comment_count,favlists_count,thanks_count,pagination_info,content,created_time,updated_time,reshipment_settings,mark_infos,is_collapsed,collapse_reason,is_normal,relationship.voting,relationship.is_author,suggest_edit.unnormal_details,commercial_info,relevant_info,excerpt,attachment';
        return this.client.get(`https://www.zhihu.com/api/v4/answers/${answerId}?include=${include}`);
    }
    async getArticle(articleId: string, include?: string) {
        const defaultInclude =
            'comment_count,content,voteup_count,created,updated,author,excerpt,can_comment,comment_permission,relationship.is_author, relationship.is_following, relationship.is_favorited';
        const includeParam = encodeURIComponent(include || defaultInclude);
        return this.client.get(`https://www.zhihu.com/api/v4/articles/${articleId}?include=${includeParam}`);
    }
    /**
     * 点赞回答
     * @param {string} answerId - 回答 ID
     */
    async voteupAnswer(answerId: string) {
        return this.client.post(`https://www.zhihu.com/api/v4/answers/${answerId}/voters`, { type: "up" }, true);
    }

    /**
     * 取消点赞回答
     * @param {string} answerId - 回答 ID
     */
    async cancelVoteupAnswer(answerId: string) {
        return this.client.post(`https://www.zhihu.com/api/v4/answers/${answerId}/voters`, { type: "neutral" }, true);
    }
    /**
     * 取消点赞文章
     * @param {string} articleId - 文章 ID
     */
    async cancelVoteupArticle(articleId: string) {
        return this.client.post(`https://www.zhihu.com/api/v4/articles/${articleId}/voters`, { voting: 0 }, true);
    }
    /**
     * 点赞文章
     * @param {string} articleId - 文章 ID
     */
    async voteupArticle(articleId: string) {
        return this.client.post(`https://www.zhihu.com/api/v4/articles/${articleId}/voters`, { voting: 1 }, true);
    }

    // ==================== 问题相关 ====================

    /**
     * 获取问题详情
     * @param {string} questionId - 问题 ID
     */
    async getQuestion(questionId: string) {
        const include = 'answer_count,visit_count,comment_count,follower_count,author,detail';
        return this.client.get(`https://www.zhihu.com/api/v4/questions/${questionId}?include=${include}`);
    }

    /**
     * 获取问题的回答列表
     * @param {string} questionId - 问题 ID
     * @param {number} offset - 偏移量
     * @param {string} sort - 排序方式（default/updated）
     */
    async getQuestionAnswers(questionId: string, offset: number = 0, sort: string = 'default') {
        const include = 'author,content,voteup_count,comment_count,created_time,updated_time,excerpt';
        return this.client.get(`https://www.zhihu.com/api/v4/questions/${questionId}/answers?include=${include}&limit=20&offset=${offset}&sort_by=${sort}`);
    }

    // ==================== 评论相关 ====================

    /**
     * 获取评论列表
     * @param {string} id - 内容 ID
     * @param {string} type - 内容类型（answers/articles/pins等）
     * @param {number} offset - 偏移量
     */
    async getRootComments(id: string, type: string, offset: string = "", sort: string = "score") {
        return this.client.get(`https://www.zhihu.com/api/v4/comment_v5/${type}/${id}/root_comment?limit=20&offset=${offset}&order_by=${sort}`);
    }

    /**
     * 获取子评论列表
     * @param {string} commentId - 父评论 ID
     * @param {number} offset - 偏移量
     * @param {string} sort - 排序方式（score/time）
     */

    async getChildComments(commentId: string, offset: string = "", sort: string = "ts") {
        return this.client.get(`https://www.zhihu.com/api/v4/comment_v5/comment/${commentId}/child_comment?limit=20&offset=${offset}&order_by=${sort}`);
    }
    /**
     * 构建评论请求参数
     * @param {Object} options - 评论选项
     * @param {string} options.contentType - 内容类型（answers/articles/pins等）
     * @param {string} options.contentId - 内容 ID
     * @param {string} options.text - 评论内容
     * @param {string} [options.replyCommentId] - 回复评论 ID（可选）
     */
    buildCommentRequest(options: { contentType: string; contentId: string; text: string; replyCommentId?: string }) {
        const { contentType, contentId, text, replyCommentId } = options || {};
        if (!text || String(text).trim().length === 0) {
            throw new Error('评论内容不能为空');
        }

        const type = normalizeCommentType(contentType);
        const escapedText = escapeHtml(String(text));
        const body: { content: string; reply_comment_id?: string } = {
            content: `<p>${escapedText}</p>`
        };
        if (replyCommentId) {
            body.reply_comment_id = replyCommentId;
        }

        const url = `https://www.zhihu.com/api/v4/comment_v5/${type}/${contentId}/comment`;
        return { url, body };
    }

    /**
     * 发送评论（调用 buildCommentRequest 生成请求）
     */
    async submitComment(options: { contentType: string; contentId: string; text: string; replyCommentId?: string }) {
        const { url, body } = this.buildCommentRequest(options);
        return this.client.post(url, body, true);
    }
    /**
     * 点赞评论
     * @param commentId 
     * @returns 
     */
    async likeComment(commentId: string) {
        return this.client.post(`https://www.zhihu.com/api/v4/comments/${commentId}/like`, {}, true);
    }
    /**
     * 取消点赞评论
     * @param commentId 
     * @returns 
     */
    async cancelLikeComment(commentId: string) {
        return this.client.delete(`https://www.zhihu.com/api/v4/comments/${commentId}/like`);
    }

    // ==================== 收藏相关 ====================

    /**
     * 收藏回答
     * @param {string} answerId - 回答 ID
     */
    async favoriteAnswer(answerId: string) {
        return this.client.post(`https://www.zhihu.com/api/v4/answers/${answerId}/favlists`, {});
    }

    /**
     * 取消收藏回答
     * @param {string} answerId - 回答 ID
     */
    async unfavoriteAnswer(answerId: string) {
        return this.client.delete(`https://www.zhihu.com/api/v4/answers/${answerId}/favlists`);
    }

    // ==================== 搜索相关 ====================

    /**
     * 搜索内容
     * @param {string} keyword - 搜索关键词
     * @param {number} offset - 偏移量
     * @param {string} type - 搜索类型（content/people/topic等）
     */
    async search(keyword: string, offset: number = 0, type: string = 'general') {
        return this.client.get(`https://www.zhihu.com/api/v4/search_v3?t=${type}&q=${encodeURIComponent(keyword)}&offset=${offset}&limit=20`);
    }
    // ==================== 历史记录相关 ====================

    /**
     * 添加阅读历史记录
     * @param {string} contentToken 资源的ID (例如文章ID或回答ID)
     * @param {string} contentType 资源类型 (例如 'article', 'answer', 'question')
     */
    async addReadHistory(contentToken: string, contentType = 'article') {
        const payload = {
            content_token: String(contentToken),
            content_type: contentType
        };
        // 传入第三个参数 true，让 client 以 application/json 格式发起 POST 请求
        return this.client.post('https://www.zhihu.com/api/v4/read_history/add', payload, true);
    }

    /**
     * 获取阅读历史列表
     * @param {number|string} offset 翻页偏移量，默认 0
     */
    async getReadHistory(offset: number = 0) {
        return this.client.get(`https://www.zhihu.com/api/v4/unify-consumption/read_history?offset=${offset}&limit=20`);
    }
    /**
     * 获取用户的回答列表
     * @param {string} urlToken 用户的 URL token
     * @param {number} offset 偏移量
     * @param {number} limit 每页数量
     * @param {string} sortBy 排序方式（created/updated/voteup_count等）
     */
    async getUserAnswers(urlToken: string, offset: number = 0, limit: number = 20, sortBy: string = "created") {
        const include = "data[*].is_normal,admin_closed_comment,reward_info,is_collapsed,annotation_action,annotation_detail,collapse_reason,collapsed_by,suggest_edit,comment_count,can_comment,content,editable_content,attachment,voteup_count,reshipment_settings,comment_permission,created_time,updated_time,review_info,excerpt,paid_info,reaction_instruction,is_labeled,label_info,relationship.is_authorized,voting,is_author,is_thanked,is_nothelp,reaction,vessay_info;data[*].author.badge[?(type=best_answerer)].topics;data[*].author.kvip_info;data[*].author.vip_info;data[*].question.has_publishing_draft,relationship";
        return this.client.get(`https://www.zhihu.com/api/v4/members/${urlToken}/answers?include=${encodeURIComponent(include)}&offset=${offset}&limit=${limit}&sort_by=${sortBy}&ws_qiangzhisafe=0`);
    }

    async getUserQuestions(urlToken: string, offset: number = 0, limit: number = 20) {
        const include = "data[*].created,answer_count,follower_count,author,admin_closed_comment";
        return this.client.get(`https://www.zhihu.com/api/v4/members/${urlToken}/questions?include=${encodeURIComponent(include)}&offset=${offset}&limit=${limit}&ws_qiangzhisafe=0`);
    }

    async getUserArticles(urlToken: string, offset: number = 0, limit: number = 20, sortBy: string = "created") {
        const include = "data[*].comment_count,suggest_edit,is_normal,thumbnail_extra_info,thumbnail,can_comment,comment_permission,admin_closed_comment,content,voteup_count,created,updated,upvoted_followees,voting,review_info,reaction_instruction,is_labeled,label_info,reaction,vessay_info;data[*].author.badge[?(type=best_answerer)].topics;data[*].author.kvip_info;data[*].author.vip_info;";
        return this.client.get(`https://www.zhihu.com/api/v4/members/${urlToken}/articles?include=${encodeURIComponent(include)}&offset=${offset}&limit=${limit}&sort_by=${sortBy}&ws_qiangzhisafe=0`);
    }

    async getUserActivities(urlToken: string, offset: string = "", pageNum: number = 1) {
        return this.client.get(`https://www.zhihu.com/api/v3/moments/${urlToken}/activities?offset=${offset}&page_num=${pageNum}`);
    }
}

// 导出
export default ZhihuAPI;

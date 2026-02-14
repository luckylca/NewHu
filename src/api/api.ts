/**
 * 知乎 API 封装
 * 提供常用的知乎 API 接口调用
 */

import ZhihuClient from './client'

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
    getComments(id: string, type: string, offset?: number): Promise<any>;
    favoriteAnswer(answerId: string): Promise<any>;
    unfavoriteAnswer(answerId: string): Promise<any>;
    search(keyword: string, offset?: number, type?: string): Promise<any>;
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

    /**
     * 点赞回答
     * @param {string} answerId - 回答 ID
     */
    async voteupAnswer(answerId: string) {
        return this.client.post(`https://www.zhihu.com/api/v4/answers/${answerId}/voters`, {type:"up"},true);
    }

    /**
     * 取消点赞回答
     * @param {string} answerId - 回答 ID
     */
    async cancelVoteupAnswer(answerId: string) {
        return this.client.post(`https://www.zhihu.com/api/v4/answers/${answerId}/voters`,{type:"neutral"},true);
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
    async getComments(id: string, type: string, offset: number = 0) {
        return this.client.get(`https://www.zhihu.com/api/v4/${type}/${id}/root_comments?limit=20&offset=${offset}&order=normal`);
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
}

// 导出
export default ZhihuAPI;

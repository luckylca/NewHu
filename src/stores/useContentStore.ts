// src/stores/useContentStore.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { FeedItemInfo } from '@/src/types/zhihu';

interface ContentState {
    feedList: FeedItemInfo[]; // 推荐流列表
    setFeedList: (list: FeedItemInfo[]) => void; // 设置推荐流列表的函数
    removeFeedItem: (id: string) => void; // 根据 ID 从列表中移除指定帖子的函数
    refreshRequest: number;
    requestFeedRefresh: () => void;

    unlikeList: string[]; // 不喜欢列表，存储用户不喜欢的帖子的 ID
    setUnlikeList: (list: string[]) => void; // 设置不喜欢列表的函数
    addUnlikeItem: (id: string) => void; // 向不喜欢列表中添加一个帖子的 ID 的函数
    removeUnlikeItem: (id: string) => void; // 从不喜欢列表中移除一个帖子的 ID 的函数

    seenFeedKeys: string[]; // 已经推送过的回答/文章，格式为 type:id
    addSeenFeedKeys: (keys: string[]) => void;
}

export const useContentStore = create<ContentState>()(
    persist(
        (set) => ({
            feedList: [],
            setFeedList: (list) => set({ feedList: list }),
            refreshRequest: 0,
            requestFeedRefresh: () => set((state) => ({ refreshRequest: state.refreshRequest + 1 })),
            removeFeedItem: (id) => set((state) => ({
                feedList: state.feedList.filter(
                    (feed) => feed.item.id.toString() !== id.toString()
                )
            })),

            unlikeList: [],
            setUnlikeList: (list) => set({ unlikeList: list }),
            addUnlikeItem: (id) => set((state) => ({
                unlikeList: [...state.unlikeList, id]
            })),
            removeUnlikeItem: (id) => set((state) => ({
                unlikeList: state.unlikeList.filter((itemId) => itemId !== id)
            })),

            seenFeedKeys: [],
            addSeenFeedKeys: (keys) => set((state) => {
                if (keys.length === 0) return state;
                const existing = new Set(state.seenFeedKeys);
                const nextKeys = keys.filter((key) => !existing.has(key));
                return nextKeys.length === 0
                    ? state
                    : { seenFeedKeys: [...state.seenFeedKeys, ...nextKeys] };
            }),
        }),
        {
            name: 'content-store',
            storage: createJSONStorage(() => AsyncStorage),
            // feedList 是瞬态数据：体积大（含 HTML 正文）且重启后会重新拉取，
            // 推荐流正文不持久化，只保存不喜欢和已推送记录。
            partialize: (state) => ({
                unlikeList: state.unlikeList,
                seenFeedKeys: state.seenFeedKeys,
            }),
        }
    )
);

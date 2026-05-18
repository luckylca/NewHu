// src/store/useContentStore.ts
import { create } from 'zustand';

interface contentState {
    feedList: any[]; // 推荐流列表
    setFeedList: (list: any[]) => void; // 设置推荐流列表的函数
    removeFeedItem: (id: string) => void; // 新增：根据 ID 从列表中移除指定帖子的函数

    unlikeList: any[]; // 不喜欢列表，存储用户不喜欢的帖子的 ID
    setUnlikeList: (list: any[]) => void; // 设置不喜欢列表的函数
    addUnlikeItem: (id: string) => void; // 新增：向不喜欢列表中添加一个帖子的 ID 的函数
    removeUnlikeItem: (id: string) => void; // 新增：从不喜欢列表中移除一个帖子的 ID 的函数
}

export const useContentStore = create<contentState>((set) => ({
    feedList: [], 
    setFeedList: (list: any[]) => set({ feedList: list }),
    removeFeedItem: (id: string) => set((state) => ({
        feedList: state.feedList.filter(
            (feed) => feed.item.id.toString() !== id.toString()
        )
    })),

    unlikeList: [],
    setUnlikeList: (list: any[]) => set({ unlikeList: list }),
    addUnlikeItem: (id: string) => set((state) => ({
        unlikeList: [...state.unlikeList, id]
    })),
    removeUnlikeItem: (id: string) => set((state) => ({
        unlikeList: state.unlikeList.filter((itemId) => itemId !== id)
    }))
}));
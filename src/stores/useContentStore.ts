// src/store/useContentStore.ts
// 这里面放的是设置相关的信息，比如自动播放，快进倍速，选中的频道ID等
import {create} from 'zustand';

interface contentState {
    feedList: any[]; // 推荐流列表
    setFeedList: (list: any[]) => void; // 设置推荐流列表的函数
}

export const useContentStore = create<contentState>((set) => ({
    feedList: [], // 推荐流列表
    setFeedList: (list: any[]) => set({feedList: list}), // 设置推荐流列表的函数

}));
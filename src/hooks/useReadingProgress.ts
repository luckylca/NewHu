import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef } from 'react';
import {
    AppState,
    FlatList,
    type LayoutChangeEvent,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
} from 'react-native';
import {
    getReadingProgress,
    saveReadingProgress,
} from '@/src/db/repositories/readingProgressRepository';
import type { ReadingProgress } from '@/src/db/types';
import type { FeedType } from '@/src/types/zhihu';
import {
    createReadingProgressSnapshot,
    getReadingResumeOffset,
    type ReadingProgressSnapshot,
} from '@/src/utils/readingProgress';

const SAVE_THROTTLE_MS = 900;
const RESUME_SETTLE_MS = 180;

export function useReadingProgress(options: {
    contentId: string;
    contentType: FeedType;
}) {
    const { contentId, contentType } = options;
    const listRef = useRef<FlatList<string>>(null);
    const persistedRef = useRef<ReadingProgress | null>(null);
    const latestSnapshotRef = useRef<ReadingProgressSnapshot | null>(null);
    const currentOffsetRef = useRef(0);
    const contentHeightRef = useRef(0);
    const viewportHeightRef = useRef(0);
    const loadedRef = useRef(false);
    const resumeAppliedRef = useRef(false);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const sessionMaxScrollRatioRef = useRef(0);

    const captureCurrentSnapshot = useCallback(() => {
        if (contentHeightRef.current <= 0 || viewportHeightRef.current <= 0) return null;
        const snapshot = createReadingProgressSnapshot({
            scrollOffset: currentOffsetRef.current,
            contentHeight: contentHeightRef.current,
            viewportHeight: viewportHeightRef.current,
            previousMaxScrollRatio: Math.max(
                persistedRef.current?.maxScrollRatio ?? 0,
                latestSnapshotRef.current?.maxScrollRatio ?? 0,
            ),
            wasCompleted: Boolean(
                persistedRef.current?.completed || latestSnapshotRef.current?.completed,
            ),
        });
        latestSnapshotRef.current = snapshot;
        return snapshot;
    }, []);

    const persistLatest = useCallback(() => {
        if (!loadedRef.current || !resumeAppliedRef.current) return;
        const snapshot = latestSnapshotRef.current;
        if (!snapshot) return;

        const updatedAt = Date.now();
        persistedRef.current = {
            contentId,
            contentType,
            ...snapshot,
            updatedAt,
        };
        void saveReadingProgress({
            contentId,
            contentType,
            ...snapshot,
            updatedAt,
        }).catch((error) => {
            console.warn('阅读进度保存失败', error);
        });
    }, [contentId, contentType]);

    const scheduleSave = useCallback(() => {
        if (saveTimerRef.current) return;
        saveTimerRef.current = setTimeout(() => {
            saveTimerRef.current = null;
            persistLatest();
        }, SAVE_THROTTLE_MS);
    }, [persistLatest]);

    const applyResume = useCallback(() => {
        if (!loadedRef.current || resumeAppliedRef.current) return;
        const progress = persistedRef.current;
        if (!progress) {
            resumeAppliedRef.current = true;
            const snapshot = captureCurrentSnapshot();
            if (snapshot?.completed) scheduleSave();
            return;
        }
        if (contentHeightRef.current <= 0 || viewportHeightRef.current <= 0) return;

        const targetOffset = getReadingResumeOffset(
            progress,
            contentHeightRef.current,
            viewportHeightRef.current,
        );
        resumeAppliedRef.current = true;
        currentOffsetRef.current = targetOffset;
        if (targetOffset > 0) {
            listRef.current?.scrollToOffset({ offset: targetOffset, animated: false });
        }
        const snapshot = captureCurrentSnapshot();
        if (snapshot?.completed && !progress.completed) scheduleSave();
    }, [captureCurrentSnapshot, scheduleSave]);

    const requestResume = useCallback(() => {
        if (!loadedRef.current || resumeAppliedRef.current || resumeTimerRef.current) return;
        resumeTimerRef.current = setTimeout(() => {
            resumeTimerRef.current = null;
            applyResume();
        }, RESUME_SETTLE_MS);
    }, [applyResume]);

    useEffect(() => {
        let active = true;
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
        saveTimerRef.current = null;
        resumeTimerRef.current = null;
        persistedRef.current = null;
        latestSnapshotRef.current = null;
        currentOffsetRef.current = 0;
        contentHeightRef.current = 0;
        viewportHeightRef.current = 0;
        loadedRef.current = false;
        resumeAppliedRef.current = false;
        sessionMaxScrollRatioRef.current = 0;

        void getReadingProgress(contentId, contentType)
            .then((progress) => {
                if (!active) return;
                persistedRef.current = progress;
                loadedRef.current = true;
                if (!progress) {
                    resumeAppliedRef.current = true;
                    const snapshot = captureCurrentSnapshot();
                    if (snapshot?.completed) scheduleSave();
                    return;
                }
                requestResume();
            })
            .catch((error) => {
                console.warn('阅读进度读取失败', error);
                if (!active) return;
                loadedRef.current = true;
                resumeAppliedRef.current = true;
            });

        return () => {
            active = false;
            if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
            resumeTimerRef.current = null;
            saveTimerRef.current = null;
            persistLatest();
        };
    }, [captureCurrentSnapshot, contentId, contentType, persistLatest, requestResume, scheduleSave]);

    useFocusEffect(useCallback(() => {
        return () => {
            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
                saveTimerRef.current = null;
            }
            persistLatest();
        };
    }, [persistLatest]));

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (state) => {
            if (state !== 'active') persistLatest();
        });
        return () => subscription.remove();
    }, [persistLatest]);

    const onLayout = useCallback((event: LayoutChangeEvent) => {
        viewportHeightRef.current = Math.max(0, event.nativeEvent.layout.height);
        requestResume();
        if (loadedRef.current && resumeAppliedRef.current) {
            const snapshot = captureCurrentSnapshot();
            if (snapshot?.completed) scheduleSave();
        }
    }, [captureCurrentSnapshot, requestResume, scheduleSave]);

    const onContentSizeChange = useCallback((_width: number, height: number) => {
        contentHeightRef.current = Math.max(0, height);
        requestResume();
        if (loadedRef.current && resumeAppliedRef.current) {
            const snapshot = captureCurrentSnapshot();
            if (snapshot?.completed) scheduleSave();
        }
    }, [captureCurrentSnapshot, requestResume, scheduleSave]);

    const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
        currentOffsetRef.current = Math.max(0, contentOffset.y);
        contentHeightRef.current = Math.max(0, contentSize.height);
        viewportHeightRef.current = Math.max(0, layoutMeasurement.height);

        const scrollable = Math.max(0, contentSize.height - layoutMeasurement.height);
        const ratio = scrollable <= 1
            ? 1
            : Math.max(0, Math.min(1, contentOffset.y / scrollable));
        sessionMaxScrollRatioRef.current = Math.max(sessionMaxScrollRatioRef.current, ratio);

        if (!loadedRef.current || !resumeAppliedRef.current) return;
        const snapshot = captureCurrentSnapshot();
        if (snapshot) scheduleSave();
    }, [captureCurrentSnapshot, scheduleSave]);

    return {
        listRef,
        onLayout,
        onContentSizeChange,
        onScroll,
        sessionMaxScrollRatioRef,
        flush: persistLatest,
    };
}

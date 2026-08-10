import { Snackbar } from '@/src/ui';
import { useNotificationStore } from '@/src/stores/useNotificationStore';
import React, { useEffect } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function GlobalNotificationHost() {
    const current = useNotificationStore((state) => state.current);
    const dismiss = useNotificationStore((state) => state.dismiss);
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();

    useEffect(() => {
        if (!current) return;
        const timer = setTimeout(dismiss, current.duration ?? 2200);
        return () => clearTimeout(timer);
    }, [current, dismiss]);

    return (
        <Snackbar
            visible={Boolean(current)}
            message={current?.message}
            actionLabel={current?.actionLabel}
            onAction={() => {
                current?.onAction?.();
                dismiss();
            }}
            withDismissAction
            onDismiss={dismiss}
            bottomInset={insets.bottom + height * 0.08}
        />
    );
}

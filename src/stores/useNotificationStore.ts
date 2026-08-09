import { create } from 'zustand';

export type NotificationOptions = {
    message: string;
    duration?: number;
    actionLabel?: string;
    onAction?: () => void;
};

type NotificationState = {
    current: (NotificationOptions & { id: number }) | null;
    show: (options: NotificationOptions | string) => void;
    dismiss: () => void;
};

let notificationId = 0;

export const useNotificationStore = create<NotificationState>((set) => ({
    current: null,
    show: (options) => set({
        current: {
            ...(typeof options === 'string' ? { message: options } : options),
            id: ++notificationId,
        },
    }),
    dismiss: () => set({ current: null }),
}));

export function notify(options: NotificationOptions | string) {
    useNotificationStore.getState().show(options);
}

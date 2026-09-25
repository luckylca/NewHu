const MIN_OFFLINE_REQUEST_INTERVAL_MS = 1_500;
let requestQueue: Promise<void> = Promise.resolve();
let lastRequestStartedAt = 0;
let backoffUntil = 0;

const wait = (durationMs: number) => new Promise<void>((resolve) => setTimeout(resolve, durationMs));

export function isOfflineCacheStopError(error: unknown) {
    const status = Number((error as { status?: unknown } | null)?.status);
    return status === 401 || status === 403 || status === 429;
}

/** Serialize only the offline-cache traffic and keep requests at least 1.5s apart. */
export function runOfflineCacheRequest<T>(request: () => Promise<T>): Promise<T> {
    const scheduled = requestQueue.then(async () => {
        const nextAllowedAt = Math.max(lastRequestStartedAt + MIN_OFFLINE_REQUEST_INTERVAL_MS, backoffUntil);
        await wait(Math.max(0, nextAllowedAt - Date.now()));
        lastRequestStartedAt = Date.now();

        try {
            return await request();
        } catch (error) {
            const status = Number((error as { status?: unknown } | null)?.status);
            if (status === 429) backoffUntil = Math.max(backoffUntil, Date.now() + 60_000);
            else if (status === 403) backoffUntil = Math.max(backoffUntil, Date.now() + 30_000);
            throw error;
        }
    });

    requestQueue = scheduled.then(() => undefined, () => undefined);
    return scheduled;
}

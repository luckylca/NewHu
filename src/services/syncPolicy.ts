export function isRetryableHttpStatus(status: number) {
    return status === 408 || status === 425 || status === 429 || status >= 500;
}

export function isDependencySatisfied(
    dependencyId: string | null,
    completedThisRun: ReadonlySet<string>,
    persistedStatus?: string,
) {
    return !dependencyId || completedThisRun.has(dependencyId) || persistedStatus === 'synced';
}

let runtime = { engine: 'legacy' };
const listeners = new Set();
export function getGlassRuntime() {
    return runtime;
}
export function subscribeGlassRuntime(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}
export function setGlassRuntime(next) {
    if (runtime.engine === next.engine)
        return;
    runtime = next;
    for (const listener of listeners)
        listener();
}
//# sourceMappingURL=glassRuntime.js.map
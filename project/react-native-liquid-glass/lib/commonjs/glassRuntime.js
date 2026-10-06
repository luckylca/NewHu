"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGlassRuntime = getGlassRuntime;
exports.subscribeGlassRuntime = subscribeGlassRuntime;
exports.setGlassRuntime = setGlassRuntime;
let runtime = { engine: 'legacy' };
const listeners = new Set();
function getGlassRuntime() {
    return runtime;
}
function subscribeGlassRuntime(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}
function setGlassRuntime(next) {
    if (runtime.engine === next.engine)
        return;
    runtime = next;
    for (const listener of listeners)
        listener();
}
//# sourceMappingURL=glassRuntime.js.map
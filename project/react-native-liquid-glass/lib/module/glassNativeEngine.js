import { getGlassRuntime, setGlassRuntime, subscribeGlassRuntime } from './glassRuntime';
export function getGlassNativeEngine() {
    return getGlassRuntime().engine;
}
export function subscribeGlassNativeEngine(listener) {
    return subscribeGlassRuntime(listener);
}
export function setGlassNativeEngine(next) {
    setGlassRuntime({ engine: next });
}
//# sourceMappingURL=glassNativeEngine.js.map
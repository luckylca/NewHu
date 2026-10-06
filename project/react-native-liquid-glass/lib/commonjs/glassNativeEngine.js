"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGlassNativeEngine = getGlassNativeEngine;
exports.subscribeGlassNativeEngine = subscribeGlassNativeEngine;
exports.setGlassNativeEngine = setGlassNativeEngine;
const glassRuntime_1 = require("./glassRuntime");
function getGlassNativeEngine() {
    return (0, glassRuntime_1.getGlassRuntime)().engine;
}
function subscribeGlassNativeEngine(listener) {
    return (0, glassRuntime_1.subscribeGlassRuntime)(listener);
}
function setGlassNativeEngine(next) {
    (0, glassRuntime_1.setGlassRuntime)({ engine: next });
}
//# sourceMappingURL=glassNativeEngine.js.map
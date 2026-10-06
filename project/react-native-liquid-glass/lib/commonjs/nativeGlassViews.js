"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoreGlassSurfaceView = exports.CoreGlassCaptureSource = exports.LegacyGlassCaptureSource = exports.LegacyGlassSurfaceView = void 0;
const expo_modules_core_1 = require("expo-modules-core");
const react_1 = __importDefault(require("react"));
const react_native_1 = require("react-native");
const liquid_glass_kit_1 = require("liquid-glass-kit");
exports.LegacyGlassSurfaceView = liquid_glass_kit_1.LiquidGlassView;
exports.LegacyGlassCaptureSource = liquid_glass_kit_1.LiquidGlassProvider;
exports.CoreGlassCaptureSource = react_native_1.Platform.OS === 'android'
    ? (0, expo_modules_core_1.requireNativeViewManager)('NewHuLiquidGlassCore', 'GlassCaptureSource')
    : null;
const CoreGlassSurfaceManager = react_native_1.Platform.OS === 'android'
    ? (0, expo_modules_core_1.requireNativeViewManager)('NewHuLiquidGlassCore', 'GlassSurface')
    : null;
exports.CoreGlassSurfaceView = CoreGlassSurfaceManager
    ? react_1.default.forwardRef(function CoreGlassSurfaceView({ tint, ...props }, ref) {
        return react_1.default.createElement(CoreGlassSurfaceManager, {
            ref,
            ...props,
            tint: tint != null ? (0, react_native_1.processColor)(tint) ?? undefined : undefined,
        });
    })
    : null;
//# sourceMappingURL=nativeGlassViews.js.map
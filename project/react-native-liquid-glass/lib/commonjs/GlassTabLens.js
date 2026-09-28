"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlassTabLens = GlassTabLens;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_native_1 = require("react-native");
const react_native_reanimated_1 = require("react-native-reanimated");
const GlassSurface_1 = require("./GlassSurface");
const ENTER_SPRING = { damping: 19, stiffness: 340, mass: 0.62 };
/** Standalone preview surface for callers that need one; GlassTabBar uses its selection lens instead. */
function GlassTabLens({ visible, label, icon, labelColor, style }) {
    const reducedMotion = (0, GlassSurface_1.useGlassReducedMotion)();
    const [mounted, setMounted] = (0, react_1.useState)(visible);
    const opacity = (0, react_native_reanimated_1.useSharedValue)(visible ? 1 : 0);
    const scale = (0, react_native_reanimated_1.useSharedValue)(visible ? 1 : 0.78);
    (0, react_1.useEffect)(() => {
        if (visible) {
            setMounted(true);
            if (reducedMotion) {
                opacity.value = 1;
                scale.value = 1;
            }
            else {
                opacity.value = (0, react_native_reanimated_1.withTiming)(1, { duration: 110 });
                scale.value = (0, react_native_reanimated_1.withSpring)(1, ENTER_SPRING);
            }
            return;
        }
        if (!mounted)
            return;
        if (reducedMotion) {
            opacity.value = 0;
            scale.value = 0.84;
            setMounted(false);
            return;
        }
        opacity.value = (0, react_native_reanimated_1.withTiming)(0, { duration: 130 });
        scale.value = (0, react_native_reanimated_1.withTiming)(0.84, { duration: 130 }, (finished) => {
            if (finished)
                (0, react_native_reanimated_1.runOnJS)(setMounted)(false);
        });
    }, [mounted, opacity, reducedMotion, scale, visible]);
    const animatedStyle = (0, react_native_reanimated_1.useAnimatedStyle)(() => ({
        opacity: opacity.value,
        transform: [{ scale: scale.value }, { translateY: (1 - scale.value) * 8 }],
    }), []);
    if (!mounted)
        return null;
    return ((0, jsx_runtime_1.jsx)(GlassSurface_1.GlassSurface, { variant: "lens", interactive: true, style: [styles.surface, style], animatedStyle: animatedStyle, placeholderChildren: (0, jsx_runtime_1.jsx)(react_native_1.View, { style: styles.placeholder }), zIndex: 320, children: (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.content, children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: styles.icon, children: icon }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { numberOfLines: 1, style: [styles.label, { color: labelColor }], children: label })] }) }));
}
const styles = react_native_1.StyleSheet.create({
    surface: {
        width: 82,
        height: 82,
    },
    placeholder: { width: 82, height: 82 },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 8,
        gap: 4,
    },
    icon: { alignItems: 'center', justifyContent: 'center', height: 34 },
    label: { maxWidth: 66, fontSize: 11, fontWeight: '600', includeFontPadding: false },
});
//# sourceMappingURL=GlassTabLens.js.map
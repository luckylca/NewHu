import { useSettingStore } from '@/src/stores/useSettingStore';
import { useTheme } from '@/src/ui/theme';

function rgb(hex: string) {
    const normalized = hex.replace('#', '');
    if (!/^[0-9a-f]{6}$/i.test(normalized)) return null;
    return [0, 2, 4].map((index) => parseInt(normalized.slice(index, index + 2), 16));
}

function blend(top: number[], bottom: number[], opacity: number) {
    return top.map((channel, index) => channel * opacity + bottom[index] * (1 - opacity));
}

function luminance(color: number[]) {
    const linear = color.map((channel) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

export function useMonetTextColor(secondary = false) {
    const theme = useTheme();
    const enabled = useSettingStore((state) => state.useMonetText);
    const wallpaperUri = useSettingStore((state) => state.wallpaperUri);
    const wallpaperColor = useSettingStore((state) => state.wallpaperColor);
    const wallpaperOpacity = useSettingStore((state) => state.wallpaperOpacity);

    const sampledColor = wallpaperColor ? rgb(wallpaperColor) : null;
    if (!enabled || !wallpaperUri || !sampledColor) {
        return secondary ? theme.colors.onBackgroundVariant : theme.colors.onBackground;
    }

    const base = theme.dark ? [36, 36, 36] : [255, 255, 255];
    const imageLayer = blend(sampledColor, base, wallpaperOpacity);
    const scrim = theme.dark ? [0, 0, 0] : [255, 255, 255];
    const effectiveBackground = blend(scrim, imageLayer, theme.dark ? 0.26 : 0.12);
    const useDarkText = luminance(effectiveBackground) > 0.42;

    if (useDarkText) return secondary ? 'rgba(22,22,22,0.68)' : '#161616';
    return secondary ? 'rgba(250,250,250,0.72)' : '#FAFAFA';
}

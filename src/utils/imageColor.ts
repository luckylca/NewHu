import { File } from 'expo-file-system';

type PixelData = {
    data: Uint8Array | Uint8ClampedArray | Uint16Array;
    width: number;
    height: number;
    channels: number;
    maxValue: number;
};

function averageColor({ data, width, height, channels, maxValue }: PixelData) {
    const pixelCount = width * height;
    const step = Math.max(1, Math.floor(pixelCount / 2400));
    let red = 0;
    let green = 0;
    let blue = 0;
    let samples = 0;

    for (let pixel = 0; pixel < pixelCount; pixel += step) {
        const index = pixel * channels;
        const grayscale = channels < 3;
        const alpha = channels === 2 || channels === 4 ? data[index + channels - 1] / maxValue : 1;
        if (alpha < 0.2) continue;

        red += data[index] / maxValue;
        green += data[index + (grayscale ? 0 : 1)] / maxValue;
        blue += data[index + (grayscale ? 0 : 2)] / maxValue;
        samples += 1;
    }

    if (!samples) throw new Error('图片没有可读取的颜色');
    const channelHex = (value: number) => Math.round(value / samples * 255).toString(16).padStart(2, '0');
    return `#${channelHex(red)}${channelHex(green)}${channelHex(blue)}`;
}

export async function getImageAverageColor(uri: string) {
    const bytes = await new File(uri).bytes();

    if (bytes[0] === 0xff && bytes[1] === 0xd8) {
        const { decode } = await import('jpeg-js');
        const image = decode(bytes, { useTArray: true, formatAsRGBA: true, maxResolutionInMP: 12, maxMemoryUsageInMB: 96 });
        return averageColor({ ...image, channels: 4, maxValue: 255 });
    }

    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
        const { decode, convertIndexedToRgb } = await import('fast-png');
        const image = decode(bytes);
        const data = image.palette ? convertIndexedToRgb(image) : image.data;
        const channels = image.palette?.[0]?.length ?? image.channels;
        return averageColor({ data, width: image.width, height: image.height, channels, maxValue: image.depth === 16 ? 65535 : 255 });
    }

    throw new Error('暂不支持这种图片格式的自动取色');
}

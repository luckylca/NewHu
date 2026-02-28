import React, { useMemo } from "react";
import { Image, Linking, Text as RNText,Dimensions,TouchableOpacity } from "react-native";
import ImageReanimatedModal from "./ImageReanimatedModal";

type Token =
    | { type: "text"; text: string }
    | { type: "newline" }
    | { type: "link"; text: string; href: string }
    | { type: "emoji"; name: string }
    | { type: "image"; url: string ; width: number; height: number };

const { width: WindowWidth } = Dimensions.get("window");

function decodeHtmlEntities(s: string) {
    return s
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"');
}

function stripLightHtml(html: string) {
    if (!html) return "";
    return decodeHtmlEntities(
        html
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(/<\/p>\s*<p[^>]*>/gi, "\n")
            .replace(/<\/?p[^>]*>/gi, "")
            .replace(/<\/?[^>]+>/g, "")
            .trim()
    );
}

function splitEmojiTokens(text: string): Token[] {
    const out: Token[] = [];
    const re = /\[([^\[\]]+)\]/g;
    let last = 0;
    let m: RegExpExecArray | null;

    while ((m = re.exec(text)) !== null) {
        if (m.index > last) out.push({ type: "text", text: text.slice(last, m.index) });
        out.push({ type: "emoji", name: m[1] });
        last = re.lastIndex;
    }
    if (last < text.length) out.push({ type: "text", text: text.slice(last) });
    return out;
}

function textToTokens(plain: string): Token[] {
    const out: Token[] = [];
    if (!plain) return out;

    const lines = plain.split("\n");
    lines.forEach((line, idx) => {
        if (line) out.push(...splitEmojiTokens(line));
        if (idx !== lines.length - 1) out.push({ type: "newline" });
    });
    return out;
}
function htmlToTokens(html: string): Token[] {
    if (!html) return [];
    let tmp = html
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>\s*<p[^>]*>/gi, "\n")
        .replace(/<\/?p[^>]*>/gi, "");

    const tokens: Token[] = [];
    const aRe = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = aRe.exec(tmp)) !== null) {
        const fullTag = match[0]; // 拿到完整的标签字符串，例如：<a class="comment_img" href="...">[图片]</a>
        const before = tmp.slice(lastIndex, match.index);
        const href = (match[1] || "").trim();
        const inner = stripLightHtml(match[2] || "").trim();

        tokens.push(...textToTokens(stripLightHtml(before)));

        // 核心修改：利用正则判断完整的 <a> 标签中是否包含 class="comment_img"
        // 这样写可以兼容单引号/双引号，以及 class 里包含多个类名的情况
        const isImageClass = /class=["'][^"']*comment_img[^"']*["']/i.test(fullTag);

        // 之前的文本判断保留作为兜底
        const imageTexts = ["图片", "查看图片", "[图片]", "[查看图片]"];

        const wMatch = fullTag.match(/data-width=["'](\d+)["']/i);
        const hMatch = fullTag.match(/data-height=["'](\d+)["']/i);
        const originalWidth = wMatch ? parseInt(wMatch[1], 10) : 0;
        const originalHeight = hMatch ? parseInt(hMatch[1], 10) : 0;

        if (isImageClass || imageTexts.includes(inner)) {
            tokens.push({
                type: "image",
                url: href,
                width: originalWidth,   // <-- 存入宽度
                height: originalHeight  // <-- 存入高度
            });
        }

        lastIndex = aRe.lastIndex;
    }

    tokens.push(...textToTokens(stripLightHtml(tmp.slice(lastIndex))));

    while (tokens.length && tokens[tokens.length - 1].type === "newline") tokens.pop();
    return tokens;
}

export default function CommentText({
    content,
    emojiMap,
}: {
    content: string;
    emojiMap: Record<string, any>;
}) {
    const tokens = useMemo(() => htmlToTokens(content), [content]);
    const [imageUrl, setImageUrl] = React.useState<string>("");
    const [imageToken, setImageToken] = React.useState<{ width: number; height: number } | null>(null);
    const [imageOrigin, setImageOrigin] = React.useState<{ x: number; y: number; width: number; height: number }>({ x: 0, y: 0, width: 0, height: 0 });
    const imageRef = React.useRef<any>(null);
    const [imageVisible, setImageVisible] = React.useState(false);
    const children = useMemo(() => {
        return tokens.map((t, idx) => {
            if (t.type === "newline") return <RNText key={idx}>{"\n"}</RNText>;
            if (t.type === "text") return <RNText key={idx}>{t.text}</RNText>;
            if (t.type === "link")
                return (
                    <RNText
                        key={idx}
                        style={{ textDecorationLine: "underline" }}
                        onPress={() => t.href && Linking.openURL(t.href)}
                    >
                        {t.text}
                    </RNText>
                );
            if (t.type === "image") {
                setImageUrl(t.url);
                setImageToken({ width: t.width, height: t.height });
                return null;
            }
            const src = emojiMap[t.name];
            if (!src) return <RNText key={idx}>[{t.name}]</RNText>;
            return (
                <Image
                    key={idx}
                    source={{uri: src}}
                    style={{ width: 18, height: 18, transform: [{ translateY: 2 }] }}
                    resizeMode="contain"
                />
            );
        });
    }, [tokens, emojiMap]);

    const imagePressHandler = () => {
        if (imageRef.current) {
            imageRef.current.measure((fx: number, fy: number, width: number, height: number, px: number, py: number) => {                
                setImageOrigin({ x: px, y: py, width, height });
                setImageVisible(true);
            })
        }
    }

    return (
        <>
            <RNText style={{ fontSize: 15, lineHeight: 22 }}>
                {children}
            </RNText>
            {imageUrl && imageToken && (
                <TouchableOpacity onPress={imagePressHandler}>
                    <Image
                        source={{ uri: imageUrl }}
                        key={imageUrl}
                        ref={imageRef}
                        style={{ width: WindowWidth*0.8,aspectRatio: (imageToken.width && imageToken.height) ? (imageToken.width / imageToken.height) : 1.77, alignSelf: "center", marginVertical: 10 }}
                        resizeMode="contain"
                    />
                </TouchableOpacity>
            )}
            <ImageReanimatedModal url={imageUrl} origin={imageOrigin} visible={imageVisible} onClose={() => setImageVisible(false)} />
        </>
    );
}
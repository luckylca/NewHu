import React, { useMemo } from "react";
import { Image, Linking, Text as RNText } from "react-native";

type Token =
    | { type: "text"; text: string }
    | { type: "newline" }
    | { type: "link"; text: string; href: string }
    | { type: "emoji"; name: string };

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

// 轻量支持 <a href>...</a>，其余标签 strip 掉
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
        const before = tmp.slice(lastIndex, match.index);
        const href = (match[1] || "").trim();
        const inner = match[2] || "";

        tokens.push(...textToTokens(stripLightHtml(before)));
        tokens.push({ type: "link", text: stripLightHtml(inner) || href, href });

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
    content: string; // ✅ 直接传 HTML/string
    emojiMap: Record<string, any>; // require(...) 或 {uri}
}) {
    const tokens = useMemo(() => htmlToTokens(content), [content]);

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

            const src = emojiMap[t.name];
            if (!src) return <RNText key={idx}>[{t.name}]</RNText>;
            return (
                <Image
                    key={idx}
                    source={src}
                    style={{ width: 18, height: 18, transform: [{ translateY: 2 }] }}
                    resizeMode="contain"
                />
            );
        });
    }, [tokens, emojiMap]);

    return (
        <RNText selectable style={{ fontSize: 15, lineHeight: 22 }}>
            {children}
        </RNText>
    );
}
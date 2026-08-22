import tokenizerJson from '@/assets/product-v1/tokenizer.json';
import tokenizerMeta from '@/assets/product-v1/tokenizer_meta.json';

type TokenizerModel = {
  vocab: Record<string, number>;
  unk_token: string;
  continuing_subword_prefix: string;
  max_input_chars_per_word: number;
};

const model = tokenizerJson.model as TokenizerModel;
const vocab = model.vocab;
const PAD = Number(tokenizerMeta.pad_token_id);
const UNK = Number(tokenizerMeta.unk_token_id);
const CLS = Number(tokenizerMeta.cls_token_id);
const SEP = Number(tokenizerMeta.sep_token_id);
const MAX_LENGTH = Number(tokenizerMeta.max_length);

function isWhitespace(char: string) {
  return /\s/u.test(char);
}

function isControl(char: string) {
  const code = char.codePointAt(0) ?? 0;
  return (code < 32 || (code >= 127 && code <= 159)) && !isWhitespace(char);
}

function isChinese(code: number) {
  return (code >= 0x4e00 && code <= 0x9fff)
    || (code >= 0x3400 && code <= 0x4dbf)
    || (code >= 0x20000 && code <= 0x2a6df)
    || (code >= 0x2a700 && code <= 0x2b73f)
    || (code >= 0x2b740 && code <= 0x2b81f)
    || (code >= 0x2b820 && code <= 0x2ceaf)
    || (code >= 0xf900 && code <= 0xfaff)
    || (code >= 0x2f800 && code <= 0x2fa1f);
}

function isPunctuation(char: string) {
  const code = char.codePointAt(0) ?? 0;
  return (code >= 33 && code <= 47)
    || (code >= 58 && code <= 64)
    || (code >= 91 && code <= 96)
    || (code >= 123 && code <= 126)
    || /\p{P}/u.test(char);
}

function basicTokens(input: string): string[] {
  let normalized = '';
  for (const char of input) {
    const code = char.codePointAt(0) ?? 0;
    if (char === '\0' || char === '\ufffd' || isControl(char)) continue;
    if (isChinese(code)) normalized += ` ${char} `;
    else normalized += isWhitespace(char) ? ' ' : char;
  }

  const tokens: string[] = [];
  for (const segment of normalized.trim().split(/\s+/u).filter(Boolean)) {
    let current = '';
    for (const char of segment) {
      if (isPunctuation(char)) {
        if (current) tokens.push(current);
        tokens.push(char);
        current = '';
      } else {
        current += char;
      }
    }
    if (current) tokens.push(current);
  }
  return tokens;
}

function wordPiece(token: string): number[] {
  const chars = Array.from(token);
  if (chars.length > model.max_input_chars_per_word) return [UNK];
  const pieces: number[] = [];
  let start = 0;
  while (start < chars.length) {
    let end = chars.length;
    let found: number | undefined;
    while (start < end) {
      const text = `${start > 0 ? model.continuing_subword_prefix : ''}${chars.slice(start, end).join('')}`;
      if (vocab[text] !== undefined) {
        found = vocab[text];
        break;
      }
      end -= 1;
    }
    if (found === undefined) return [UNK];
    pieces.push(found);
    start = end;
  }
  return pieces;
}

export type TokenizedInput = {
  inputIds: BigInt64Array;
  attentionMask: BigInt64Array;
  tokenCount: number;
};

export function tokenizeProductV1(text: string): TokenizedInput {
  const ids = [CLS];
  for (const token of basicTokens(text)) ids.push(...wordPiece(token));
  ids.push(SEP);
  const truncated = ids.slice(0, MAX_LENGTH);

  const inputIds = new BigInt64Array(MAX_LENGTH);
  const attentionMask = new BigInt64Array(MAX_LENGTH);
  inputIds.fill(BigInt(PAD));
  truncated.forEach((id, index) => {
    inputIds[index] = BigInt(id);
    attentionMask[index] = 1n;
  });
  return { inputIds, attentionMask, tokenCount: truncated.length };
}

export function articleText(title: string, excerpt: string) {
  return `${title}\n${excerpt}`.trim();
}

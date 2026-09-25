import tokenizerJson from '@/assets/semantic-v2/tokenizer.json';

type WordPieceModel = {
  vocab: Record<string, number>;
  unk_token: string;
  continuing_subword_prefix: string;
  max_input_chars_per_word: number;
};

const model = tokenizerJson.model as WordPieceModel;
const vocab = model.vocab;
const PAD = Number(vocab['[PAD]']);
const UNK = Number(vocab[model.unk_token]);
const CLS = Number(vocab['[CLS]']);
const SEP = Number(vocab['[SEP]']);
export const SEMANTIC_V2_MAX_LENGTH = 64;

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
      const candidate = `${start > 0 ? model.continuing_subword_prefix : ''}${chars.slice(start, end).join('')}`;
      if (vocab[candidate] !== undefined) {
        found = vocab[candidate];
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

export type SemanticV2TokenizedInput = {
  inputIds: BigInt64Array;
  attentionMask: BigInt64Array;
  tokenCount: number;
};

export function tokenizeSemanticV2(text: string): SemanticV2TokenizedInput {
  const ids = [CLS];
  for (const token of basicTokens(text)) ids.push(...wordPiece(token));
  ids.push(SEP);

  // The frozen mobile contract truncates after post-processing, so a sequence
  // longer than 64 may legitimately lose its final [SEP]. Keep this exact.
  const truncated = ids.slice(0, SEMANTIC_V2_MAX_LENGTH);
  const inputIds = new BigInt64Array(SEMANTIC_V2_MAX_LENGTH);
  const attentionMask = new BigInt64Array(SEMANTIC_V2_MAX_LENGTH);
  inputIds.fill(BigInt(PAD));
  truncated.forEach((id, index) => {
    inputIds[index] = BigInt(id);
    attentionMask[index] = 1n;
  });
  return { inputIds, attentionMask, tokenCount: truncated.length };
}

export function semanticV2ArticleText(title: string, excerpt: string) {
  return `${title}\n${excerpt}`.trim();
}

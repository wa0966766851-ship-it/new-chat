// 描述原文的顯示解析：只把 Markdown 排版符號轉成視覺結構，不改動原文、不參與任何戰鬥判定。
// - 行首 `>` 數量 → 縮排層級（depth）
// - `**粗體**` / `__粗體__` → bold 片段
// - `## 標題` → heading（依 # 數量分級）
// - `---` → divider
// - `\r\n` / `\r` / `\n` → 斷行（正規化後逐行解析；空行保留為 blank，讓純文字輸出與原文等長）
// 注意：專案原文大量使用 `*70`、`1/3` 等乘號寫法，因此刻意「不」支援單星號斜體，避免把數值吃成標記。

export interface RichSegment {
  text: string;
  bold?: boolean;
  code?: boolean;
  href?: string;
}

export type RichBlock =
  | { kind: 'heading'; level: number; depth: number; segments: RichSegment[] }
  | { kind: 'text'; depth: number; segments: RichSegment[] }
  | { kind: 'divider'; depth: number }
  | { kind: 'code'; depth: number; text: string }
  | { kind: 'blank'; depth: number };

const DIVIDER = /^\s*(?:-{3,}|\*{3,}|_{3,}|={3,})\s*$/;
const HEADING = /^\s*(#{1,6})\s+(.+?)\s*#*\s*$/;
const QUOTE = /^(\s*)((?:[>＞]\s*)+)(.*)$/;
const BULLET = /^(\s*)[-*+•]\s+(.*)$/;
const FENCE = /^\s*```/;
const MAX_DEPTH = 8;

/** 去掉殘留的未配對粗體符號；不觸碰乘號、比例與負號。 */
function stripMarkup(text: string): string {
  return text.replace(/\*\*/g, '').replace(/__/g, '');
}

/** 行內 Markdown → 片段（僅粗體、行內程式碼與連結）。 */
export function parseInlineDescription(content: string): RichSegment[] {
  const segments: RichSegment[] = [];
  const pattern = /(\*\*([^*\n]+)\*\*|__([^_\n]+)__|`([^`\n]+)`|\[([^\]\n]+)\]\(([^)\s]+)\))/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  const pushText = (text: string) => {
    const cleaned = stripMarkup(text);
    if (cleaned) segments.push({ text: cleaned });
  };
  while ((match = pattern.exec(content))) {
    if (match.index > cursor) pushText(content.slice(cursor, match.index));
    if (match[2] !== undefined) segments.push({ text: stripMarkup(match[2]), bold: true });
    else if (match[3] !== undefined) segments.push({ text: stripMarkup(match[3]), bold: true });
    else if (match[4] !== undefined) segments.push({ text: match[4], code: true });
    else segments.push({ text: match[5], href: match[6] });
    cursor = pattern.lastIndex;
  }
  if (cursor < content.length) pushText(content.slice(cursor));
  return segments;
}

function depthOf(indent: string, quoteMarks = 0): number {
  const spaces = indent.replace(/\t/g, '  ').length;
  return Math.min(MAX_DEPTH, quoteMarks + Math.floor(spaces / 2));
}

/** 逐行解析描述原文為可渲染區塊；空行保留為 blank，僅作分段。 */
export function parseRichDescription(source?: string | null): RichBlock[] {
  if (!source) return [];
  const blocks: RichBlock[] = [];
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  let fenced = false;
  let codeLines: string[] = [];
  let codeDepth = 0;
  for (const line of lines) {
    if (FENCE.test(line)) {
      if (fenced) {
        blocks.push({ kind: 'code', depth: codeDepth, text: codeLines.join('\n') });
        codeLines = [];
      }
      fenced = !fenced;
      continue;
    }
    if (fenced) { codeLines.push(line); continue; }
    if (!line.trim()) { blocks.push({ kind: 'blank', depth: 0 }); continue; }
    if (DIVIDER.test(line)) { blocks.push({ kind: 'divider', depth: 0 }); continue; }
    const heading = line.match(HEADING);
    if (heading) {
      const segments = parseInlineDescription(heading[2]);
      blocks.push(segments.length ? { kind: 'heading', level: heading[1].length, depth: 0, segments } : { kind: 'blank', depth: 0 });
      continue;
    }
    const quote = line.match(QUOTE);
    if (quote) {
      const depth = depthOf(quote[1], (quote[2].match(/[>＞]/g) || []).length);
      codeDepth = depth;
      const segments = parseInlineDescription(quote[3]);
      blocks.push(segments.length ? { kind: 'text', depth, segments } : { kind: 'blank', depth });
      continue;
    }
    const bullet = line.match(BULLET);
    if (bullet) {
      const depth = depthOf(bullet[1]);
      const segments = parseInlineDescription(`• ${bullet[2]}`);
      blocks.push(segments.length ? { kind: 'text', depth, segments } : { kind: 'blank', depth });
      continue;
    }
    const indent = (line.match(/^\s*/) || [''])[0];
    const depth = depthOf(indent);
    const segments = parseInlineDescription(line.trimStart());
    blocks.push(segments.length ? { kind: 'text', depth, segments } : { kind: 'blank', depth });
  }
  if (fenced && codeLines.length) blocks.push({ kind: 'code', depth: codeDepth, text: codeLines.join('\n') });
  return blocks;
}

/** 純文字輸出（tooltip、複製用）：保留縮排概念但不含任何 Markdown 符號。 */
export function richDescriptionToText(source?: string | null): string {
  return parseRichDescription(source).map(block => {
    if (block.kind === 'blank') return '';
    if (block.kind === 'divider') return '────────';
    if (block.kind === 'code') return block.text;
    return '  '.repeat(block.depth) + block.segments.map(s => s.text).join('');
  }).join('\n');
}

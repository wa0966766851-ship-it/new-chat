import { Fragment, useMemo, type CSSProperties, type ReactNode } from 'react';
import { parseInlineDescription, parseRichDescription, type RichBlock, type RichSegment } from '../utils/richDescription';

/** 每一層 `>` 對應的縮排像素。 */
const INDENT_PX = 16;

export interface RichDescriptionProps {
  /** 原始描述字串（可能含 Markdown 排版符號與 CRLF）。 */
  text?: string | null;
  /** 無描述時的替代文字。 */
  fallback?: ReactNode;
  className?: string;
  /** 行內關鍵字著色等自訂渲染；只作用於純文字片段。 */
  renderText?: (text: string) => ReactNode;
  /** 縮排層級上限（超過者沿用最後一級，避免極端原文把版面推出畫面）。 */
  maxDepth?: number;
  /** 緊湊模式：縮小行距與字級，供 tooltip／列表預覽使用。 */
  compact?: boolean;
  /** 根元素標籤；預設 div。 */
  as?: 'div' | 'p' | 'section';
}

function segmentBody(segment: RichSegment, renderText?: (text: string) => ReactNode): ReactNode {
  if (segment.href) {
    return <a href={segment.href} target="_blank" rel="noreferrer noopener"
      className="text-cyan-300 underline decoration-cyan-400/40 underline-offset-2">{segment.text}</a>;
  }
  if (segment.code) {
    return <code className="rounded bg-white/10 px-1 py-0.5 font-mono text-[0.92em]">{segment.text}</code>;
  }
  const body = renderText ? renderText(segment.text) : segment.text;
  return segment.bold ? <strong className="font-bold">{body}</strong> : body;
}

function renderSegments(segments: RichSegment[], renderText?: (text: string) => ReactNode): ReactNode[] {
  return segments.map((segment, i) => <Fragment key={i}>{segmentBody(segment, renderText)}</Fragment>);
}

/** 行內片段：`**粗體**` → strong、`` `code` `` → code、`[x](y)` → 連結。 */
export function RichInline({ text, renderText }: { text?: string | null; renderText?: (text: string) => ReactNode }) {
  const segments = useMemo(() => parseInlineDescription(text || ''), [text]);
  if (!segments.length) return null;
  return <>{renderSegments(segments, renderText)}</>;
}

function BlockView({ block, renderText, maxDepth }: { block: RichBlock; renderText?: (text: string) => ReactNode; maxDepth: number }) {
  if (block.kind === 'blank') {
    return <span data-rich-kind="blank" aria-hidden="true" className="block h-1.5" />;
  }
  if (block.kind === 'divider') {
    return <span role="separator" data-rich-kind="divider" aria-hidden="true"
      className="my-2 block border-0 border-t border-white/15" />;
  }
  if (block.kind === 'code') {
    return <span data-rich-kind="code"
      className="my-1 block overflow-x-auto whitespace-pre rounded-lg bg-black/40 p-2 font-mono text-[0.9em] leading-relaxed text-slate-300">{block.text}</span>;
  }
  if (block.kind === 'heading') {
    const size = block.level <= 2 ? 'text-[1.15em]' : block.level === 3 ? 'text-[1.06em]' : 'text-[1em]';
    return <span data-rich-kind="heading" data-rich-level={block.level}
      className={`mt-1 block font-bold tracking-wide text-slate-100 first:mt-0 ${size}`}>
      {renderSegments(block.segments, renderText)}
    </span>;
  }
  const depth = Math.min(block.depth, maxDepth);
  const style: CSSProperties | undefined = depth ? {
    paddingInlineStart: depth * INDENT_PX,
    borderInlineStartWidth: 1,
    borderInlineStartStyle: 'solid',
    borderInlineStartColor: 'rgba(255,255,255,0.10)',
  } : undefined;
  return <span data-rich-kind="text" data-rich-depth={depth} className="block min-w-0 break-words" style={style}>
    {renderSegments(block.segments, renderText)}
  </span>;
}

/**
 * 精靈／魂印／技能／印記描述的共用渲染元件。
 * 只影響呈現：`>` 轉縮排、`**` 轉粗體、`##` 轉標題、`---` 轉分隔線、CRLF 正確斷行；
 * 原文內容與任何戰鬥判定都保持不變。
 */
export function RichDescription({
  text, fallback = null, className = '', renderText, maxDepth = 6, compact = false, as = 'div',
}: RichDescriptionProps) {
  const blocks = useMemo(() => parseRichDescription(text), [text]);
  const Root = as;
  if (!blocks.length) {
    if (fallback === null || fallback === undefined || fallback === '') return null;
    return <Root className={`min-w-0 break-words ${className}`}>{fallback}</Root>;
  }
  return (
    <Root data-rich-description="true"
      className={`min-w-0 break-words ${compact ? 'text-[0.95em] leading-5' : 'leading-relaxed'} ${className}`}>
      {blocks.map((block, i) => <Fragment key={i}>{i > 0 ? '\n' : null}<BlockView block={block} renderText={renderText} maxDepth={maxDepth} /></Fragment>)}
    </Root>
  );
}

export default RichDescription;

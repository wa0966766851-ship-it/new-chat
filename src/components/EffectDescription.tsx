import { useMemo, type ReactNode } from 'react';
import { descriptionStructure, type DescriptionNode } from '../utils/descriptionStructure';
import { RichInline } from './RichDescription';

/** 各詳情共用的純呈現元件；不載入戰鬥登記表、不修改描述或執行模式。 */
export function EffectDescription({ description, className = '', renderText }: {
  description?: string; className?: string; renderText?: (text: string) => ReactNode;
}) {
  const tree = useMemo(() => descriptionStructure(description), [description]);
  // 標題與正文都走同一套行內解析：`**粗體**` 真的加粗、殘留符號不外露。
  const inline = (node: DescriptionNode) => renderText
    ? renderText(node.text)
    : <RichInline text={node.raw ?? node.text} />;
  const render = (node: DescriptionNode): ReactNode => <div key={node.id} data-description-kind={node.kind}
    data-source-line={node.sourceLine} data-parent-id={node.parentId}>
    {node.kind === 'section' ? <section className="rounded-xl border border-white/10 bg-white/[0.025] p-3 space-y-2" aria-label={node.text}>
      <h5 className="font-semibold text-[1em] text-slate-100 leading-normal">{inline(node)}</h5>
      <div className="space-y-2">{node.children.map(render)}</div>
    </section> : <>
      <div className={node.kind === 'note' ? 'text-slate-400 text-[0.95em] leading-relaxed' : 'whitespace-pre-wrap'}>
        {node.kind === 'note' && <span className="mr-2 rounded bg-white/5 px-1.5 py-0.5 text-[0.85em]">說明</span>}
        {inline(node)}
      </div>
      {node.children.length > 0 && <div className="ml-2 mt-2 border-l-2 border-white/15 pl-3 space-y-2">{node.children.map(render)}</div>}
    </>}
  </div>;
  return <div data-testid="effect-description" className={`min-w-0 space-y-2 break-words text-sm leading-7 ${className}`}>
    {tree.nodes.length ? tree.nodes.map(render) : <span className="text-slate-500">尚無描述</span>}
  </div>;
}

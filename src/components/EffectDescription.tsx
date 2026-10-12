import { useMemo, type ReactNode } from 'react';
import { descriptionStructure, type DescriptionNode } from '../utils/descriptionStructure';

/** 各詳情共用的純呈現元件；不載入戰鬥登記表、不修改描述或執行模式。 */
export function EffectDescription({ description, className = '', renderText }: {
  description?: string; className?: string; renderText?: (text: string) => ReactNode;
}) {
  const tree = useMemo(() => descriptionStructure(description), [description]);
  const render = (node: DescriptionNode): ReactNode => <div key={node.id} data-description-kind={node.kind}
    data-source-line={node.sourceLine} data-parent-id={node.parentId}>
    {node.kind === 'section' ? <section className="rounded-xl border border-white/10 bg-white/[0.025] p-3 space-y-2" aria-label={node.text}>
      <h5 className="font-semibold text-[1em] text-slate-100 leading-normal">{node.text}</h5>
      <div className="space-y-2">{node.children.map(render)}</div>
    </section> : <>
      <div className={node.kind === 'note' ? 'text-slate-400 text-[0.95em] leading-relaxed' : 'whitespace-pre-wrap'}>
        {node.kind === 'note' && <span className="mr-2 rounded bg-white/5 px-1.5 py-0.5 text-[0.85em]">說明</span>}
        {renderText ? renderText(node.text) : node.text}
      </div>
      {node.children.length > 0 && <div className="ml-2 mt-2 border-l-2 border-white/15 pl-3 space-y-2">{node.children.map(render)}</div>}
    </>}
  </div>;
  return <div data-testid="effect-description" className={`min-w-0 space-y-2 break-words text-sm leading-7 ${className}`}>
    {tree.nodes.length ? tree.nodes.map(render) : <span className="text-slate-500">尚無描述</span>}
  </div>;
}

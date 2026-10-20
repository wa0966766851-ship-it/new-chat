import type { ReactNode } from 'react';
import { EFFECT_NODE_LABELS } from '../effects/effectNodes';
import type { defaultEffectKit } from '../effects/effectPresets';
import { EffectParameterTree } from './EffectParameterTree';

/** 只呈現資料，不建立 Blockly 工作區，不替查看者改寫精靈。 */
export function DefaultEffectBlocks({ draft, action }: {draft: ReturnType<typeof defaultEffectKit>;action?: ReactNode}) {
  return <section className="ios-card p-4 sm:p-5 space-y-3" aria-label="預設積木">
    <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">{draft.origin === 'authored' ? '已設定積木' : '原文預設積木'}</h3><p className="text-xs text-slate-400 mt-1">{draft.kit.length} 個積木 · {draft.complete ? '入口已接通，情境正確性仍需驗收' : '有未接通部分，原執行來源保留'}</p></div>{action}</div>
    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">{draft.kit.map((entry,i)=><details key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs"><summary className="cursor-pointer leading-5"><span className="block text-blue-300">{EFFECT_NODE_LABELS[entry.node]} · {entry.source === 'skill' ? (entry.role === 'innate'?'固有':entry.role === 'carried'?'攜帶':'附加') : '被動／機制'}</span>{entry.customText || entry.codeId}</summary><EffectParameterTree value={entry.params}/></details>)}</div>
    {!draft.kit.length && <p className="text-xs text-slate-400">此效果尚無完全等價的預設積木，不能把空畫布當作已實裝。</p>}
    {!!draft.issues.length && <details className="text-xs text-amber-200"><summary className="cursor-pointer">未接通清單（{draft.issues.length}）</summary><div className="max-h-52 overflow-y-auto">{draft.issues.map((issue,i)=><p key={i} className="py-2 leading-6">{issue.text}：{issue.reason}</p>)}</div></details>}
  </section>;
}

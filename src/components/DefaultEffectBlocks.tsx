import type { ReactNode } from 'react';
import { EFFECT_NODE_LABELS } from '../effects/effectNodes';
import type { defaultEffectKit } from '../effects/effectPresets';
import type { Clause } from '../blocks/model';
import { sequenceActionLabel } from '../effects/sequencePresentation';

function SequencePreview({clause,depth=0}:{clause:Clause;depth?:number}) {
  if(depth>8)return <p>巢狀效果超過8層，請檢查來源。</p>;
  if(!clause || !Array.isArray(clause.body))return <p className="mt-2 text-amber-200">連鎖格式損壞，請先修正問題清單；未執行此效果。</p>;
  return <ol className="mt-2 space-y-2 text-slate-300" aria-label="條件與結果連鎖">
    {!!clause.cond?.length && <li>觸發條件：{clause.cond.map(c=>c.label||c.c).join('；')}</li>}
    {clause.body.map((stmt,i)=><li key={i} className="rounded-lg bg-black/20 p-2">
      <p>{i+1}. {stmt.chain==='success'?'前項成功才執行':stmt.chain==='fail'?'前項失敗才執行':stmt.chain==='any_fail'?'任一前項失敗才執行':'一般分支'}{stmt.pre?' · 句首快照':stmt.live?' · 即時判定':' · 事件開始快照'}</p>
      {!!stmt.cond?.length && <p className="text-amber-200">條件：{stmt.cond.map(c=>c.label||c.c).join('；')}</p>}
      {stmt.acts.map((a,j)=><div key={j}><p>{sequenceActionLabel(a)}</p>{['timed','once'].includes(a.op)&&a.p?.body&&<div className="border-l-2 border-blue-400/40 pl-3 mt-2"><SequencePreview depth={depth+1} clause={{raw:'',parsed:true,trig:'use',body:a.p.body}}/></div>}{a.op==='mark_program'&&(a.p.rules||[]).map((rule:Clause,k:number)=><div key={k} className="border-l-2 border-yellow-400/40 pl-3 mt-2"><p>{rule.raw}（{rule.trig}）</p><SequencePreview depth={depth+1} clause={rule}/></div>)}<details className="text-slate-400"><summary>精確參數</summary><pre className="whitespace-pre-wrap break-all">{JSON.stringify(a.p,null,2)}</pre></details></div>)}
      {!!stmt.elseActs?.length && <p>否則：{stmt.elseActs.map(a=>a.label||a.op).join('；')}</p>}
    </li>)}
  </ol>;
}

/** 只呈現資料，不建立 Blockly 工作區，不替查看者改寫精靈。 */
export function DefaultEffectBlocks({ draft, action }: {draft: ReturnType<typeof defaultEffectKit>;action?: ReactNode}) {
  return <section className="ios-card p-4 sm:p-5 space-y-3" aria-label="預設積木">
    <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">{draft.origin === 'authored' ? '已設定積木' : '原文預設積木'}</h3><p className="text-xs text-slate-400 mt-1">{draft.kit.length} 個積木 · {draft.complete ? '入口已接通，情境正確性仍需驗收' : '有未接通部分，原執行來源保留'}</p></div>{action}</div>
    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">{draft.kit.map((entry,i)=><details key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs"><summary className="cursor-pointer leading-5"><span className="block text-blue-300">{EFFECT_NODE_LABELS[entry.node]} · {entry.source === 'skill' ? (entry.role === 'innate'?'固有':entry.role === 'carried'?'攜帶':'附加') : '被動／機制'}</span>{entry.customText || entry.codeId}</summary>{entry.codeId==='effect_sequence' && <SequencePreview clause={entry.params.clause}/>}<pre className="mt-2 whitespace-pre-wrap break-all text-slate-400">{JSON.stringify(entry.params,null,2)}</pre></details>)}</div>
    {!draft.kit.length && <p className="text-xs text-slate-400">此效果尚無完全等價的預設積木，不能把空畫布當作已實裝。</p>}
    {!!draft.issues.length && <details className="text-xs text-amber-200"><summary className="cursor-pointer">未接通清單（{draft.issues.length}）</summary><div className="max-h-52 overflow-y-auto">{draft.issues.map((issue,i)=><p key={i} className="py-2 leading-6">{issue.text}：{issue.reason}</p>)}</div></details>}
  </section>;
}

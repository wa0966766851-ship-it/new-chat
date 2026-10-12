import { useMemo } from 'react';
import { compileEffectPlan, EFFECT_NODE_LABELS, type EffectDefinition } from '../effects/effectConnection';
import { TRIG_LABEL } from '../blocks/parse';
import type { Program } from '../blocks/model';
import { EFFECT_NODES } from '../effects/effectNodes';

const CASES = ['正常觸發及精確數值', '條件不成立／技能無效', 'P1／P2及持有者隔離', '下場／回場／期限／清除'];
export function EffectVerificationWorkbench({ definition, kind, hasHandler, elfId, execution }: {
  definition: EffectDefinition; kind: 'skill' | 'soul'; hasHandler: boolean; elfId: string;
  execution: { source: string; program: Program };
}) {
  const plan = useMemo(() => compileEffectPlan(definition, kind, hasHandler), [definition, kind, hasHandler]);
  const legacy = !definition.effectMode || definition.effectMode === 'auto';
  const program = legacy ? execution.program : plan.program;
  const source = legacy ? execution.source : plan.route;
  const exportChecklist = () => {
    const blob = new Blob([JSON.stringify({ schemaVersion: 1, elfId, effect: definition, source,
      clauses: program.clauses, issues: plan.issues, semanticVerification: 'pending', requiredCases: CASES }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = `effect-review-${elfId.replace(/[^a-z0-9_-]/gi, '_')}.json`; link.click(); URL.revokeObjectURL(url);
  };
  return <section aria-label="逐句驗收工作區" className="space-y-3">
    <div className="ios-card p-4 space-y-2">
      <div className="flex flex-wrap justify-between items-center gap-2"><h3 className="font-semibold">{definition.name} · 逐句對照</h3>
        <button type="button" className="ios-button-secondary px-3 py-2 text-xs" onClick={exportChecklist}>匯出核對清單</button></div>
      <p className="text-xs text-slate-300">執行來源：{source} · 原句／詞條 {program.clauses.length} · 語意驗收：待測試證據</p>
      <p className="text-xs text-amber-200">此頁不自動宣稱通過。正式證據需記錄測試檔、情境、預期值與未驗分支；改動後舊證據需重新核對。</p>
      <ul className="grid sm:grid-cols-2 gap-2 text-xs text-slate-400">{CASES.map(text => <li key={text}>□ {text}</li>)}</ul>
    </div>
    <details className="ios-card p-4" open><summary className="cursor-pointer text-sm text-blue-200">保留的原始描述</summary><p className="mt-2 whitespace-pre-wrap text-sm leading-7">{definition.description || '尚無描述'}</p></details>
    {plan.issues.map((issue,i) => <p key={i} className="ios-card p-3 text-xs text-amber-200">待接通：{issue.text} · {issue.reason}</p>)}
    {program.clauses.map((clause,i) => <article key={i} className="ios-card p-4 space-y-3">
      <header className="flex justify-between gap-3 text-xs"><span className="text-blue-200">{plan.route === 'kit' && !legacy ? '積木詞條' : '原句'} {i + 1} · {clause.marker || '未標記'}</span>
        <span className={clause.parsed ? 'text-slate-300' : 'text-amber-200'}>{clause.parsed ? '已形成結構 · 未驗收' : '未完整解析 · 保留原文'}</span></header>
      <p className="whitespace-pre-wrap text-sm leading-7">{clause.raw}</p>
      <dl className="grid grid-cols-[64px_minmax(0,1fr)] gap-x-3 gap-y-2 text-xs">
        <dt className="text-slate-400">觸發</dt><dd>{clause.body[0]?.acts[0]?.p.node ? EFFECT_NODE_LABELS[clause.body[0].acts[0].p.node] : TRIG_LABEL[clause.trig] || clause.trig}
          {clause.body[0]?.acts[0]?.p.node && <p className="mt-1 text-slate-400">{EFFECT_NODES[clause.body[0].acts[0].p.node as keyof typeof EFFECT_NODES]?.help}</p>}</dd>
        <dt className="text-slate-400">前置條件</dt><dd>{clause.cond?.map(c => c.label).join('；') || '未列出前置條件'}</dd>
        <dt className="text-slate-400">行為／目標</dt><dd className="min-w-0 space-y-2">{clause.body.map((stmt,n) => <div key={n}>
          {stmt.cond?.length ? <p className="text-cyan-200">條件：{stmt.cond.map(c => c.label).join('；')}</p> : null}
          {stmt.chain && <p className="text-cyan-200">上一步結果：{stmt.chain === 'success' ? '成功' : '失敗'}</p>}
          {stmt.acts.map((act,k) => <details key={k} className="border border-white/10 rounded-lg p-2"><summary className="cursor-pointer break-words">{act.label} {act.p.node ? `· ${EFFECT_NODE_LABELS[act.p.node] || act.p.node}` : ''}</summary>
            <pre className="mt-2 whitespace-pre-wrap break-all text-slate-400">{JSON.stringify(act.p,null,2)}</pre></details>)}
          {!!stmt.elseActs?.length && <p className="text-amber-200">否則：{stmt.elseActs.map(a => a.label).join('；')}</p>}
          {(stmt.pre || stmt.live || stmt.afterHit) && <p className="text-slate-400">判定方式：{stmt.pre ? '執行前快照 ' : ''}{stmt.live ? '即時狀態 ' : ''}{stmt.afterHit ? '主傷害結算後' : ''}</p>}
        </div>)}</dd>
        <dt className="text-slate-400">保留片段</dt><dd className="text-amber-200">{clause.rest?.join('；') || '無；仍需驗證數值及分支'}</dd>
      </dl>
    </article>)}
    {!program.clauses.length && <p className="ios-card p-4 text-sm text-slate-400">尚無效果原句或積木；不能標記實裝完成。</p>}
  </section>;
}

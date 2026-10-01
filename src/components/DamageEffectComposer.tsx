import { useState } from 'react';
import type { KitEntry, Node } from '../effects/effectSystem.schema';
import { createDamageEntry, DAMAGE_CHOICES, type DamageChoice } from '../effects/damageChoices';
import { SEER_TYPES } from '../utils/statCalculator';
export function DamageEffectComposer({ source, onAdd }: { source: KitEntry['source']; onAdd: (entry: KitEntry) => void }) {
  const [amount, setAmount] = useState(150), [unit, setUnit] = useState<'points' | 'percent'>('points');
  const [type, setType] = useState<DamageChoice>('fixed'), [elem, setElem] = useState('普通');
  const [target, setTarget] = useState<'self' | 'opponent'>('opponent'), [node, setNode] = useState<Node>('on_hit'), [error, setError] = useState('');
  const field = 'w-full p-2 text-sm bg-slate-950 border border-white/10 rounded-lg';
  return <details className="ios-card p-3 mb-3" aria-label="傷害類型組裝"><summary className="text-sm cursor-pointer text-rose-200">新增明確傷害積木</summary>
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 text-xs">
      <label>數值<input aria-label="傷害數值" className={field} type="number" min="0" value={amount} onChange={e => setAmount(Number(e.target.value))} /></label>
      <label>取值<select aria-label="傷害取值" className={field} value={unit} onChange={e => { const next = e.target.value as typeof unit; setUnit(next); setType(next === 'percent' ? 'percent' : 'fixed'); if (next === 'percent') setAmount(25); }}><option value="points">點數（預設固定）</option><option value="percent">最大體力 %（預設百分比）</option></select></label>
      <label>類別<select aria-label="傷害類型" className={field} value={type} onChange={e => { const next = e.target.value as DamageChoice; setType(next); if (next === 'percent') { setUnit('percent'); setAmount(25); } }}>{DAMAGE_CHOICES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
      <label>目標<select aria-label="傷害目標" className={field} value={target} onChange={e => setTarget(e.target.value as typeof target)}><option value="opponent">對手</option><option value="self">自身</option></select></label>
      {source !== 'skill' && <label>時點<select aria-label="傷害時點" className={field} value={node} onChange={e => setNode(e.target.value as Node)}><option value="on_hit">技能命中時</option><option value="round_start">回合開始</option><option value="round_end">回合結束</option><option value="battle_phase_end">戰鬥階段結束</option><option value="on_entered">登場時</option></select></label>}
      {type === 'skill' && <label>屬性<select aria-label="傷害屬性" className={field} value={elem} onChange={e => setElem(e.target.value)}>{SEER_TYPES.map(t => <option key={t}>{t}</option>)}</select></label>}
    </div><p className="text-xs text-slate-400 mt-2">{DAMAGE_CHOICES.find(c => c.value === type)?.help} 取值與類別獨立。命中直接追加使用攻擊傷害節點，其他時點走技能效果節點；不自動建立額外行動。</p>
    {error && <p role="alert" className="text-rose-300 text-xs">{error}</p>}
    <button type="button" className="ios-button mt-2" onClick={() => { try { onAdd(createDamageEntry({ amount, unit, type, elem, target, node: source === 'skill' ? 'on_hit' : node, source })); setError(''); } catch (e) { setError((e as Error).message); } }}>加入傷害積木</button>
  </details>;
}

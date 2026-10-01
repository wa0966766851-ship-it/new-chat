import { useState } from 'react';
import type { KitEntry, Node } from '../effects/effectSystem.schema';
import { validateAtomParams, DAMAGE_FILTER_TYPES } from '../effects/kitValidation';
import { DAMAGE_CHOICES, damageChoiceLabel, damageScopeLabel } from '../effects/damageChoices';
import { SEER_TYPES } from '../utils/statCalculator';

export function DamageModifierComposer({ source, onAdd }: { source: KitEntry['source']; onAdd: (e: KitEntry) => void }) {
  const [atom, setAtom] = useState('damage_multiplier'), [value, setValue] = useState(1.5);
  const [types, setTypes] = useState<string[]>(['non_true']), [damageType, setDamageType] = useState('fixed');
  const [unit, setUnit] = useState('flat'), [elem, setElem] = useState('普通'), [error, setError] = useState('');
  const modifier = ['damage_multiplier','damage_reduce'].includes(atom);
  const node: Node = modifier ? 'before_damage' : atom === 'damage_reflect' ? 'on_damaged' : 'on_hit';
  const field = 'w-full bg-slate-950 border border-white/10 rounded-lg p-2';
  return <details className="ios-card p-3 mb-3" aria-label="傷害修正組裝"><summary className="text-sm cursor-pointer text-amber-200">新增倍率／減傷／反彈／吸取積木</summary>
    <div className="grid grid-cols-2 gap-2 text-xs mt-3">
      <label>效果<select aria-label="傷害修正效果" className={field} value={atom} onChange={e => { setAtom(e.target.value); setValue(e.target.value === 'damage_multiplier' ? 1.5 : e.target.value === 'drain_hp' ? 100 : 50); }}><option value="damage_multiplier">傷害倍率</option><option value="damage_reduce">受到傷害減少</option><option value="damage_reflect">受到傷害反彈</option><option value="drain_hp">扣對手體力並恢復自身</option></select></label>
      <label>{atom === 'damage_multiplier' ? '倍率（1.5 = 增加50%）' : atom === 'drain_hp' ? '數量' : '比例 %'}<input aria-label="傷害修正數值" className={field} type="number" min="0" value={value} onChange={e => setValue(Number(e.target.value))} /></label>
      {!modifier && <label>傷害類別<select aria-label="修正傷害類型" className={field} value={damageType} onChange={e => { setDamageType(e.target.value); if (e.target.value === 'percent') setUnit('max_hp_percent'); }}>{DAMAGE_CHOICES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label>}
      {atom === 'drain_hp' && <label>取值<select aria-label="吸取取值" className={field} value={unit} onChange={e => { setUnit(e.target.value); if (damageType === 'percent' && e.target.value === 'flat') setDamageType('fixed'); }}><option value="flat">點數</option><option value="max_hp_percent">對手最大體力 %</option></select></label>}
      {!modifier && damageType === 'skill' && <label>屬性<select aria-label="修正傷害屬性" className={field} value={elem} onChange={e => setElem(e.target.value)}>{SEER_TYPES.map(t => <option key={t}>{t}</option>)}</select></label>}
    </div>
    {modifier && <fieldset className="flex flex-wrap gap-3 text-xs mt-3"><legend>作用傷害類別（可複選）</legend>{DAMAGE_FILTER_TYPES.map(type => <label key={type}><input type="checkbox" checked={types.includes(type)} onChange={e => setTypes(e.target.checked ? [...types, type] : types.filter(t => t !== type))} /> {damageScopeLabel(type)}</label>)}</fieldset>}
    <p className="text-xs text-slate-400 mt-2">時點：{node}。技能範圍包含普通攻擊、X 系及額外行動；普通系屬性不等於普通攻擊。非真實排除真傷與體力調整。扣血＋恢復與技能吸血是不同效果；所有恢復仍受恢復規則限制。</p>
    {error && <p role="alert" className="text-rose-300">{error}</p>}
    <button type="button" className="ios-button mt-2" onClick={() => {
      const params = atom === 'damage_multiplier' ? { multiplier: value, damageTypes: types } : atom === 'damage_reduce' ? { percent: value, damageTypes: types } : atom === 'damage_reflect' ? { percent: value, damageType, elem, target: 'opponent' } : { amount: value, amountMode: unit, damageType, elem, target: 'opponent' };
      try { validateAtomParams(atom, params); onAdd({ codeId: atom, params, node, source, order: 0, customText: `${atom}：${value}；${modifier ? types.map(damageScopeLabel).join('／') : damageChoiceLabel(damageType)}` }); setError(''); }
      catch (e) { setError((e as Error).message); }
    }}>加入傷害修正積木</button>
  </details>;
}

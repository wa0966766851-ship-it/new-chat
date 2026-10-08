import React, { useState } from 'react';
import type { Elf } from '../types';
import { TypeIcon } from './SeerImages';
import { EQUIPPABLE_STONE_GRADES, SKILL_STONE_ATTRIBUTES, SKILL_STONE_GRADES, createSkillStone,
  equipSkillStone, getPerfectEffectsForAttribute, isStoneThrower, type SkillStoneGrade } from '../data/skillStones';

/** 首頁技能替換庫的輕量入口，不載入整個精靈編輯器。 */
export default function SkillStonePicker({ elf, slot, onEquip }: { elf: Elf; slot: number; onEquip: (elf: Elf) => void }) {
  const [open, setOpen] = useState(false);
  const [attribute, setAttribute] = useState('普通');
  const [grade, setGrade] = useState<SkillStoneGrade>('S');
  const [category, setCategory] = useState<'物理' | '特殊'>('特殊');
  const [perfect, setPerfect] = useState(false);
  const [effectId, setEffectId] = useState('');
  const [error, setError] = useState('');
  if (slot >= 4 || elf.skills[slot]?.isFifthSkill) return null;
  const effects = getPerfectEffectsForAttribute(attribute);
  return <section className="ios-card p-3 mb-3 shrink-0" aria-label="技能石配置">
    <button type="button" className="ios-button px-3 py-2 text-sm" aria-expanded={open} onClick={() => setOpen(!open)}>
      💎 {open ? '收起技能石配置' : '裝備技能石（最高S級）'}
    </button>
    {open && <div className="mt-3 space-y-3">
      <p className="text-xs text-slate-400">{isStoneThrower(elf) ? '投石者可攜帶四個不同屬性技能石；SS只在戰鬥出招時轉化。' : '所有精靈均可攜帶一個技能石，佔用普通技能槽；已有時請在原槽更換。'}</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
        <label>屬性 <span className="inline-flex"><TypeIcon type={attribute} size={18} /></span>
          <select aria-label="技能石屬性" value={attribute} onChange={e => { setAttribute(e.target.value); setEffectId(''); }} className="ios-input w-full p-2">
            {SKILL_STONE_ATTRIBUTES.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label>等級
          <select aria-label="技能石等級" value={grade} onChange={e => setGrade(e.target.value as SkillStoneGrade)} className="ios-input w-full p-2">
            {EQUIPPABLE_STONE_GRADES.map(g => <option key={g} value={g}>{g}（威力{SKILL_STONE_GRADES[g].power}／PP{SKILL_STONE_GRADES[g].pp}）</option>)}
          </select>
        </label>
        <label>攻擊分類
          <select aria-label="技能石攻擊分類" value={category} onChange={e => setCategory(e.target.value as '物理' | '特殊')} className="ios-input w-full p-2">
            <option value="物理">物理</option><option value="特殊">特殊</option>
          </select>
        </label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={perfect} onChange={e => setPerfect(e.target.checked)} />完美技能石</label>
      </div>
      {perfect && <label className="block text-sm">附帶效果
        <select aria-label="技能石附帶效果" value={effectId || effects[0]?.id} onChange={e => setEffectId(e.target.value)} className="ios-input w-full p-2">
          {effects.map(effect => <option key={effect.id} value={effect.id}>{effect.name} — {effect.description}</option>)}
        </select>
      </label>}
      {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
      <button type="button" className="ios-button px-3 py-2 text-sm" onClick={() => {
        try {
          const stone = createSkillStone(attribute, grade, category, perfect, perfect ? effectId || effects[0]?.id : undefined,
            isStoneThrower(elf) ? 'project' : 'standard');
          onEquip({ ...elf, ...equipSkillStone(elf, stone, slot) });
          setError('');
        } catch (e) { setError((e as Error).message); }
      }}>替換第{slot + 1}格並保留原招式</button>
    </div>}
  </section>;
}

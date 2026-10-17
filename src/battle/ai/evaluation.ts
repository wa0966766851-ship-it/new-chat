import type { BattleState } from '../../components/BattleManager';
import { checkElfDead } from '../elfAlive';
import { markAppliesToElf } from '../marks';
import { activeConstraints } from '../timedConstraints';
import { getStatuses } from '../../utils/battleHelpers';
import { isZeroPpExempt } from '../ppExemptions';
import { StatusRegistry } from '../../effects/statusRegistry';
import { canonicalStatusName } from '../../effects/statusIdentity';
import { ppMissing } from './legalActions';
import type { Elf } from '../../types';
import { visibleSkills } from '../viewerPerspective';
import { metricPreference } from './styles';
import { opposite, type AISettings, type AISide, type PositionScore, type ScorePart } from './types';

/** 僅決策評價，不參與傷害、恢復、機率或真實體力結算。 */
export const POSITION_WEIGHTS = {
  hp: 100, shield: 45, barrier: 50, death: -200, stage: 4, pp: -30,
  control: -18, abnormal: -7, boss: 10, mark: 2, protection: 12, inventory: 3,
  charge:15, restriction:-8,
} as const;
export const WEIGHT_LABELS: Record<keyof typeof POSITION_WEIGHTS, string> = {
  hp: '體力比例', shield: '護盾折算', barrier: '護罩折算', death: '主精靈陣亡', stage: '能力等級',
  pp: 'PP缺額', control: '行動限制異常', abnormal: '其他異常', boss: 'BOSS狀態', mark: '印記', protection: '限時保護', inventory: '藥劑庫存', charge:'充能',restriction:'行動限制',
};
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, Number.isFinite(n) ? n : a));
// 滿體力等量的盾後邊際價值降低，不能無限堆盾灌分。
export const shieldUtility = (ratio:number) => clamp(ratio,0,1)+clamp(ratio-1,0,1)*0.15;
function usefulStages(elf:Elf,opponent:Elf):number {
  const attacks=visibleSkills(elf).filter((s,i)=>s.category!=='屬性'&&((elf.skills[i].charge??elf.skills[i].pp??0)>0||isZeroPpExempt(elf,elf.skills[i],opponent)));
  const incoming=visibleSkills(opponent).filter(s=>s.category!=='屬性');
  const has=(list:typeof attacks,type:string)=>list.some(s=>s.category===type)?1:0;
  const stages:Partial<NonNullable<Elf['statStages']>>=elf.statStages||{};
  return clamp((stages.atk||0)*has(attacks,'物理')+(stages.spatk||0)*has(attacks,'特殊')+
    (stages.def||0)*has(incoming,'物理')+(stages.spdef||0)*has(incoming,'特殊')+
    (stages.speed||0)+(stages.accuracy||0)*(attacks.some(s=>!s.isSureHit)?1:0),-36,36);
}
function sideScore(state: BattleState, side: AISide): PositionScore {
  const totals: Record<string, number> = {};
  const add = (key: string, value: number) => { totals[key] = (totals[key] || 0) + (Number.isFinite(value) ? value : 0); };
  const opponent = state[opposite(side)];
  const team = state[`${side}Team`].map((e, i) => i === state[`${side}ActiveIndex`] ? state[side] : e);
  for (const e of team) {
    if (checkElfDead(e)) { if (!e.isExtra) add('death', POSITION_WEIGHTS.death); continue; }
    const body = e.isExtra ? 0.3 : 1;
    const max = Math.max(1, e.maxHp);
    let health = clamp(e.currentHp / max, 0, 1);
    // 非正體力存活不能被當成陣亡或「0傷就能殺」。神降評估離下限的餘裕，非真正HP。
    if (e.survivalRule?.active && e.currentHp <= 0) {
      health = e.survivalRule.mode === 'freeze_at_zero' ? 1
        : clamp((e.currentHp - e.survivalRule.minHp) / Math.max(1, -e.survivalRule.minHp), 0, 1);
    } else if (e.currentHp <= 0 && (e.deathImmunity?.deathImmuneTurns || 0) > 0) health = 0.25;
    add('hp', body * health * POSITION_WEIGHTS.hp);
    add('shield', body * shieldUtility((e.shield || 0) / max) * POSITION_WEIGHTS.shield);
    add('barrier', body * clamp((e.barrier || 0) / max, 0, 2) * POSITION_WEIGHTS.barrier);
    add('stage', body * usefulStages(e,opponent) * POSITION_WEIGHTS.stage);
    const skills = e.skills.filter(s => !isZeroPpExempt(e, s, opponent) && s.charge === undefined);
    const missing = skills.reduce((n, s) => n + (ppMissing(e, s) > 0 ? ppMissing(e, s) / Math.max(1, (s.pp || 0) + ppMissing(e, s)) : 0), 0) / Math.max(1, skills.length);
    add('pp', body * missing * POSITION_WEIGHTS.pp);
    // 充能獨立資源，不把永久滿PP誤當充能已滿。
    const charge = e.skills.filter(s => s.charge !== undefined);
    if (charge.length) add('charge', body * charge.reduce((n, s) => n + clamp(Number(s.charge) / Math.max(1, Number((s as any).maxCharge || s.maxPp || 20)), 0, 1), 0) / charge.length * POSITION_WEIGHTS.charge);
    for (const [name, remaining] of Object.entries(getStatuses(e))) {
      if (!(remaining > 0)) continue;
      const entry = StatusRegistry[canonicalStatusName(name)];
      const value = entry?.categories.includes('BOSS_ONLY') ? POSITION_WEIGHTS.boss
        : entry?.categories.includes('AUXILIARY') ? 0
        : entry?.mechanics.some(m => m.type === 'CANT_ACT') ? POSITION_WEIGHTS.control : POSITION_WEIGHTS.abnormal;
      add('status', body * value * Math.min(2, remaining));
    }
    const marks = state[`${side}Marks`].filter(m => markAppliesToElf(m, e));
    for (const m of marks) if (m.polarity && m.polarity !== 'neutral') add('mark', body * Math.min(10, Math.max(0, m.count)) * POSITION_WEIGHTS.mark * (m.polarity === 'positive' ? 1 : -1));
    for (const p of activeConstraints(state[`${side}Timers`], e)) {
      if (p.blockAttack || p.lockSwitch) add('restriction', POSITION_WEIGHTS.restriction * body);
      if (p.blockDamage || p.fatalResist || p.immuneStatus || p.immuneControl) add('protection', POSITION_WEIGHTS.protection * body);
    }
  }
  const inventory = state[`${side}ItemInventory`];
  if (inventory) add('inventory', Object.values(inventory).reduce((n, item) => n + clamp(item.left / Math.max(1, item.max), 0, 1), 0) * POSITION_WEIGHTS.inventory);
  const parts = Object.entries(totals).map(([key, value]) => ({ key, label: WEIGHT_LABELS[key] || ({ status: '異常狀態', restriction: '行動限制', charge: '充能' }[key]) || key, value }));
  return { total: parts.reduce((n, p) => n + p.value, 0), parts };
}
export function evaluatePosition(state: BattleState, side: AISide, settings: AISettings): PositionScore {
  const own = sideScore(state, side), enemy = sideScore(state, opposite(side));
  const keys = new Set([...own.parts, ...enemy.parts].map(p => p.key));
  const parts: ScorePart[] = [...keys].map(key => ({ key, label: own.parts.find(p => p.key === key)?.label || enemy.parts.find(p => p.key === key)!.label,
    value: (own.parts.find(p => p.key === key)?.value || 0) * metricPreference(settings.style,key,true) -
      (enemy.parts.find(p => p.key === key)?.value || 0) * metricPreference(settings.style,key,false) }));
  if (state.winner) parts.push({ key: 'terminal', label: '勝敗', value: state.winner === side ? 10000 : state.winner === opposite(side) ? -10000 : 0 });
  return { total: parts.reduce((n, p) => n + p.value, 0), parts };
}

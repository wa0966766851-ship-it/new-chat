import type { BattleState } from '../../components/BattleManager';
import type { Elf } from '../../types';
import { elfForViewer } from '../viewerPerspective';
import { opposite, type AISide } from './types';

/** 清除未公開選招；隱匿／幻化敵人只按可見形態推演。不是全知模式。 */
export function decisionKnowledge(source: BattleState, side: AISide): { state: BattleState; assumptions: string[] } {
  const state = structuredClone(source), enemy = opposite(side);
  const assumptions = new Set<string>(), masked = new Set<string>();
  state[`${enemy}Team`][state[`${enemy}ActiveIndex`]] = state[enemy];
  const activeIdentity = state[enemy].battleId || state[enemy].id;
  state[`${enemy}Team`] = state[`${enemy}Team`].map((elf, index): Elf => {
    if (!elf.isConcealed && !elf.illusion) return elf;
    masked.add(elf.battleId || elf.id);
    if (elf.isConcealed) {
      assumptions.add('敵方隱匿：使用中性能力與通用招式假設，不讀取隱藏魂印、屬性或技能。');
      return {
        // 不保留原種族ID，防止底層以ID查到隱藏專屬機制。
        id: `ai_unknown_${enemy}_${index}`, battleId: elf.battleId || elf.id, name: '未知精靈', type: '普通', level: elf.level || 100,
        currentHp: elf.currentHp, maxHp: elf.maxHp,
        calculatedStats: { hp: elf.maxHp, atk: 250, def: 250, spatk: 250, spdef: 250, speed: 250 },
        baseStats: { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 },
        statStages: { ...elf.statStages }, battleStatuses: { ...elf.battleStatuses }, effects: elf.effects,
        shield: elf.shield, barrier: elf.barrier, isExtra: elf.isExtra,
        skills: [{ name: '未知攻擊', category: '物理', type: '普通', power: 90, pp: 20, maxPp: 20, priority: 0, description: '' }],
      } as Elf;
    }
    assumptions.add('敵方幻化：按迷霧公開的複製形態推演，不使用原形的隱藏固有效果。');
    const target = elf.illusion!.target;
    // 公開形態從複製對象重建，不用spread原形留下私人旗標。
    return { ...structuredClone(target), id: target.id, battleId: elf.battleId || elf.id,
      currentHp: elf.currentHp, maxHp: elf.maxHp, skills: elfForViewer(elf, 'p2').skills,
      statStages: { ...elf.statStages }, battleStatuses: { ...elf.battleStatuses }, effects: elf.effects,
      shield: elf.shield, barrier: elf.barrier, illusion: undefined } as Elf;
  });
  state[enemy] = state[`${enemy}Team`][state[`${enemy}ActiveIndex`]];
  state[`${side}Team`][state[`${side}ActiveIndex`]] = state[side];
  if (masked.has(activeIdentity)) {
    state[`${enemy}RegistryState`] = {};
    state[`${enemy}Timers`] = [];
    state[`${enemy}Marks`] = [];
  }
  if (state[`${enemy}ElfState`]) for (const id of masked) delete state[`${enemy}ElfState`][id];
  state[`${enemy}Marks`] = state[`${enemy}Marks`].filter(m => !m.ownerBattleId || !masked.has(m.ownerBattleId));
  for (const s of ['p1', 'p2'] as const) {
    state[`${s}SelectedSkill`] = null; state[`${s}SelectedItem`] = null; state[`${s}SwitchIndex`] = null;
  }
  state.isAutoBattle = false; state.logs = []; state.floatingDamagePopups = []; state.activeSkillAnim = null;
  return { state, assumptions: [...assumptions] };
}

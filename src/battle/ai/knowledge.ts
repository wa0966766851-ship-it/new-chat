import type { BattleState } from '../../components/BattleManager';
import type { Elf } from '../../types';
import { elfForViewer, maskViewerText, viewerMaskTerms } from '../viewerPerspective';
import { opposite, type AISide } from './types';

/** 只取已結算回合，保留少量事實以辨識重複出招及保命。 */
export function recentBattleEvents(state: BattleState, side: AISide) {
  const masks = viewerMaskTerms(state[`${opposite(side)}Team`]);
  return (state.logs ?? []).slice(-180).filter(l => l.turn < state.turnNumber &&
    /使用了|空過|派出|陣亡|切換|保留.{0,3}1.{0,3}體力|強制存活|恢復失效|藥劑/.test(l.text))
    .slice(-18).map(l => ({turn:l.turn,text:maskViewerText(l.text,masks).slice(0,150)}));
}
export function repeatedAttack(state: BattleState, side: AISide): string | undefined {
  const last = recentBattleEvents(state, side);
  const self = state[side];
  for (const skill of self.skills) {
    if (skill.category === '屬性') continue;
    const turns = new Set(last.filter(e => e.turn >= state.turnNumber - 3 &&
      e.text.includes(`【${self.name}】使用了【${skill.name}】`)).map(e => e.turn));
    if (turns.size >= 2) return skill.name;
  }
}

/** 清除未公開選招；隱匿／幻化敵人只按可見形態推演。不是全知模式。 */
export function decisionKnowledge(source: BattleState, side: AISide): { state: BattleState; assumptions: string[] } {
  const state = structuredClone({...source, logs:[], floatingDamagePopups:[], activeSkillAnim:null,
    p1SelectedSkill:null,p2SelectedSkill:null,p1SelectedItem:null,p2SelectedItem:null,p1SwitchIndex:null,p2SwitchIndex:null,
    isAutoBattle:false}), enemy = opposite(side);
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
  return { state, assumptions: [...assumptions] };
}

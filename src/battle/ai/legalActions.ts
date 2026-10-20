import type { BattleState } from '../../components/BattleManager';
import type { Elf, Skill } from '../../types';
import { checkElfDead } from '../elfAlive';
import { listBagElves } from '../bagTargets';
import { activeConstraints } from '../timedConstraints';
import { hasBattleItem } from '../itemInventory';
import { BATTLE_ITEMS, getMaxPp, getNoSwitchTurns, isElfItemDisabled, isElfSkillSelectionDisabled, isElfSwitchDisabled } from '../../utils/battleHelpers';
import { isZeroPpExempt } from '../ppExemptions';
import { visibleSkills } from '../viewerPerspective';
import { opposite, type AISide, type PlannedAction } from './types';

/** 不能選擇 ≠ 選了會無效／受控。後者交由真正引擎結算，不能用補PP代替。 */
export function skillSelectable(state: BattleState, side: AISide, elf: Elf, slot: number): boolean {
  const raw = elf.skills?.[slot];
  if (!raw || raw.isAbolished || checkElfDead(elf) || isElfSkillSelectionDisabled(elf)) return false;
  const projected = visibleSkills(elf)[slot];
  if (projected.category !== '屬性' && activeConstraints(state[`${side}Timers`], elf).some(p => p.blockAttack)) return false;
  return isZeroPpExempt(elf, raw, state[opposite(side)]) || (raw.charge ?? raw.pp ?? 0) > 0;
}
export function ppMissing(elf: Elf, skill: Skill): number {
  // 充能不是PP；不能把充能不足當作PP藥劑可以修復。
  if (skill.charge !== undefined) return 0;
  return Math.max(0, getMaxPp(skill, elf) - (skill.pp ?? 0));
}
export function legalActions(state: BattleState, side: AISide, forced = false, potionRemaining?: number): PlannedAction[] {
  const self = state[side], opponent = state[opposite(side)];
  const actions: PlannedAction[] = [];
  const constraints = activeConstraints(state[`${side}Timers`], self);
  const canSwitch = forced || (!checkElfDead(self) && !constraints.some(p => p.lockSwitch) && !isElfSwitchDisabled(self, opponent, state.isTyrDuelField, getNoSwitchTurns(state, side)));
  if (!forced && !checkElfDead(self)) {
    self.skills.forEach((_, slot) => { if (skillSelectable(state, side, self, slot)) actions.push({ kind: 'skill', slot }); });
    if (!isElfItemDisabled(self)) {
      for (const item of BATTLE_ITEMS) {
        if (!hasBattleItem(state[`${side}ItemInventory`], item.id)) continue;
        if (side === 'p1' && potionRemaining !== undefined && potionRemaining <= 0 && item.type !== 'special') continue;
        if (item.pickTarget === 'bag_elf') {
          const teams = {p1: state.p1Team.map((e,i) => i === state.p1ActiveIndex ? state.p1 : e),
            p2: state.p2Team.map((e,i) => i === state.p2ActiveIndex ? state.p2 : e)};
          for (const {side: targetSide, elf} of listBagElves(teams)) {
            if (elf.isVanished || (targetSide === side && (elf.battleId || elf.id) === (self.battleId || self.id))) continue;
            actions.push({kind: 'item', id: item.id, picked: {side: targetSide, battleId: elf.battleId || elf.id}});
          }
        } else if (!item.pickTarget) actions.push({ kind: 'item', id: item.id });
      }
    }
  }
  if (canSwitch) state[`${side}Team`].forEach((elf, index) => {
    if (index !== state[`${side}ActiveIndex`] && !elf.isExtra && !checkElfDead(elf)) actions.push({ kind: 'switch', index });
  });
  // 普通選擇無合法行動時等待，絕不把無PP技能0當成可用攻擊。
  if (!actions.length && !forced) actions.push({ kind: 'wait' });
  return actions;
}
export function actionLabel(state: BattleState, side: AISide, action: PlannedAction): string {
  if (action.kind === 'skill') return state[side].skills[action.slot]?.name || '未知技能';
  if (action.kind === 'switch') return `換上 ${state[`${side}Team`][action.index]?.name || '未知精靈'}`;
  if (action.kind === 'item') {
    const name = BATTLE_ITEMS.find(i => i.id === action.id)?.name || '未知道具';
    const target = action.picked && listBagElves({p1: state.p1Team, p2: state.p2Team}).find(e => e.side === action.picked!.side && (e.elf.battleId || e.elf.id) === action.picked!.battleId);
    return target ? `${name} → ${target.side === side ? '己方' : '對方'} ${target.elf.isConcealed && target.side !== side ? '隱匿精靈' : target.elf.name}` : name;
  }
  return '等待';
}

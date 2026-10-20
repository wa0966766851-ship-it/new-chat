import type { BattleState } from '../../components/BattleManager';
import type { Elf, Skill } from '../../types';
import { calculateDamage } from '../../utils/damageCalculator';
import { getTypeMatchup } from '../../utils/statCalculator';
import { BATTLE_ITEMS, getStatuses } from '../../utils/battleHelpers';
import { isZeroPpExempt } from '../ppExemptions';
import { AI_EASY, AI_DEFAULT, AI_HARD, scoreActions, decideForcedSwitch, type AIDeps, type AIContext } from './legacyScoring';
import { visibleSkills } from '../viewerPerspective';
import { canonicalStatusName } from '../../effects/statusIdentity';
import { StatusRegistry } from '../../effects/statusRegistry';
import { legalActions, skillSelectable, actionLabel } from './legalActions';
import { actionKey, opposite, type CandidateReport, type DecisionRequest, type PlannedAction } from './types';
import { makeRng } from '../../utils/rng';
import { AI_STYLES } from './styles';
import { illusionItemAdjustment } from './illusionPlanning';

export function heuristicRanking(request: DecisionRequest): CandidateReport[] {
  const { state, side } = request;
  const foe = opposite(side);
  const legal = legalActions(state, side, request.forced, request.potionRemaining);
  const ownTeam = state[`${side}Team`].map((e, i) => {
    const elf = i === state[`${side}ActiveIndex`] ? state[side] : e;
    return { ...elf, skills: visibleSkills(elf) };
  });
  const enemy = { ...state[foe], skills: visibleSkills(state[foe]) };
  const ctx: AIContext = { self: ownTeam[state[`${side}ActiveIndex`]], opponent: enemy,
    team: ownTeam, activeIndex: state[`${side}ActiveIndex`],
    items: BATTLE_ITEMS.filter(i => legal.some(a => a.kind === 'item' && a.id === i.id)),
    canSwitch: legal.some(a => a.kind === 'switch'), canUseItem: legal.some(a => a.kind === 'item'), turnNumber: state.turnNumber };
  const deps: AIDeps = {
    estimateDamage: (attacker, defender, skill) => {
      const actingSide = attacker === enemy ? foe : side;
      const reg = (s: 'p1' | 'p2', e: Elf) => (e.battleId || e.id) === (state[s].battleId || state[s].id)
        ? state[`${s}RegistryState`] : state[`${s}ElfState`]?.[e.battleId || e.id]?.registry || {};
      const raw = calculateDamage(attacker, defender, skill, actingSide, request.p1Suit ?? state.p1Suit, request.p2Suit ?? state.p2Suit,
        236 / 255, false, state.p1Team, state.p2Team, undefined, request.p1Title, request.p2Title,
        actingSide === 'p1' ? reg('p1', attacker) : reg('p1', defender), actingSide === 'p2' ? reg('p2', attacker) : reg('p2', defender), state.p1Marks, state.p2Marks);
      return Math.floor(raw.damage * (raw.equipmentMultiplier ?? 1));
    },
    getTypeMatchup, getStatuses,
    isSkillUsable: (elf, sk) => {
      const s = elf === enemy ? foe : side;
      const slot = sk.battleSlot ?? elf.skills.indexOf(sk);
      const rawElf = elf === enemy ? state[foe] : state[`${side}Team`].find(e => (e.battleId || e.id) === (elf.battleId || elf.id)) || state[side];
      return skillSelectable(state, s, rawElf, slot);
    },
    isControlStatus: name => !!StatusRegistry[canonicalStatusName(name)]?.mechanics.some(m => m.type === 'CANT_ACT'),
    isPpExempt: (elf, sk) => isZeroPpExempt(elf, sk, elf === enemy ? ctx.self : enemy),
    rng: makeRng(request.seed),
  };
  const difficulty = request.settings.difficulty === 'hard' ? AI_HARD : request.settings.difficulty === 'easy' ? AI_EASY : AI_DEFAULT;
  const cfg = { ...difficulty, aggression: AI_STYLES[request.settings.style].aggression };
  const scored = scoreActions(ctx, deps, cfg);
  const preferredSwitch = request.forced ? decideForcedSwitch(ctx, deps) : -1;
  const map = new Map(scored.map(c => {
    const action: PlannedAction = c.action.kind === 'skill' ? { kind: 'skill', slot: c.action.moveIndex }
      : c.action.kind === 'switch' ? c.action : { kind: 'item', id: c.action.item.id };
    return [actionKey(action), c];
  }));
  return legal.map(action => {
    const score = map.get(actionKey(action)) || (action.kind === 'item' ? map.get(actionKey({kind:'item', id:action.id})) : undefined);
    const deferred = illusionItemAdjustment(state, side, action);
    const value = request.forced && action.kind === 'switch' ? (action.index === preferredSwitch ? 100 : 0)
      : (score?.score ?? (action.kind === 'item' ? -30 : 0)) + deferred;
    return { action, label: actionLabel(state, side, action), score: value, positionDelta: 0, strategyBonus: 0,
      reason: deferred > 0 ? `指定下次幻化對象的長期潛力；${score?.reason || '本回合無需補血'}` : score?.reason || (request.forced ? '合法存活替補' : '合法候選，尚未推演'), samples: 0, worst: value, parts: [] };
  }).sort((a, b) => b.score - a.score || actionKey(a.action).localeCompare(actionKey(b.action)));
}

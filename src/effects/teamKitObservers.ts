import { activeAlienTrait } from '../data/elfGroups';
import {portableSkillCapabilities} from '../battle/portableSkillMarks';
import type { Elf } from '../types';
import type { BattleEventContext } from './types';
import { EffectTiming } from './types';
import { TEAM_KIT_TRIGGERS } from './teamKitContract';
import { runConnectedKit, soulDefinition } from './connectedEffects';
import { checkElfDead } from '../battle/elfAlive';

/** 正式事件的出戰背包觀察者。源持有者、事件主體與真正active分開。 */
const events: Record<string, string> = {
  [EffectTiming.BEFORE_DAMAGE]:'team_before_damage',[EffectTiming.ACTION_FAILED]:'team_action_failed',
  [EffectTiming.STAT_CHANGED]:'team_stat_changed',
  [EffectTiming.OPPONENT_DAMAGE]:'team_damage_settled',
  [EffectTiming.MODIFY_PRIORITY]:'team_modify_priority',[EffectTiming.SKILL_SELECTED]:'team_skill_selected',
  [EffectTiming.ACTION_PHASE_ENTER]: 'team_action_phase_enter',
  [EffectTiming.MODIFY_STATUS_MECHANIC]: 'team_status_mechanic',
  [EffectTiming.BATTLE_START]: 'team_battle_start', [EffectTiming.ELF_ENTERED]: 'team_entrance',
  [EffectTiming.AFTER_ACTION]: 'team_after_action', [EffectTiming.ROUND_END]: 'team_round_end',
  [EffectTiming.BEFORE_STATUS_APPLY]: 'team_before_status', [EffectTiming.SELF_STATUS_APPLIED]: 'team_status_received',
  [EffectTiming.DEATH_NODE_1]: 'team_defeated',
  [EffectTiming.BATTLE_PHASE_END]: 'team_phase_end', [EffectTiming.OPPONENT_ACTION]: 'team_opponent_skill',
  [EffectTiming.ACTION_END]: 'team_action_end',
  [EffectTiming.ACTUAL_SKILL_USE]: 'team_skill_used',
};
const idOf = (elf: any) => String(elf?.battleId || elf?.id || '');
const executing = new Set<string>();
export function notifyTeamKitObservers(ctx: BattleEventContext, event: string, data: any = {}) {
  const trig = events[event], node = TEAM_KIT_TRIGGERS[trig];
  if (!node || !ctx.contextForElf || !ctx.getFullTeam) return;
  if(event===EffectTiming.BEFORE_DAMAGE && !(data.damageComp||data).isIncoming)return;
  if(event===EffectTiming.DEATH_NODE_1&&data.node!==undefined&&data.node!==1)return;
  // 替換異常須早於各種免疫；既有受方魂印晚期通知不能再觸發一次。
  if (event === EffectTiming.BEFORE_STATUS_APPLY && data?.teamObserverPhase !== 'beforeImmunity') return;
  const active = ctx.actor === 'p1' ? ctx.activeP1 : ctx.activeP2;
  // ELF_ENTERED原來已廣播每個背包持有者；只取一次，另自行遍歷源持有者。
  if (event === EffectTiming.ELF_ENTERED) {
    if (ctx.actor !== data.enteredSide || idOf(ctx.self) !== idOf(active)) return;
  } else if (![EffectTiming.BEFORE_STATUS_APPLY, EffectTiming.SELF_STATUS_APPLIED, EffectTiming.DEATH_NODE_1].includes(event as EffectTiming)
    && idOf(ctx.self) !== idOf(active)) return;
  const sides: ('p1'|'p2')[] = [EffectTiming.STAT_CHANGED,EffectTiming.OPPONENT_DAMAGE,EffectTiming.ELF_ENTERED,EffectTiming.SELF_STATUS_APPLIED,EffectTiming.SKILL_SELECTED,EffectTiming.MODIFY_PRIORITY,EffectTiming.BEFORE_STATUS_APPLY].includes(event as EffectTiming) ? ['p1','p2'] : [ctx.actor];
  for (const side of sides) for (const owner of ctx.getFullTeam(side) || []) {
    // 敵方收到異常使用獨立觸發，不能重播原本只觀察己方的條款。
    const ownerTrig=side!==ctx.actor ? ({[EffectTiming.OPPONENT_DAMAGE]:'team_opponent_damage_settled',[EffectTiming.SELF_STATUS_APPLIED]:'team_opponent_status_received',[EffectTiming.MODIFY_PRIORITY]:'team_opponent_modify_priority',[EffectTiming.SKILL_SELECTED]:'team_opponent_skill_selected'} as Record<string,string>)[event]||trig : trig;
    if (owner.isExtra) continue;
    const field=side==='p1'?ctx.activeP1:ctx.activeP2;
    if(idOf(owner)!==idOf(field)&&portableSkillCapabilities(field).suppressBenchEffects)continue;
    const definitions = [soulDefinition(owner), owner.trait, owner.alienTraits?.gen2Trait,
      owner.alienTraits?.exclusiveTrait, ...(owner.alienTraits?.exclusiveTraits || []), activeAlienTrait(owner), owner.alienTraits?.generalTrait,
      ...owner.skills.filter(skill => skill.effectMode === 'kit' && skill.kit?.some(entry => entry.role === 'carried' && entry.node === node))
        .map(skill => ({ ...skill, kit: skill.kit?.filter(entry => entry.role === 'carried') }))];
    const seen = new Set<string>();
    for (const def of definitions) {
      if (!def || def.effectMode !== 'kit') continue;
      const identity = JSON.stringify([def.name, def.description]);
      if (seen.has(identity)) continue; seen.add(identity);
      const kit = def.kit?.filter(e => e.codeId === 'effect_sequence' && e.params.clause?.trig === ownerTrig
        && (!data.applicationBlocked || e.params.clause?.observer?.includeBlocked === true)
        && ((!checkElfDead(owner) && !owner.isVanished) || e.params.clause?.observer?.includeDead === true));
      if (!kit?.length) continue;
      const key = JSON.stringify([side,idOf(owner),identity,event]);
      if (executing.has(key)) continue;
      const owned = ctx.contextForElf(side, owner), frame = Object.create(owned);
      frame.teamKitObserver = true;
      // 保留原payload物件身分，before-status的替換需回寫原本的待判定事件。
      frame.effectEventData = data;
      frame.observedEventSide = ctx.actor;
      frame.observedEventOwnerBattleId = idOf(ctx.self);
      frame.eventSide = ctx.actor;
      frame.eventOwnerBattleId = idOf(ctx.self);
      for (const field of ['skill','damageComp','priorityComp','powerComp']) if (data?.[field] !== undefined)
        Object.defineProperty(frame,field,{value:data[field],configurable:true});
      executing.add(key);
      try { runConnectedKit(node,{...def,kit},frame); } finally { executing.delete(key); }
    }
  }
}

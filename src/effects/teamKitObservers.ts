import {portableSkillCapabilities} from '../battle/portableSkillMarks';
import type { Elf } from '../types';
import type { BattleEventContext } from './types';
import { EffectTiming } from './types';
import { TEAM_KIT_TRIGGERS } from './teamKitContract';
import { runConnectedKit, soulDefinition } from './connectedEffects';
import { checkElfDead } from '../battle/elfAlive';

/** 正式事件的出戰背包觀察者。源持有者、事件主體與真正active分開。 */
const events: Record<string, string> = {
  [EffectTiming.BATTLE_START]: 'team_battle_start', [EffectTiming.ELF_ENTERED]: 'team_entrance',
  [EffectTiming.AFTER_ACTION]: 'team_after_action', [EffectTiming.ROUND_END]: 'team_round_end',
  [EffectTiming.BEFORE_STATUS_APPLY]: 'team_before_status', [EffectTiming.SELF_STATUS_APPLIED]: 'team_status_received',
  [EffectTiming.DEATH_NODE_1]: 'team_defeated',
};
const idOf = (elf: any) => String(elf?.battleId || elf?.id || '');
const executing = new Set<string>();
export function notifyTeamKitObservers(ctx: BattleEventContext, event: string, data: any = {}) {
  const trig = events[event], node = TEAM_KIT_TRIGGERS[trig];
  if (!node || !ctx.contextForElf || !ctx.getFullTeam) return;
  if(event===EffectTiming.DEATH_NODE_1&&data.node!==undefined&&data.node!==1)return;
  // 替換異常須早於各種免疫；既有受方魂印晚期通知不能再觸發一次。
  if (event === EffectTiming.BEFORE_STATUS_APPLY && data?.teamObserverPhase !== 'beforeImmunity') return;
  const active = ctx.actor === 'p1' ? ctx.activeP1 : ctx.activeP2;
  // ELF_ENTERED原來已廣播每個背包持有者；只取一次，另自行遍歷源持有者。
  if (event === EffectTiming.ELF_ENTERED) {
    if (ctx.actor !== data.enteredSide || idOf(ctx.self) !== idOf(active)) return;
  } else if (![EffectTiming.BEFORE_STATUS_APPLY, EffectTiming.SELF_STATUS_APPLIED, EffectTiming.DEATH_NODE_1].includes(event as EffectTiming)
    && idOf(ctx.self) !== idOf(active)) return;
  const sides: ('p1'|'p2')[] = event === EffectTiming.ELF_ENTERED ? ['p1','p2'] : [ctx.actor];
  for (const side of sides) for (const owner of ctx.getFullTeam(side) || []) {
    if (owner.isExtra) continue;
    const field=side==='p1'?ctx.activeP1:ctx.activeP2;
    if(idOf(owner)!==idOf(field)&&portableSkillCapabilities(field).suppressBenchEffects)continue;
    const definitions = [soulDefinition(owner), owner.trait, owner.alienTraits?.gen2Trait,
      owner.alienTraits?.exclusiveTrait, ...(owner.alienTraits?.exclusiveTraits || []), owner.alienTraits?.alienTrait, owner.alienTraits?.generalTrait];
    const seen = new Set<string>();
    for (const def of definitions) {
      if (!def || def.effectMode !== 'kit') continue;
      const identity = JSON.stringify([def.name, def.description]);
      if (seen.has(identity)) continue; seen.add(identity);
      const kit = def.kit?.filter(e => e.codeId === 'effect_sequence' && e.params.clause?.trig === trig
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

import type { Elf, Skill } from '../types';
import type { BattleEventContext } from './types';
import { EffectTiming } from './types';
import type { KitEntry, Node } from './effectSystem.schema';
import { effectRoute, kitEntryIssue, type EffectDefinition } from './effectConnection';
import { runNode } from './effectRunner';
import { eventEffectNode } from './effectNodes';
import { checkElfDead } from '../battle/elfAlive';
import { isPpConsumption, claimPpCarriedSlot } from './ppConsumptionChain';
import { TEAM_KIT_TRIGGERS } from './teamKitContract';
import { soulDefinition } from './soulDefinitionSource';
export { soulDefinition } from './soulDefinitionSource';
let skillHandlerProvider: (name: string) => boolean = () => false;
export function setConnectedSkillHandlerProvider(provider: (name: string) => boolean) { skillHandlerProvider = provider; }
export function hasConnectedSkillHandler(name: string) { return skillHandlerProvider(name); }

export function hasOpponentDamageObserver(elf:Elf):boolean{
  const definitions=[soulDefinition(elf),elf.trait,elf.alienTraits?.gen2Trait,elf.alienTraits?.exclusiveTrait,...(elf.alienTraits?.exclusiveTraits||[]),elf.alienTraits?.alienTrait,elf.alienTraits?.generalTrait];
  return definitions.some(d=>d?.effectMode==='kit'&&d.kit?.some(e=>e.node==='on_opponent_damaged'&&!kitEntryIssue(e)))||elf.skills.some(s=>s.effectMode==='kit'&&s.kit?.some(e=>e.node==='on_opponent_damaged'&&e.role==='carried'&&!kitEntryIssue(e)));
}
export function usesAuthoredSoul(elf: Elf, hasHandler: boolean): boolean {
  return !!elf.soulMark?.effectMode && elf.soulMark.effectMode !== 'auto' || !hasHandler && !!elf.isCustom &&
    (!!soulDefinition(elf).kit?.length || !elf.soulMark?.effectType || ['custom','none'].includes(elf.soulMark.effectType));
}
export function usesAuthoredSkill(skill: Skill, hasHandler: boolean, elf?: Elf): boolean {
  return !!skill.effectMode && skill.effectMode !== 'auto' || !hasHandler && (!!skill.kit?.length || !!elf?.isCustom);
}
export function runConnectedKit(node: Node, definition: EffectDefinition, ctx: BattleEventContext) {
  const runnable: KitEntry[] = [];
  for (const entry of definition.kit || []) {
    if (entry.node !== node) continue;
    if (!!TEAM_KIT_TRIGGERS[entry.params?.clause?.trig] !== !!(ctx as any).teamKitObserver) continue;
    if (entry.source === 'skill') {
      if (entry.role === 'innate' && ctx.self.isInherentInvalid) continue;
      if ((entry.role || 'attached') === 'attached' && !(ctx as any).forcedHitEffects && ((ctx as any).additionalEffectsEnabled === false || ctx.self.isAdditionalInvalid || ctx.getPlayerState?.('additionalEffectsSealed') || ctx.getPlayerState?.(`${ctx.actor}_sealSkillAdditionalEffects`))) continue;
    }
    const issue = kitEntryIssue(entry);
    if (issue) ctx.addLog(`【效果待接通】${definition.name}：${entry.customText || entry.codeId}；${issue}`, 'effect');
    else runnable.push(entry);
  }
  return runNode(node, runnable, {}, ctx) === true;
}

/** 同義事件只採一個正式時點，避免入場／致死／行動結束各觸發多次。 */
export function connectedEventNodes(event: EffectTiming, data: any, battleStart = false): Node[] {
  if (event === EffectTiming.ON_DAMAGED && data?.targetSide && data.targetSide !== data.holderSide) return /^skill_/.test(data.damageType||'')?['on_opponent_damaged']:[];
  const node = eventEffectNode(event);
  const nodes: Node[] = node ? [node, 'any_battle_node'] : [];
  if (event === EffectTiming.PP_CHANGED && isPpConsumption(event,data)) nodes.push('pp_consumed');
  if(event===EffectTiming.PP_CHANGED&&data?.reason==='clear'&&data.emptied?.length)nodes.push('pp_cleared');
  if (event === EffectTiming.ON_PP_CONSUME && !isPpConsumption(event,data)) return [];
  if (battleStart&&!nodes.includes('battle_start')) nodes.unshift('battle_start');
  if (event === EffectTiming.BEFORE_DAMAGE) nodes.push('passive_always');
  return nodes;
}

export function runConnectedLifecycle(ctx: BattleEventContext, event: EffectTiming, data: any, elf: Elf, hasSoulHandler: boolean, battleStart: boolean, acquired = false) {
  const active = ctx.actor === 'p1' ? ctx.activeP1 : ctx.activeP2;
  if (!active) return;
  const bench=!acquired && (active.battleId || active.id)!==(elf.battleId || elf.id);
  const teamRound=bench && event===EffectTiming.ROUND_START && !checkElfDead(elf);
  const teamStart=event===EffectTiming.BATTLE_START&&!checkElfDead(elf)&&!elf.isVanished&&!elf.isExtra;
  const instantGuard=event===EffectTiming.BEFORE_INSTANT_KILL&&!checkElfDead(elf);
  // 場下不能出招／跑普通回合被動，但真正被指定受擊、致死、死亡或附加異常仍屬該持有者。
  const ppConsumed=isPpConsumption(event,data);
  const resourceChanged=event===EffectTiming.RESOURCE_CHANGED&&data?.side===ctx.actor&&data?.targetBattleId===(elf.battleId||elf.id)&&data.after!==data.before;
  const recipientEvent=[EffectTiming.FATAL_RESIST,EffectTiming.DEATH_NODE_1,EffectTiming.ON_DAMAGED,EffectTiming.BEFORE_STATUS_APPLY,EffectTiming.SHIELD_BROKEN,EffectTiming.ON_PP_CONSUME,EffectTiming.PP_CHANGED,EffectTiming.ON_STATUS_ENDED,EffectTiming.SELF_STATUS_APPLIED,EffectTiming.ON_STATUS_IMMUNIZED,EffectTiming.BEFORE_STATUS_TICK].includes(event)
    && (!data?.targetSide || data.targetSide===ctx.actor);
  const incomingToOwner=event===EffectTiming.BEFORE_DAMAGE && (data?.damageComp?.isIncoming || data?.isIncoming);
  if(event===EffectTiming.RESOURCE_CHANGED&&!resourceChanged)return;
  if(bench && !teamRound && !teamStart && !recipientEvent && !incomingToOwner && !instantGuard && !resourceChanged)return;
  // ActionResultInfo.actor 是原行動方，不是事件持有方；不可蓋掉 ctx.actor／即時 self getter。
  const nodeCtx = Object.create(ctx);
  nodeCtx.effectEventData = data;
  for (const key of ['skill','damageComp','priorityComp','powerComp','amount','damage','hpReduced','settledDamage','damageDealt','damageType','typedSkill','hit','invalid','killed']) {
    if (data?.[key] !== undefined) Object.defineProperty(nodeCtx, key, { value: data[key], writable: true, configurable: true });
  }
  const nodes = connectedEventNodes(event, { ...data, holderSide: ctx.actor }, battleStart);
  const definition = soulDefinition(elf);
  const soulKit = usesAuthoredSoul(elf, hasSoulHandler) && effectRoute(definition, hasSoulHandler) === 'kit';
  let survived=false;
  for (const node of nodes) {
    if (soulKit) survived=runConnectedKit(node,teamRound?{...definition,kit:definition.kit?.filter(e=>e.codeId==='effect_sequence'&&e.params.clause.trig==='team_round_start')}:definition,nodeCtx)||survived;
    const seenTraits=new Set<string>();
    for (const trait of [elf.trait, elf.alienTraits?.gen2Trait, elf.alienTraits?.exclusiveTrait,
      ...(elf.alienTraits?.exclusiveTraits || []), elf.alienTraits?.alienTrait, elf.alienTraits?.generalTrait]) {
      if(!trait)continue;
      const identity=JSON.stringify([trait.name,trait.description]);
      if(seenTraits.has(identity))continue;seenTraits.add(identity);
      if (trait?.effectMode === 'kit') survived=runConnectedKit(node,teamRound?{...trait,kit:trait.kit?.filter(e=>e.codeId==='effect_sequence'&&e.params.clause.trig==='team_round_start')}:trait,nodeCtx)||survived;
    }
    // 取得魂印／特質不等於取得目標的整套技能（技能由幻化槽另行轉化）。
    if (acquired || bench && !ppConsumed && !teamStart && !resourceChanged) continue;
    const selected = data?.skill || ctx.skill;
    for (const [slot, skill] of elf.skills.entries()) {
      if (!usesAuthoredSkill(skill, skillHandlerProvider(skill.name), elf) || effectRoute(skill, skillHandlerProvider(skill.name)) !== 'kit') continue;
      if(node==='pp_consumed') {
        const kit=skill.kit?.filter(e=>e.node===node&&e.role==='carried');
        if(!ppConsumed||!data.consumedSlots.includes(slot)||!kit?.length||!claimPpCarriedSlot(ctx,slot))continue;
        const carriedCtx=Object.create(nodeCtx);
        Object.defineProperty(carriedCtx,'skill',{value:{...skill,battleSlot:slot},configurable:true});
        survived=runConnectedKit(node,{...skill,kit},carriedCtx)||survived;
        continue;
      }
      const selectedSlot = skill === selected || (skill.name === selected?.name && (selected?.battleSlot == null || slot === selected.battleSlot));
      // 轉化保留原槽的固有行動後效果；不能把原技能的附加效果一併重播。
      const transformedInnateSlot = node === 'after_action' && !!elf.illusion &&
        Number.isInteger(selected?.battleSlot) && slot === selected.battleSlot && skill.name !== selected.name;
      // 本次使用槽命中由 runSkillBlocks(after_hit) 執行，這裡只補其他槽的攜帶監控。
      if ((node === 'on_hit' || node === 'on_invalid') && selectedSlot) continue;
      // 攜帶效果可監控裝備中的技能；固有／附加只屬於本次使用槽，不能因裝備就每回合觸發。
      const kit = skill.kit?.filter(e => e.role === 'carried' || (node !== 'on_hit' && !data?.damageComp?.isIncoming && !data?.isIncoming &&
        (selectedSlot || transformedInnateSlot && e.role === 'innate')));
      survived=runConnectedKit(node, { ...skill, kit }, nodeCtx)||survived;
    }
  }
  return survived;
}

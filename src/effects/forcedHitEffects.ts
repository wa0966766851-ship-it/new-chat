import type {BattleEventContext} from './types';
import type {Skill} from '../types';
import {runConnectedKit} from './connectedEffects';
import {requestSkillRecalculation,hasPendingSkillDamageSuppression} from '../battle/skillRecalculation';
import {teamForcedHitPower} from '../battle/forcedHitRules';
import {evalCond} from '../blocks/runtime';
import {soulDefinition} from './soulDefinitionSource';
import {kitEntryIssue} from './effectConnection';

/** 查詢已啟用的宣告式即時抵擋；不試跑傷害、不執行附加動作或消耗亂數。 */
function hasActiveKitDamageBlock(ctx:BattleEventContext):boolean{
  if(!ctx.contextForElf)return false;
  const receiver=Object.assign(Object.create(ctx.contextForElf(ctx.targetSide,ctx.target)),{skill:ctx.skill});
  const data={damageComp:{isIncoming:true,damageCategory:'skill_attack',pure:false},skill:ctx.skill};
  receiver.effectEventData=data;
  const matches=(conds:any[],st:any)=>conds.every(c=>!['chance','mark_chance'].includes(c.c)&&evalCond(receiver,c,st)===true);
  const contains=(body:any[],st:any):boolean=>body.some(stmt=>{
    if(stmt.chain)return false;
    const chosen=stmt.cond&&!matches(stmt.cond,st)?stmt.elseActs:stmt.acts;
    return (chosen||[]).some((action:any)=>action.op==='block_damage'&&['攻擊','技能'].includes(action.p.kind));
  });
  const elf=ctx.target,definitions=[soulDefinition(elf),elf.trait,elf.alienTraits?.gen2Trait,elf.alienTraits?.exclusiveTrait,...(elf.alienTraits?.exclusiveTraits||[]),elf.alienTraits?.alienTrait,elf.alienTraits?.generalTrait];
  return definitions.some(def=>def?.effectMode==='kit'&&def.kit?.some(entry=>{
    if(entry.codeId!=='effect_sequence'||kitEntryIssue(entry))return false;
    const clause=entry.params.clause;
    if(!['incoming','incoming_attack','incoming_skill','incoming_nontrue','passive'].includes(clause.trig))return false;
    const st={last:null,lastAmount:0,event:{trig:clause.trig,data}};
    return matches(clause.cond||[],st)&&contains(clause.body,st);
  }));
}

export {hasForcedHitEffects} from '../battle/forcedHitRules';
/** 技能自帶威力變化（倍率、隨機威力、依狀態加成等，於威力公式節點結算）。強制命中時這些也要進入重算，否則整招變成無效且零傷害。 */
export function skillHasPowerChange(skill:Skill):boolean{
  return (skill.kit||[]).some(e=>e.source==='skill'&&e.role!=='carried'&&e.node==='modify_power');
}
/** 強制的只有命中附加條款；固有、攜帶、無效、擊敗與被動入口不在這裡重播。 */
export function runForcedHitEffects(ctx:BattleEventContext,skill:Skill):void {
  const forcedCtx=Object.assign(Object.create(ctx),{skill,forcedHitEffects:true,additionalEffectsEnabled:true,mainSkillHpReduced:0,damageDealt:0,killed:false});
  const definition={...skill,kit:(skill.kit||[]).filter(e=>e.source==='skill'&&(e.role||'attached')==='attached'&&['on_skill_use','on_hit'].includes(e.node))};
  runConnectedKit('on_skill_use',definition,forcedCtx);
  runConnectedKit('on_hit',definition,forcedCtx);
  // 包含其他來源早已附加的固定威力，不只比較本段執行前後的差值。
  if(Number(ctx.getPlayerState('powerAddThisAction'))>0||(Number(ctx.getPlayerState('powerMultiplierThisAction'))||1)!==1||skillHasPowerChange(skill)||teamForcedHitPower(forcedCtx)>0||hasPendingSkillDamageSuppression(ctx)||hasActiveKitDamageBlock(ctx))requestSkillRecalculation(ctx,{powerMultiplier:1,forced:true});
}

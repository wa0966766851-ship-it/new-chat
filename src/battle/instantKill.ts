import type {BattleEventContext} from '../effects/types';
import {EffectTiming} from '../effects/types';
import type {EffectItem} from '../components/BattleManager';
import {checkElfDead} from './elfAlive';
import {markAppliesToElf} from './marks';
import {resolveHpAdjustment,isAliveBySurvivalRule} from './survivalRules';
import {SoulMarkRegistry} from '../effects/battleEventRegistry';
import {TraitsEngine} from '../utils/traitsEngine';
import {traitFatalResist} from '../effects/traitEffects';
import {checkStatusDrivenFatalResist} from '../utils/statusFatalResist';
import type {InstantKillRequest} from './instantKillRequest';
import {bossTraitBlocksInstantKill} from '../blocks/ops/bossTraits';
export type {InstantKillRequest,InstantKillTarget} from './instantKillRequest';

type Side='p1'|'p2';
export interface InstantKillReceipt {
  operation:'instant_kill';targetBattleId:string;hpBefore:number;hpAfter:number;
  hpLost:number;killed:boolean;resistedFatal:boolean;blocked:boolean;
}
export type InstantKillOptions={onSettled?:(result:Readonly<InstantKillReceipt>)=>void};
export function queueInstantKill(ctx:BattleEventContext,targetSide:Side,label:string|undefined,opts:InstantKillOptions|undefined,push:(e:EffectItem)=>void):boolean {
  const target=targetSide==='p1'?ctx.activeP1:ctx.activeP2;
  if(!target||checkElfDead(target)||checkElfDead(ctx.self))return false;
  if(bossTraitBlocksInstantKill(target))return false; // BOSS 特性「疾行」：免疫瞬殺
  if(ctx.getMarks(ctx.actor).some(m=>markAppliesToElf(m,ctx.self)&&m.effects?.instantKillDisabled))return false;
  const request:InstantKillRequest={sourceSide:ctx.actor,sourceBattleId:ctx.self.battleId||ctx.self.id,
    targetSide,targetBattleId:target.battleId||target.id,
    targets:[{side:targetSide,id:target.battleId||target.id,hpSnapshot:target.currentHp}],blocked:false};
  // 在場和存活背包持有者都有機會防護；不以精靈名稱決定規則。
  for(const side of ['p1','p2'] as const)for(const owner of ctx.getFullTeam(side)||[]){
    if(!owner||owner.isExtra||owner.isVanished||checkElfDead(owner))continue;
    ctx.emitElfEvent?.(side,owner,EffectTiming.BEFORE_INSTANT_KILL,request as unknown as Record<string,unknown>);
  }
  if(request.blocked)return false;
  const seen=new Set<string>();
  for(const target of request.targets){
    const key=`${target.side}:${target.id}`;if(seen.has(key))continue;seen.add(key);
    push({type:'instant_kill',side:target.side,data:{targetId:target.id,sourceSide:request.sourceSide,sourceBattleId:request.sourceBattleId,label:label||'秒殺',...opts}});
  }
  return seen.size>0;
}
/** 體力修正不經增減傷／護盾，不派發受傷與吸血；致命抵抗及特殊存活仍走正式規則。 */
export function settleInstantKill(ctx:BattleEventContext,data:any):Readonly<InstantKillReceipt> {
  const before=ctx.self.currentHp,id=ctx.self.battleId||ctx.self.id;
  let resistedFatal=false;
  const blocked=checkElfDead(ctx.self)||before<=0;
  if(!blocked){
    const outcome=resolveHpAdjustment(before,-before,ctx.self.survivalRule);
    const immortal=(ctx.self.deathImmunity?.deathImmuneTurns||0)>0;
    if(!isAliveBySurvivalRule(outcome.hp,ctx.self.survivalRule)&&!immortal){
      resistedFatal=!!SoulMarkRegistry[ctx.self.name]?.(ctx,EffectTiming.FATAL_RESIST,{damageType:'instant_kill',sourceSide:data.sourceSide,sourceBattleId:data.sourceBattleId})
        ||TraitsEngine.triggerFatalResist(ctx)||traitFatalResist(ctx,ctx.actor,ctx.self,ctx.rng||Math.random)||checkStatusDrivenFatalResist(ctx);
    }
    if(!resistedFatal)ctx.updateAnyElf(ctx.actor,id,{currentHp:outcome.hp});
  }
  const receipt=Object.freeze({operation:'instant_kill' as const,targetBattleId:id,hpBefore:before,hpAfter:ctx.self.currentHp,
    hpLost:Math.max(0,before-ctx.self.currentHp),killed:!blocked&&checkElfDead(ctx.self),resistedFatal,blocked});
  try{data.onSettled?.(receipt);}catch(error){console.error('[instant kill callback]',error);}
  return receipt;
}

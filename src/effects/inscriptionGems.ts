import {equippedGems} from '../training/gems';
import type {Elf} from '../types';
import {EffectTiming,type BattleEventContext} from './types';
import {applyKitPpOperation} from './ppOperations';
import {getTypeMatchup} from '../utils/statCalculator';
import {addDamageIncrease} from '../battle/damagePipeline';
import {queueHpDrain} from '../battle/hpDrain';
const key=(elf:Elf,suffix:string)=>`inscriptionGem:${elf.battleId||elf.id}:${suffix}`;
const names:Record<number,string>={10:'麻痺',11:'中毒',12:'燒傷',14:'凍傷',22:'疲憊',15:'冰封',20:'失明',27:'感染'};
/** Carried equipment: never reparse source descriptions, and never execute a gem on another skill slot. */
export function runInscriptionGems(ctx:BattleEventContext,event:EffectTiming,data:any={}){
 const elf=ctx.self,all=equippedGems(elf);
 const reduction=ctx.getPlayerState('inscriptionGemAttackReduction');
 if(event===EffectTiming.BEFORE_DAMAGE&&data.damageComp&&!data.damageComp.isIncoming&&data.damageComp.damageCategory==='skill_attack'&&reduction?.round===ctx.roundNumber&&reduction.owner===(elf.battleId||elf.id))data.damageComp.multiplier*=1-reduction.rate;
 if(!all.length)return;
 const ownKey=key(elf,'entry'),lossKey=key(elf,'loss');
 if(event===EffectTiming.ON_ENTRANCE)ctx.setPlayerState(ownKey,ctx.roundNumber);
 if(event===EffectTiming.RESOURCE_CHANGED&&['shield','barrier'].includes(data.id)&&data.before>data.after){
  const old=ctx.getPlayerState(lossKey),loss=old?.round===ctx.roundNumber?old:{round:ctx.roundNumber,shield:0,barrier:0,previous:old?{round:old.round,shield:old.shield,barrier:old.barrier}:undefined};
  ctx.setPlayerState(lossKey,{...loss,[data.id]:loss[data.id]+data.before-data.after});
 }
 if(event===EffectTiming.PP_CHANGED&&data.reason==='clear'){
  if(ctx.roundNumber-(ctx.getPlayerState(ownKey)??ctx.roundNumber)<2)for(const g of all)if(g.effects.some(e=>e.id===2521)){
   const emptiedNames=(data.emptied||[]).map((index:number)=>elf.skills[index]?.name);
   if(emptiedNames.includes(g.skillName))applyKitPpOperation(ctx,ctx.actor,'add',2,(s:any)=>s.name===g.skillName&&s.pp===0);
  }
 }
 const skill=data.skill||ctx.skill;if(!skill)return;
 const gems=equippedGems(elf,skill);if(!gems.length)return;
 for(const gem of gems)for(const effect of gem.effects){
  const id=effect.id,a=effect.args,side=ctx.actor,foe=ctx.targetSide;
  if(event===EffectTiming.BEFORE_SKILL){
   if(id===1703&&data.ppCostComp)data.ppCostComp.multiplier=0;
   if(id===2515)ctx.setPlayerState(key(elf,'statusBoost'),{chance:25,resistance:25});
  }
  if(event===EffectTiming.BEFORE_DAMAGE&&data.damageComp&&!data.damageComp.isIncoming&&data.damageComp.damageCategory==='skill_attack'){
   const comp=data.damageComp;
   if(id===1707&&getTypeMatchup(skill.type,ctx.target.type)>1)addDamageIncrease(comp,a[0]/100,`gem:${gem.id}`);
   if(id===2183&&Object.values(elf.statStages||{}).some(n=>n>0))addDamageIncrease(comp,a[0]/100,`gem:${gem.id}`);
   if(id===2216&&comp.isCrit)addDamageIncrease(comp,a[0]/100,`gem:${gem.id}`);
   if(id===2215){const max=skill.maxPp??skill.pp,used=max>0?Math.floor((max-skill.pp)/max*5):0;addDamageIncrease(comp,Math.max(0,used)*a[0]/100,`gem:${gem.id}`);}
  }
  if(event!==EffectTiming.ON_SKILL_HIT&&!(event===EffectTiming.AFTER_ACTION&&skill.category==='屬性'&&data.hit===true))continue;
  const label=`寶石・${gem.name}`;
  if(id===4)ctx.applyStatChange(side,{[['atk','def','spatk','spdef','speed','accuracy'][a[0]]]:a[2]});
  else if([10,11,12,14,22].includes(id))ctx.applyStatusWithImmunityCheck(foe,names[id],id===22?2:3,false,undefined,{kind:'equipment',sourceSide:side,sourceBattleId:elf.battleId||elf.id});
  else if(id===756){const status=a[1]===22?'焚燼':a[1]===29?'失神':names[a[1]];if(status)ctx.applyStatusWithImmunityCheck(foe,status,3,false,undefined,{kind:'equipment',sourceSide:side,sourceBattleId:elf.battleId||elf.id});}
  else if(id===29)ctx.applyFixedDamage(foe,a[0],label);
  else if(id===1528)ctx.applyTrueDamage(foe,a[0],label);
  else if(id===1704)applyKitPpOperation(ctx,foe,'reduce',1);
  else if(id===1705)applyKitPpOperation(ctx,side,'add',1);
  else if(id===1706&&skill.category!=='屬性'&&data.damage===0)queueHpDrain(ctx,foe,Math.floor(ctx.target.maxHp*a[0]/100),'percent',label);
  else if(id===2516){const drops=Object.values(ctx.target.statStages||{}).reduce((n:number,v:number)=>n+Math.max(0,-v),0);ctx.setOpponentState('inscriptionGemAttackReduction',{round:ctx.roundNumber,owner:ctx.target.battleId||ctx.target.id,rate:Math.min(a[1],drops*a[0])/100});}
  else if(id===2522||id===2523){let loss=ctx.getPlayerState(lossKey);if(loss?.round===ctx.roundNumber)loss=loss.previous;const amount=loss?.round===ctx.roundNumber-1?Math.min(a[1],Math.floor(loss[id===2522?'shield':'barrier']*a[0]/100)):0;if(amount>0){if(id===2522)ctx.applyShield(side,amount);else ctx.updateElf(side,{barrier:(ctx.self.barrier||0)+amount});}}
 }
}

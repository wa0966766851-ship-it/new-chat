/** 狀態登記表的共用執行端；只讀機制參數，不依狀態或精靈名稱分支。 */
import type { Elf, Skill } from '../types';
import type { BattleEventContext } from './types';
import { StatusRegistry } from './statusRegistry';
import { getStatuses,getEffectiveStatuses,addStatusEffect } from '../utils/battleHelpers';
import { getTypeMatchup } from '../utils/statCalculator';
import { skillSlot } from '../battle/skillSlot';
import { applyKitPpOperation } from './ppOperations';

const mechanics=(elf:Elf)=>Object.entries(getEffectiveStatuses(elf)).filter(([,n])=>n>0).flatMap(([name])=>StatusRegistry[name]?.mechanics||[]);
export function statusTypeMultiplier(elf:Elf,normal:number):number {
 let result=normal;
 for(const m of mechanics(elf))if(m.type==='TYPE_MATCHUP_OVERRIDE'){
  const p=m.params||{};
  result=(p.baseMultiplier??1)*(p.multiplierSources||[]).reduce((sum:number,t:string)=>sum+getTypeMatchup(t.replace(/系$/,''),elf.type),0);
 }
 return result;
}
export function statusSkillSelected(ctx:BattleEventContext,skill:Skill,slot:number){
 ctx.setPlayerState('selectedActionSnapshot',{round:ctx.roundNumber,battleId:ctx.self.battleId||ctx.self.id,slot,attack:skill.category!=='屬性'});
 if(slot<0)return;
 if(mechanics(ctx.self).some(m=>m.type==='MODIFIER_LIMIT'&&m.params?.drainSelectedPP)){
  applyKitPpOperation(ctx,ctx.actor,'zero',0,s=>s===ctx.self.skills[slot]);
  const latest=ctx.getFullTeam(ctx.actor).find(e=>(e.battleId||e.id)===(ctx.self.battleId||ctx.self.id))||ctx.self;
  if(latest.skills[slot]?.pp!==0)return;
  // 選招時已成功觸發，之後恢復 PP 或解除狀態也不撤回當回合的行動阻止。
  ctx.setPlayerState('actionPreventedRound',ctx.roundNumber);
  ctx.addLog(`【${skill.name}】在選招時PP歸零，當回合無法行動。`,'status');
 }
}
export function statusSelectionRoundEnd(ctx:BattleEventContext){
 const elf=ctx.getFullTeam(ctx.actor).find(e=>(e.battleId||e.id)===(ctx.self.battleId||ctx.self.id))||ctx.self;
 const snap=ctx.getPlayerState('selectedActionSnapshot');
 const selectedAttack=snap?.round===ctx.roundNumber&&snap.battleId===(elf.battleId||elf.id)&&snap.attack;
 for(const m of mechanics(elf)){
  const p=m.params?.selectionRoundEnd;
  if(!p)continue;
  if(selectedAttack){
   const slot=skillSlot(elf,{...elf.skills[snap.slot],battleSlot:snap.slot});
   if(slot>=0)applyKitPpOperation(ctx,ctx.actor,'reduce',p.attackPpCost,s=>s===elf.skills[slot]);
  }else{
   // 2026-11-02：原文「失去體力上限20%」——只降上限，不直接扣當前體力；
   // 當前體力僅在上限降低後仍高於新上限時才被夾到新上限。
   // 2026-11-02：原文「失去體力上限20%」——只降上限，不直接扣當前體力；
   // 當前體力僅在上限降低後仍高於新上限時才被夾到新上限。
   // 注意：上限變更與異常延長必須合併成「一次」updateElf，
   // 否則後一次只帶 effects/battleStatuses 會把 maxHp 的修改蓋掉。
   const loss = Math.floor(elf.maxHp * p.noAttackHpLoss);
   const nextMax = Math.max(1, elf.maxHp - loss);
   const nextHp = Math.min(elf.currentHp, nextMax);
   const updated={...elf,maxHp:nextMax,currentHp:nextHp,
     calculatedStats:{...elf.calculatedStats,hp:nextMax},
     battleStatuses:{...getStatuses(elf)},effects:[...(elf.effects||[])]};
   for(const [name,n] of Object.entries(getStatuses(elf)))if(StatusRegistry[name]?.categories.includes(p.extendCategory))addStatusEffect(updated,name,n+p.extendTurns);
   ctx.updateElf(ctx.actor,{
     maxHp:nextMax,currentHp:nextHp,
     calculatedStats:{...elf.calculatedStats,hp:nextMax},
     effects:updated.effects,battleStatuses:updated.battleStatuses,
   });
   ctx.addLog?.(`💀 【入魔】：失去體力上限 ${loss} 點（上限 ${elf.maxHp}→${nextMax}，當前 ${elf.currentHp}→${nextHp}）！`, 'status');
  }
 }
}

import type {Elf,BattleItem} from '../types';
import {BATTLE_ITEMS,getStatuses} from '../utils/battleHelpers';
import {isNonTrueDamageType,isSkillDamageType} from './damageSemantics';
import {multiplyDamageReduction} from './damageReduction';
import type {DamageComputation} from '../effects/types';
import type {BattleEventContext} from '../effects/types';
type Side='p1'|'p2';
export function syncHeldDeathFloor(ctx:BattleEventContext,leaving=false){
 const field=ctx.actor==='p1'?ctx.activeP1:ctx.activeP2;
 if((field.battleId||field.id)!==(ctx.self.battleId||ctx.self.id))return;
 const ratio=leaving?0:Math.max(0,...BATTLE_ITEMS.filter(item=>(ctx.getBattleItem?.(ctx.actor,item.id)?.left||0)>0).map(item=>item.heldModifiers?.deathFloorRatio||0));
 if((ctx.self.heldDeathFloorRatio||0)!==ratio)ctx.updateElf(ctx.actor,{heldDeathFloorRatio:ratio});
}
/** 每次讀真正庫存與在場身分；物品用完、換人、來源陣亡都不會留下永久殘影。 */
export function heldModifiers(state:any,side:Side,elf:Elf):NonNullable<BattleItem['heldModifiers']>[] {
 const field=state?.[side];if(!field||(field.battleId||field.id)!==(elf.battleId||elf.id))return [];
 const inv=state[side+'ItemInventory'];if(!inv)return [];
 return BATTLE_ITEMS.filter(item=>item.heldModifiers&&(inv[item.id]?.left||0)>0).map(item=>item.heldModifiers!);
}
export function guardHeldMaximumHp(state:any,side:Side,elf:Elf,patch:Partial<Elf>):Partial<Elf>{
 if(!heldModifiers(state,side,elf).some(m=>m.maxHpIncreaseDisabled))return patch;
 const maxHp=Math.min(elf.maxHp,patch.maxHp??elf.maxHp);
 return {...patch,...(patch.maxHp!==undefined?{maxHp}:{}),...(patch.calculatedStats?{calculatedStats:{...patch.calculatedStats,hp:Math.min(maxHp,patch.calculatedStats.hp)}}:{})};
}
export function heldRecoveryModifiers(state:any,side:Side,elf:Elf):{multiplier:number;opponentTrueRatio:number}{
 let multiplier=1,opponentTrueRatio=0;
 const abnormal=Object.keys(getStatuses(elf)).length>0;
 for(const m of heldModifiers(state,side,elf))if(m.recovery){const scale=abnormal?m.recovery.abnormalMultiplier:1;multiplier*=Math.max(0,1-m.recovery.reduction*scale);opponentTrueRatio+=m.recovery.opponentTrueRatio*scale;}
 return {multiplier,opponentTrueRatio};
}
export function applyHeldDamageModifiers(comp:DamageComputation,state:any,sourceSide:Side,targetSide:Side,actor:Elf,target:Elf){
 if(!isNonTrueDamageType(comp.damageCategory)||comp.pure)return;
 for(const m of heldModifiers(state,targetSide,target))comp.increasePercent+=isSkillDamageType(comp.damageCategory)&&comp.skillCategory==='特殊'?m.incomingSpecialSkillIncrease??m.incomingIncrease??0:m.incomingIncrease??0;
 const selected=state[sourceSide+'RegistryState']?.selectedActionSnapshot;
 if(isSkillDamageType(comp.damageCategory)&&selected&&selected.round===state.turnNumber&&selected.battleId===(actor.battleId||actor.id)&&selected.category==='特殊')
  for(const m of heldModifiers(state,sourceSide,actor))if(m.selectedSpecialSkillMultiplier!==undefined)multiplyDamageReduction(comp,m.selectedSpecialSkillMultiplier,false);
}

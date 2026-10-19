import type {BattleEventContext} from '../../effects/types';
import type {RunState} from '../runtime';
import {matchesDamageTypes} from '../../effects/damageChoices';

export const MISSING_HP_SCALING_FIELDS:Record<string,readonly string[]>={
  missing_hp_scaled_boost:['baseBoost','step','multiplier','types'],
  missing_hp_scaled_heal:['baseRatio','step','multiplier'],
  damage_cap_now:['cap','types'],
};
export function missingHpScalingIssue(op:string,p:any,trig:string):string|null{
  if(op==='damage_cap_now')return trig.startsWith('incoming')&&p.cap>0&&p.cap<=1e6&&validTypes(p.types)?null:'即時傷害上限需受傷前入口、正上限及傷害分類';
  if(!(p.step>=.01&&p.step<=1&&p.multiplier>=1&&p.multiplier<=2))return '失血逐次倍率需1%至100%步長及1至2倍增幅';
  if(op==='missing_hp_scaled_boost'&&(!trig.startsWith('outgoing')||!(p.baseBoost>=0&&p.baseBoost<=100)||!validTypes(p.types)))return '失血增傷需造成傷害前入口、有限基礎增幅及分類';
  if(op==='missing_hp_scaled_heal'&&(!(p.baseRatio>0&&p.baseRatio<=1)||trig!=='round_end'))return '失血回血需回合末及最大體力正比例';
  return null;
}
const validTypes=(types:any)=>Array.isArray(types)&&types.length>0&&types.length<=5&&types.every((v:any)=>['skill','attack','fixed','percent','non_true'].includes(v));
const current=(ctx:BattleEventContext)=>ctx.getFullTeam(ctx.actor).find(e=>(e.battleId||e.id)===(ctx.self.battleId||ctx.self.id))||ctx.self;
const factor=(ctx:BattleEventContext,p:any)=>{
  const elf=current(ctx),missing=elf.maxHp>0?Math.min(elf.maxHp,Math.max(0,elf.maxHp-elf.currentHp)):0;
  const steps=elf.maxHp>0?missing/(elf.maxHp*p.step):0;
  return p.multiplier**Math.floor(steps+Number.EPSILON*Math.max(1,steps)*4);
};
export const missingHpScalingOperations={
  missing_hp_scaled_boost:(ctx:BattleEventContext,p:any,st:RunState)=>{
    const comp=st.event?.data?.damageComp||(ctx as any).damageComp;
    if(!comp||comp.isIncoming||!matchesDamageTypes(p.types,comp.damageCategory))return false;
    comp.increasePercent+=p.baseBoost*factor(ctx,p);return true;
  },
  missing_hp_scaled_heal:(ctx:BattleEventContext,p:any)=>{
    const elf=current(ctx);if(elf.currentHp<=0||elf.currentHp>=elf.maxHp)return false;
    ctx.applyHeal(ctx.actor,Math.floor(elf.maxHp*p.baseRatio*factor(ctx,p)));return true;
  },
  damage_cap_now:(ctx:BattleEventContext,p:any,st:RunState)=>{
    const comp=st.event?.data?.damageComp||(ctx as any).damageComp;
    if(!comp?.isIncoming||!matchesDamageTypes(p.types,comp.damageCategory))return false;
    comp.limit=Math.min(comp.limit??Infinity,p.cap);return true;
  },
};

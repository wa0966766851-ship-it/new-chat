import type{BattleEventContext}from'./types';import{readMarkStacks}from'./markQueries';import{addDamageReduction}from'../battle/damageReduction';import{changePp}from'./newElfOperations';import{getMaxPp}from'../utils/battleHelpers';
const keys=['atk','spatk','def','spdef','speed'];
const count=(ctx:BattleEventContext,ids:string[])=>ids.reduce((n,id)=>n+Math.min(1,readMarkStacks(ctx,{side:'self',id})),0);
const live=(ctx:BattleEventContext,side:'p1'|'p2')=>{const e=side===ctx.actor?ctx.self:ctx.target;return ctx.getFullTeam(side).find(x=>(x.battleId||x.id)===(e.battleId||e.id))||e;};
export const RESOURCE_PANEL_FIELDS:Record<string,readonly string[]>={resource_panel_scale:['key','ids','statRatio','maxHpRatio'],resource_damage_scale:['ids','attackBoost','nonTrueReduce'],resource_round_recovery:['ids','healRatio','ppPerResource'],resource_scaled_hits:['ids','mark','base','bonusMark','bonusPerResource','multiplierMark','maxMultiplier','elem']};
export function resourcePanelIssue(op:string,p:any):string|null{
 if(!RESOURCE_PANEL_FIELDS[op])return null;
 if(!Array.isArray(p.ids)||!p.ids.length||p.ids.length>10||p.ids.some((s:any)=>typeof s!=='string'||!s||s.length>100)||new Set(p.ids).size!==p.ids.length)return '資源面板需不重複且有限的資源清單';
 if(op==='resource_scaled_hits'&&(![p.mark,p.bonusMark,p.multiplierMark,p.elem].every(s=>typeof s==='string'&&s.length>0&&s.length<=100)||!Number.isInteger(p.base)||p.base<1||p.base>100000||!Number.isInteger(p.bonusPerResource)||p.bonusPerResource<0||p.bonusPerResource>100000||!Number.isFinite(p.maxMultiplier)||p.maxMultiplier<1||p.maxMultiplier>10))return '資源連擊需明確印記、屬性、有限基值及倍率';
 if(op==='resource_panel_scale'&&(typeof p.key!=='string'||!p.key||p.key.length>100||![p.statRatio,p.maxHpRatio].every(n=>Number.isFinite(n)&&n>=0&&n<=2)))return '資源面板需有限鍵及0至200%能力/體力比例';
 if(op==='resource_damage_scale'&&(!Number.isFinite(p.attackBoost)||p.attackBoost<0||p.attackBoost>10||!Number.isFinite(p.nonTrueReduce)||p.nonTrueReduce<0||p.nonTrueReduce>1))return '資源增減傷需有限非負比例';
 if(op==='resource_round_recovery'&&(!Number.isFinite(p.healRatio)||p.healRatio<0||p.healRatio>1||!Number.isInteger(p.ppPerResource)||p.ppPerResource<0||p.ppPerResource>10))return '資源回復需有限體力比例與PP整數';return null;
}
export function resourcePanelOperations(){return{
 resource_scaled_hits:(ctx:BattleEventContext,p:any)=>{
  const n=count(ctx,p.ids),stacks=readMarkStacks(ctx,{side:'self',id:p.mark});
  if(!n||!stacks)return false;
  const boosted=readMarkStacks(ctx,{side:'self',id:p.bonusMark})>0;
  const maximum=readMarkStacks(ctx,{side:'self',id:p.multiplierMark})>0;
  const base=p.base+(boosted?n*p.bonusPerResource:0),hits=Math.floor(n*stacks);
  // 各段獨立經過屬性、護盾、免疫及傷害結算。
  for(let i=0;i<hits;i++){
   if(live(ctx,ctx.targetSide).currentHp<=0)break;
   ctx.applySkillTypeDamage(ctx.targetSide,Math.floor(base*(maximum?p.maxMultiplier:1)),'資源連擊',{
    elem:p.elem,category:'skill_attribute',applyTypeMatchup:!maximum,
   });
  }
  return true;
 },
 resource_panel_scale:(ctx:BattleEventContext,p:any)=>{
  const elf=live(ctx,ctx.actor),n=count(ctx,p.ids),prev=ctx.getPlayerState(p.key)||{count:0,baseStats:{...elf.calculatedStats},baseMax:elf.maxHp,boost:0,points:{}};
  if(n===prev.count){if(!ctx.getPlayerState(p.key))ctx.setPlayerState(p.key,prev);return false;}
  const stats={...elf.calculatedStats},points:any={};for(const k of keys){points[k]=Math.floor(prev.baseStats[k]*p.statRatio*n);stats[k]=Math.max(1,stats[k]+points[k]-(prev.points[k]||0));}
  const boost=Math.floor(prev.baseMax*p.maxHpRatio*n),maxHp=Math.max(1,elf.maxHp+boost-prev.boost);stats.hp=maxHp;
  ctx.setPlayerState(p.key,{...prev,count:n,boost,points});
  ctx.updateElf(ctx.actor,{calculatedStats:stats,maxHp,currentHp:Math.min(elf.currentHp,maxHp),tempMaxHpBoost:Math.max(0,(elf.tempMaxHpBoost||0)+boost-prev.boost)});return true;
 },
 resource_damage_scale:(ctx:BattleEventContext,p:any)=>{
  const comp=(ctx as any).damageComp||(ctx as any).effectEventData?.damageComp,n=count(ctx,p.ids);if(!comp||!n)return false;
  if(!comp.isIncoming&&comp.damageCategory==='skill_attack'){comp.increasePercent+=n*p.attackBoost;return true;}
  if(comp.isIncoming&&comp.damageCategory!=='true'){addDamageReduction(comp,Math.min(1,n*p.nonTrueReduce));return true;}return false;
 },
 resource_round_recovery:(ctx:BattleEventContext,p:any)=>{
  const n=count(ctx,p.ids);if(!n)return false;ctx.applyHeal(ctx.actor,Math.floor(live(ctx,ctx.actor).maxHp*p.healRatio*n));
  const pick=(xs:number[])=>xs[Math.min(xs.length-1,Math.floor((ctx.rng?.()??Math.random())*xs.length))];
  for(let i=0;i<n*p.ppPerResource;i++){
   const foe=live(ctx,ctx.targetSide),available=foe.skills.flatMap((s,j)=>s.pp>0?[j]:[]);if(!available.length)break;
   const slot=pick(available),removed=changePp(ctx,ctx.targetSide,foe,(s,j)=>j===slot?s.pp-1:s.pp,false,'drain').removed;if(!removed)continue;
   const own=live(ctx,ctx.actor),empty=own.skills.flatMap((s,j)=>s.pp<getMaxPp(s,own)?[j]:[]);if(!empty.length)continue;
   const target=pick(empty);changePp(ctx,ctx.actor,own,(s,j)=>j===target?s.pp+1:s.pp,true,'restore');
  }return true;
 },
};}

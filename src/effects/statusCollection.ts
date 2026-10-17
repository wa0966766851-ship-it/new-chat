import type { BattleEventContext } from './types';
import { StatusRegistry } from './statusRegistry';
import { canonicalStatusName } from './statusIdentity';
import { checkElfDead } from '../battle/elfAlive';
import {syncLegacy} from '../utils/battleHelpers';
import type {Elf} from '../types';

export const STATUS_COLLECTION_CLASSES=['','控制類','弱化類','限制類','衍化類','附屬類'] as const;
const categories:Record<string,string>={控制類:'CONTROL',弱化類:'WEAKENING',限制類:'RESTRICTIVE',衍化類:'EVOLUTIONARY',附屬類:'AUXILIARY'};
/** 當下的正規化期限快照；BOSS特性與無效果標記不計為異常。 */
export function statusDurationSum(ctx:BattleEventContext,elves:Elf[]):number{
  return elves.reduce((sum,elf)=>sum+Object.entries(ctx.getStatuses(elf)||{}).reduce((total,[id,turns])=>{
    const cats=StatusRegistry[canonicalStatusName(id)]?.categories||[];
    return total+(cats.some(c=>c==='BOSS_ONLY'||c==='NO_EFFECT')?0:Math.max(0,Number(turns)||0));
  },0),0);
}
/** 延長不重新附加或重設堆疊；缺少狀態時才走正式施加／免疫事件。 */
export function applyOrExtendStatus(ctx:BattleEventContext,side:'p1'|'p2',elf:Elf,status:string,turns:number,extend:number):boolean{
  const name=canonicalStatusName(status),before=ctx.getStatuses(elf)||{},duration=before[name]||0;
  if(duration<=0)return ctx.applyStatusWithImmunityCheck(side,name,turns).success;
  const updated={...elf,battleStatuses:{...before,[name]:duration+extend},effects:[...(elf.effects||[])]};
  let found=false;
  updated.effects=updated.effects.map(effect=>canonicalStatusName(effect.id)===name?(found=true,{...effect,duration:duration+extend}):effect);
  if(!found)updated.effects.push({id:name,name,duration:duration+extend,stacks:1});
  syncLegacy(updated);
  ctx.updateElf(side,{effects:updated.effects,battleStatuses:updated.battleStatuses,battleStatus:updated.battleStatus,battleStatusDuration:updated.battleStatusDuration});return true;
}
export function applyStatusCollection(ctx:BattleEventContext,p:any):boolean {
  const source=ctx.self;
  // 名稱及持有者在開始時一次取快照；附加引發的衍化不能再擴大同一次集合。
  const names=p.mode==='current'
    ? [...new Set(Object.entries(ctx.getStatuses(source)).filter(([,turns])=>Number(turns)>0).map(([name])=>canonicalStatusName(name)))]
    : Object.keys(StatusRegistry).filter(name=>{
      const e=StatusRegistry[name];return e.name===name&&!e.categories.some(c=>c==='BOSS_ONLY'||c==='NO_EFFECT')&&(!p.cls||e.categories.includes(categories[p.cls] as any));
    });
  const sides:('p1'|'p2')[]=p.side==='both'?[ctx.actor,ctx.targetSide]:[p.side==='self'?ctx.actor:ctx.targetSide];
  const targets=sides.flatMap(side=>(p.scope==='team'?(ctx.getFullTeam?.(side) || []):[side===ctx.actor?ctx.self:ctx.target])
    .filter(elf=>!checkElfDead(elf)).map(elf=>({side,id:elf.battleId || elf.id})));
  let any=false;
  for(const {side,id} of targets)for(const name of names)any=ctx.applyStatusWithImmunityCheck(side,name,p.turns,false,id).success||any;
  return any;
}
export function increasingStatusChance(ctx:BattleEventContext,p:any):number {
  const base=p.chance ?? 100;
  if(p.chanceIncrement===undefined)return base;
  const use=ctx.getPlayerState('skillUseSequence');
  const count=use?.resolvedName===ctx.skill?.name?Math.max(1,Number(use.totalUses) || 1):1;
  return Math.min(p.chanceCap,base+(count-1)*p.chanceIncrement);
}

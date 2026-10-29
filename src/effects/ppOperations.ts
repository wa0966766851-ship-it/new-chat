import type { BattleEventContext } from './types';
import type { Elf } from '../types';
import { getMaxPp } from '../utils/battleHelpers';
import { changePp } from './newElfOperations';
import { deriveContext } from './deriveContext';

export type KitPpMode='zero'|'recover'|'drain'|'add'|'reduce';
const identity=(elf:Elf)=>elf.battleId || elf.id;

/** 所有技能槽逐槽結算：上限、恢復限制、星護及PP事件走同一管道，不以模板直接覆寫。 */
/** only：只處理符合條件的技能（例如只限攻擊技能）；未符合的技能PP不變。 */
export function applyKitPpOperation(ctx:BattleEventContext,side:'p1'|'p2',mode:KitPpMode,amount=0,only?:(skill:any)=>boolean,report?:{emptied?:number[];restored?:number}):boolean {
  const current=(s:'p1'|'p2')=>{
    const base=s===ctx.actor?ctx.self:s===ctx.targetSide?ctx.target:s==='p1'?ctx.activeP1:ctx.activeP2;
    return ctx.getFullTeam?.(s)?.find(e=>identity(e)===identity(base)) || base;
  };
  // 老測試及非戰鬥預覽也可提供updateElf；正式戰鬥仍保留指定持有者的updateAnyElf。
  // ctx 常是 Object.create(ctx) 的節點上下文，必須用原型繼承衍生，不可展開複製。
  const adapter:BattleEventContext=deriveContext(ctx,{
    getFullTeam:ctx.getFullTeam || ((s:'p1'|'p2')=>[current(s)]),
    updateAnyElf:ctx.updateAnyElf || ((s:'p1'|'p2',_id:string,patch:any)=>ctx.updateElf(s,patch))});
  const elf=current(side);if(!elf)return false;
  const before=JSON.stringify(elf.skills);
  const recovery=mode==='recover'||mode==='add';
  const result=changePp(adapter,side,elf,s=>only&&!only(s)?s.pp:mode==='zero'?0:mode==='recover'?getMaxPp(s,elf):recovery?
    Math.min(getMaxPp(s,elf),s.pp+amount):Math.max(0,s.pp-amount),recovery,mode==='zero'?'clear':recovery?'restore':'drain');
  if(report){report.emptied=result.emptied;report.restored=result.restored;}
  let changed=before!==JSON.stringify(current(side).skills);
  if(mode==='drain') {
    const self=current(ctx.actor),old=JSON.stringify(self.skills);
    // 「吸取所有技能N點PP」自身各技能恢復N；不是集中到使用槽，也不按對手總扣除量平分。
    changePp(adapter,ctx.actor,self,s=>Math.min(getMaxPp(s,self),s.pp+amount),true,'restore');
    changed=changed||old!==JSON.stringify(current(ctx.actor).skills);
  }
  return changed;
}

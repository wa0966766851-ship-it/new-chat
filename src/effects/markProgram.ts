import type { Clause } from '../blocks/model';
import type { Mark } from '../battle/marks';
import type { BattleEventContext } from './types';

/** 印記內的程式以持有者為self。只開放已由持有者事件實際派發的節點。 */
export const MARK_PROGRAM_TRIGGERS = new Set([
  'round_start','round_end','phase_end','damaged','damaged_skill','damaged_attack',
  'damaged_true','damaged_fixed','damaged_percent','damaged_nontrue',
  'incoming','incoming_skill','incoming_attack','incoming_nontrue',
  'outgoing','outgoing_skill','outgoing_attack',
]);
export const MARK_PROGRAM_FIELDS = [
  'id','name','side','mode','count','maxCount','scope','persistsOffField','turns',
  'displayChar','unit','description','rules',
] as const;
export function markProgramIssue(p:any):string|null {
  if(!['self','opp'].includes(p.side)||!['elf','team'].includes(p.scope))return '印記需明確目標與精靈／陣營作用域';
  if(!['add','set'].includes(p.mode)||!Number.isInteger(p.count)||p.count<1||p.count>10000)return '印記需明確累加／設定方式及正整數層數';
  if(!Number.isInteger(p.maxCount)||p.maxCount<1||p.maxCount>10000||p.count>p.maxCount)return '印記需有效層數上限';
  if(typeof p.persistsOffField!=='boolean')return '印記需明確下場保留規則';
  for(const key of ['id','name','displayChar','description'])if(typeof p[key]!=='string'||!p[key]||p[key].length>(key==='description'?100000:200))return `印記${key}需有限非空文字`;
  if(!['層','道','點','篇','枚','株','回合'].includes(p.unit))return '印記單位不明';
  if(p.turns!==undefined&&(!Number.isInteger(p.turns)||p.turns<1||p.turns>10000))return '印記期限需正整數；未填才代表不按回合到期';
  if(!Array.isArray(p.rules)||!p.rules.length||p.rules.length>30)return '印記需1至30份可執行規則';
  for(const rule of p.rules)if(!MARK_PROGRAM_TRIGGERS.has(rule?.trig))return '印記規則缺少已接通的持有者節點';
  return null;
}
/** 不從原精靈名字查詢，不共享外部可變圖紙；附加成功後持有者自帶完整程式。 */
export function applyMarkProgram(ctx:BattleEventContext,p:any,holder:any):boolean {
  const side=p.side==='self'?ctx.actor:ctx.targetSide;
  const ownerBattleId=p.scope==='elf'?String(holder.battleId||holder.id):undefined;
  const previous=ctx.getMarks(side).find(m=>m.id===p.id&&m.ownerBattleId===ownerBattleId);
  const count=Math.min(p.maxCount,p.mode==='add'?(previous?.count||0)+p.count:p.count);
  const mark:Omit<Mark,'source'>={
    id:p.id,name:p.name,displayChar:p.displayChar,description:p.description,
    count,maxCount:p.maxCount,unit:p.unit,scope:p.scope,ownerBattleId,
    persistsOffField:p.persistsOffField,clearable:false,remainingRounds:p.turns,
    effects:{blockProgram:structuredClone(p.rules) as Clause[],...(p.turns!==undefined?{blkTurns:p.turns}:{})},
  };
  ctx.setMark(mark,side);return true;
}

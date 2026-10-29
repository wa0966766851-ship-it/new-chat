import type { Clause } from '../blocks/model';
import type { Mark } from '../battle/marks';
import type { BattleEventContext } from './types';
import { markRecoveryReductionIssue } from '../battle/markRecovery';
import {markDamageReductionIssue} from '../battle/markDamageReduction';
import {readMarkStacks} from './markQueries';

/** 印記內的程式以持有者為self。只開放已由持有者事件實際派發的節點。 */
export const MARK_PROGRAM_TRIGGERS = new Set([
  'round_start','round_end','phase_end','damaged','damaged_skill','damaged_attack',
  'damaged_true','damaged_fixed','damaged_percent','damaged_nontrue',
  'incoming','incoming_skill','incoming_attack','incoming_nontrue',
  'outgoing','outgoing_skill','outgoing_attack',
]);
export const MARK_PROGRAM_FIELDS = [
  'id','name','side','mode','count','maxCount','scope','persistsOffField','turns',
  'displayChar','unit','description','rules','recoveryReduction','incomingDamageReduction',
  // 引擎既有印記效果讀取端（marks.effects；battle/contextBuilders 倍率、battleEngine 保底機率）：
  // 5025 恐懼之種/花寫入用（DSH 20261018）。guaranteedMaxHpDamageChancePerStack：每層提高量，
  // 寫入時依最終層數折算成 guaranteedMaxHpDamageChance 存入（引擎讀值不讀層數）。
  'nonTrueDamageDealtMultiplier','nonTrueDamageTakenMultiplier',
  'guaranteedMaxHpDamageChance','guaranteedMaxHpDamageChancePerStack',
  // 持有者（屬性／攻擊／全部）技能無效：寫入 marks.effects.blkInvalid（battleEngine 技能無效讀取端既有）。5010 星海之浸。
  'holderInvalid',
  'countFromMark','turnsFromCount','priorityBonus','vsOpponentName',
] as const;
export function markProgramIssue(p:any):string|null {
  if(!['self','opp'].includes(p.side)||!['elf','team'].includes(p.scope))return '印記需明確目標與精靈／陣營作用域';
  if(!['add','set'].includes(p.mode)||!Number.isInteger(p.count)||p.count<1||p.count>10000)return '印記需明確累加／設定方式及正整數層數';
  if(!Number.isInteger(p.maxCount)||p.maxCount<1||p.maxCount>10000||p.count>p.maxCount)return '印記需有效層數上限';
  if(typeof p.persistsOffField!=='boolean')return '印記需明確下場保留規則';
  for(const key of ['id','name','displayChar','description'])if(typeof p[key]!=='string'||!p[key]||p[key].length>(key==='description'?100000:200))return `印記${key}需有限非空文字`;
  if(!['層','道','點','篇','枚','株','回合'].includes(p.unit))return '印記單位不明';
  if(p.turns!==undefined&&(!Number.isInteger(p.turns)||p.turns<1||p.turns>10000))return '印記期限需正整數；未填才代表不按回合到期';
  if(p.recoveryReduction!==undefined){const issue=markRecoveryReductionIssue(p.recoveryReduction);if(issue)return issue;}
  if(p.incomingDamageReduction!==undefined){const issue=markDamageReductionIssue(p.incomingDamageReduction);if(issue)return issue;}
  // 引擎讀取端效果欄位：空規則陣列亦可（效果本身即持有者限制），數值需有限。
  for(const key of ['nonTrueDamageDealtMultiplier','nonTrueDamageTakenMultiplier'] as const)
    if(p[key]!==undefined&&(!Number.isFinite(p[key])||p[key]<=0||p[key]>1000))return '印記非真實傷害倍率需為有限正數';
  if(p.guaranteedMaxHpDamageChance!==undefined&&(!Number.isFinite(p.guaranteedMaxHpDamageChance)||p.guaranteedMaxHpDamageChance<0||p.guaranteedMaxHpDamageChance>1))return '印記保底傷害機率需0至1';
  if(p.guaranteedMaxHpDamageChancePerStack!==undefined&&(!Number.isFinite(p.guaranteedMaxHpDamageChancePerStack)||p.guaranteedMaxHpDamageChancePerStack<0))return '印記每層保底機率需非負有限數';
  if(p.holderInvalid!==undefined&&!['屬性','攻擊','all'].includes(p.holderInvalid))return '印記持有者技能無效需為屬性／攻擊／all';
  if(p.countFromMark!==undefined&&(!p.countFromMark||Object.keys(p.countFromMark).some(k=>!['side','id'].includes(k))||!['self','opp'].includes(p.countFromMark.side)||typeof p.countFromMark.id!=='string'||!p.countFromMark.id||p.countFromMark.id.length>200))return '印記數量來源需明確持有者與資源識別碼';
  if(p.turnsFromCount!==undefined&&(typeof p.turnsFromCount!=='boolean'||!p.countFromMark||p.turns!==undefined))return '依數量定期限需資源來源且不能重複指定期限';
  if(p.priorityBonus!==undefined&&(!Number.isInteger(p.priorityBonus)||!p.priorityBonus||Math.abs(p.priorityBonus)>6))return '印記先制需非零-6至6整數';
  if(p.vsOpponentName!==undefined&&(typeof p.vsOpponentName!=='string'||!p.vsOpponentName||p.vsOpponentName.length>200||p.priorityBonus===undefined))return '對手名稱條件需有限文字及先制讀取效果';
  const hasEngineEffect=p.priorityBonus!==undefined||p.holderInvalid!==undefined||p.nonTrueDamageDealtMultiplier!==undefined||p.nonTrueDamageTakenMultiplier!==undefined||p.guaranteedMaxHpDamageChance!==undefined;
  if(!Array.isArray(p.rules)||p.rules.length>30||(!p.rules.length&&p.recoveryReduction===undefined&&p.incomingDamageReduction===undefined&&!hasEngineEffect))return '印記需明確規則陣列；空陣列時需已接通的持有者限制';
  for(const rule of p.rules)if(!MARK_PROGRAM_TRIGGERS.has(rule?.trig))return '印記規則缺少已接通的持有者節點';
  return null;
}
/** 不從原精靈名字查詢，不共享外部可變圖紙；附加成功後持有者自帶完整程式。 */
export function applyMarkProgram(ctx:BattleEventContext,p:any,holder:any):boolean {
  if(p.countFromMark){
    const count=Math.min(p.maxCount,Math.floor(readMarkStacks(ctx,p.countFromMark)*p.count));
    if(!(count>0))return false;
    p={...p,count};
  }
  const side=p.side==='self'?ctx.actor:ctx.targetSide;
  const ownerBattleId=p.scope==='elf'?String(holder.battleId||holder.id):undefined;
  const previous=ctx.getMarks(side).find(m=>m.id===p.id&&m.ownerBattleId===ownerBattleId);
  const previousCount=p.turnsFromCount?(previous?.remainingRounds??previous?.count??0):(previous?.count||0);
  const count=Math.min(p.maxCount,p.mode==='add'?previousCount+p.count:p.count);
  const turns=p.turnsFromCount?count:p.turns;
  const mark:Omit<Mark,'source'>={
    id:p.id,name:p.name,displayChar:p.displayChar,description:p.description,
    count,maxCount:p.maxCount,unit:p.unit,scope:p.scope,ownerBattleId,
    persistsOffField:p.persistsOffField,clearable:false,remainingRounds:turns,
    effects:{blockProgram:structuredClone(p.rules) as Clause[],...(p.holderInvalid!==undefined?{blkInvalid:p.holderInvalid}:{}),...(turns!==undefined?{blkTurns:turns}:{}),
      ...(p.priorityBonus!==undefined?{priorityBonus:p.priorityBonus,...(p.vsOpponentName?{vsOpponentName:p.vsOpponentName}:{})}:{}),
      ...(p.recoveryReduction!==undefined?{recoveryReduction:structuredClone(p.recoveryReduction)}:{}),
      ...(p.incomingDamageReduction!==undefined?{incomingDamageReduction:structuredClone(p.incomingDamageReduction)}:{}),
      ...(p.nonTrueDamageDealtMultiplier!==undefined?{nonTrueDamageDealtMultiplier:p.nonTrueDamageDealtMultiplier}:{}),
      ...(p.nonTrueDamageTakenMultiplier!==undefined?{nonTrueDamageTakenMultiplier:p.nonTrueDamageTakenMultiplier}:{}),
      ...(p.guaranteedMaxHpDamageChance!==undefined?{guaranteedMaxHpDamageChance:p.guaranteedMaxHpDamageChance+(p.guaranteedMaxHpDamageChancePerStack||0)*(count-1)}:{})},
  };
  ctx.setMark(mark,side);return true;
}

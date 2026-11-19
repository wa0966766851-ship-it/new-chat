// 戰鬥藥劑通用 op（legacyWrapped 拆解；DSH 20261017）。
// 「偷取對手藥劑並立即使用」：消耗對手庫存中指定藥劑，效果歸自身；
// 未配置正式庫存時不可憑空偷取（與 ctx.useBattleItem 的防護一致）。
//
// 2026-11-07 新增（藥劑反噬與行動限制，使用者規格）：
// - potion_backlash：施加「藥劑反噬」N 回合——期間該方藥劑效果全部反轉（見 battle/itemInventory.applyBattleItem）。
// - potion_backlash_damage：藥劑反噬傷害（只能由藥劑附加；無視傷害減免與限制，綠字黃框負數）。供藥劑定義使用。
// - item_lock：無法使用藥劑 N 回合（個體或全隊）。
// - switch_lock_scoped：無法主動切換 N 回合（個體＝在場那一隻；全隊＝換誰都一樣）。
// - potion_regen：持續恢復一次（在場／不在場／額外精靈的體力或 PP；inverted＝藥劑反噬版本）。持續恢復藥劑的回合計時器以它為每回合內容。
import type { BattleEventContext } from '../../effects/types';
import type { RunState } from '../runtime';
import { tickPotionRegen, regenParamIssue } from '../../battle/potionRegen';
import {StatusRegistry} from '../../effects/statusRegistry';
import {changePp,identity} from '../../effects/newElfOperations';
import {getMaxPp} from '../../utils/battleHelpers';
import {isNonTrueDamageType,isSkillDamageType} from '../../battle/damageSemantics';
import {queueHpDrain} from '../../battle/hpDrain';
// addBlockTimer 由 runtime 注入（避免 runtime ↔ 契約 的循環載入）。
type AddBlockTimer = (ctx: BattleEventContext, side: 'p1' | 'p2', name: string, n: number, mode: 'turns' | 'uses', payload: Record<string, any>, pendingActivation?: boolean, kind?: 'turn_effect' | 'round_counter', benefitThisTurn?: boolean, scope?: 'elf' | 'team',timerId?:string) => void;

/** 契約欄位（登記於 sequenceContract.SEQUENCE_ACTION_FIELDS）。 */
export const ITEM_USE_ACTION_FIELDS: Record<string, readonly string[]> = {
  use_stolen_item: ['itemId'],
  grant_item: ['side', 'itemId', 'count', 'snapshotStats'],
  convert_item: ['side', 'fromId', 'ids'],
  use_items_in_order:['side','ids'],
  potion_penalty:['amount','pp','opponentId','mult','restoreRatio'],
  damage_parity_next:['evenBoost','oddMultiplier'],
  opponent_drain:['ratio'],
  item_source_panel_scale: ['side','itemId','stats','ratio'],
  item_snapshot_drains:['itemId','stat','ratio','type','status','perTurn'],
  potion_backlash: ['side', 'turns', 'next', 'scope'],
  potion_backlash_damage: ['side', 'amount', 'maxHpRatio'],
  item_lock: ['side', 'turns', 'next', 'scope'],
  switch_lock_scoped: ['side', 'turns', 'next', 'scope'],
  potion_regen: ['targets', 'hp', 'hpPercent', 'pp', 'ppPercent', 'inverted', 'label'],
};
export const ITEM_USE_CONDITION_FIELDS: Record<string, readonly string[]> = { held_item: ['side','itemId','neg'] };
export function itemUseConditionIssue(c: any): string | null {
  if (c.c !== 'held_item') return null;
  return !sideOk(c.p?.side) || typeof c.p?.itemId !== 'string' || !c.p.itemId || c.p.itemId.length > 100 || (c.p.neg !== undefined && typeof c.p.neg !== 'boolean') ? '道具持有查詢需明確陣營、物品識別碼與布林反向旗標' : null;
}
export function itemUseCondition(ctx: BattleEventContext, c: any): boolean | undefined {
  if (c.c !== 'held_item') return undefined;
  // 無正式庫存讀取管道時，不把「未知」冒充「未持有」。
  if (!ctx.getBattleItem) return false;
  const held = (ctx.getBattleItem(c.p.side === 'self' ? ctx.actor : ctx.targetSide, c.p.itemId)?.left || 0) > 0;
  return c.p.neg ? !held : held;
}

const sideOk = (s: unknown) => s === 'self' || s === 'opp';
const scopeOk = (s: unknown) => s === undefined || s === 'elf' || s === 'team';
const turnsOk = (n: unknown) => Number.isSafeInteger(n) && (n as number) >= 1 && (n as number) <= 1000;

/** 契約補充檢查；回傳 null 代表通過。 */
export function itemUseActionIssue(op: string, p: any, trig?:string): string | null {
  if(op==='opponent_drain')return trig==='opp_after_skill'&&Number.isFinite(p.ratio)&&p.ratio>0&&p.ratio<=1?null:'對手吸取需對手使用後及正最大體力比例';
  if(op==='use_items_in_order')return sideOk(p.side)&&Array.isArray(p.ids)&&p.ids.length>0&&p.ids.length<=30&&new Set(p.ids).size===p.ids.length&&p.ids.every((id:unknown)=>typeof id==='string'&&id.length>0&&id.length<=100)?null:'依序使用需明確陣營及有限不重複道具';
  if(op==='potion_penalty')return Number.isFinite(p.amount)&&p.amount>0&&Number.isFinite(p.pp)&&p.pp>0&&typeof p.opponentId==='string'&&p.opponentId.length>0&&p.opponentId.length<=100&&Number.isFinite(p.mult)&&p.mult>=1&&p.mult<=10&&(p.restoreRatio===undefined||Number.isFinite(p.restoreRatio)&&p.restoreRatio>0&&p.restoreRatio<=10)?null:'藥劑代價需體力、PP、對手物種與倍率';
  if(op==='damage_parity_next')return trig==='opp_damage_settled'&&Number.isFinite(p.evenBoost)&&p.evenBoost>=0&&p.evenBoost<=100&&Number.isFinite(p.oddMultiplier)&&p.oddMultiplier>0&&p.oddMultiplier<=1?null:'傷害奇偶監控需正式傷害結算及有限倍率';
  if (op === 'convert_item') return sideOk(p.side) && typeof p.fromId === 'string' && p.fromId.length > 0 && p.fromId.length <= 100 &&
    Array.isArray(p.ids) && p.ids.length > 0 && p.ids.length <= 30 && new Set(p.ids).size === p.ids.length &&
    p.ids.every((id: unknown) => typeof id === 'string' && id.length > 0 && id.length <= 100 && id !== p.fromId)
    ? null : '道具轉化需明確陣營、來源及有限且不重複的依序形態';
  if(op==='item_snapshot_drains'){
    if(trig!==undefined&&!['damaged','damaged_skill','damaged_attack','damaged_nontrue','damaged_true','damaged_fixed','damaged_percent'].includes(trig))return '道具紀錄逐次汲取必須接正式受傷後事件';
    if(typeof p.itemId!=='string'||!p.itemId||p.itemId.length>100||!['hp','atk','def','spatk','spdef','speed'].includes(p.stat)||!Number.isFinite(p.ratio)||p.ratio<=0||p.ratio>1||!['fixed','percent','true'].includes(p.type)||!StatusRegistry[p.status]||!Number.isSafeInteger(p.perTurn)||p.perTurn<0||p.perTurn>1000)return '道具紀錄逐次汲取需物品、能力比例、明確傷害種類與異常回合次數';
    return null;
  }
  if(op==='item_source_panel_scale'){
    if(!sideOk(p.side)||typeof p.itemId!=='string'||!p.itemId||p.itemId.length>100||!Array.isArray(p.stats)||!p.stats.length||new Set(p.stats).size!==p.stats.length||p.stats.some((k:string)=>!['hp','atk','def','spatk','spdef','speed'].includes(k))||!Number.isFinite(p.ratio)||p.ratio<=0||p.ratio>10)return '道具來源同種族面板調整需明確陣營、道具、能力與正比例';
    return null;
  }
  if (op === 'grant_item') {
    if (!sideOk(p.side) || typeof p.itemId !== 'string' || !p.itemId || p.itemId.length > 100 || !Number.isSafeInteger(p.count) || p.count < 1 || p.count > 1000) return '加入道具需明確陣營、物品識別碼與正整數數量';
    if (p.snapshotStats !== undefined && typeof p.snapshotStats !== 'boolean') return '加入時紀錄能力必須為是／否';
    return null;
  }
  if (op === 'use_stolen_item') {
    if (typeof p.itemId !== 'string' || !p.itemId || p.itemId.length > 100) return '偷取藥劑需明確物品識別碼';
    return null;
  }
  if (op === 'potion_backlash' || op === 'item_lock' || op === 'switch_lock_scoped') {
    if (!sideOk(p.side)) return '需明確持有者（自身／對手）';
    if (!turnsOk(p.turns)) return '需正整數回合數（1–1000）';
    if (!scopeOk(p.scope)) return '作用域只能是個體或全隊';
    return null;
  }
  if (op === 'potion_regen') return regenParamIssue(p) ?? (p.inverted !== undefined && typeof p.inverted !== 'boolean' ? '反轉旗標需為是／否' : null);
  if (op === 'potion_backlash_damage') {
    if (!sideOk(p.side)) return '需明確目標（自身／對手）';
    const amount = p.amount === undefined ? 0 : p.amount, ratio = p.maxHpRatio === undefined ? 0 : p.maxHpRatio;
    if (!(Number.isFinite(amount) && amount >= 0 && amount <= 1e9) || !(Number.isFinite(ratio) && ratio >= 0 && ratio <= 1)) return '藥劑反噬傷害數值不合法';
    if (!(amount > 0 || ratio > 0)) return '藥劑反噬傷害需固定值或最大體力比例';
    return null;
  }
  return null;
}

const sideOf = (ctx: BattleEventContext, w: string) => (w === 'self' ? ctx.actor : ctx.targetSide);
const isSkillCtx = (st: RunState) => st.sourceKind ? st.sourceKind === 'skill' : !st.event || st.event.trig === 'use' || st.event.trig === 'after_hit' || st.event.trig === 'on_invalid';
const timedWith = (addBlockTimer: AddBlockTimer) => (ctx: BattleEventContext, p: any, st: RunState, name: string, payload: Record<string, any>) => {
  addBlockTimer(ctx, sideOf(ctx, p.side), name, p.turns, 'turns', payload, !!p.next, isSkillCtx(st) ? 'turn_effect' : 'round_counter', !p.next, p.scope === 'team' ? 'team' : 'elf');
  return true;
};

/** 執行端（併入 runtime 的 OPS）。 */
export function itemUseOperations(deps: { addBlockTimer?: AddBlockTimer } = {}) {
  const timed = timedWith(deps.addBlockTimer || (() => { throw new Error('itemUseOperations 需要 runtime 注入 addBlockTimer'); }));
  return {
    opponent_drain:(ctx:BattleEventContext,p:any):boolean=>{
      if(ctx.getPlayerState('opponentSkillUsedRound')!==ctx.roundNumber)return false;
      const field=ctx.actor==='p1'?ctx.activeP1:ctx.activeP2,opponent=ctx.targetSide==='p1'?ctx.activeP1:ctx.activeP2;
      const own=ctx.contextForElf?.(ctx.targetSide,opponent);if(!own)return false;
      return queueHpDrain(own,ctx.actor,Math.floor(field.maxHp*p.ratio),'fixed','持有道具被對手吸取')>0;
    },
    use_items_in_order:(ctx:BattleEventContext,p:any):boolean=>{
      const side=sideOf(ctx,p.side);let used=false;
      for(const id of p.ids)if((ctx.getBattleItem?.(side,id)?.left||0)>0)used=ctx.useBattleItem?.(side,id,side)===true||used;
      return used;
    },
    potion_penalty:(ctx:BattleEventContext,p:any):boolean=>{
      const active=ctx.actor==='p1'?ctx.activeP1:ctx.activeP2;
      const opponent=ctx.targetSide==='p1'?ctx.activeP1:ctx.activeP2;
      const isTarget=opponent.id===p.opponentId,mult=isTarget?p.mult:1,pp=p.pp*mult,amount=Math.floor(p.amount*mult);
      ctx.applyPotionBacklashDamage?.(ctx.actor,amount,'特殊藥劑代價');
      // 對方在場為指定精靈：其恢復代價體力／PP 的 restoreRatio 倍（存活即可）
      if(isTarget&&p.restoreRatio>0){
        const heal=Math.floor(amount*p.restoreRatio);
        if(heal>0)ctx.applyHealToElf?ctx.applyHealToElf(ctx.targetSide,identity(opponent),heal,{}):ctx.applyHeal(ctx.targetSide,heal);
        changePp(ctx,ctx.targetSide,opponent,s=>Math.min(getMaxPp(s,opponent),s.pp+Math.floor(pp*p.restoreRatio)),true);
      }
      const elf=ctx.getFullTeam(ctx.actor).find(e=>identity(e)===identity(active))||active;
      changePp(ctx,ctx.actor,elf,s=>Math.max(0,s.pp-pp));
      const now=ctx.getFullTeam(ctx.actor).find(e=>identity(e)===identity(elf))||elf;
      ctx.updateElf(ctx.actor,{skills:now.skills.map(s=>{
        const max=Math.max(0,getMaxPp(s,now)-pp);
        return {...s,ppMaxOffset:(s.ppMaxOffset||0)-pp,pp:Math.min(s.pp,max),currentPp:Math.min(s.pp,max)};
      })});return true;
    },
    damage_parity_next:(ctx:BattleEventContext,p:any,st:RunState):boolean=>{
      const data=st.event?.data?.effectEventData||st.event?.data;
      if(data?.sourceSide!==ctx.actor||!isNonTrueDamageType(data.damageType))return false;
      const amount=data.receipt?.settledAmount??data.amount;if(!(amount>0))return false;
      const kind=isSkillDamageType(data.damageType)?'技能':data.damageType==='fixed'?'固定':'百分比';
      const block=amount%2===0?{dmgIn:p.evenBoost,kind}:{dmgOutMult:p.oddMultiplier,kind};
      if(!deps.addBlockTimer)return false;
      deps.addBlockTimer(ctx,ctx.actor,'傷害奇偶下回合效果',1,'turns',block,true,'round_counter',false,'team',`damageParity:${ctx.actor}:${(ctx.roundNumber||0)+1}:${kind}:${amount%2}`);return true;
    },
    convert_item: (ctx: BattleEventContext, p: any): boolean => ctx.convertBattleItem?.(sideOf(ctx, p.side), p.fromId, p.ids) === true,
    item_snapshot_drains:(ctx:BattleEventContext,p:any,st:RunState):boolean=>{
      const data=st.event?.data?.effectEventData||st.event?.data;
      // 反應傷害不再引發下一層受傷反應（與正式反彈管道一致）。
      if(data?.reaction)return false;
      if(!((data?.receipt?.settledAmount??data?.amount)>0))return false;
      const held=ctx.getBattleItem?.(ctx.actor,p.itemId);
      if(!held?.left||!held.snapshot)return false;
      const amount=Math.floor(held.snapshot.stats[p.stat as keyof typeof held.snapshot.stats]*p.ratio);
      if(!(amount>0))return false;
      // 受擊者可能在場下；回合份數取受擊者，汲取與恢復都由真正的在場隊友執行。
      const field=ctx.actor==='p1'?ctx.activeP1:ctx.activeP2;
      const opponent=ctx.targetSide==='p1'?ctx.activeP1:ctx.activeP2;
      const own=ctx.contextForElf?.(ctx.actor,field);
      if(!own?.applyDamageToElf)return false;
      const n=Math.max(0,Number(ctx.getStatuses(ctx.self)?.[p.status])||0);
      st.lastAmount=0;
      for(let i=0;i<1+n*p.perTurn;i++){
        const settled=own.applyDamageToElf(ctx.targetSide,opponent.battleId||opponent.id,amount,p.type,{reaction:true,label:'道具紀錄逐次汲取'});
        if(settled>0){own.applyHeal(ctx.actor,settled);st.lastAmount+=settled;}
      }
      return st.lastAmount>0;
    },
    item_source_panel_scale:(ctx:BattleEventContext,p:any):boolean=>{
      const side=p.side==='self'?ctx.actor:ctx.targetSide;
      const held=ctx.getBattleItem?.(side,p.itemId);
      if(!held?.left||!held.snapshot||!ctx.updateAnyElf)return false;
      const team=ctx.getFullTeam(side),source=team.find(e=>(e.battleId||e.id)===held.snapshot!.sourceBattleId);
      const species=held.snapshot.sourceElfId||source?.id;if(!species)return false;
      let changed=false;
      for(const elf of team){
        if(elf.id!==species||elf.isVanished)continue;
        const stats={...elf.calculatedStats,hp:elf.maxHp};
        for(const k of p.stats as ('hp'|'atk'|'def'|'spatk'|'spdef'|'speed')[])stats[k]=Math.floor(stats[k]*p.ratio);
        ctx.updateAnyElf(side,elf.battleId||elf.id,{calculatedStats:stats,...(p.stats.includes('hp')?{maxHp:stats.hp,currentHp:Math.min(elf.currentHp,stats.hp)}:{})});changed=true;
      }
      return changed;
    },
    grant_item: (ctx: BattleEventContext, p: any): boolean => {
      // 來源可能在板凳，不能拿在場隊友的面板冒充來源能力。
      const self = ctx.getFullTeam(ctx.actor).find(e => (e.battleId || e.id) === (ctx.self.battleId || ctx.self.id)) || ctx.self;
      const snapshot = p.snapshotStats ? { sourceBattleId: self.battleId || self.id, sourceElfId:self.id, stats: { ...self.calculatedStats, hp: self.maxHp } } : undefined;
      return ctx.grantBattleItem?.(sideOf(ctx, p.side), p.itemId, p.count, snapshot) === true;
    },
    use_stolen_item: (ctx: BattleEventContext, p: any, _st: RunState): boolean => {
      if (typeof ctx.useBattleItem !== 'function') return false;
      // 偷取＝庫存在對手、受益者為自身；與舊專屬程式 useBattleItem(targetSide, itemId, actor) 同一管道。
      const ok = ctx.useBattleItem(ctx.targetSide, p.itemId, ctx.actor);
      if (!ok) ctx.addLog?.('藥劑已用盡或目前無法偷取。', 'effect');
      return ok === true;
    },
    potion_backlash: (ctx: BattleEventContext, p: any, st: RunState): boolean => {
      timed(ctx, p, st, '藥劑反噬', { potionBacklash: true });
      ctx.addLog?.(`🧪 ${p.side === 'self' ? '自身' : '對手'}${p.scope === 'team' ? '全隊' : ''}${p.next ? '下' : ''}${p.turns}回合進入藥劑反噬！`, 'effect');
      return true;
    },
    item_lock: (ctx: BattleEventContext, p: any, st: RunState): boolean => {
      timed(ctx, p, st, '無法使用藥劑', { noItem: true });
      ctx.addLog?.(`🚫 ${p.side === 'self' ? '自身' : '對手'}${p.scope === 'team' ? '全隊' : ''}${p.next ? '下' : ''}${p.turns}回合無法使用藥劑！`, 'effect');
      return true;
    },
    switch_lock_scoped: (ctx: BattleEventContext, p: any, st: RunState): boolean => {
      timed(ctx, p, st, p.scope === 'team' ? '全隊無法主動切換' : '無法主動切換', { lockSwitch: true });
      ctx.addLog?.(`⛓️ ${p.side === 'self' ? '自身' : '對手'}${p.scope === 'team' ? '全隊' : ''}${p.next ? '下' : ''}${p.turns}回合無法主動切換精靈！`, 'effect');
      return true;
    },
    potion_regen: (ctx: BattleEventContext, p: any, _st: RunState): boolean => tickPotionRegen(ctx, ctx.actor, p),
    potion_backlash_damage: (ctx: BattleEventContext, p: any, _st: RunState): boolean => {
      const side = sideOf(ctx, p.side);
      const target = side === 'p1' ? ctx.activeP1 : ctx.activeP2;
      const amount = Math.floor((p.amount || 0) + (p.maxHpRatio ? (target?.maxHp || 0) * p.maxHpRatio : 0));
      if (!(amount > 0) || typeof ctx.applyPotionBacklashDamage !== 'function') return false;
      ctx.applyPotionBacklashDamage(side, amount, '藥劑反噬傷害');
      return true;
    },
  };
}

import { drainMultiplierOf } from '../../battle/hpDrain';
import type {BattleEventContext} from '../../effects/types';
import type {RunState} from '../runtime';
import {changePp} from '../../effects/newElfOperations';
import {getMaxPp} from '../../utils/battleHelpers';
import {checkElfDead} from '../../battle/elfAlive';
import {isSkillDamageType} from '../../battle/damageSemantics';

/** 通用結算鏈：逐份吸取、實際回血延後傷害、按實際損失逐槽轉移PP。 */
export const SETTLEMENT_CHAIN_FIELDS:Record<string,readonly string[]>={
  priority_exponential_damage:['boost'],
  drain_checked_then:['type','flat','ratio','extraRatio','extraBelowHpRatio','threshold','measure','belowBody','afterBody','basis','floor','belowOnFloor'],
  damage_steps_drain:['step','ratio','thresholdSide','belowRatio','belowBody','smallBody'],
  heal_defer_damage:['ratio'],
  pp_drain_slots:['amount'],
  heal_mark_source:['ratio','activeOnly'],
};
export function settlementChainIssue(op:string,p:any,trig:string,nested:(body:any[],trig:string)=>string|null):string|null{
  if(op==='priority_exponential_damage'&&(trig!=='outgoing_skill'||!Number.isFinite(p.boost)||p.boost<0))return '先制絕對值指數增傷需技能傷害節點及有限非負增幅';
  if(op==='drain_checked_then'){
    if(!['固定','百分比','真實'].includes(p.type)||!['lost','healed','either'].includes(p.measure)||!Number.isFinite(p.threshold)||p.threshold<0)return '吸取結算需明確傷害類型、檢查項目及非負門檻';
    if((p.extraRatio!==undefined||p.extraBelowHpRatio!==undefined)&&(!(p.extraRatio>0&&p.extraRatio<=1)||!(p.extraBelowHpRatio>0&&p.extraBelowHpRatio<=1)||p.ratio===undefined))return '額外吸取需最大體力比例與吸取前體力門檻';
    if(p.basis!==undefined&&(p.basis!=='skill_damage'||!(p.ratio>0&&p.ratio<=10)||p.flat!==undefined))return '技能傷害比例吸取需正比例且不與點數併用';
    if(p.floor!==undefined&&(!Number.isFinite(p.floor)||p.floor<0))return '最低吸取需非負點數';
    if(p.belowOnFloor!==undefined&&typeof p.belowOnFloor!=='boolean')return '觸發最低吸取的後續需布林值';
    if((p.flat!==undefined)===(p.ratio!==undefined)||p.flat!==undefined&&(!Number.isFinite(p.flat)||p.flat<=0)||p.ratio!==undefined&&(!Number.isFinite(p.ratio)||p.ratio<=0))return '吸取量需點數或最大體力比例擇一';
    if(!Array.isArray(p.belowBody)||!p.belowBody.length&&!p.afterBody?.length)return '吸取需結果後續流程';
    for(const body of [p.belowBody,p.afterBody])if(body!==undefined){if(!Array.isArray(body))return '吸取後續需動作列表';if(body.length){const issue=nested(body,trig);if(issue)return issue;}}
  }
  if(op==='damage_steps_drain'){
    if(!['opp_damaged_skill','damaged_skill'].includes(trig)||!(p.step>=.01&&p.step<=1)||!(p.ratio>0&&p.ratio<=1)||!['self','opp'].includes(p.thresholdSide))return '逐份吸取需正式技能受傷事件、1%至100%步長、正吸取比例及門檻持有者';
    if(p.belowRatio!==undefined&&!(p.belowRatio>0&&p.belowRatio<=1))return '吸取結果比較需0至100%比例';
    for(const key of ['belowBody','smallBody'])if(p[key]!==undefined){if(!Array.isArray(p[key]))return '結算分支需動作列表';const issue=nested(p[key],trig);if(issue)return issue;}
  }
  if(op==='heal_defer_damage'&&(!['opp_skill','opp_used_skill','opp_used_attack','opp_attack'].includes(trig)||!(p.ratio>0&&p.ratio<=1)))return '延後等量傷害需對手使用技能事件及0至100%回血比例';
  if(op==='pp_drain_slots'&&(!Number.isInteger(p.amount)||p.amount<1||p.amount>100))return '逐槽吸取PP需1至100整數點';
  if(op==='heal_mark_source'&&(!['damaged','damaged_skill','damaged_attack','damaged_true','damaged_fixed','damaged_percent','damaged_nontrue'].includes(trig)||!Number.isFinite(p.ratio)||!(p.ratio>0&&p.ratio<=100)||typeof p.activeOnly!=='boolean'))return '印記來源回血需正式受傷事件、有限正比例及明確在場限制';
  return null;
}
const identity=(e:any)=>String(e.battleId||e.id);
const live=(ctx:BattleEventContext,side:'p1'|'p2',base:any)=>ctx.getFullTeam(side).find(e=>identity(e)===identity(base))||base;
export function damageStepCount(damage:number,maxHp:number,step:number):number{
  if(!Number.isFinite(damage)||!Number.isFinite(maxHp)||!(damage>=0&&maxHp>0&&step>0))return 0;
  const steps=damage/(maxHp*step);
  return Math.floor(steps+Number.EPSILON*Math.max(1,steps)*4);
}
type Dependencies={runStmts:(ctx:BattleEventContext,body:any[],st:RunState)=>void;addTimer:(ctx:BattleEventContext,amount:number)=>void};
export function settlementChainOperations(deps:Dependencies){return {
  priority_exponential_damage:(ctx:BattleEventContext,p:any,st:RunState)=>{
    const comp=(ctx as any).effectEventData?.damageComp||st.event?.data?.damageComp;
    if(!comp||comp.pure||comp.isIncoming||!isSkillDamageType(comp.damageCategory))return false;
    const mine=Number(ctx.getPlayerState('actionPriorityThisTurn')),enemy=Number(ctx.getOpponentState('actionPriorityThisTurn'));
    if(!Number.isFinite(mine)||!Number.isFinite(enemy))return false;
    const multiplier=1+p.boost*2**(Math.abs(mine)+Math.abs(enemy));
    if(!Number.isFinite(multiplier))throw Error('先制指數增傷超出可表示範圍');
    comp.multiplier*=multiplier;return true;
  },
  drain_checked_then:(ctx:BattleEventContext,p:any,st:RunState)=>{
    const self=live(ctx,ctx.actor,ctx.self),opp=live(ctx,ctx.targetSide,ctx.target);
    // basis skill_damage：本次行動造成的技能傷害×ratio（「吸取對手受到技能傷害值N%」）；floor＝最低吸取量。
    const record=ctx.getPlayerState('skillDamageDealtThisAction');
    const rawAmount=p.basis==='skill_damage'?Math.floor((record?.actionId===ctx.actionId?Number(record.amount)||0:0)*p.ratio):Math.floor(p.flat??opp.maxHp*p.ratio);
    const floorUsed=Number.isFinite(p.floor)&&rawAmount<p.floor;
    const amount=Math.floor(Math.max(rawAmount,p.floor||0)*drainMultiplierOf(ctx)),selfId=identity(self),targetId=identity(opp);
    const amounts=[amount];
    if(p.extraRatio&&self.currentHp<self.maxHp*p.extraBelowHpRatio)amounts.push(Math.floor(opp.maxHp*p.extraRatio));
    let finished=false,remaining=amounts.length,totalLost=0,totalHealed=0;
    const finish=(lost:number,healed:number)=>{
      if(finished)return;
      totalLost+=lost;totalHealed+=healed;
      if(--remaining>0)return;
      finished=true;lost=totalLost;healed=totalHealed;
      if(p.afterBody?.length)deps.runStmts(ctx,p.afterBody,{sourceKind:st.sourceKind,event:st.event,last:lost>0,lastAmount:lost,lastDealt:lost});
      if(p.belowBody?.length&&((p.belowOnFloor&&floorUsed)||(p.measure!=='healed'&&lost<p.threshold)||(p.measure!=='lost'&&healed<p.threshold)))
        deps.runStmts(ctx,p.belowBody,{sourceKind:st.sourceKind,event:st.event,last:lost>0,lastAmount:lost,lastDealt:lost});
    };
    const onSettled=(damage:any)=>{
      if(damage.targetBattleId!==targetId)return;
      const current=live(ctx,ctx.actor,self);
      if(!(damage.settledAmount>0)||checkElfDead(current)){finish(damage.hpLost,0);return;}
      const options={onSettled:(heal:any)=>{if(heal.targetBattleId===selfId)finish(damage.hpLost,heal.hpGained);}};
      if(ctx.applyHealToElf)ctx.applyHealToElf(ctx.actor,selfId,damage.settledAmount,options);
      else ctx.applyHeal(ctx.actor,damage.settledAmount,options);
    };
    // 各份仍各自結算護罩／限制；分支只檢查整次吸取的實際回血總量。
    for(const part of amounts){
      if(p.type==='真實')ctx.applyTrueDamage(ctx.targetSide,part,'吸取',undefined,undefined,{onSettled});
      else ctx.applyPinkDamage(ctx.targetSide,part,'吸取',undefined,undefined,p.type==='固定'?'fixed':'percent',{onSettled});
    }
    return true;
  },
  heal_mark_source:(ctx:BattleEventContext,p:any,st:RunState)=>{
    if(!st.holderMark||!ctx.applyHealToElf)return false;
    const mark=ctx.getMarks(ctx.actor).find(m=>m.id===st.holderMark!.id&&(m.ownerBattleId||null)===(st.holderMark!.ownerBattleId||null));
    const source=mark?.effects?.blockSource;
    if(!source||!['p1','p2'].includes(source.side)||typeof source.battleId!=='string')return false;
    const elf=ctx.getFullTeam(source.side).find(e=>identity(e)===source.battleId);
    if(!elf||checkElfDead(elf)||elf.isVanished)return false;
    const active=source.side==='p1'?ctx.activeP1:ctx.activeP2;
    if(p.activeOnly&&(!active||identity(active)!==source.battleId))return false;
    // 正式事件記錄的實際結算量；不以傷害公式原值或滿血差反推。
    const data=st.event?.data||{},damage=Number(data.settledDamage??data.damageDealt??data.damage??data.amount??0);
    if(!Number.isFinite(damage)||damage<=0)return false;
    const amount=Math.floor(damage*p.ratio);
    if(amount<=0)return false;
    ctx.applyHealToElf(source.side,source.battleId,amount);
    return true;
  },
  damage_steps_drain:(ctx:BattleEventContext,p:any,st:RunState)=>{
    const data=(ctx as any).effectEventData||st.event?.data||{};
    // 對手受傷通知也可能來自他人／自損；只有持有者造成的技能傷害可觸發。
    if(st.event?.trig==='opp_damaged_skill'&&(data.sourceSide!==ctx.actor||(data.sourceBattleId&&String(data.sourceBattleId)!==identity(ctx.self))))return false;
    const self=live(ctx,ctx.actor,ctx.self),opp=live(ctx,ctx.targetSide,ctx.target);
    const damage=Number(data.settledDamage??data.damageDealt??data.damage??0);
    const count=damageStepCount(damage,p.thresholdSide==='self'?self.maxHp:opp.maxHp,p.step);
    if(!count){if(p.smallBody)deps.runStmts(ctx,p.smallBody,st);return false;}
    const amount=Math.floor(opp.maxHp*p.ratio),sourceId=identity(self),targetId=identity(opp),comparisonMax=opp.maxHp;
    let remaining=count,totalDamage=0,totalHeal=0;
    const done=()=>{if(--remaining===0&&p.belowBody&&totalDamage+totalHeal<comparisonMax*p.belowRatio)deps.runStmts(ctx,p.belowBody,st);};
    // 每份獨立進傷害結算，不能合併而繞過每次傷害限制／護罩。
    for(let i=0;i<count;i++)ctx.applyPinkDamage(ctx.targetSide,amount,undefined,undefined,undefined,'percent',{onSettled:receipt=>{
      if(receipt.targetBattleId!==targetId){done();return;}
      totalDamage+=receipt.settledAmount;
      const options={onSettled:(heal:any)=>{totalHeal+=heal.hpGained;done();}};
      if(ctx.applyHealToElf)ctx.applyHealToElf(ctx.actor,sourceId,receipt.settledAmount,options);
      else ctx.applyHeal(ctx.actor,receipt.settledAmount,options);
    }});
    return true;
  },
  heal_defer_damage:(ctx:BattleEventContext,p:any)=>{
    const elf=live(ctx,ctx.actor,ctx.self),sourceId=identity(elf);
    const options={onSettled:(receipt:any)=>{if(receipt.targetBattleId===sourceId&&receipt.hpGained>0)deps.addTimer(ctx,receipt.hpGained);}};
    if(ctx.applyHealToElf)ctx.applyHealToElf(ctx.actor,sourceId,Math.floor(elf.maxHp*p.ratio),options);
    else ctx.applyHeal(ctx.actor,Math.floor(elf.maxHp*p.ratio),options);
    return true;
  },
  pp_drain_slots:(ctx:BattleEventContext,p:any,st:RunState)=>{
    const opponent=live(ctx,ctx.targetSide,ctx.target),before=opponent.skills.map(s=>s.pp);
    changePp(ctx,ctx.targetSide,opponent,s=>Math.max(0,s.pp-p.amount),false,'drain');
    const after=live(ctx,ctx.targetSide,opponent),removed=before.map((pp,i)=>Math.max(0,pp-(after.skills[i]?.pp??pp)));
    const self=live(ctx,ctx.actor,ctx.self);
    changePp(ctx,ctx.actor,self,(s,i)=>Math.min(getMaxPp(s,self),s.pp+(removed[i]||0)),true,'restore');
    st.lastAmount=removed.reduce((sum,n)=>sum+n,0);return st.lastAmount>0;
  },
};}

/** 只查目前在場持有者的已啟用無效效果。 */
export function hasSkillInvalidEffect(ctx:BattleEventContext,side:'self'|'opp'|'both'='both'):boolean{
 const sides=side==='both'?[ctx.actor,ctx.targetSide]:[side==='self'?ctx.actor:ctx.targetSide];
 return sides.some(s=>{
  const elf=s===ctx.actor?ctx.self:ctx.target;
  const read=s===ctx.actor?ctx.getPlayerState:ctx.getOpponentState;
  if(['allSkillInvalidTurns','attackSkillInvalidTurns','utilitySkillInvalidTurns'].some(k=>Number(read(k))>0))return true;
  const timers=s==='p1'?ctx.p1Timers:ctx.p2Timers;
  return (timers||[]).some(t=>t.remaining>0&&!t.pendingActivation&&(t.scope==='team'||!t.ownerBattleId||String(t.ownerBattleId)===identity(elf))&&!!(t.payload?.invalid||t.payload?.block?.invalid));
 });
}

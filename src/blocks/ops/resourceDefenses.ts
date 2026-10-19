import type {BattleEventContext} from '../../effects/types';
import {EffectTiming} from '../../effects/types';
import type {RunState} from '../runtime';
import {matchesDamageTypes} from '../../effects/damageChoices';
import {addDamageReduction} from '../../battle/damageReduction';
import {markAppliesToElf} from '../../battle/marks';
import {resourceMarkLocked} from '../../effects/resourceMarkLocks';
import {getMaxPp} from '../../utils/battleHelpers';
import {withPp} from '../../battle/ppTransitions';

export const RESOURCE_DEFENSE_FIELDS:Record<string,readonly string[]>={
  stat_drop_guard:[], damage_immunity_now:['types'],
  damage_reduce_first:['id','ratio','types','resources'],
  resource_consume_pending:['id'],resource_resolve_pending:['id','body'],
  resource_pending_reset:['keys'],
  reset_hp_pp_on_clear:[],
};
export function resourceDefenseIssue(op:string,p:any,trig:string,nested:(body:any[])=>string|null):string|null{
  if(op==='damage_reduce_first'&&(!trig.startsWith('incoming')||typeof p.id!=='string'||!p.id||p.id.length>100||!(p.ratio>0&&p.ratio<=1)||!Array.isArray(p.types)||!p.types.length||!p.types.every((v:any)=>['attack','fixed','percent','skill','non_true'].includes(v))||!Array.isArray(p.resources)||!p.resources.length||!p.resources.every((v:any)=>['shield','barrier'].includes(v))))return '首次減傷需受傷前入口、識別碼、比例、傷害分類及必要資源';
  if(op==='stat_drop_guard'&&trig!=='before_stat_change')return '能力下降攔截需能力變化前入口';
  if(op==='reset_hp_pp_on_clear'&&trig!=='pp_cleared')return 'PP被清除重置需真實清除事件';
  if(op==='damage_immunity_now'&&(!trig.startsWith('incoming')||!Array.isArray(p.types)||!p.types.length||!p.types.every((v:any)=>['attack','fixed','percent','skill','non_true'].includes(v))))return '即時傷害免疫需受傷前入口及明確傷害分類';
  if(['resource_consume_pending','resource_resolve_pending'].includes(op)&&(typeof p.id!=='string'||!p.id||p.id.length>100))return '待消耗資源需有限識別碼';
  if(op==='resource_pending_reset'&&(!Array.isArray(p.keys)||!p.keys.length||!p.keys.every((v:any)=>typeof v==='string'&&v&&v.length<=100)))return '待消耗重置需明確資源清單';
  if(op==='resource_resolve_pending'){
    if(trig!=='round_end'||!Array.isArray(p.body)||!p.body.length)return '待消耗結算需回合末及可編輯副作用';
    return nested(p.body);
  }
  return null;
}
const holder=(ctx:BattleEventContext)=>String(ctx.self.battleId||ctx.self.id);
const held=(ctx:BattleEventContext,id:string)=>ctx.getMarks(ctx.actor).find(m=>m.id===id&&m.count>0&&markAppliesToElf(m,ctx.self));
export function resourceDefenseOperations(runStmts:(ctx:BattleEventContext,body:any[],st:RunState)=>void){return {
  damage_reduce_first:(ctx:BattleEventContext,p:any,st:RunState)=>{
    const comp=st.event?.data?.damageComp||(ctx as any).damageComp||st.event?.data;
    if(!comp?.isIncoming||!matchesDamageTypes(p.types,comp.damageCategory)||comp.pure)return false;
    const owner=holder(ctx),key=`firstDamageReduction:${p.id}:${owner}`;
    const current=()=>ctx.getFullTeam(ctx.actor).find(e=>String(e.battleId||e.id)===owner)||ctx.self;
    if(ctx.getPlayerState(key)===ctx.roundNumber||!p.resources.every((r:string)=>Number((current() as any)[r])>0))return false;
    // 終段再檢查，完全被其他免疫擋掉的傷害不搶走首次次數。
    (comp.beforeFinalDamage||=[]).push(()=>{
      if(ctx.getPlayerState(key)===ctx.roundNumber||!(comp.base>0)||!(comp.multiplier>0)||comp.decreasePercent>=1||!p.resources.every((r:string)=>Number((current() as any)[r])>0))return;
      if(addDamageReduction(comp,p.ratio)>0)ctx.setPlayerState(key,ctx.roundNumber);
    });
    return true;
  },
  reset_hp_pp_on_clear:(ctx:BattleEventContext)=>{
    const data=(ctx as any).effectEventData;
    if(data?.reason!=='clear'||!data.emptied?.length)return false;
    // 文義為重置，不能被恢復量降低或禁療變成普通恢復；不遞迴派發一次假清除。
    const current=ctx.getFullTeam(ctx.actor).find(e=>String(e.battleId||e.id)===holder(ctx))||ctx.self;
    ctx.updateAnyElf(ctx.actor,holder(ctx),{currentHp:current.maxHp,skills:current.skills.map(s=>withPp(s,getMaxPp(s,current)))});
    return true;
  },
  stat_drop_guard:(ctx:BattleEventContext,_p:any,st:RunState)=>{
    const data=(ctx as any).effectEventData||st.event?.data;
    if(!data?.changes||data.prevented||!Object.values(data.changes).some(v=>typeof v==='number'&&v<0))return false;
    data.changes=Object.fromEntries(Object.entries(data.changes).filter(([,v])=>typeof v!=='number'||v>=0));
    return true;
  },
  damage_immunity_now:(_ctx:BattleEventContext,p:any,st:RunState)=>{
    const comp=st.event?.data?.damageComp||st.event?.data;
    if(!comp?.isIncoming||!(comp.base>0)||!(comp.multiplier>0)||comp.decreasePercent>=1||!matchesDamageTypes(p.types,comp.damageCategory))return false;
    return addDamageReduction(comp,1)===1;
  },
  resource_consume_pending:(ctx:BattleEventContext,p:any)=>{
    if(!held(ctx,p.id))return false;
    const pending=ctx.getPlayerState('pendingResourceConsumption')||{};
    ctx.setPlayerState('pendingResourceConsumption',{...pending,[p.id]:{round:ctx.roundNumber,owner:holder(ctx)}});
    return true;
  },
  resource_pending_reset:(ctx:BattleEventContext,p:any)=>{
    const pending={...(ctx.getPlayerState('pendingResourceConsumption')||{})};
    for(const id of p.keys)delete pending[id];
    ctx.setPlayerState('pendingResourceConsumption',pending);return true;
  },
  resource_resolve_pending:(ctx:BattleEventContext,p:any,st:RunState)=>{
    const pending={...(ctx.getPlayerState('pendingResourceConsumption')||{})},request=pending[p.id];
    if(!request)return false;
    delete pending[p.id];ctx.setPlayerState('pendingResourceConsumption',pending);
    const mark=held(ctx,p.id);
    if(request.round!==ctx.roundNumber||request.owner!==holder(ctx)||!mark)return false;
    // 受保護時保留資源，但仍執行明文的消失副作用；同回合多次成功只結算一次。
    if(!resourceMarkLocked(ctx,ctx.actor,p.id)){
      if(mark.count===1)ctx.clearMark(p.id,ctx.actor,mark.ownerBattleId||null);
      else ctx.setMark({...mark,count:mark.count-1},ctx.actor);
      ctx.emitElfEvent?.(ctx.actor,ctx.self,EffectTiming.RESOURCE_CHANGED,{side:ctx.actor,targetBattleId:holder(ctx),id:p.id,before:mark.count,after:mark.count-1});
    }
    runStmts(ctx,p.body,st);return true;
  },
};}

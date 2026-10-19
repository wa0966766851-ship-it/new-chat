import type {BattleEventContext} from './types';
import {checkElfDead} from '../battle/elfAlive';
import {portableSkillCapabilities} from '../battle/portableSkillMarks';
import {canonicalStatusName} from './statusIdentity';
import {StatusRegistry} from './statusRegistry';
const id=(e:any)=>String(e?.battleId||e?.id||'');
export const SUPPORT_ACTION_FIELDS:Record<string,readonly string[]>={
 priority_tie_role:['role'],charge_limits_snapshot:['key','slots'],bench_priority_recharge:['key','slots'],
 bench_health_consume_guard:['ratio','cost'],archive_outgoing_control:['key'],
};
export function supportActionIssue(op:string,p:any):string|null{
 if(op==='priority_tie_role'&&!['challenged','challenger'].includes(p.role))return '同速排序角色需挑戰或被挑戰方';
 if(['charge_limits_snapshot','bench_priority_recharge'].includes(op)&&(!Number.isInteger(p.slots)||p.slots<1||p.slots>10))return '充能槽範圍需1至10整數';
 if(['charge_limits_snapshot','bench_priority_recharge','archive_outgoing_control'].includes(op)&&(typeof p.key!=='string'||!p.key||p.key.length>100))return '場下支援需有限識別鍵';
 if(op==='bench_health_consume_guard'&&(!(p.ratio>0&&p.ratio<1)||!Number.isInteger(p.cost)||p.cost<1||p.cost>10))return '體力消耗減免需正比例與充能成本';return null;
}
export function supportOperations(){return{
 priority_tie_role:(ctx:BattleEventContext,p:any)=>{const comp=(ctx as any).priorityComp||(ctx as any).effectEventData?.priorityComp;if(!comp)return false;comp.tieRole=p.role;return true;},
 charge_limits_snapshot:(ctx:BattleEventContext,p:any)=>{if(ctx.getPlayerState(p.key))return false;ctx.setPlayerState(p.key,ctx.self.skills.slice(0,p.slots).map(s=>s.maxPp??s.pp));return true;},
 bench_priority_recharge:(ctx:BattleEventContext,p:any)=>{
  const active=ctx.actor==='p1'?ctx.activeP1:ctx.activeP2;
  if(id(active)===id(ctx.self))return false;
  const field=ctx.contextForElf?.(ctx.actor,active),mine=field?.getPlayerState('actionPriorityThisTurn'),enemy=field?.getOpponentState('actionPriorityThisTurn');
  if(!Number.isFinite(mine)||!Number.isFinite(enemy)||enemy<=mine)return false;
  const limits=ctx.getPlayerState(p.key);if(!Array.isArray(limits))return false;
  const owner=ctx.getFullTeam(ctx.actor).find(e=>id(e)===id(ctx.self));if(!owner)return false;
  let slot=-1;for(let i=0;i<Math.min(p.slots,owner.skills.length);i++)if(Number(owner.skills[i].charge||0)<limits[i])slot=i;
  if(slot<0)return false;
  ctx.updateAnyElf(ctx.actor,id(owner),{skills:owner.skills.map((s,i)=>i===slot?{...s,charge:limits[i]}:s)});return true;
 },
 bench_health_consume_guard:(ctx:BattleEventContext,p:any)=>{ctx.setPlayerState('benchHealthConsumptionPolicy',{ratio:p.ratio,cost:p.cost});return true;},
 archive_outgoing_control:(ctx:BattleEventContext,p:any)=>{
  const data=(ctx as any).effectEventData,active=ctx.actor==='p1'?ctx.activeP1:ctx.activeP2;
  if(!data?.status||data.sourceSide!==ctx.actor||data.sourceMoveIndex!==1||id(active)!==id(ctx.self)||!StatusRegistry[canonicalStatusName(data.status)]?.categories?.includes('CONTROL'))return false;
  const status=canonicalStatusName(data.status),prev:string[]=ctx.getPlayerState(p.key)||[];
  if(prev.includes(status))return false;ctx.setPlayerState(p.key,[...prev,status]);
  ctx.setMark({id:'mechArchivedMark',name:'堅壁解析',displayChar:'析',unit:'道',scope:'elf',ownerBattleId:id(ctx.self),persistsOffField:true,clearable:false,count:prev.length+1,description:'已解析並記錄的異常：'+[...prev,status].join('、')},ctx.actor);return true;
 },
};}
/** 僅明文「消耗體力」呼叫；傷害、調整與恢復不混入此攔截。 */
export function consumedHealthAmount(ctx:BattleEventContext,amount:number):number{
 let result=Math.max(0,amount);if(result<=0)return 0;
 for(const side of ['p1','p2'] as const){
  if(side===ctx.actor)continue;const active=side==='p1'?ctx.activeP1:ctx.activeP2;
  if(portableSkillCapabilities(active).suppressBenchEffects)continue;
  for(const owner of ctx.getFullTeam(side)){
   if(owner.isExtra||owner.isVanished||checkElfDead(owner)||id(owner)===id(active))continue;
   const owned=ctx.contextForElf?.(side,owner),policy=owned?.getPlayerState('benchHealthConsumptionPolicy');if(!policy)continue;
   const candidates=owner.skills.flatMap((s,i)=>Number(s.charge||0)>=policy.cost?[i]:[]);if(!candidates.length)continue;
   const slot=candidates[Math.min(candidates.length-1,Math.floor((ctx.rng?.()??Math.random())*candidates.length))];
   ctx.updateAnyElf(side,id(owner),{skills:owner.skills.map((s,i)=>i===slot?{...s,charge:Number(s.charge)-policy.cost}:s)});
   result=Math.floor(result*(1-policy.ratio));
  }
 }return result;
}

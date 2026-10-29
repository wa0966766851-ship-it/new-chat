import type {BattleEventContext} from '../../effects/types';
import {EffectTiming} from '../../effects/types';
import type {RunState} from '../runtime';
import {isSkillDamageType} from '../../battle/damageSemantics';
import {addDamageReduction} from '../../battle/damageReduction';
import {readMarkStacks} from '../../effects/markQueries';
import {markAppliesToElf} from '../../battle/marks';

export const TYPED_CYCLE_ACTION_FIELDS:Record<string,readonly string[]>={
  typed_cycle_reset:['id','initialReductions'],
  typed_damage_cycle:['id','types','ratio','initialReductions','onMatch','onMismatch'],
  resource_dye_first:['fromId','choices','resetFieldRounds'],
  team_type_stats_mult:['type','ratio','aliveOnly'],
};
export function typedCycleActionIssue(op:string,p:any,trig:string,nested:(body:any[],trig:string)=>string|null):string|null{
  if(['typed_cycle_reset','typed_damage_cycle'].includes(op)&&
    (typeof p.id!=='string'||!p.id||p.id.length>100||!Number.isInteger(p.initialReductions)||p.initialReductions<1||p.initialReductions>100))return '屬性循環需有限識別碼及1至100初始減傷次數';
  if(op==='typed_cycle_reset'&&trig!=='entrance')return '循環重置需登場入口';
  if(op==='typed_damage_cycle'){
    if(trig!=='incoming'||!Array.isArray(p.types)||!p.types.length||p.types.length>10||new Set(p.types).size!==p.types.length||!p.types.every((v:any)=>typeof v==='string'&&v&&v.length<20)||!(p.ratio>0&&p.ratio<1))return '屬性循環需受傷前入口、不重複單屬性列表及0至1減傷倍率';
    for(const key of ['onMatch','onMismatch']){if(!Array.isArray(p[key])||!p[key].length)return '循環成敗需非空可編輯動作';const issue=nested(p[key],trig);if(issue)return issue;}
  }
  if(op==='resource_dye_first'&&(typeof p.fromId!=='string'||!p.fromId||typeof p.resetFieldRounds!=='boolean'||!Array.isArray(p.choices)||!p.choices.length||p.choices.length>10||new Set(p.choices.map((v:any)=>v.id)).size!==p.choices.length||!p.choices.every((v:any)=>v&&Object.keys(v).every(k=>['id','name','displayChar'].includes(k))&&['id','name','displayChar'].every(k=>typeof v[k]==='string'&&v[k].length>0&&v[k].length<100)&&v.id!==p.fromId)))return '資源染色需來源印記、獨立目標清單及在場回合重置選項';
  if(op==='team_type_stats_mult'&&(typeof p.type!=='string'||!p.type||!(p.ratio>0&&p.ratio<=1)||typeof p.aliveOnly!=='boolean'))return '隊伍能力上限需明確屬性、0至100%比例及存活範圍';
  return null;
}
const owner=(ctx:BattleEventContext)=>String(ctx.self.battleId||ctx.self.id);
const cycleKey=(ctx:BattleEventContext,id:string)=>`${owner(ctx)}:${id}`;
export function typedCycleOperations(runStmts:(ctx:BattleEventContext,body:any[],st:RunState)=>void){
  return {
    typed_cycle_reset:(ctx:BattleEventContext,p:any)=>{
      const all=ctx.getPlayerState('typedDamageCycles')||{},key=cycleKey(ctx,p.id);
      ctx.setPlayerState('typedDamageCycles',{...all,[key]:{index:0,reductions:all[key]?.reductions??p.initialReductions}});return true;
    },
    typed_damage_cycle:(ctx:BattleEventContext,p:any,st:RunState)=>{
      const comp=st.event?.data?.damageComp||st.event?.data;
      if(!comp?.isIncoming||comp.sourceSide===ctx.actor||!isSkillDamageType(comp.damageCategory))return false;
      const all=ctx.getPlayerState('typedDamageCycles')||{},key=cycleKey(ctx,p.id);
      const previous=all[key]||{index:0,reductions:p.initialReductions};
      const matches=comp.skillType===p.types[previous.index%p.types.length];
      const next=matches?{...previous,index:previous.index+1}:{...previous,reductions:previous.reductions+1};
      ctx.setPlayerState('typedDamageCycles',{...all,[key]:next});
      if(matches)addDamageReduction(comp,1-p.ratio**previous.reductions);
      else comp.multiplier=0;
      runStmts(ctx,matches?p.onMatch:p.onMismatch,st);
      return matches;
    },
    resource_dye_first:(ctx:BattleEventContext,p:any)=>{
      const source=ctx.getMarks(ctx.actor).find(m=>m.id===p.fromId&&markAppliesToElf(m,ctx.self)&&m.count>0);
      const next=p.choices.find((m:any)=>readMarkStacks(ctx,{side:'self',id:m.id})===0);
      if(!source||!next)return false;
      if(source.count===1)ctx.clearMark(source.id,ctx.actor,source.ownerBattleId||null);
      else ctx.setMark({...source,count:source.count-1},ctx.actor);
      ctx.setMark({...source,...next,count:1,maxCount:1},ctx.actor);
      if(p.resetFieldRounds)ctx.setPlayerState(`${ctx.actor}_turnsInBattle`,0);
      for(const [id,before,after] of [[source.id,source.count,source.count-1],[next.id,0,1]] as const)
        ctx.emitElfEvent?.(ctx.actor,ctx.self,EffectTiming.RESOURCE_CHANGED,{side:ctx.actor,targetBattleId:owner(ctx),id,before,after});
      return true;
    },
    team_type_stats_mult:(ctx:BattleEventContext,p:any)=>{
      let changed=false;
      for(const elf of ctx.getFullTeam(ctx.actor)){
        if(elf.isVanished||(p.aliveOnly&&elf.currentHp<=0)||!String(elf.type).replace(/系/g,'').split(/[·・./]/).includes(p.type))continue;
        const calculatedStats={...elf.calculatedStats};
        for(const k of ['hp','atk','def','spatk','spdef','speed'] as const)calculatedStats[k]=Math.floor(calculatedStats[k]*(1+p.ratio));
        const maxHp=Math.floor(elf.maxHp*(1+p.ratio));
        ctx.updateAnyElf(ctx.actor,String(elf.battleId||elf.id),{calculatedStats,maxHp});changed=true;
      }
      return changed;
    },
  };
}

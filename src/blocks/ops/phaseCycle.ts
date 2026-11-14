import type {BattleEventContext} from '../../effects/types';
import type {RunState} from '../runtime';
export const PHASE_CYCLE_FIELDS:Record<string,readonly string[]>={phase_enter:['key','name','turns','statsMultiplier','restoreHp'],phase_expire:['key','name','statsMultiplier'],phase_leave:['key']};
export function phaseCycleIssue(op:string,p:any,trig:string):string|null{
 if(typeof p.key!=='string'||!p.key||p.key.length>100)return '階段需要有限識別碼';
 if(op!=='phase_leave'&&(typeof p.name!=='string'||!p.name||p.name.length>100))return '階段需要名稱';
 if(p.statsMultiplier!==undefined&&(!Number.isFinite(p.statsMultiplier)||p.statsMultiplier<=0||p.statsMultiplier>100))return '階段能力倍率需有限正數';
 if(p.turns!==undefined&&(!Number.isSafeInteger(p.turns)||p.turns<1||p.turns>10000))return '階段期限需正整數';
 if(p.restoreHp!==undefined&&typeof p.restoreHp!=='boolean')return '階段重生需明確布林';
 if(op==='phase_expire'&&trig!=='phase_end'||op==='phase_leave'&&trig!=='switch_out')return '階段到期及離場需各自正式事件';
 return null;
}
function writePhase(ctx:BattleEventContext,key:string,next:any){
 const elf=ctx.self,previous=elf.combatPhases?.[key];
 const before=previous?.statsMultiplier||1,after=next?.statsMultiplier||1;
 const patch:any={combatPhases:{...elf.combatPhases,[key]:next}};
 if(before!==after){
  const calculatedStats={...elf.calculatedStats} as Record<string,number>;for(const stat of ['hp','atk','def','spatk','spdef','speed'])calculatedStats[stat]=Math.max(1,Math.round(calculatedStats[stat]/before*after));
  patch.calculatedStats=calculatedStats;patch.maxHp=calculatedStats.hp;patch.currentHp=Math.min(elf.currentHp,calculatedStats.hp);
 }
 ctx.updateElf(ctx.actor,patch);
}
export const phaseCycleOperations={
 phase_enter:(ctx:BattleEventContext,p:any,st:RunState)=>{
  writePhase(ctx,p.key,{phase:p.name,statsMultiplier:p.statsMultiplier||1,...(p.turns?{until:ctx.roundNumber+p.turns-1}:{})});
  if(p.restoreHp){ctx.updateElf(ctx.actor,{currentHp:ctx.self.maxHp});if(st.event?.trig==='fatal')st.survived=true;}return true;
 },
 phase_expire:(ctx:BattleEventContext,p:any)=>{
  const previous=ctx.self.combatPhases?.[p.key];if(previous?.until===undefined||ctx.roundNumber<previous.until)return false;
  writePhase(ctx,p.key,{phase:p.name,statsMultiplier:p.statsMultiplier||1});return true;
 },
 phase_leave:(ctx:BattleEventContext,p:any)=>{if(!ctx.self.combatPhases?.[p.key])return false;writePhase(ctx,p.key,undefined);return true;},
};

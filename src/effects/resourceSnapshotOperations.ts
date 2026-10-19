import type {BattleEventContext} from './types';
import { StatusRegistry } from './statusRegistry';
import type {RunState} from '../blocks/runtime';
import {checkElfDead} from '../battle/elfAlive';
const id=(elf:any)=>String(elf.battleId||elf.id);
/** 數值快照綁原持有者及回合；不把回合末即時值冒充回合初資源。 */
/** 描述是否含「機率不高於50%的異常狀態附加效果」（通用特性判定；與 wujiRegistry 既有規則同構）。 */
function lowChanceStatusInText(desc: string): boolean {
  if (!desc) return false;
  const names = [...Object.keys(StatusRegistry).filter(k => k.length >= 2 && !/[.*+?^${}()|[\]\\]/.test(k)), '異常狀態', '異常'];
  const re = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*%[^。；;\\n%]{0,16}?(?:使|令|讓)?(?:對方|對手)?(?:陷入|進入|處於)?(?:${names.join('|')})`, 'g');
  for (const m of desc.matchAll(re)) if (Number(m[1]) <= 50 && !/解除|消除|免疫|抵抗|自身|己方/.test(m[0])) return true;
  return false;
}

export function resourceSnapshotOperations(helpers:{liveElf:(ctx:BattleEventContext,side:'p1'|'p2')=>any}){
  return {
    snapshot_value:(ctx:BattleEventContext,p:any,st:RunState)=>{
      const elf=helpers.liveElf(ctx,p.side==='self'?ctx.actor:ctx.targetSide);
      const values=p.fields.map((key:string)=>elf[key]??(['shield','barrier'].includes(key)?0:NaN));
      if(values.some((v:unknown)=>typeof v!=='number'||!Number.isFinite(v)))return false;
      st.lastAmount=values.reduce((sum:number,v:number)=>sum+v,0);
      ctx.setPlayerState(`blockSnapshot_${p.key}`,{value:st.lastAmount,round:ctx.roundNumber,owner:id(ctx.self)});return true;
    },
    heal_snapshot:(ctx:BattleEventContext,p:any,st:RunState)=>{
      st.lastAmount=0;const key=`blockSnapshot_${p.key}`,snapshot=ctx.getPlayerState(key);
      if(!snapshot||snapshot.round!==ctx.roundNumber||snapshot.owner!==id(ctx.self))return false;
      if(p.consume)ctx.setPlayerState(key,undefined);
      const amount=Math.floor(snapshot.value*p.ratio);if(amount<=0||checkElfDead(ctx.self))return false;
      ctx.applyHeal(ctx.actor,amount,{onSettled:r=>{if(r.operation==='heal'&&r.targetBattleId===id(ctx.self))st.lastAmount=r.hpGained;}});return true;
    },
    count_team_trait:(ctx:BattleEventContext,p:any,st:RunState)=>{
      const sides=p.side==='both'?['p1','p2']:p.side==='self'?[ctx.actor]:[ctx.targetSide];
      // traitText：依「特性描述是否含指定效果文字」統計（通用特性判定；5035/arena_14 的
      // 「機率不高於50%的異常狀態附加效果」句式）。以既有的低機率異常偵測規則比對描述。
      if(p.traitText==='lowChanceStatus'){
        const traitTexts=(elf:any)=>[elf.soulMark?.description,elf.trait?.description,
          elf.alienTraits?.gen2Trait?.description,elf.alienTraits?.exclusiveTrait?.description,
          ...(elf.alienTraits?.exclusiveTraits||[]).map((t:any)=>t?.description),
          elf.alienTraits?.alienTrait?.description,elf.alienTraits?.generalTrait?.description]
          .filter((x:any)=>typeof x==='string'&&x);
        st.lastAmount=sides.flatMap(side=>ctx.getFullTeam(side as 'p1'|'p2'))
          .filter(elf=>!elf.isExtra&&!elf.isVanished&&(p.state==='any'||(p.state==='dead'?checkElfDead(elf):!checkElfDead(elf))))
          .filter(elf=>traitTexts(elf).some((t:string)=>lowChanceStatusInText(t))).length;
        return true;
      }
      st.lastAmount=sides.flatMap(side=>ctx.getFullTeam(side as 'p1'|'p2')).filter(elf=>!elf.isExtra&&!elf.isVanished&&(p.state==='any'||(p.state==='dead'?checkElfDead(elf):!checkElfDead(elf))))
        .filter(elf=>[elf.trait,elf.alienTraits?.gen2Trait,elf.alienTraits?.exclusiveTrait,...(elf.alienTraits?.exclusiveTraits||[]),elf.alienTraits?.alienTrait,elf.alienTraits?.generalTrait].some(trait=>trait?.name===p.name)).length;
      return true;
    },
  };
}

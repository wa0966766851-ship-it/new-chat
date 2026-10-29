import type { Elf } from '../types';
import type { BattleEventContext } from '../effects/types';
import { effectDefinitionEntries } from './effectSources';
import { finalExtraTraitActionIssue } from '../blocks/ops/finalExtraTraits';
const id=(e:any)=>String(e?.battleId||e?.id||'');
/** 公式層直接查目前積木，移除條目或編輯值即失效；不依精靈名稱或原文猜測。 */
export function readPassiveSoulMechanic(elf:Elf,op:string):any|undefined {
  for(const def of effectDefinitionEntries(elf)){
    if(def.effectMode!=='kit')continue;
    for(const e of def.kit||[]){
      if(e.node!=='passive_always'||e.codeId!=='effect_sequence'||(e as any).disabled)continue;
      const clause=e.params?.clause;if(!clause?.parsed||clause.trig!=='passive')continue;
      for(const segment of clause.body||[]){
        if(segment.cond?.length||segment.chain||segment.elseActs?.length)continue;
        const a=segment.acts?.find((a:any)=>a.op===op&&!finalExtraTraitActionIssue(a.op,a.p));
        if(a)return a.p;
      }
    }
  }
}
/** 永久能力值錨定仍在持有者死亡／條目刪除時還原，來源身分存在每個目標身上。 */
export function runFinalExtraSoulLifecycle(ctx:BattleEventContext):void {
  if(!ctx.getFullTeam||!ctx.updateAnyElf)return;
  for(const side of ['p1','p2'] as const){
    const team=ctx.getFullTeam(side)||[],active=side==='p1'?ctx.activeP1:ctx.activeP2;
    const owners=team.filter(e=>e.currentHp>0&&!e.isVanished&&readPassiveSoulMechanic(e,'team_stat_anchor'));
    // 先解除已失效來源；其他隊員進場時也還原其原本能力值。
    for(const member of team){
      const records={...((member as any).kitStatAnchors||{})};
      let stat=member.calculatedStats.spdef,changed=false;
      for(const [ownerId,record] of Object.entries(records) as [string,any][]){
        const owner=owners.find(e=>id(e)===ownerId);
        if(!owner||(id(member)===id(active)&&id(member)!==ownerId)){
          stat=record.original;delete records[ownerId];changed=true;
        }
      }
      if(changed)ctx.updateAnyElf(side,id(member),{calculatedStats:{...member.calculatedStats,spdef:stat},kitStatAnchors:records} as any);
    }
    for(const owner of owners){
      const p=readPassiveSoulMechanic(owner,'team_stat_anchor'),key=id(owner);
      const liveOwner=ctx.getFullTeam(side).find(e=>id(e)===key)||owner;
      const original=(liveOwner as any).kitStatAnchors?.[key]?.original??liveOwner.calculatedStats.spdef;
      const adjusted=Math.ceil(original/p.divisor);
      for(const member of ctx.getFullTeam(side)){
        if(id(member)===id(active)&&id(member)!==key)continue;
        const records={...((member as any).kitStatAnchors||{})};
        records[key]??={original:member.calculatedStats.spdef};
        if(member.calculatedStats.spdef!==adjusted||!(member as any).kitStatAnchors?.[key])
          ctx.updateAnyElf(side,id(member),{calculatedStats:{...member.calculatedStats,spdef:adjusted},kitStatAnchors:records} as any);
      }
    }
  }
}

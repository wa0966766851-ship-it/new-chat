import type { Elf } from '../types';
import type { BattleEventContext } from '../effects/types';
import { effectDefinitionEntries } from './effectSources';
import { finalExtraTraitActionIssue } from '../blocks/ops/finalExtraTraits';
const id=(e:any)=>String(e?.battleId||e?.id||'');
const isPassiveSequence=(e:any)=>e?.node==='passive_always'&&e.codeId==='effect_sequence'&&!e.disabled;
const hasPassiveSequence=(kit:any)=>Array.isArray(kit)&&kit.some(isPassiveSequence);
const traitHasPassive=(t:any)=>!!t&&hasPassiveSequence(t.kit);
/** 必要條件（超集合）：effectDefinitionEntries 會讀到的所有 kit 中，是否存在可被讀取的被動連鎖條目。沒有就一定讀不到。 */
function mayHavePassiveSequence(elf:any):boolean {
  const views=elf?.illusion?.target?[elf,elf.illusion.target,elf.illusion.original]:[elf];
  for(const v of views){
    if(!v)continue;
    if(hasPassiveSequence(v.soulMark?.kit)||hasPassiveSequence(v.kit))return true;
    const a=v.alienTraits;
    if(traitHasPassive(v.trait)||traitHasPassive(a?.gen2Trait)||traitHasPassive(a?.exclusiveTrait)||traitHasPassive(a?.alienTrait)||traitHasPassive(a?.generalTrait))return true;
    for(const t of a?.exclusiveTraits||[])if(traitHasPassive(t))return true;
  }
  return false;
}
/** 公式層直接查目前積木，移除條目或編輯值即失效；不依精靈名稱或原文猜測。 */
export function readPassiveSoulMechanic(elf:Elf,op:string):any|undefined {
  // 效能：每個戰鬥事件都會對全隊掃描；絕大多數精靈沒有任何被動連鎖，先用不配置物件的必要條件擋掉（結果與完整掃描相同）。
  if(!mayHavePassiveSequence(elf))return undefined;
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

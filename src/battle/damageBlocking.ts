import type { DamageComputation } from '../effects/types';
import { bypassesAttackDefense } from './attackDefense';
/** 抵擋／轉化在完整增減傷、上限／保底之後，護盾與致死之前。 */
export function resolveDamageBlocking(comp:DamageComputation,amount:number):number {
  if(comp.reductionPolicy?.skillDefenseDisabled)return amount;
  const blocks=!comp.ignoreDamageBlocking&&!bypassesAttackDefense(comp,'block')?[...(comp.damageBlocks?.values()||[])]:[];
  const conversions=!bypassesAttackDefense(comp,'conversion')?[...(comp.damageConversions?.values()||[])]:[];
  if(blocks.length)comp.damageBlocks!.clear();
  if(conversions.length)comp.damageConversions!.clear();
  if(amount<=0)return amount;
  if(blocks.length) {
    for(const record of blocks)record(amount);
    return 0;
  }
  if(conversions.length) {
    // 一份傷害只能轉化一次；不存在的受傷量不產生額外恢復。
    comp.incomingDamageCancellation='conversion';conversions[0](amount);return 0;
  }
  return amount;
}

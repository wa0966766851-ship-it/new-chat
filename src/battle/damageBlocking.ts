import type { DamageComputation } from '../effects/types';
import { bypassesAttackDefense } from './attackDefense';
/** 抵擋在完整增減傷、上限／保底之後，護盾與致死之前。不能以base冒充實際抵擋量。 */
export function resolveDamageBlocking(comp:DamageComputation,amount:number):number {
  if(!comp.damageBlocks?.size||bypassesAttackDefense(comp,'block'))return amount;
  const requests=[...comp.damageBlocks.values()];comp.damageBlocks.clear();
  if(amount<=0)return amount;
  for(const record of requests)record(amount);
  return 0;
}

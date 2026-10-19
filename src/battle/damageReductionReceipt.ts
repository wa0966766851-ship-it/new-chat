import type {DamageComputation} from '../effects/types';
import {floorDamage} from './damagePipeline';
export interface DamageReductionReceipt {beforeReduction:number;afterReduction:number;reduced:number}
/** 正式增傷完成後、限制/抵擋/盾罩/HP截斷前，還原且僅還原減傷乘區。保底可抵銷減免。 */
export function damageReductionReceipt(comp:DamageComputation):Readonly<DamageReductionReceipt>{
 const product=comp.multiplierReductionProduct??1;
 if(!comp.trackReduction||!(product>0)||!Number.isFinite(product))return Object.freeze({beforeReduction:0,afterReduction:0,reduced:0});
 const amplified=(comp.base+(comp.bonusFixed||0))*(1+comp.increasePercent)*comp.multiplier;
 const beforeReduction=floorDamage(Math.max(0,amplified/product));
 const afterReduction=floorDamage(Math.max(0,comp.floor||0,amplified*Math.max(0,1-comp.decreasePercent)-(comp.flatReduction||0)));
 return Object.freeze({beforeReduction,afterReduction,reduced:Math.max(0,beforeReduction-afterReduction)});
}

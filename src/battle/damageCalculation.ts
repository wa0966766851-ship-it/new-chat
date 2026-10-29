import type {DamageComputation} from '../effects/types';
import type {SettlementOptions} from './settlementReceipt';
export interface DamageCalculationReceipt {damageType:string;requestedAmount:number;settledAmount:number;incomingImmune:boolean}
export type DamageCalculationOptions=SettlementOptions&{onCalculated?:(receipt:Readonly<DamageCalculationReceipt>)=>void};
/** 計算結果和免疫原因獨立；抵擋、上限、固定减免、取整與護罩不冒充免疫。 */
export function notifyDamageCalculation(opts:DamageCalculationOptions|undefined,comp:DamageComputation,requestedAmount:number,settledAmount:number){
  if(!opts?.onCalculated)return;
  opts.onCalculated(Object.freeze({damageType:comp.damageCategory,requestedAmount,settledAmount,
    incomingImmune:requestedAmount>0&&settledAmount===0&&!!comp.incomingDamageImmunity&&!comp.incomingDamageCancellation}));
}

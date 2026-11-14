import type {Elf,ElfResistances} from '../types';

/** 未配置抗性時的預設：傷害抗性各35%（上限），六項異常各50%＋全免5%＝55%（上限）。 */
export function defaultResistances():ElfResistances{
  return {damageResist:{crit:35,fixed:35,percent:35},statusResist:{allImmune:true,selectedStatuses:['麻痺','害怕','疲憊','中毒','燒傷','凍傷'],slots:[
    {id:'c1',category:'control',status:'麻痺',rate:50},{id:'c2',category:'control',status:'害怕',rate:50},{id:'c3',category:'control',status:'疲憊',rate:50},
    {id:'w1',category:'weakening',status:'中毒',rate:50},{id:'w2',category:'weakening',status:'燒傷',rate:50},{id:'w3',category:'weakening',status:'凍傷',rate:50}]}};
}

/** 未配置抗性的精靈補上預設（內建與自製精靈載入時套用；已配置者不動）。 */
export const withDefaultResistances=<T extends {resistances?:ElfResistances}>(elf:T):T=>elf.resistances?elf:{...elf,resistances:defaultResistances()};

/** 戰鬥中的抗性規則不覆寫編輯器設定；傷害與異常共用同一份計算結果。 */
export function battleResistances(elf:Pick<Elf,'resistances'|'resistanceHighestOnly'>):ElfResistances|undefined {
  const res=elf.resistances;
  if(!res||!elf.resistanceHighestOnly)return res;
  const slots=res.statusResist?.slots||[],base=res.statusResist?.allImmune?5:0;
  const items=[res.damageResist.crit,res.damageResist.fixed,res.damageResist.percent,...slots.map(s=>Math.min(100,s.rate+base))];
  const max=Math.max(0,...items);
  if(!(max>0)||items.filter(n=>n===max).length!==1)return res;
  const index=items.indexOf(max);
  return {...res,damageResist:{crit:index===0?100:0,fixed:index===1?100:0,percent:index===2?100:0},
    statusResist:{...res.statusResist,allImmune:false,slots:slots.map((s,i)=>({...s,rate:index===i+3?100:0}))}};
}

import {DAMAGE_BASE_CHOICES,DAMAGE_STAT_BASES} from './damageBases';
export type DamageTerm={base:string;of:'self'|'opp';ratio:number};
/** 先合計不同持有者／資源的基數，再作一次正式傷害結算，不能拆成多次去繞過抵擋或上限。 */
export function damageTermsIssue(value:unknown):string|null{
 if(!Array.isArray(value)||!value.length||value.length>12)return '合計傷害需1至12個明確基數';
 for(const t of value)if(!t||typeof t!=='object'||Object.keys(t).some(k=>!['base','of','ratio'].includes(k))||!DAMAGE_BASE_CHOICES.includes(t.base)||!['self','opp'].includes(t.of)||!Number.isFinite(t.ratio)||t.ratio<=0||t.ratio>10000)return '傷害合計項需已接通基數、單一持有者與正有限比例';
 return null;
}
export function damageBaseValue(elf:any,base:string):number{
 if(!elf)return 0;
 if(base==='當前體力')return Math.max(0,elf.currentHp||0);
 if(base==='已損失體力')return Math.max(0,(elf.maxHp||0)-(elf.currentHp||0));
 if(base==='最大體力')return Math.max(0,elf.maxHp||0);
 if(base==='護盾值')return Math.max(0,elf.shield||0);
 return (DAMAGE_STAT_BASES[base]||[]).reduce((n,k)=>n+Math.max(0,Number(elf.calculatedStats?.[k])||0),0);
}

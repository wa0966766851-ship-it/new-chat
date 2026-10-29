import type {Elf} from '../types';
import type {Timer} from './timers';
import {activeConstraints} from './timedConstraints';

export type StatusOrigin={kind:'skill'|'soul'|'trait';sourceSide:'p1'|'p2';sourceBattleId:string;skillCategory?:string};

/** 限制施加方的技能來源；魂印或特質不因當前選了攻擊技能就被誤認成技能附加。 */
export function blocksStatusInfliction(timers:Timer[],source:Elf,sourceSide:'p1'|'p2',origin?:StatusOrigin):boolean{
  return activeConstraints(timers,source).some(payload=>{
    const kind=payload.statusInflictGuard?.kind;
    if(!kind)return false;
    if(kind==='all')return true;
    if(origin?.kind!=='skill'||origin.sourceSide!==sourceSide||origin.sourceBattleId!==(source.battleId||source.id))return false;
    return kind==='攻擊'?(origin.skillCategory==='物理'||origin.skillCategory==='特殊'):kind===origin.skillCategory;
  });
}

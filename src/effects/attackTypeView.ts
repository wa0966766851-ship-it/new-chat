import type {BattleEventContext} from './types';
import {SEER_TYPES} from '../utils/statCalculator';

export const isKnownBattleType=(v:unknown):v is string=>typeof v==='string'&&SEER_TYPES.includes(v);
/** 只改攻擊的克制視圖；真實屬性、辨識與STAB維持原資料。 */
export function grantAttackTypeView(ctx:BattleEventContext,p:{uses:number;attackType?:string;targetType?:string}):boolean{
  const patch={attackTypeOverride:p.attackType,targetTypeOverride:p.targetType,attackTypeOverrideUses:p.uses};
  for(const [key,value] of Object.entries(patch))ctx.setPlayerState(key,value);
  const keys=new Set<string>(ctx.getPlayerState('clearOnSwitch')||[]);
  for(const key of Object.keys(patch))keys.add(key);
  ctx.setPlayerState('clearOnSwitch',[...keys]);
  return true;
}

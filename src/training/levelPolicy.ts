import type {Elf} from '../types';
export const DEFAULT_LEVEL=100,MAX_LEVEL=120;
export const trainingLevel=(level=DEFAULT_LEVEL)=>Math.max(1,Math.min(MAX_LEVEL,Math.round(Number(level)||DEFAULT_LEVEL)));
/** Only persisted starting-HP configuration affects a new battle; battle damage is never written back here. */
export function configuredStartingHp(elf:Pick<Elf,'startingHp'>,maxHp:number):number{
 const setup=elf.startingHp;if(!setup)return maxHp;
 return Math.max(1,Math.min(maxHp,Math.floor(setup.mode==='percent'?maxHp*setup.value/100:setup.value)));
}

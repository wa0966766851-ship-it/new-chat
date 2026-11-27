import type {BaseStats,Inscription} from '../types';

/** Explicit empty slot: undefined is reserved by old saves for the default engraving. */
export function emptyInscription(slotIndex:number):Inscription{
 return {id:`empty_inscription_${slotIndex+1}`,name:'未裝備',description:'此孔未裝備刻印，能力加成為0。',stats:{hp:0,atk:0,def:0,spatk:0,spdef:0,speed:0}};
}

/** Both editors save through the same rules; appearance never supplies stat values. */
export function buildInscriptionDraft(original:Inscription|undefined,draft:Inscription):Inscription{
 const stats=Object.fromEntries(Object.entries(draft.stats).map(([key,value])=>[key,Number.isFinite(value)?Math.max(0,value):0])) as unknown as BaseStats;
 const skinId=draft.skinId&&/^\d{1,9}$/.test(draft.skinId)?draft.skinId:undefined;
 return {...original,...draft,name:draft.name.trim()||'自訂刻印',stats,skinId,skinIcon:skinId?`/seer/countermark/${skinId}.png`:undefined};
}

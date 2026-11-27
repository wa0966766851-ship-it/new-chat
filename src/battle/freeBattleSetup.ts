import {isFlameId} from '../data/battleFlames';
export const FREE_FIELD_KEY='seer_free_battle_field';
export const FREE_FIELD_IDS=['duel','peak6','destiny','eclipse'] as const;
export type FreeFieldId=typeof FREE_FIELD_IDS[number];
export function readFreeBattleSetup(storage:Pick<Storage,'getItem'>=localStorage){
 const value=storage.getItem(FREE_FIELD_KEY);
 const flame=(side:string)=>{const v=storage.getItem(`seer_${side}_flame`);return isFlameId(v)?v:undefined;};
 return {fieldId:FREE_FIELD_IDS.includes(value as FreeFieldId)?value as FreeFieldId:'duel',flames:{p1:flame('p1'),p2:flame('p2')}};
}

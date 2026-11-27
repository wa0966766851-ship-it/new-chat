/** Independent of engine/UI modules so field display never imports battle operations. */
export interface SideField {
 id:string; name:string; description:string; icon?:string;
 remaining:number; sureHit?:boolean; attackIncrease?:number; teamHeal?:number; teamPp?:number;
 /** Inclusive round boundary; the last round's effects remain active through both sides' settlement. */
 expiresRound?:number;
}
export const SIDE_FIELD_KEY='teamSideField';
export const PENDING_SIDE_FIELD_KEY='teamPendingSideField';
export function activeSideField(field:SideField|undefined|null,round?:number):SideField|null{
 if(!field)return null;
 const remaining=round!==undefined&&field.expiresRound!==undefined?field.expiresRound-round+1:field.remaining;
 return remaining>0?{...field,remaining}:null;
}
export function readSideField(state:Record<string,any>|undefined,round?:number):SideField|null {
 return activeSideField(state?.[SIDE_FIELD_KEY],round);
}
export function validSideField(field:any):field is SideField {
 return !!field&&typeof field.id==='string'&&field.id.length>0&&field.id.length<=100&&
 typeof field.name==='string'&&field.name.length<=100&&typeof field.description==='string'&&field.description.length<=10000&&
 Object.keys(field).every(k=>['id','name','description','icon','remaining','sureHit','attackIncrease','teamHeal','teamPp'].includes(k))&&
 (field.icon===undefined||typeof field.icon==='string'&&/^\/seer\/[a-z0-9_/-]+\.png$/i.test(field.icon))&&
 Number.isInteger(field.remaining)&&field.remaining>0&&field.remaining<=1000&&
 ['attackIncrease','teamHeal','teamPp'].every(k=>field[k]===undefined||Number.isFinite(field[k])&&field[k]>=0&&field[k]<=1e6)&&
 (field.sureHit===undefined||typeof field.sureHit==='boolean');
}

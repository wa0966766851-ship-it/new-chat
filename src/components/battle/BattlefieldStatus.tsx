import React from 'react';
import {readSideField,type SideField} from '../../battle/sideFieldModel';
import './battlefieldStatus.css';
type Field={name:string;description:string};
export function BattlefieldStatus({center,p1,p2,round,onInspect}:{center:Field;p1:Record<string,any>;p2:Record<string,any>;round:number;onInspect:(field:Field)=>void}){
 const side=(registry:Record<string,any>,owner:string)=>{
  const field=readSideField(registry,round);
  return <button type="button" className="battlefield-slot" data-side-field={owner} data-field-id={field?.id||''}
   aria-label={`${owner}場地：${field?.name||'無'}${field?`，剩餘${field.remaining}回合`:''}`} title={`${owner}場地：${field?.name||'無'}`}
   onClick={()=>onInspect({name:`${owner}場地${field?'・'+field.name:''}`,description:field?`${field.description}\n剩餘 ${field.remaining} 回合。`:'此方目前沒有場地效果。'})}>
   <FieldSymbol field={field}/><span>{owner}</span>{field&&<b>{field.remaining}</b>}
  </button>;
 };
 return <div className="battlefield-slots" data-battlefield-slots>
  {side(p1,'P1')}<button type="button" data-battlefield className="battlefield-central" aria-label={`中央場地：${center.name}`} onClick={()=>onInspect(center)}>
   <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" aria-hidden="true"><path d="m3 8 9-5 9 5v8l-9 5-9-5Zm0 0 9 5 9-5M12 13v8"/></svg>{center.name}
  </button>{side(p2,'P2')}
 </div>;
}
function FieldSymbol({field}:{field:SideField|null}){
 if(field?.icon)return <img src={field.icon} alt="" width="22" height="22" loading="lazy"/>;
 return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" aria-hidden="true">
  {field?.teamHeal?<><path d="M3 15q3-3 6 0t6 0 6 0M3 20q3-3 6 0t6 0 6 0M7 11V4h10v7M7 7h10"/></>:field?<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/>:<circle cx="12" cy="12" r="7" strokeDasharray="3 3"/>}
 </svg>;
}

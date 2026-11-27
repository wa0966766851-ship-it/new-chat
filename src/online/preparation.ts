import type {Elf} from '../types';
import {compactBuiltinOverrides} from '../data/savedTeamCompact';
import {normalizeElfStats} from '../utils/elfStats';
import type {MatchMode} from './matchmaking';

export const ONLINE_PREPARATION_KEY='seer_online_preparation_v1';
export interface OnlinePreparation {
 schemaVersion:1;
 mode:MatchMode;
 team:Elf[];
 starterId:string;
 configurations?:Record<string,Elf>;
 equipment:{suit:string;eyewear:string;title:string;flame:string};
}
export function initialPreparation(catalog:Elf[]):OnlinePreparation{
 const team=catalog.filter(e=>!e.isExtra&&!e.isCustom).slice(0,6).map(e=>normalizeElfStats(structuredClone(e)));
 return {schemaVersion:1,mode:'peak',team,starterId:team[0]?.id||'',equipment:{suit:'',eyewear:'',title:'',flame:''}};
}
export function preparationError(value:OnlinePreparation){
 if(!['peak','destiny'].includes(value.mode))return '請選擇對戰模式';
 if(value.team.length!==6)return '請先準備完整的6隻精靈';
 if(new Set(value.team.map(e=>e.id)).size!==6)return '隊伍不可重複加入同一隻精靈';
 if(!value.team.some(e=>e.id===value.starterId))return '請選擇隊伍中的首發精靈';
 if(value.team.some(e=>e.isExtra||!e.skills?.length))return '額外精靈或缺少技能的精靈無法作為預選隊伍';
 return '';
}
export function savePreparation(storage:Pick<Storage,'setItem'|'getItem'>,value:OnlinePreparation,catalog:Elf[]){
 const patches=compactBuiltinOverrides({...value.configurations,...Object.fromEntries(value.team.map(e=>[e.id,e]))},catalog);
 const json=JSON.stringify({...value,configurations:patches,team:value.team.map(e=>({id:e.id}))});
 if(json.length>1_000_000)throw Error('雙人配置過大，未覆寫原本配置');
 const previous=storage.getItem(ONLINE_PREPARATION_KEY);
 if(previous&&previous!==json)storage.setItem(ONLINE_PREPARATION_KEY+'.previous',previous);
 storage.setItem(ONLINE_PREPARATION_KEY,json);
}
export function readPreparation(storage:Pick<Storage,'getItem'>,catalog:Elf[]):OnlinePreparation{
 const raw=storage.getItem(ONLINE_PREPARATION_KEY);
 if(!raw)return initialPreparation(catalog);
 if(raw.length>2_000_000)throw Error('雙人配置檔案過大，原檔已保留');
 const value=JSON.parse(raw);
 if(value?.schemaVersion!==1||!Array.isArray(value.team)||value.team.length>6||!['peak','destiny'].includes(value.mode)||typeof value.starterId!=='string'||!value.equipment)throw Error('雙人配置格式無法讀取，原檔已保留');
 const hydrate=(patch:Partial<Elf>)=>{
  const base=catalog.find(e=>e.id===patch?.id&&!e.isExtra&&!e.isCustom);
  if(!base)throw Error('雙人配置中的精靈已不在目前名單，原檔已保留');
  return normalizeElfStats({...structuredClone(base),...patch});
 };
 const configurations=Object.fromEntries(Object.entries(value.configurations||{}).map(([id,patch])=>[id,hydrate(patch as Partial<Elf>)]));
 const team=value.team.map((patch:Partial<Elf>)=>hydrate({...configurations[patch.id],...patch}));
 return {...value,team,configurations};
}

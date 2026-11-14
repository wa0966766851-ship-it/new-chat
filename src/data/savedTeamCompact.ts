// 2026-11-14 存檔瘦身：陣容紀錄只存「順序與實例身分」，內建精靈覆寫只存與內建不同的欄位。
// 讀取端本來就以目前倉庫（prepareSavedBattleRoster）取得定義與配置，完整副本只會佔空間並遮蔽內建修正。
import type {Elf} from '../types';

const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);

/** 陣容成員：保留身分、顯示與準備畫面狀態，去掉可由倉庫重建的重資料（積木、說明、技能池、內嵌圖）。
 *  開戰／載入一律經 prepareSavedBattleRoster 取目前倉庫定義，所以不影響戰鬥內容。 */
const HEAVY_ELF_KEYS=['skillPool','decompositionReport','rawPrompt','description','kit','builtinEffectBindings'];
const HEAVY_SKILL_KEYS=['kit','description','effects','effectDefinitions','rawText'];
const inlineImage=(v:unknown)=>typeof v==='string'&&v.startsWith('data:');
export function slimTeamMember(e:any):any{
  if(!e||typeof e!=='object'||Array.isArray(e))return e;
  const out:any={...e};
  for(const k of HEAVY_ELF_KEYS)delete out[k];
  for(const k of ['imageUrl','avatarUrl'])if(inlineImage(out[k]))delete out[k];
  if(out.soulMark&&typeof out.soulMark==='object'){const {kit,description,...rest}=out.soulMark;out.soulMark=rest;}
  if(Array.isArray(out.skills))out.skills=out.skills.map((s:any)=>{if(!s||typeof s!=='object')return s;const n={...s};for(const k of HEAVY_SKILL_KEYS)delete n[k];return n;});
  return out;
}
export const slimTeamRecord=<T>(record:T):T=>{
  const r:any=record;
  return r&&typeof r==='object'&&Array.isArray(r.team)?{...r,team:r.team.map(slimTeamMember)}:record;
};
export const slimTeamPresets=<T>(presets:T):T=>{
  if(!presets||typeof presets!=='object')return presets;
  return Object.fromEntries(Object.entries(presets as any).map(([k,v])=>[k,slimTeamRecord(v)])) as T;
};

/** 內建覆寫：只保留與目前內建不同的欄位（id／name 保留作身分）。讀取時 {...內建, ...覆寫} 結果不變。 */
export function compactBuiltinOverrides(overrides:Record<string,Elf>,builtins:Elf[]):Record<string,Partial<Elf>>{
  const byId=new Map(builtins.filter(Boolean).map(e=>[String(e.id),e]));
  const out:Record<string,Partial<Elf>>={};
  for(const [key,override] of Object.entries(overrides||{})){
    const base:any=byId.get(String((override as any)?.id??key));
    if(!base||!override||typeof override!=='object'){out[key]=override;continue;}
    const diff:any={id:(override as any).id??base.id,name:(override as any).name??base.name};
    for(const [k,v] of Object.entries(override))if(k!=='id'&&k!=='name'&&!same(v,base[k]))diff[k]=v;
    out[key]=diff;
  }
  return out;
}

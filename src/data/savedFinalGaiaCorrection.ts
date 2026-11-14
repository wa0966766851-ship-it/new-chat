import type {Elf} from '../types';

const stable=(value:unknown)=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)
 ?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
/** 只認領此次已知的完整舊魂印；自訂描述／積木與其餘精靈配置保持原樣。 */
export function correctSavedFinalGaia(elf:Elf,defaults:Elf[]):Elf {
 if(elf.isCustom||String(elf.id)!=='5043'||!elf.soulMark)return elf;
 const canonical=defaults.find(e=>String(e.id)===String(elf.id)&&e.name===elf.name)?.soulMark;
 if(!canonical?.kit||!canonical.description.includes('自身每次造成非真實傷害提升160%')||!canonical.kit.some(e=>e.params?.clause?.body?.some((step:any)=>step.acts?.some((a:any)=>a.op==='status_duration_damage_boost'))))return elf;
 const legacy=structuredClone(canonical);
 legacy.description=legacy.description.replace('自身每次造成非真實傷害提升160%','自身每次受到非真實傷害提升160%');
 legacy.kit=legacy.kit!.filter(e=>e.order!==22).map(e=>{
  if(e.order!==0)return e;
  const clause=e.params.clause;
  return {...e,params:{...e.params,clause:{...clause,body:clause.body.map((step:any)=>({...step,acts:step.acts?.map((a:any)=>a.op==='status_duration_damage'?{...a,p:{...a.p,increase:1.6}}:a)}))}}};
 });
 const definition=(s:NonNullable<Elf['soulMark']>)=>({name:s.name,description:s.description,effectMode:s.effectMode,effectType:s.effectType,effectValue:s.effectValue,kit:s.kit});
 if(stable(definition(elf.soulMark))!==stable(definition(legacy)))return elf;
 const oldTop=elf.kit?.filter(e=>e.source!=='skill');
 const kit=oldTop?.length&&stable(oldTop)===stable(legacy.kit)
  ?[...structuredClone(canonical.kit),...elf.kit!.filter(e=>e.source==='skill')]:elf.kit;
 return {...elf,kit,soulMark:{...elf.soulMark,description:canonical.description,kit:structuredClone(canonical.kit)}};
}

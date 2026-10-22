import type { Elf } from '../types';
import {soulDefinition} from '../effects/soulDefinitionSource';

type Definition = { name: string; kit?: unknown[]; [key: string]: any };
// 只更新效果定義，不能把 PP、配裝、戰鬥狀態及實例身分當成資料庫欄位覆寫。
const fields = ['description','effectMode','kit','effectType','effectValue','effectDetail','customCode','mechanics',
  'type','category','power','priority','accuracy','isSureHit','ppUnlimited','ignorePpLimit',
  'isCarrying','isInherent','statChanges','statusEffects','templateId','templateArgs',
  'wuxu_trait','trait_wuwo','trait_warrior','trait_wuxu_apostle','trait_stone_thrower'] as const;
function projection(d: Definition) {
  return Object.fromEntries(fields.filter(k => d[k] !== undefined).map(k => [k, d[k]]));
}
function stable(value: unknown): string {
  return JSON.stringify(value, (_key, v) => v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
}
/** 雙 32 位指紋加長度，只用於變更偵測，不用於安全／簽章驗證。 */
function signature(d: Definition): string {
  const text = stable(projection(d));
  let a = 2166136261, b = 3339675911;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 16777619);
    b = Math.imul(b ^ text.charCodeAt(i), 2246822519);
  }
  return `1:${text.length}:${(a >>> 0).toString(16)}:${(b >>> 0).toString(16)}`;
}
const savedSignature=(key:string,value:Definition,elf:Elf)=>signature(key==='soul'?{...value,kit:soulDefinition(elf).kit}:value);
function sourceFor(elf: Elf, defaults: Elf[]) {
  if (!elf || String(elf.id).startsWith('custom_')) return undefined;
  return defaults.find(d => String(d.id) === String(elf.id) && d.name === elf.name);
}
function baselineFor(elf: Elf): Record<string,string> {
  const b=elf.builtinEffectBindings;
  return b?.schemaVersion===1 && b.elfId===String(elf.id) && b.definitions && typeof b.definitions==='object' && !Array.isArray(b.definitions) ? b.definitions : {};
}
/** 同名技能跟隨技能重排；出戰槽與替換池分開，重複同名以次序區隔。 */
function mapDefinitions(elf: Elf, canonical: Elf, visit: (key: string, value: Definition, source?: Definition) => Definition): Elf {
  const single = (key: string, value: any, source: any) => value ? visit(key, value, source) : value;
  const list = <T extends Definition>(key: string, values: T[] | undefined, sources: Definition[]) => {
    const seen = new Map<string, number>();
    return values?.map(value => {
      const occurrence = seen.get(value.name) || 0; seen.set(value.name, occurrence + 1);
      return visit(`${key}:${JSON.stringify(value.name)}:${occurrence}`, value, sources.find(s => s.name === value.name)) as T;
    });
  };
  const skillSources = [...canonical.skills, ...(canonical.skillPool || [])];
  const soulMark = single('soul', elf.soulMark, canonical.soulMark && soulDefinition(canonical));
  const trait = single('trait', elf.trait, canonical.trait);
  const skills = list('skill', elf.skills, skillSources)!;
  const skillPool = list('pool', elf.skillPool, skillSources);
  const alienTraits = elf.alienTraits && { ...elf.alienTraits };
  if (alienTraits) {
    for (const key of ['gen2Trait','exclusiveTrait','alienTrait','generalTrait'] as const)
      alienTraits[key] = single(key, elf.alienTraits?.[key], canonical.alienTraits?.[key]);
    alienTraits.exclusiveTraits = list('exclusive', elf.alienTraits?.exclusiveTraits, canonical.alienTraits?.exclusiveTraits || []);
  }
  const sameList = (a: any[] | undefined, b: any[] | undefined) => a?.length === b?.length && (!a || a.every((v, i) => v === b?.[i]));
  if (soulMark === elf.soulMark && trait === elf.trait && sameList(skills, elf.skills) && sameList(skillPool, elf.skillPool) &&
    (!alienTraits || (['gen2Trait','exclusiveTrait','alienTrait','generalTrait'] as const).every(k => alienTraits[k] === elf.alienTraits?.[k]) && sameList(alienTraits.exclusiveTraits, elf.alienTraits?.exclusiveTraits))) return elf;
  return { ...elf, soulMark, trait, skills, ...(skillPool ? {skillPool} : {}), ...(alienTraits ? {alienTraits} : {}) };
}

export type BindingDiagnostic = { key: string; name: string; status: 'current' | 'upgradeable' | 'modified' | 'untracked' | 'source-missing'; differences?: string[]; kitDifferences?: string[] };
function changedPaths(a:any,b:any,path='kit',result:string[]=[]):string[]{
  if(result.length>=20||stable(a??null)===stable(b??null))return result;
  if(!a||!b||typeof a!=='object'||typeof b!=='object'){result.push(path);return result;}
  for(const key of new Set([...Object.keys(a),...Object.keys(b)]))changedPaths(a[key],b[key],`${path}.${key}`,result);
  return result;
}
/** 已追蹤定義被修改後，即使清空 kit 也不得被舊版補漏規則補回。 */
export function modifiedBuiltinDefinitions(elf: Elf, defaults: Elf[]): Set<object> {
  const result=new Set<object>(),source=sourceFor(elf,defaults);if(!source)return result;
  const baseline=baselineFor(elf);
  mapDefinitions(elf,source,(key,value)=>{if(baseline[key] && baseline[key]!==savedSignature(key,value,elf))result.add(value);return value;});
  return result;
}
export function inspectBuiltinEffectBindings(elf: Elf, defaults: Elf[]): BindingDiagnostic[] {
  const source = sourceFor(elf, defaults); if (!source) return [];
  const baseline = baselineFor(elf);
  const result: BindingDiagnostic[] = [];
  mapDefinitions(elf, source, (key, value, canonical) => {
    if (!canonical?.kit?.length) { result.push({key, name:value.name, status:'source-missing'}); return value; }
    const current = savedSignature(key,value,elf), latest = signature(canonical), previous = baseline[key];
    const effective=key==='soul'?{...value,kit:soulDefinition(elf).kit}:value;
    result.push({key, name:value.name, status: current === latest ? 'current' : previous === current ? 'upgradeable' : previous ? 'modified' : 'untracked',
      ...(current===latest?{}:{differences:fields.filter(field=>stable(effective[field]??null)!==stable(canonical[field]??null)),
        ...(stable(effective.kit??null)===stable(canonical.kit??null)?{}:{kitDifferences:changedPaths(effective.kit,canonical.kit)})})});
    return value;
  });
  return result;
}

/** 三方比較：上次內建版本／存檔現在內容／最新內建；只有未被修改的定義自動升級。 */
export function synchronizeBuiltinEffectBindings(elf: Elf, defaults: Elf[]): Elf {
  const source = sourceFor(elf, defaults); if (!source) return elf;
  const bindings = elf.builtinEffectBindings;
  const baseline = baselineFor(elf);
  const next = {...baseline};
  const updated = mapDefinitions(elf, source, (key, value, canonical) => {
    if (!canonical?.kit?.length) return value;
    const current = savedSignature(key,value,elf), latest = signature(canonical);
    if (current === latest) { next[key] = latest; return value; }
    if (baseline[key] !== current) return value;
    const replacement = {...value};
    for (const field of fields) delete replacement[field];
    Object.assign(replacement, structuredClone(projection(canonical)));
    next[key] = latest;
    return replacement;
  });
  if (stable(next) === stable(baseline) && bindings?.schemaVersion === 1 && bindings.elfId === String(elf.id)) return updated;
  if (!Object.keys(next).length) return updated;
  return {...updated, builtinEffectBindings:{schemaVersion:1, elfId:String(elf.id), definitions:next}};
}

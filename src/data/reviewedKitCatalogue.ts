import type { Elf, Skill } from '../types';
import type { KitEntry } from '../effects/effectSystem.schema';
import packed from './reviewedKits.homepage.json';
import {unpackReviewedKits} from './packedReviewedKits';
import {isLegacyWrappedKit} from '../blocks/ops/legacyHandler';
import {buildWrappedKit,isSlimWrapped,textFingerprint,wrappedKey,wrappedLabel,type SlimWrapped,type WrappedKind} from '../blocks/ops/legacyWrappedKit';
// legacy_handler 包裝仍由舊 handler 執行：模式用 registry（不是 kit），避免關掉舊路徑。
const kitMode=(kit:KitEntry[])=>isLegacyWrappedKit(kit)?'registry' as const:'kit' as const;
type FullDefinition = { kind?:'soul'|'trait'; elfIds: string[]; name: string; description: string; kit: KitEntry[] };
type Definition = FullDefinition | SlimWrapped;
// 專屬機制包裝（過渡）在首頁封裝只存指紋，用精靈自己的原文還原；原文不符就不套用。
function slimWrappedKit(candidates:Definition[],kind:WrappedKind,elf:Elf,item:{name:string;description:string}):KitEntry[]|undefined{
  const fp=textFingerprint(item.description);
  return candidates.some(d=>isSlimWrapped(d)&&d.kind===kind&&d.name===item.name&&d.fp===fp)
    ? buildWrappedKit(kind,String(elf.id),wrappedKey(kind,elf.name,item.name),item.description,wrappedLabel(kind,elf.name,item.name)) : undefined;
}
const isFull=(d:Definition):d is FullDefinition=>!isSlimWrapped(d);
const byOwner = new Map<string, Definition[]>();
function register(data:{schemaVersion:number;gzip:string}){
  const definitions=unpackReviewedKits<Definition[]>(data);
  for(const definition of definitions)for(const id of definition.elfIds)byOwner.set(id,[...(byOwner.get(id)||[]),definition]);
}
register(packed);
let deferred:Promise<void>|null=null;
/** 與競技場／匯入精靈一同載入，完成前不公布那些精靈，避免圖紙暫時缺漏。 */
export function loadDeferredReviewedKits():Promise<void>{
  return deferred??=import('./reviewedKits.deferred.json').then(({default:data})=>register(data)).catch(error=>{deferred=null;throw error;});
}

/** 建置前核對完整原始定義；執行時只還原可信資料一次，不載入大型建構原碼。 */
export function applyReviewedSkillKits(elf: Elf): Elf {
  const candidates = byOwner.get(String(elf.id)) || [];
  const apply = (skill: Skill): Skill => {
    if (skill.effectMode && skill.effectMode !== 'auto' || skill.kit?.length) return skill;
    const exact = candidates.find((d):d is FullDefinition => isFull(d) && !d.kind && d.name === skill.name && d.description === skill.description);
    if (exact) return { ...skill, effectMode: kitMode(exact.kit), kit: structuredClone(exact.kit) };
    const wrapped = slimWrappedKit(candidates, 'skill', elf, skill);
    return wrapped ? { ...skill, effectMode: 'registry', kit: wrapped } : skill;
  };
  const soul=elf.soulMark,untouchedSoul=!!soul && !(soul.effectMode && soul.effectMode!=='auto') && !soul.kit?.length;
  const exactSoul=untouchedSoul
    ? candidates.find((d):d is FullDefinition=>isFull(d)&&d.kind==='soul'&&d.name===soul!.name&&d.description===soul!.description):undefined;
  const wrappedSoul=untouchedSoul&&!exactSoul?slimWrappedKit(candidates,'soul',elf,soul!):undefined;
  const applyTrait = <T extends {name:string;description:string;effectMode?:string;kit?:KitEntry[]}>(trait:T|undefined):T|undefined => {
    if(!trait || trait.effectMode && trait.effectMode!=='auto' || trait.kit?.length)return trait;
    const exact=candidates.find((d):d is FullDefinition=>isFull(d)&&d.kind==='trait'&&d.name===trait.name&&d.description===trait.description);
    if(exact)return {...trait,effectMode:kitMode(exact.kit),kit:structuredClone(exact.kit)};
    const wrapped=slimWrappedKit(candidates,'trait',elf,trait);
    return wrapped ? {...trait,effectMode:'registry' as const,kit:wrapped} : trait;
  };
  const applyAlienTraits = (traits: NonNullable<typeof elf.alienTraits>) => {
    const next: any = { ...traits };
    for (const key of ['gen2Trait', 'exclusiveTrait', 'alienTrait', 'generalTrait'] as const) if (next[key]) next[key] = applyTrait(next[key]);
    if (Array.isArray(next.exclusiveTraits)) next.exclusiveTraits = next.exclusiveTraits.map((t: any) => applyTrait(t)!);
    return next;
  };
  return { ...elf, skills: elf.skills.map(apply), skillPool: elf.skillPool?.map(apply),
    trait:applyTrait(elf.trait),
    // 只改寫實際存在的特質欄位，不留下值為 undefined 的鍵（存成圖紙再讀回時鍵不一致）。
    ...(elf.alienTraits?{alienTraits:applyAlienTraits(elf.alienTraits)}:{}),
    ...(exactSoul?{soulMark:{...soul!,effectMode:kitMode(exactSoul.kit),kit:structuredClone(exactSoul.kit)}}
      :wrappedSoul?{soulMark:{...soul!,effectMode:'registry' as const,kit:wrappedSoul}}:{}) };
}

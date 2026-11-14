import packedSeeds from './defaultElfSeeds.packed.json';
import {unpackReviewedKits} from './packedReviewedKits';
import { ELF_TEXT } from "./elfDescriptions";
import { SOURCE_TEXT, SKILL_REFERENCES } from './descriptionSources';
import { ELF_ID_MAPPING } from "./elfRegistry";
import { Elf, Skill, StatChange } from "../types";
import { KitEntry } from "../effects/effectSystem.schema";
import { calculateElfStats } from "../utils/statCalculator";
import { getEffectiveInscriptions } from "./inscriptionsCatalog";
import { parseStatChangesFromText } from "../utils/statChangeManager";
import { parseStatusesFromText } from "../utils/statusManager";
import { isSkillStone, stoneBasePp } from './skillStones';
import { applyReviewedSkillKits,loadDeferredReviewedKits } from './reviewedKitCatalogue';
import {fillElfPhysicalMeasurements} from './elfPhysicalMeasurements';
import {normalizeElfSkillText} from './skillTextNormalize';
import {withDefaultResistances} from '../battle/resistances';

// 完整原始定義在 defaultElfSeedsSource.ts；建置逐欄核對，執行期只讀無損封裝。
const SEED_ELVES=unpackReviewedKits<Elf[]>(packedSeeds);


import { getNumericElfId } from './elfRegistry';

/** 套用 elf_source_files 的標準描述與數值（elfSourceText.json，由 txt 匯入；txt 為準） */
type SourceSkill = { d: string; f?: Partial<Skill> };
type SourceEntry = { soulMark?: string; destiny?: string; skills: Record<string, SourceSkill>; add?: Skill[]; ss?: Record<string, string> };
export const SOURCE_SS_TEXT: Record<string, string> = Object.assign({}, ...Object.values(SOURCE_TEXT as Record<string, SourceEntry>).map(e => e.ss || {}));
function applySourceText(item: Elf): Elf {
  const st = (SOURCE_TEXT as Record<string, SourceEntry>)[String(item.id)];
  // 屬性技能的屬性欄誤填「屬性」→「無屬性」
  const fixType = (sk: Skill): Skill => (sk.type === "屬性" ? { ...sk, type: "無屬性" } : sk);
  if (!st) return { ...item, skills: item.skills?.map(fixType) || item.skills, skillPool: item.skillPool?.map(fixType) };
  const apply = (sk: Skill): Skill => {
    const src = st.skills[sk.name];
    return src ? { ...sk, ...(src.f || {}), description: src.d } : sk;
  };
  const withDesc = (list?: Skill[]) => list?.map(fixType).map(apply);
  let soulMark = item.soulMark;
  if (soulMark && (st.soulMark || st.destiny)) {
    const [oldMain, ...rest] = (soulMark.description || "").split("【命運之輪");
    const oldDestiny = rest.length ? "【命運之輪" + rest.join("【命運之輪") : "";
    const main = st.soulMark || oldMain.trim();
    const destiny = st.destiny || oldDestiny.trim();
    soulMark = { ...soulMark, description: destiny ? `${main}\n\n${destiny}` : main };
  }
  const skills = withDesc(item.skills) || item.skills;
  let skillPool = withDesc(item.skillPool);
  // txt 有、app 沒有的技能 → 加入技能庫
  const have = new Set([...(skills || []), ...(skillPool || [])].map(x => x.name));
  const added = (st.add || []).filter(x => !have.has(x.name));
  if (added.length) skillPool = [...(skillPool || []), ...added];
  return { ...item, soulMark, skills, skillPool };
}

const prepareSeeds = (items: any[]): Elf[] => items.map(fillElfPhysicalMeasurements).map(applySourceText).map(applyReviewedSkillKits).map(normalizeElfSkillText).map(withDefaultResistances);
function finalizeSeed(item: Elf, index: number): Elf {
  const inscriptions = getEffectiveInscriptions(item.inscriptions);
  const calculated = calculateElfStats(item.baseStats, item.level, item.ivs, item.evs, item.natureModifiers, inscriptions);
  return {
    ...item,
    skills: item.skills.map(s => isSkillStone(s) ? { ...s, isSkillStone: true, skillStoneRuleset: 'project' as const, pp: stoneBasePp(s), maxPp: stoneBasePp(s) } : s),
    skillPool: item.skillPool?.map(s => isSkillStone(s) ? { ...s, isSkillStone: true, skillStoneRuleset: 'project' as const, pp: stoneBasePp(s), maxPp: stoneBasePp(s) } : s),
    id: getNumericElfId(item.id || `default_${index}`, item.name),
    inscriptions,
    calculatedStats: calculated,
    currentHp: calculated.hp,
    maxHp: calculated.hp
  };
}

/** 預設精靈清單（同一個陣列物件）。API 匯入的精靈在 loadImportedElves() 完成後才追加到尾端。 */
export const DEFAULT_ELVES: Elf[] = prepareSeeds(SEED_ELVES).map(finalizeSeed);

// ── 延後載入：API 匯入精靈與階段競技場精靈（stagedArenaElves＋heavyweights.json）的資料不進首頁初始 JS ──────────────────────────
// 載入完成前清單不含匯入精靈；完成後以與其他精靈完全相同的流程（原文套用→審核 Kit→定稿）追加，並通知訂閱者。
let importedLoad: Promise<void> | null = null;
let revision = 0;
const listeners = new Set<() => void>();
export const getDefaultElvesRevision = () => revision;
export function subscribeDefaultElves(listener: () => void): () => void { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function loadImportedElves(): Promise<void> {
  // 順序與先前靜態載入相同：階段競技場精靈（原本在 SEED_ELVES 尾端）→ API 匯入精靈，皆追加在清單尾端。
  importedLoad ??= Promise.all([import("./stagedArenaElves"), import("./importedElves"),loadDeferredReviewedKits()]).then(([{ STAGED_ARENA_ELVES }, { IMPORTED_ELF_SEEDS }]) => {
    const start = DEFAULT_ELVES.length;
    DEFAULT_ELVES.push(...prepareSeeds([...STAGED_ARENA_ELVES, ...IMPORTED_ELF_SEEDS] as any).map((item, i) => finalizeSeed(item, start + i)));
    revision++;
    listeners.forEach(listener => listener());
  }).catch(error => { importedLoad = null; throw error; });
  return importedLoad;
}

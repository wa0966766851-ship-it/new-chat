/** 原廠 BOSS 特性的異常資料庫條目（BOSS_ONLY：無回合數、不遞減、下場保留）；資料來自 src/data/bossTraits.ts，神話沿用既有條目。 */
import type { StatusRegistryEntry } from './statusRegistry';
import { BOSS_TRAITS, bossTraitText } from '../data/bossTraits';

export const BOSS_TRAIT_POWER = "特性·力量";

export const BOSS_TRAIT_STATUSES: Record<string, StatusRegistryEntry> = {
  ...Object.fromEntries(BOSS_TRAITS.filter(t => t.conf !== "existing").map(t => [t.status, {
    name: t.status,
    categories: ["BOSS_ONLY"],
    description: `BOSS 特性・${t.name}。${bossTraitText(t)}（BOSS 專用，無回合數、下場後保留）`,
    mechanics: [{ type: "SPECIAL_BUFF", params: { bossTrait: t.id, ...t.def } }],
  } as StatusRegistryEntry])),
  // 覺醒的「力量」：有回合數的附屬類異常，效果由覺醒處理器讀取（無視強化弱化、攻擊必暴、消除回合、造成傷害回血）
  [BOSS_TRAIT_POWER]: {
    name: BOSS_TRAIT_POWER,
    categories: ["AUXILIARY"],
    description: "附屬類異常；BOSS 特性「覺醒」賦予：無視強化弱化、攻擊必定致命一擊、攻擊後消除對手回合類效果、造成傷害時恢復等量體力。",
    mechanics: [{ type: "SPECIAL_BUFF", params: { bossTraitPower: true } }],
  },
};

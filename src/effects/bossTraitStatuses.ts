/** 原廠 BOSS 特性的異常資料庫條目（附屬類異常 + BOSS 類異常；無回合數、不遞減、下場保留）；資料來自 src/data/bossTraits.ts，神話沿用既有條目。 */
import type { StatusRegistryEntry } from './statusRegistry';
import { BOSS_TRAITS, bossTraitText, type BossTraitDef } from '../data/bossTraits';

export const BOSS_TRAIT_POWER = "特性·力量";

/**
 * BOSS 特性的正式描述（2026-10-29 使用者規格）。
 * 格式：附屬類異常；BOSS 類異常；處於該異常狀態則<效果>（等級 1/2/3 分別為 …）。無回合數且不會隨回合遞減，下場後保留
 */
function bossStatusDescription(t: BossTraitDef): string {
  // 代入預設參數得到實際數值（不是模板）
  const effect = bossTraitText(t);
  // 有 lv（星蝕回廊依難度等級 0–3 的 x 值）時補上等級差異
  let levelText = '';
  if (Array.isArray(t.lv) && t.lv.length === 4) {
    const [l1, l2, l3, l4] = t.lv;
    const unit = String(t.lab?.x || '');
    const sign = unit.includes('%') || unit.includes('倍') ? '' : '+';
    levelText = `（等級 1/2/3 分別為 ${sign}${l1}/${sign}${l2}/${sign}${l3}/${sign}${l4}${unit.includes('%') ? '%' : ''}）`;
  } else if (t.lab?.x) {
    levelText = `（${t.lab.x}＝${t.def?.x ?? ''}）`;
  }
  // 原 desc 結尾常有句號，先清掉再拼接，避免「。。」
  const cleanEffect = effect.replace(/[。.]\s*$/, '');
  return `附屬類異常；BOSS 類異常；處於該異常狀態則${cleanEffect}${levelText}。無回合數且不會隨回合遞減，下場後保留`;
}

export const BOSS_TRAIT_STATUSES: Record<string, StatusRegistryEntry> = {
  ...Object.fromEntries(BOSS_TRAITS.filter(t => t.conf !== "existing").map(t => [t.status, {
    name: t.status,
    // 2026-10-29 修正：BOSS 特性在 PVP 被施加時屬「附屬類異常」，原本只有 BOSS_ONLY 導致被剝離。
    categories: ["AUXILIARY", "BOSS_ONLY"],
    description: bossStatusDescription(t),
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

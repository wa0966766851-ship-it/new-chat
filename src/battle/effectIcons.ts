// 異常狀態／效果圖標與說明（資料來源：SeerAPI battle_effect、buff；圖檔：seer-unity-assets battleeffect）
import data from "../data/seerEffects.json";
import { getStatMultiplier } from "../utils/statCalculator";
import { BOSS_TRAIT_BY_STATUS, bossTraitIcon, bossTraitText, BOSS_TRAIT_BADGE_DIR, BOSS_TRAIT_ICON_DIR } from "../data/bossTraits";

type StatusRow = [number, string, string]; // [圖標ID, 類別, 官方說明]
const STATUS = (data as any).status as Record<string, StatusRow>;
const BUFF_TAGS = (data as any).buffTags as Record<string, number>;
// Seer battle-effect static assets: myth (yellow) and immunity (blue).
const BOSS_STATUS_ICON_IDS: Record<string, number> = { 神話: 17, 免疫: 18 };
// Locally supplied artwork for statuses without the intended in-game icon.
const CUSTOM_STATUS_ICONS: Record<string, string> = {
  沉睡: "/status-icons/沉睡.png",
  星佑: "/status-icons/星佑.png",
  星護: "/status-icons/星護.png",
  繳械: "/status-icons/繳械.png",
  // Approved artwork (2026-10-03); presentation only, no status-rule overrides.
  眩暈: "/status-icons/眩暈.png",
  神悔: "/status-icons/神悔.png",
  腐朽: "/status-icons/腐朽.png",
  失溫: "/status-icons/失溫.png",
  遲鈍: "/status-icons/遲鈍.png",
  窒息: "/status-icons/窒息.png",
  平靜: "/status-icons/平靜.png",
  入魔: "/status-icons/入魔.png",
  // 黯痕無官方圖示：以專屬向量素材補上（僅呈現，不改狀態規則）。
  黯痕: "/status-icons/黯痕.svg",
};
// User-provided battle UI artwork; these are intentionally not SeerAPI buff ids.
const CUSTOM_BUFF_ICONS: Record<string, string> = {
  護盾: "/status-icons/精靈護盾.png",
  護罩: "/status-icons/精靈護罩.png",
};

const ALIAS: Record<string, string> = { 麻痹: "麻痺", 神游: "神遊", 魘味: "魘昧", 異常抵抗: "異常免疫", 免疫: "異常免疫" };

export interface EffectVisual { icon?: string; desc?: string; category?: string }

/** 官方異常狀態：名稱 → 圖標與說明 */
export function statusVisual(name?: string): EffectVisual | null {
  if (!name) return null;
  const n = ALIAS[name] || name;
  if (CUSTOM_STATUS_ICONS[n]) {
    return { icon: CUSTOM_STATUS_ICONS[n], category: STATUS[n]?.[1] || "" };
  }
  // 原廠 BOSS 特性：有圖用 battleeffect/bosseffect，無圖用文字徽記（神話沿用既有 abnormal/17）
  const trait = BOSS_TRAIT_BY_STATUS[name];
  if (trait && trait.conf !== "existing") return { icon: bossTraitIcon(trait), category: 'BOSS_ONLY', desc: bossTraitText(trait) };
  if (name === "特性·力量") return { icon: `${BOSS_TRAIT_BADGE_DIR}power.svg`, category: 'AUXILIARY' };
  if (BOSS_STATUS_ICON_IDS[name] !== undefined) {
    return { icon: `/seer/abnormal/${BOSS_STATUS_ICON_IDS[name]}.png`, category: 'BOSS_ONLY' };
  }
  const row = STATUS[n];
  if (!row) return null;
  return { icon: `/seer/abnormal/${row[0]}.png`, category: row[1], desc: row[2] };
}

// 關鍵字 → 官方 buff 標籤（取圖標）
const KEYWORDS: [RegExp, string][] = [
  [/免疫.*(異常)|異常.*免疫|異常抵抗/, "免疫異常"], [/免疫.*(弱化|能力下降)/, "免疫弱化"],
  [/免死|不死|存活|庇護|殘留1點/, "免死"], [/重生|復活/, "重生"],
  [/反彈|反傷|反擊/, "反傷"], [/吸血|汲取|吸取.*體力/, "吸血"],
  [/降療|恢復量下降|無法恢復/, "降療"],
  [/技能無效|失效|封印|封鎖|無法使用/, "技能無效"], [/閃避/, "閃避"],
  [/傷害限制|不超過/, "傷害限制"], [/減傷|傷害降低|傷害減少|減半/, "減傷"], [/免傷|抵擋|攻擊免疫/, "免傷"],
  [/先制-|先制降低/, "先制降低"], [/先制|先手/, "先制"],
  [/致命一擊|暴擊/, "致命一擊"], [/秒殺|瞬殺/, "秒殺"],
  [/切換/, "切換限制"],
  [/^強化$/, "強化"], [/^弱化$/, "弱化"],
];

/** 依效果名稱／說明推斷通用效果圖標（找不到回傳 undefined） */
export function buffIconFor(text?: string): string | undefined {
  if (!text) return undefined;
  // 2026-10-28：嫉妒是 BOSS 特性（官方 bossEffectIcon iconId 19），
  // 原本 seerEffects.json 的 buffTags.嫉妒→19 會指到 seer/buff/19.png（那是「恢復」圖）。
  if (/嫉妒/.test(text)) return `${BOSS_TRAIT_ICON_DIR}19.png`;
  if (/護盾/.test(text)) return CUSTOM_BUFF_ICONS.護盾;
  if (/護罩/.test(text)) return CUSTOM_BUFF_ICONS.護罩;
  for (const [re, tag] of KEYWORDS) {
    if (re.test(text) && BUFF_TAGS[tag] != null) return `/seer/buff/${BUFF_TAGS[tag]}.png`;
  }
  return undefined;
}

export const STAT_FULL: Record<string, string> = { atk: "攻擊", def: "防禦", spatk: "特攻", spdef: "特防", speed: "速度", accuracy: "命中" };

/** 能力等級說明（倍率） */
export function stageDesc(key: string, v: number): string {
  const mult = getStatMultiplier(v, key === "accuracy");
  return `${STAT_FULL[key] || key}等級 ${v > 0 ? "+" : ""}${v}：${STAT_FULL[key] || key}×${Number(mult.toFixed(2))}`;
}

/** 官方印記（sign）圖示：battleeffect/signbuff/<id>.png，id 取自 SeerAPI api-data sign。 */
const SIGN_ICON_IDS: Record<string, number> = {
  精靈護盾: 2, 護盾: 2, 精靈護罩: 3, 護罩: 3,
  星芳之纏: 96, 星芳之缠: 96, 星海之浸: 97, 星火之灼: 98,
  // 無極聖武專屬印記（SeerAPI sign 133–137，圖檔 battleeffect/signbuff/<id>.png）
  英雄之耀: 133, 亮節: 134, 亮节: 134, 威怯: 135, 武誅: 136, 武诛: 136, 英雄之誡: 137, 英雄之诫: 137,
  // 其他精靈印記（名稱與 SeerAPI sign 完全一致才收錄）
  永恆之水: 108, 永恒之水: 108,
  寂殺之魄: 110, 寂杀之魄: 110,
  肅霜之禁: 111, 肃霜之禁: 111,
  魔王咒怨: 121,
  嫉妒: 225,
  // 哈莫林 龍鱗（官方 sign 48–51）
  紅色龍鱗: 48, 红色龙鳞: 48, 黃色龍鱗: 49, 黄色龙鳞: 49,
  藍色龍鱗: 50, 蓝色龙鳞: 50, 白色龍鱗: 51, 白色龙鳞: 51,
};

/**
 * 專案自製印記圖（不是官方 sign id，直接給路徑）。
 * - 無色龍鱗：以官方白色龍鱗為底，把彩色部分挖空成半透明。
 * - 綠色龍鱗：以官方藍色龍鱗為底，色相轉綠（官方沒有綠色龍鱗）。
 */
const CUSTOM_MARK_ICONS: Record<string, string> = {
  無色龍鱗: '/seer/signbuff/custom/無色龍鱗.png',
  无色龙鳞: '/seer/signbuff/custom/無色龍鱗.png',
  綠色龍鱗: '/seer/signbuff/custom/綠色龍鱗.png',
  绿色龙鳞: '/seer/signbuff/custom/綠色龍鱗.png',
  // 官方 sign 表無同名條目的專屬印記 → 文字徽記 SVG（2026-10-29）
  八荒: '/seer/signbuff/custom/印記_八荒.svg',
  四象待解除: '/seer/signbuff/custom/印記_四象待解除.svg',
  未暝之夜: '/seer/signbuff/custom/印記_未暝之夜.svg',
  伏魔印記: '/seer/signbuff/custom/印記_伏魔印記.svg',
  埒殘銜闕: '/seer/signbuff/custom/印記_埒殘銜闕.svg',
  '真龍・治癒': '/seer/signbuff/custom/印記_真龍治癒.svg',
  真龍治癒: '/seer/signbuff/custom/印記_真龍治癒.svg',
  能量: '/seer/signbuff/custom/印記_能量.svg',
  堅壁解析: '/seer/signbuff/custom/印記_堅壁解析.svg',
  萬相乖離: '/seer/signbuff/custom/印記_萬相乖離.svg',
  詩章: '/seer/signbuff/custom/印記_詩章.svg',
  墮魔印記: '/seer/signbuff/custom/印記_墮魔印記.svg',
  龍魂之力: '/seer/signbuff/custom/印記_龍魂之力.svg',
  龍魂之源: '/seer/signbuff/custom/印記_龍魂之源.svg',
  龍魂印記: '/seer/signbuff/custom/印記_龍魂印記.svg',
  燦界聖芒: '/seer/signbuff/custom/印記_燦界聖芒.svg',
  霜寒幽光: '/seer/signbuff/custom/印記_霜寒幽光.svg',
  魔軀枷鎖: '/seer/signbuff/custom/印記_魔軀枷鎖.svg',
  'ᛏ 戰神符文': '/seer/signbuff/custom/印記_戰神符文.svg',
  戰神符文: '/seer/signbuff/custom/印記_戰神符文.svg',
};
export function signIconFor(name?: string): string | undefined {
  if (!name) return undefined;
  if (CUSTOM_MARK_ICONS[name]) return CUSTOM_MARK_ICONS[name];
  const id = SIGN_ICON_IDS[name];
  return id !== undefined ? `/seer/signbuff/${id}.png` : undefined;
}

export const UNKNOWN_EFFECT_ICON = '/status-icons/effect-placeholder.svg';
/** Exact, explicitly selected tag only. A composite description must never pick its first keyword. */
export function effectIcon(iconTag?: string, markName?: string): string {
  if (iconTag && CUSTOM_BUFF_ICONS[iconTag]) return CUSTOM_BUFF_ICONS[iconTag];
  if (iconTag && SIGN_ICON_IDS[iconTag] !== undefined) return `/seer/signbuff/${SIGN_ICON_IDS[iconTag]}.png`;
  if (iconTag && BUFF_TAGS[iconTag] !== undefined) return `/seer/buff/${BUFF_TAGS[iconTag]}.png`;
  return signIconFor(markName) || UNKNOWN_EFFECT_ICON;
}

const CATALOG_ICON_TAGS: Record<string, string> = {
  immune_status_turns: '免疫異常', status_immune: '免疫異常', immune_drop_turns: '免疫弱化',
  seal_support_turns: '技能無效', prop_invalid_turns: '技能無效', attack_invalid_turns: '技能無效',
  negate_attack_turns: '免傷', dodge_turns: '閃避', vampire_turns: '吸血',
  shield_active: '護盾', barrier_active: '護罩', true_dmg_turns: '附加傷害',
};
export function catalogEffectIcon(id: string, label?: string): string {
  return effectIcon(CATALOG_ICON_TAGS[id], label);
}
export { STATE_SIGNS } from "./stateSigns";

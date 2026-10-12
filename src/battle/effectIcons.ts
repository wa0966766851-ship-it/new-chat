// 異常狀態／效果圖標與說明（資料來源：SeerAPI battle_effect、buff；圖檔：seer-unity-assets battleeffect）
import data from "../data/seerEffects.json";
import { getStatMultiplier } from "../utils/statCalculator";

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
};
export function signIconFor(name?: string): string | undefined {
  if (!name) return undefined;
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

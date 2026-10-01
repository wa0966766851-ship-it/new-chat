// 精靈描述 → 積木（Program）。純文字解析，不依賴戰鬥狀態，可在 UI 與執行端共用。
import type { Act, Clause, Cond, Program, Stmt, Trigger } from "./model";
import { CUSTOM, CUSTOM_HEADERS } from "./custom";

// ───────── 數值 ─────────
const FRAC: Record<string, number> = { "½": 1 / 2, "⅓": 1 / 3, "¼": 1 / 4, "⅕": 1 / 5, "⅙": 1 / 6, "⅛": 1 / 8, "⅔": 2 / 3, "¾": 3 / 4, 一半: 1 / 2 };
const CN: Record<string, number> = { 一: 1, 二: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
export const NUM = String.raw`(\d+(?:\.\d+)?|[一二兩三四五六七八九十])`;
export const RATIO = String.raw`(\d+\s*\/\s*\d+|\d+(?:\.\d+)?%|[½⅓¼⅕⅙⅛⅔¾]|一半)`;
export const n = (s?: string) => (s == null ? NaN : CN[s] ?? Number(s));
export function ratio(s?: string): number {
  if (!s) return NaN;
  s = s.replace(/\s/g, "");
  if (FRAC[s] != null) return FRAC[s];
  if (s.endsWith("%")) return Number(s.slice(0, -1)) / 100;
  const m = s.match(/^(\d+)\/(\d+)$/);
  return m ? Number(m[1]) / Number(m[2]) : NaN;
}
const pct = (r: number) => (Math.round(r * 10000) / 100) + "%";
/** 傷害分類標籤：攻擊傷害＝攻擊技能公式；X系技能傷害；固定／百分比／真實 */
const KIND: Record<string, string> = { 攻擊: "攻擊傷害", 技能: "技能傷害", 非真實: "非真實傷害", "": "所有傷害" };
const dmgName = (type: string, elem?: string) => (type === "技能" ? `${elem || ""}系技能傷害` : `${type}傷害`);

export const STATUS_LIST = "麻痺|麻痹|中毒|燒傷|害怕|睡眠|冰封|石化|寄生|凍傷|混亂|衰弱|失明|疲憊|焚燼|詛咒|感染|束縛|流血|癱瘓|沉默|失神|臣服|凝滯|狂暴|神遊|神游|空定|狂信|星贖|星賜|星哲|雷解|漸凍|魘昧|沸湧|砥礪|超頻|繳械|窒息|烈焰詛咒|致命詛咒|虛弱詛咒|失控詛咒|山神守護|易燃|腐朽|失溫|遲鈍|沉睡";
const ST = `(${STATUS_LIST})`;
const STAT_WORD = "全屬性|全能力|所有能力|雙攻|雙防|攻擊|防禦|特攻|特防|速度|命中";
const STATS = `((?:${STAT_WORD})(?:\\s*[、與和及,，]\\s*(?:${STAT_WORD}))*)`;
export const STAT_KEYS: Record<string, string[]> = {
  全屬性: ["atk", "def", "spatk", "spdef", "speed", "accuracy"], 全能力: ["atk", "def", "spatk", "spdef", "speed", "accuracy"], 所有能力: ["atk", "def", "spatk", "spdef", "speed", "accuracy"],
  雙攻: ["atk", "spatk"], 雙防: ["def", "spdef"], 攻擊: ["atk"], 防禦: ["def"], 特攻: ["spatk"], 特防: ["spdef"], 速度: ["speed"], 命中: ["accuracy"],
};
const statList = (s: string) => s.split(/\s*[、與和及,，]\s*/).filter(Boolean);
const who = (s?: string): "self" | "opp" | "both" => (!s ? "opp" : /雙方|敵我/.test(s) ? "both" : /自身|自己|己方/.test(s) ? "self" : "opp");
const whoLabel = (w: string) => (w === "self" ? "自身" : w === "both" ? "雙方" : "對手");

// ───────── 動作庫 ─────────
interface ActDef { op: string; re: RegExp; p: (m: RegExpMatchArray, s: string) => Record<string, any>; label: (p: any) => string }
const A = (op: string, re: RegExp, p: ActDef["p"], label: ActDef["label"]): ActDef => ({ op, re, p, label });

export const ACTS: ActDef[] = [
  // 純標記（由技能欄位處理）
  A("noop", /^(必中|先制\s*[+＋-]\s*\d+|先手攻擊|必定先手|__RAMP__|無特殊效果|（無特殊效果）|造成(?:物理|特殊|攻擊|技能)?傷害|攻擊技能|屬性技能)$/, (m) => ({ tag: m[0] }), (p) => p.tag),
  A("noop", /^該技能(?:為)?(?:必中|先制)/, (m) => ({ tag: m[0] }), (p) => p.tag),

  // ── 異常
  A("status_seq", new RegExp(`^依次(?:令|使)對[手方](?:進入)?((?:${STATUS_LIST})(?:[、,，](?:${STATUS_LIST}))+)(?:狀態)?`), (m) => ({ list: m[1].split(/[、,，]/) }), (p) => `依次附加 ${p.list.join("→")}`),
  A("status", new RegExp(`^(?:(\\d+)%\\s*(?:的)?(?:機率)?\\s*)?(?:令|使|為)?(敵我雙方|雙方|自身|對[手方])?(?:同時)?(?:進入|陷入|附加)?(?:(\\d+)\\s*回合(?:的)?)?${ST}(?:異常)?(?:狀態)?(?:(\\d+)\\s*回合)?$`),
    (m) => ({ chance: m[1] ? n(m[1]) : 100, side: who(m[2]), status: m[4].replace("麻痹", "麻痺").replace("神游", "神遊"), turns: m[3] ? n(m[3]) : m[5] ? n(m[5]) : undefined }),
    (p) => `${whoLabel(p.side)} ${p.status}${p.turns ? ` ${p.turns}回合` : ""}${p.chance < 100 ? ` (${p.chance}%)` : ""}`),
  A("status", new RegExp(`^(?:(\\d+)%\\s*(?:機率)?)?(?:令|使)(雙方|自身|對[手方])(?:隨機)?進入(?:(\\d+)\\s*回合(?:的)?)?${ST}`),
    (m) => ({ chance: m[1] ? n(m[1]) : 100, side: who(m[2]), status: m[4], turns: m[3] ? n(m[3]) : undefined }),
    (p) => `${whoLabel(p.side)} ${p.status}${p.turns ? ` ${p.turns}回合` : ""}${p.chance < 100 ? ` (${p.chance}%)` : ""}`),
  A("status_random", /^(?:令|使)?對[手方]隨機進入(兩|二|\d+)?種?(非附屬類|弱化類|控制類)?異常(?:狀態)?/, (m) => ({ count: m[1] ? n(m[1]) : 1, cls: m[2] || "" }), (p) => `對手隨機 ${p.count} 種${p.cls}異常`),
  A("cure_status", /^(?:解除|消除)(自身|雙方|對[手方])(?:所有|的)?(?:異常|異常狀態)(?:狀態)?$/, (m) => ({ side: who(m[1]) }), (p) => `解除${whoLabel(p.side)}異常`),
  A("convert_status", new RegExp(`^將(自身|對[手方])(?:所處的?)?(?:異常|異常狀態)(?:狀態)?轉化為${ST}`), (m) => ({ side: who(m[1]), status: m[2] }), (p) => `${whoLabel(p.side)}異常轉化為 ${p.status}`),
  A("immune_status_count", /^(?:令)?(自身)?免疫(?:並反彈)?下\s*(\d+|[一二兩三])\s*次(?:受到的)?(?:異常|異常狀態)/, (m) => ({ count: n(m[2]), reflect: /反彈/.test(m[0]) }), (p) => `免疫${p.reflect ? "並反彈" : ""}下 ${p.count} 次異常`),

  // ── 能力等級
  A("stat_clear", /^消除(對[手方]|自身|雙方|敵我雙方)(?:的)?(?:所有)?能力(提升|上升|下降)(?:、(?:下降|提升|上升))?(?:狀態)?$/, (m) => ({ side: who(m[1]), kind: /下降/.test(m[2]) && !/[、]/.test(m[0]) ? "down" : /[、]/.test(m[0]) ? "all" : "up" }), (p) => `消除${whoLabel(p.side)}能力${p.kind === "up" ? "提升" : p.kind === "down" ? "下降" : "變化"}`),
  A("stat_clear", /^(?:解除|清除)(自身|對[手方])(?:的)?(?:所有)?能力下降(?:狀態)?$/, (m) => ({ side: who(m[1]), kind: "down" }), (p) => `解除${whoLabel(p.side)}能力下降`),
  A("stat_steal", /^(雙倍)?(吸取|複製)對[手方](?:的)?能力提升(?:狀態)?$/, (m) => ({ mode: m[2], double: !!m[1] }), (p) => `${p.mode}對手能力提升${p.double ? "×2" : ""}`),
  A("stat_reverse", /^反轉(自身|對[手方])(?:的)?能力(下降|提升)(?:狀態)?$/, (m) => ({ side: who(m[1]), kind: m[2] === "下降" ? "down" : "up" }), (p) => `反轉${whoLabel(p.side)}能力${p.kind === "down" ? "下降" : "提升"}`),
  A("stat_transfer", /^將自身(?:的)?能力下降(?:狀態)?(?:轉移|回饋|反饋)給對[手方]/, () => ({}), () => `自身能力下降轉移給對手`),
  A("stat", new RegExp(`^(?:(\\d+)%\\s*(?:機率)?)?(?:令|使|改變)?\\s*(自身|對[手方]|雙方|敵我雙方)?\\s*(?:的)?\\s*${STATS}\\s*(?:等級)?\\s*([+＋-]\\s*\\d+)$`),
    (m) => ({ chance: m[1] ? n(m[1]) : 100, side: m[2] ? who(m[2]) : "auto", stats: statList(m[3]), v: Number(m[4].replace(/[＋\s]/g, "").replace("+", "")) }),
    (p) => `${p.side === "auto" ? "" : whoLabel(p.side) + " "}${p.stats.join("、")} ${p.v > 0 ? "+" : ""}${p.v}${p.chance < 100 ? ` (${p.chance}%)` : ""}`),
  A("stat", new RegExp(`^(?:使|令)(自身|對[手方])${STATS}(?:等級)?([+＋-]\\d+)[，,]?(?:(?:使|令)?(自身|對[手方])${STATS}(?:等級)?([+＋-]\\d+))$`),
    (m) => ({ side: who(m[1]), stats: statList(m[2]), v: Number(m[3].replace("＋", "")), side2: who(m[4]), stats2: statList(m[5]), v2: Number(m[6].replace("＋", "")) }),
    (p) => `${whoLabel(p.side)} ${p.stats.join("、")} ${p.v}；${whoLabel(p.side2)} ${p.stats2.join("、")} ${p.v2}`),

  // ── 體力
  A("heal", new RegExp(`^(?:恢復|回復)(自身|對[手方])?(?:最大體力(?:的)?)?\\s*${RATIO}\\s*(?:的)?(?:最大)?(?:體力)?$`), (m) => ({ side: m[1] ? who(m[1]) : "self", ratio: ratio(m[2]) }), (p) => `恢復${whoLabel(p.side)}最大體力 ${pct(p.ratio)}`),
  A("heal", /^(?:恢復|回復)(?:自身)?(?:全部|所有)體力$/, () => ({ side: "self", ratio: 1 }), () => `恢復全部體力`),
  A("heal_flat", /^(?:恢復|回復)(?:自身)?\s*(\d+)\s*點體力$/, (m) => ({ amount: n(m[1]) }), (p) => `恢復 ${p.amount} 點體力`),
  A("heal_equal", /^(?:並)?(?:恢復|回復)(?:自身)?等量(?:的)?體力$/, () => ({}), () => `恢復等量體力`),
  A("heal_equal", /^(?:並)?(?:於附加後)?(?:恢復|回復)自身等同於(?:附加成功量|傷害量|造成傷害)的體力$/, () => ({}), () => `恢復等同附加量的體力`),
  A("atk_sum_calc", /^計算傷害時令攻擊、特攻等於原本二者總和$/, () => ({}), () => `本次計算：攻擊、特攻＝二者總和`),
  A("vampire", new RegExp(`^(?:造成的?|給予對[手方])?(?:攻擊)?(?:傷害|損傷)(?:的)?\\s*${RATIO}\\s*(?:恢復|回復)(?:自身)?(?:的)?體力$`), (m) => ({ ratio: ratio(m[1]), kind: /攻擊/.test(m[0]) ? "攻擊" : "技能" }), (p) => `吸血 ${pct(p.ratio)}`),
  A("vampire", new RegExp(`^(?:恢復|回復)(?:自身)?(?:等同於)?(?:造成|本次)(?:的)?(?:攻擊)?傷害(?:值)?(?:的)?\\s*${RATIO}(?:的)?體力(?:值)?$`), (m) => ({ ratio: ratio(m[1]), kind: /攻擊/.test(m[0]) ? "攻擊" : "技能" }), (p) => `吸血 ${pct(p.ratio)}`),
  A("maxhp", new RegExp(`^(?:令)?(自身|對[手方])(?:的)?體力上限(提升|增加|減少|降低)\\s*${RATIO}$`), (m) => ({ side: who(m[1]), ratio: ratio(m[3]) * (/減少|降低/.test(m[2]) ? -1 : 1) }), (p) => `${whoLabel(p.side)}體力上限 ${p.ratio > 0 ? "+" : ""}${pct(p.ratio)}`),

  // ── 傷害
  A("dmg", new RegExp(`^(?:附加|造成)(?:對[手方])?(?:等同於)?(自身|對[手方])?(最大體力|當前體力|已損失體力)(?:的)?\\s*${RATIO}\\s*(?:的)?(固定|百分比|真實)傷害$`),
    (m) => ({ base: m[2], of: m[1] ? who(m[1]) : "opp", ratio: ratio(m[3]), type: m[4] }), (p) => `【${dmgName(p.type)}】${p.of === "self" ? "自身" : "對手"}${p.base} ${pct(p.ratio)}`),
  A("dmg", new RegExp(`^(?:附加|造成)(?:對[手方])?\\s*${RATIO}\\s*(?:的)?(最大體力|當前體力)(?:的)?(固定|百分比|真實)傷害$`),
    (m) => ({ base: m[2], of: "opp", ratio: ratio(m[1]), type: m[3] }), (p) => `【${dmgName(p.type)}】對手${p.base} ${pct(p.ratio)}`),
  A("dmg", new RegExp(`^(?:附加|造成)(?:對[手方])?(?:雙方)?\\s*(\\d+)\\s*點(?:的)?(固定|百分比|真實)?傷害$`), (m) => ({ flat: n(m[1]), type: m[2] || "固定", both: /雙方/.test(m[0]) }), (p) => `【${dmgName(p.type)}】${p.flat}${p.both ? "（雙方）" : ""}`),
  A("dmg", new RegExp(`^(?:直接)?附加(?:對[手方])?\\s*(\\d+)\\s*點(.{1,3})系(?:技能)?傷害$`), (m) => ({ flat: n(m[1]), type: "技能", elem: m[2] }), (p) => `【${dmgName("技能", p.elem)}】${p.flat}`),
  A("dmg", new RegExp(`^減少對[手方]最大體力(?:的)?\\s*${RATIO}$`), (m) => ({ base: "最大體力", of: "opp", ratio: ratio(m[1]), type: "百分比" }), (p) => `【百分比傷害】對手最大體力 ${pct(p.ratio)}`),
  A("dmg_equal", /^(?:並)?(?:造成|附加)(?:對[手方])?等量(?:的)?(百分比|固定|真實)傷害$/, (m) => ({ type: m[1] }), (p) => `【${dmgName(p.type)}】等量`),
  A("drain", new RegExp(`^(?:吸取|汲取)對[手方](?:最大體力(?:的)?\\s*${RATIO}|當前體力(?:的)?\\s*${RATIO}|\\s*(\\d+)\\s*點(?:固定)?體力|(?:最大體力)?${RATIO}(?:的)?(?:最大)?體力)$`),
    (m) => ({ ratio: ratio(m[1] || m[4]), cur: !!m[2], ratioCur: ratio(m[2]), flat: m[3] ? n(m[3]) : undefined, true: /汲取/.test(m[0]) }),
    (p) => `${p.true ? "汲取" : "吸取"}對手${p.flat != null ? ` ${p.flat} 點` : p.cur ? `當前體力 ${pct(p.ratioCur)}` : `最大體力 ${pct(p.ratio)}`}`),
  A("mercy", /^(?:對[方手])?會?(?:餘下|保留)\s*1\s*點?體力$/, () => ({}), () => `手下留情（保留1點體力）`),

  // ── 傷害修正（本次）
  A("boost", new RegExp(`^(?:本次|當回合|本技能)?(?:自身)?(?:技能)?(?:威力|造成的?(?:攻擊|技能|非真實)?傷害|攻擊傷害|傷害)(?:額外)?(?:提升|提高|增加)\\s*${NUM}%$`), (m) => ({ mult: 1 + n(m[1]) / 100, kind: /非真實傷害/.test(m[0]) ? "非真實" : /技能傷害/.test(m[0]) ? "技能" : "攻擊", power: /威力/.test(m[0]) }), (p) => `本次【${p.power ? "攻擊威力" : KIND[p.kind]}】×${p.mult}`),
  A("boost", /^(?:本技能|本次)?(?:威力|傷害)(?:加倍|翻倍)$/, (m) => ({ mult: 2, kind: "攻擊", power: /威力/.test(m[0]) }), (p) => `本次【${p.power ? "攻擊威力" : "攻擊傷害"}】×2`),
  A("no_resist", /^(?:攻擊時)?造成的傷害不會出現微弱/, () => ({}), () => `不會出現微弱`),
  A("crit_now", /^(?:本次|當回合)?(?:攻擊)?必定(?:打出)?(?:致命一擊|暴擊)$/, () => ({}), () => `必定致命一擊`),

  // ── 持續型修正
  A("dmg_mod_turns", new RegExp(`^(\\d+)\\s*回合內(?:自身)?受到(?:的)?(攻擊|技能|非真實)?傷害(?:減少|降低)\\s*${NUM}%$`), (m) => ({ turns: n(m[1]), kind: m[2] || "", reduce: n(m[3]) / 100, dir: "in" }), (p) => `${p.turns}回合 受到【${KIND[p.kind]}】-${p.reduce * 100}%`),
  A("dmg_mod_turns", new RegExp(`^(?:下\\s*)?(\\d+)\\s*回合(?:內)?(?:自身)?(?:造成的?)?(攻擊|技能|非真實)?傷害(?:提升|提高)\\s*${NUM}%$`), (m) => ({ turns: n(m[1]), kind: m[2] || "", boost: n(m[3]) / 100, dir: "out", next: /^下/.test(m[0]) }), (p) => `${p.next ? "下" : ""}${p.turns}回合 造成【${KIND[p.kind]}】+${p.boost * 100}%`),
  A("dmg_mod_uses", new RegExp(`^(?:自身)?下\\s*(\\d+|[一二兩三])\\s*次(?:造成的?)?(攻擊|技能|非真實)?(?:攻擊)?傷害(?:提升|提高)\\s*${NUM}%$`), (m) => ({ uses: n(m[1]), kind: m[2] || "", boost: n(m[3]) / 100 }), (p) => `下${p.uses}次 【${KIND[p.kind]}】+${p.boost * 100}%`),
  A("dmg_taken_x2", /^下\s*(\d+)\s*回合對[手方]受到(?:的)?(?:攻擊)?傷害(?:提升100%|翻倍)$/, (m) => ({ turns: n(m[1]) }), (p) => `下${p.turns}回合 對手受到【所有傷害】×2`),
  A("dmg_cap_turns", /^(\d+)\s*回合內自身(?:體力)?受到(?:的)?(?:單次)?(?:攻擊|技能|非真實)?傷害不超過\s*(\d+)\s*點?$/, (m) => ({ turns: n(m[1]), cap: n(m[2]) }), (p) => `${p.turns}回合 受到【攻擊傷害】上限 ${p.cap}`),
  A("crit_turns", /^下\s*(\d+)?\s*回合(?:自身)?(?:的)?(?:技能|攻擊)?必定(?:致命一擊|暴擊)$/, (m) => ({ turns: m[1] ? n(m[1]) : 1 }), (p) => `下${p.turns}回合 必定致命一擊`),
  A("crit_uses", /^(?:自身)?下\s*(\d+|[一二兩三])\s*次攻擊(?:技能)?必定(?:打出)?致命一擊$/, (m) => ({ uses: n(m[1]) }), (p) => `下${p.uses}次攻擊 必定致命一擊`),

  // ── 先制
  A("prio_turns", /^下\s*(\d+)\s*回合(?:令)?(?:自身)?(?:令自身)?所有(攻擊)?技能先制\s*[+＋]\s*(\d+)$/, (m) => ({ turns: n(m[1]), attackOnly: !!m[2], v: n(m[3]) }), (p) => `下${p.turns}回合 ${p.attackOnly ? "攻擊" : ""}技能先制 +${p.v}`),
  A("prio_turns", /^下\s*(\d+)\s*回合對[手方]所有(攻擊)?技能先制\s*-\s*(\d+)$/, (m) => ({ turns: n(m[1]), attackOnly: !!m[2], v: -n(m[3]), side: "opp" }), (p) => `下${p.turns}回合 對手先制 ${p.v}`),
  A("prio_next", /^(?:自身)?下(?:\s*(\d+|[一二兩三])\s*次|次)(?:使用)?(攻擊)?技能(?:額外)?先制\s*[+＋]\s*(\d+)$/, (m) => ({ uses: m[1] ? n(m[1]) : 1, attackOnly: !!m[2], v: n(m[3]) }), (p) => `下${p.uses}次${p.attackOnly ? "攻擊" : ""}技能 先制 +${p.v}`),

  // ── 免疫／無效
  A("immune_status_turns", /^(\d+)\s*回合內(?:自身)?免疫(並反彈)?(?:所有)?(控制類|弱化類|非附屬類)?(?:異常|異常狀態)(?:狀態)?$/, (m) => ({ turns: n(m[1]), reflect: !!m[2], cls: m[3] || "" }), (p) => `${p.turns}回合 免疫${p.reflect ? "並反彈" : ""}${p.cls}異常`),
  A("immune_statdown_turns", /^(\d+)\s*回合內(?:自身)?免疫能力下降(?:狀態)?$/, (m) => ({ turns: n(m[1]) }), (p) => `${p.turns}回合 免疫能力下降`),
  A("immune_attack_count", /^(?:令自身)?免疫下\s*(\d+|[一二兩三])?\s*次(?:受到的)?攻擊$/, (m) => ({ count: m[1] ? n(m[1]) : 1 }), (p) => `免疫下${p.count}次攻擊`),
  A("immune_attack_turns", /^(\d+)\s*回合內(?:自身)?免疫受到的攻擊$/, (m) => ({ turns: n(m[1]) }), (p) => `${p.turns}回合 免疫攻擊`),
  A("block_attack", /^(?:令自身)?抵擋下\s*(\d+|[一二兩三])?\s*次(?:受到的)?攻擊(?:傷害)?$/, (m) => ({ count: m[1] ? n(m[1]) : 1 }), (p) => `抵擋下${p.count}次攻擊`),
  A("invalid_next", /^(?:令)?對[手方]下(?:\s*(\d+|[一二兩三])\s*次|次)(攻擊|屬性)?技能無效$/, (m) => ({ uses: m[1] ? n(m[1]) : 1, kind: m[2] || "" }), (p) => `對手下${p.uses}次${p.kind}技能無效`),
  A("invalid_next", /^(?:自身)?無效對[手方]下(?:\s*(\d+|[一二兩三])\s*次|次)(攻擊|屬性)?技能$/, (m) => ({ uses: m[1] ? n(m[1]) : 1, kind: m[2] || "" }), (p) => `對手下${p.uses}次${p.kind}技能無效`),
  A("invalid_turns", /^(\d+)\s*回合內(?:令)?對[手方](?:使用的)?(?:所有)?(攻擊|屬性)?技能無效$/, (m) => ({ turns: n(m[1]), kind: m[2] || "" }), (p) => `${p.turns}回合 對手${p.kind}技能無效`),
  A("invalid_turns", /^對[手方]\s*(\d+)\s*回合內(攻擊|屬性)?技能無效$/, (m) => ({ turns: n(m[1]), kind: m[2] || "" }), (p) => `${p.turns}回合 對手${p.kind}技能無效`),
  A("add_invalid_turns", /^(\d+)\s*回合內(?:令)?對[手方](?:使用的)?(攻擊|屬性)?技能(?:的)?附加效果失效$/, (m) => ({ turns: n(m[1]), kind: m[2] || "" }), (p) => `${p.turns}回合 對手${p.kind}技能附加效果失效`),
  A("add_invalid_next", /^(?:令)?對[手方]下(?:\s*(\d+|[一二兩三])\s*次|次)(攻擊|屬性)?技能(?:的)?附加效果失效$/, (m) => ({ uses: m[1] ? n(m[1]) : 1, kind: m[2] || "" }), (p) => `對手下${p.uses}次${p.kind}技能附加效果失效`),
  A("no_switch", /^(?:下\s*)?(\d+)\s*回合(?:內)?對[手方]無法主動切換(?:精靈)?$/, (m) => ({ turns: n(m[1]), next: /^下/.test(m[0]) }), (p) => `${p.next ? "下" : ""}${p.turns}回合 對手無法主動切換`),
  A("no_heal", /^(?:下\s*)?(\d+)\s*回合(?:內)?對[手方](?:無法(?:通過自身技能)?恢復體力|體力恢復量(?:降低|下降)100%)$/, (m) => ({ turns: n(m[1]), next: /^下/.test(m[0]) }), (p) => `${p.turns}回合 對手無法恢復體力`),
  A("no_heal", /^對[手方]\s*(\d+)\s*回合內無法恢復體力$/, (m) => ({ turns: n(m[1]) }), (p) => `${p.turns}回合 對手無法恢復體力`),

  // ── 回合類 / 護盾
  A("clear_turn", /^消除(對[手方]|自身|雙方|敵我雙方)(?:的)?回合類效果$/, (m) => ({ side: who(m[1]) }), (p) => `消除${whoLabel(p.side)}回合類效果`),
  A("clear_shield", /^消除(對[手方]|雙方)(?:的)?護盾(?:、護罩|與護罩|和護罩)?(?:效果)?$/, (m) => ({ side: who(m[1]) }), (p) => `消除${whoLabel(p.side)}護盾`),
  A("shield", new RegExp(`^(?:為自身)?(?:附加|獲得)(?:自身)?(?:最大體力(?:的)?\\s*${RATIO}(?:的)?|(\\d+)\\s*點(?:的)?)(?:傷害吸收)?護盾$`), (m) => ({ ratio: m[1] ? ratio(m[1]) : undefined, flat: m[2] ? n(m[2]) : undefined }), (p) => `護盾 ${p.flat ?? pct(p.ratio)}`),

  // ── PP
  A("pp_zero", /^(?:令)?對[手方](?:所有)?(攻擊|屬性)?技能(?:的)?PP值歸(?:0|零)$/, (m) => ({ kind: m[1] || "" }), (p) => `對手${p.kind}技能 PP 歸0`),
  A("pp_zero_random", /^(?:令)?對[手方]隨機\s*(\d+)\s*(?:個|項)(?:PP值不為0的)?技能(?:的)?PP值歸(?:0|零)$/, (m) => ({ count: n(m[1]) }), (p) => `對手隨機${p.count}技能 PP 歸0`),
  A("pp_drain", /^(?:吸取|降低|減少|扣除)對[手方](?:所有)?(?:技能)?(?:的)?\s*(\d+|[一二兩三])\s*點\s*PP(?:值)?$/i, (m) => ({ v: n(m[1]), steal: /吸取/.test(m[0]) }), (p) => `${p.steal ? "吸取" : "降低"}對手所有技能 ${p.v} PP`),
  A("pp_drain", /^(?:吸取|降低|減少|扣除)對[手方]所有(?:技能)?\s*(\d+|[一二兩三])\s*點\s*PP(?:值)?$/i, (m) => ({ v: n(m[1]), steal: /吸取/.test(m[0]) }), (p) => `${p.steal ? "吸取" : "降低"}對手所有技能 ${p.v} PP`),
  A("pp_drain", /^(?:吸取|降低|減少|扣除)對[手方]所有技能(?:的)?PP(?:值)?\s*(\d+|[一二兩三])\s*點$/i, (m) => ({ v: n(m[1]), steal: /吸取/.test(m[0]) }), (p) => `${p.steal ? "吸取" : "降低"}對手所有技能 ${p.v} PP`),
  A("pp_restore", /^(?:恢復|回復)自身所有技能(?:的)?\s*(?:PP(?:值)?)?\s*(\d+|[一二兩三])?\s*點?\s*(?:PP(?:值)?)?$/i, (m) => ({ v: m[1] ? n(m[1]) : 99 }), (p) => `恢復自身所有技能 ${p.v === 99 ? "全部" : p.v} PP`),

  // ── 說明性修飾（顯示用；執行時由上一個動作的預設行為處理）
  A("note", /^(下場後保留|最高\s*\d+\s*(?:%|點|層|道)|最多\s*\d+\s*(?:%|點|層|道)|上限\s*\d+\s*(?:%|點|層|道)|持續\s*\d+\s*回合|重複獲取時重置為\s*\d+\s*回合|每層額外[+＋]\d+%|（?BOSS無效）?|boss無效|--|每場戰鬥(?:最多|僅)?(?:觸發|限)\s*\d*\s*次|本場戰鬥僅限一次|不可疊加|可疊加)$/i, (m) => ({ text: m[0] }), (p) => `（${p.text}）`),
  A("note", /^命中率\s*(\d+)%$/, (m) => ({ text: m[0] }), (p) => p.text),
  // ── 更多傷害／體力
  A("dmg", new RegExp(`^(?:額外)?附加(?:對[手方])?(自身|對[手方])?(最大體力|當前體力|已損失體力)值?(?:的)?\\s*${RATIO}\\s*(?:的)?(固定|百分比|真實)傷害$`), (m) => ({ base: m[2], of: m[1] ? who(m[1]) : "opp", ratio: ratio(m[3]), type: m[4] }), (p) => `【${dmgName(p.type)}】${p.of === "self" ? "自身" : "對手"}${p.base} ${pct(p.ratio)}`),
  A("dmg", new RegExp(`^(?:額外)?附加(?:對[手方])?(?:等同於)?對方在場精靈(最大體力)\\s*${RATIO}\\s*(?:的)?(固定|百分比|真實)傷害$`), (m) => ({ base: m[1], of: "opp", ratio: ratio(m[2]), type: m[3] }), (p) => `【${dmgName(p.type)}】對手${p.base} ${pct(p.ratio)}`),
  A("dmg", /^(?:額外)?附加(?:對[手方])?\s*(\d+)\s*點(固定|真實|百分比)傷害$/, (m) => ({ flat: n(m[1]), type: m[2] }), (p) => `【${dmgName(p.type)}】${p.flat}`),
  A("heal_flat", /^(?:恢復|回復)(?:自身)?\s*(\d+)\s*點(?:固定)?體力(?:值)?$/, (m) => ({ amount: n(m[1]) }), (p) => `恢復 ${p.amount} 點體力`),
  A("drain", /^(?:附加)?吸取對[手方]\s*(\d+)\s*點(?:固定)?體力(?:值)?$/, (m) => ({ flat: n(m[1]) }), (p) => `吸取對手 ${p.flat} 點`),
  A("pp_restore", /^(?:恢復|回復)自身(?:所有技能)?(?:所有|全部)PP值?$/, () => ({ v: 99 }), () => `恢復自身所有 PP`),
  A("stat_clear", /^消除對[方手](?:的)?能力提升(?:效果|狀態)$/, () => ({ side: "opp", kind: "up" }), () => `消除對手能力提升`),
  A("clear_turn", /^消除回合類效果$/, () => ({ side: "opp" }), () => `消除對手回合類效果`),
  A("immune_status_turns", /^(\d+)\s*回合內(?:自身)?免疫(並反彈)?(?:所有)?(?:受到的)?(?:異常|異常狀態)(?:狀態)?$/, (m) => ({ turns: n(m[1]), reflect: !!m[2], cls: "" }), (p) => `${p.turns}回合 免疫${p.reflect ? "並反彈" : ""}異常`),
  A("immune_status_perm", /^(?:天生)?免疫(?:所有|每次受到的)異常狀態$/, () => ({}), () => `免疫所有異常`),
  A("crit_turns", /^接下來\s*(\d+)\s*回合(?:攻擊|技能)?必定(?:致命一擊|暴擊)$/, (m) => ({ turns: n(m[1]), now: true }), (p) => `${p.turns}回合 必定致命一擊`),
  A("first_turns", /^下\s*(\d+)\s*回合(?:攻擊|技能)?必定先出手$/, (m) => ({ turns: n(m[1]) }), (p) => `下${p.turns}回合 必定先手`),
  A("prio_turns", /^下\s*(\d+)\s*回合(?:自身)?先制\s*[+＋]\s*(\d+)$/, (m) => ({ turns: n(m[1]), v: n(m[2]) }), (p) => `下${p.turns}回合 先制 +${p.v}`),
  A("prio_turns", /^(?:使)?對[手方]下回合(?:所有技能)?先制\s*-\s*(\d+)$/, (m) => ({ turns: 1, v: -n(m[1]), side: "opp" }), (p) => `對手下回合先制 ${p.v}`),
  A("prio_turns", /^下回合(?:自身)?所有(攻擊)?技能先制\s*[+＋]\s*(\d+)$/, (m) => ({ turns: 1, attackOnly: !!m[1], v: n(m[2]) }), (p) => `下回合先制 +${p.v}`),
  A("boost_turns_x2", /^(?:使自身)?下\s*(\d+)\s*回合(?:的)?攻擊威力翻倍$/, (m) => ({ turns: n(m[1]), boost: 1, dir: "out", next: true, kind: "攻擊" }), (p) => `下${p.turns}回合【攻擊傷害】威力×2`),
  A("dmg_mod_turns", new RegExp(`^下\\s*(\\d+)\\s*回合(?:自身)?(?:造成的)?(攻擊|技能|非真實)?(?:技能)?(?:造成)?(?:的)?傷害(?:額外)?(?:提升|提高)\\s*${NUM}%$`), (m) => ({ turns: n(m[1]), kind: m[2] || "", boost: n(m[3]) / 100, dir: "out", next: true }), (p) => `下${p.turns}回合 造成【${KIND[p.kind]}】+${p.boost * 100}%`),
  A("dmg_mod_turns", new RegExp(`^下\\s*(\\d+)\\s*回合對[手方]受到(?:的)?(攻擊)?傷害(?:提高|提升)\\s*${NUM}%$`), (m) => ({ turns: n(m[1]), kind: m[2] || "", boost: n(m[3]) / 100, dir: "taken", next: true, side: "opp" }), (p) => `下${p.turns}回合 對手受到【${KIND[p.kind]}】+${p.boost * 100}%`),
  A("ignore_def_turns", new RegExp(`^下\\s*(\\d+)\\s*回合(?:攻擊)?忽略對[手方]\\s*${NUM}%(?:的)?(雙防|防禦|特防)(?:值)?$`), (m) => ({ turns: n(m[1]), ratio: n(m[2]) / 100, stat: m[3] }), (p) => `下${p.turns}回合 忽略對手${p.stat} ${p.ratio * 100}%`),
  A("ignore", /^無視對[手方](?:的)?(傷害限制|抵擋傷害|護盾|正先制|攻擊免疫|免疫攻擊|能力提升|免疫)(?:效果)?$/, (m) => ({ what: m[1] }), (p) => `無視對手${p.what}`),
  A("consume_hp_all", /^消耗自身全部體力$/, () => ({}), () => `消耗自身全部體力`),
  A("pp_zero_all", /^使雙方精靈所有技能PP值歸(?:零|0)$/, () => ({}), () => `雙方所有技能 PP 歸0`),
  A("status_chance_turns", new RegExp(`^(?:使用時|命中時)?(\\d+)%\\s*(?:機率)?(?:令|使)對[手方]${ST}(?:\\s*(\\d+)\\s*回合)?$`), (m) => ({ chance: n(m[1]), side: "opp", status: m[2], turns: m[3] ? n(m[3]) : undefined }), (p) => `對手 ${p.status}${p.turns ? ` ${p.turns}回合` : ""} (${p.chance}%)`),
  A("no_switch", /^(?:下\s*)?(\d+)\s*回合(?:內)?(?:令)?對[手方](?:無法主動切換精靈|無法切換精靈)$/, (m) => ({ turns: n(m[1]), next: /^下/.test(m[0]) }), (p) => `${p.turns}回合 對手無法主動切換`),
  A("mark", /^(?:附加|獲得|為(?:對手|自身))?(自身|對[手方])?\s*(\d+)\s*(?:層|道)(.{1,8})$/, (m) => ({ side: m[1] ? who(m[1]) : "self", count: n(m[2]), name: m[3] }), (p) => `${whoLabel(p.side)} +${p.count} ${p.name}`),
  A("mark_turns", /^(?:為對[手方])?附加(?:對[手方])?\s*(\d+)\s*回合的(.{2,8})$/, (m) => ({ side: /對手|對方/.test(m[0]) ? "opp" : "opp", turns: n(m[1]), name: m[2] }), (p) => `對手 ${p.name} ${p.turns}回合`),

  A("dmg_mod", new RegExp(`^(?:自身)?受到(?:的)?(攻擊|技能|非真實)?傷害(?:額外)?(?:減少|降低)\\s*${NUM}%$`), (m) => ({ dir: "in", kind: m[1] || "", reduce: n(m[2]) / 100 }), (p) => `受到【${KIND[p.kind]}】-${p.reduce * 100}%`),
  A("dmg_mod", new RegExp(`^(?:自身)?造成的?(攻擊|技能|非真實)?傷害(?:額外)?(?:提升|提高|增加)\\s*${NUM}%$`), (m) => ({ dir: "out", kind: m[1] || "", boost: n(m[2]) / 100 }), (p) => `造成【${KIND[p.kind]}】+${p.boost * 100}%`),
  A("per_statdown_bonus", /^對[手方]每處於\s*1\s*種能力下降狀態則額外減少\s*(\d+)%且回合數[+＋](\d+)$/, (m) => ({ ratio: n(m[1]) / 100, turns: n(m[2]) }), (p) => `對手每種能力下降：再 -${p.ratio * 100}% 且 +${p.turns}回合`),

  A("dmg_from_last", new RegExp(`^(?:恢復量|吸取量|傷害)(?:的)?\\s*${RATIO}\\s*轉化為(?:附加)?(?:對[手方])?等量(?:的)?(?:(.{1,3})系)?(固定|百分比|真實|技能)?傷害$`), (m) => ({ ratio: ratio(m[1]), elem: m[2], type: m[2] ? "技能" : (m[3] || "固定") }), (p) => `【${dmgName(p.type, p.elem)}】上一數值 ${pct(p.ratio)}`),
  A("dmg_from_last", /^(?:並)?附加等同於恢復量的(百分比|固定|真實)傷害$/, (m) => ({ ratio: 1, type: m[1] }), (p) => `【${dmgName(p.type)}】等同恢復量`),

  A("attack_inflict_turns", new RegExp(`^下\\s*(\\d+)\\s*回合(?:自身)?(?:的)?攻擊(?:技能)?必定令對[手方]${ST}$`), (m) => ({ turns: n(m[1]), status: m[2] }), (p) => `下${p.turns}回合 攻擊必定令對手${p.status}`),
  A("survive", /^(?:保留|殘留)\s*1\s*點體力$/, () => ({}), () => `保留1點體力`),
  A("bench_entrance_status", new RegExp(`^對方(?:切換)?登場(?:時)?(?:有)?(\\d+)%(?:機率)?進入${ST}$`), (m) => ({ chance: n(m[1]), status: m[2] }), (p) => `對方登場 ${p.status} (${p.chance}%)`),

  A("vampire", new RegExp(`^造成(?:的)?(?:技能|攻擊)?傷害(?:的)?\\s*${RATIO}\\s*(?:恢復|回復)自身(?:的)?體力$`), (m) => ({ ratio: ratio(m[1]), kind: /攻擊/.test(m[0]) ? "攻擊" : "技能" }), (p) => `吸血 ${pct(p.ratio)}`),
  A("boost", new RegExp(`^(\\d+)%(?:的)?機率(?:造成的?)?(?:攻擊)?傷害翻倍$`), (m) => ({ mult: 2, chance: n(m[1]), kind: "攻擊" }), (p) => `本次【攻擊傷害】×2 (${p.chance}%)`),
  A("dmg", new RegExp(`^附加(自身|對[手方])(攻擊和特攻|攻擊|特攻|防禦|特防|速度)總和?\\s*${RATIO}\\s*(?:的)?(固定|百分比|真實)傷害$`), (m) => ({ base: "stat:" + m[2], of: who(m[1]), ratio: ratio(m[3]), type: m[4] }), (p) => `【${dmgName(p.type)}】${p.base.slice(5)} ${pct(p.ratio)}`),
  A("crit_uses", /^(?:自身)?下\s*(\d+|[一二兩三])\s*次攻擊(?:技能)?必定(?:打出)?致命一擊$/, (m) => ({ uses: n(m[1]) }), (p) => `下${p.uses}次攻擊 必定致命一擊`),
  A("invalid_turns", /^(\d+)\s*回合(?:內)?(?:令)?對[手方](?:使用的)?(?:所有)?(攻擊|屬性)?技能無效$/, (m) => ({ turns: n(m[1]), kind: m[2] || "" }), (p) => `${p.turns}回合 對手${p.kind}技能無效`),
  A("dmg_mod_turns", new RegExp(`^當回合(?:自身)?受到(?:的)?(攻擊|技能|非真實)?傷害(?:減少|降低)\\s*${NUM}%$`), (m) => ({ turns: 1, kind: m[1] || "", reduce: n(m[2]) / 100, dir: "in" }), (p) => `當回合 受到【${KIND[p.kind]}】-${p.reduce * 100}%`),
  A("dmg_mod_turns", new RegExp(`^(\\d+)\\s*回合內(?:自身)?受到(?:的)?(攻擊|技能|非真實)?傷害(?:減少|降低)\\s*${NUM}%$`), (m) => ({ turns: n(m[1]), kind: m[2] || "", reduce: n(m[3]) / 100, dir: "in" }), (p) => `${p.turns}回合 受到【${KIND[p.kind]}】-${p.reduce * 100}%`),
  A("at_round_end", new RegExp(`^(?:當)?回合結束(?:時|後)(.+)$`), (m) => { const r: string[] = []; const body = parseBody(m[1], r); return r.length || !body.length ? (null as any) : { body, text: m[1] }; }, (p) => `回合結束時：${p.text}`),
  A("stat_steal_random", /^(?:造成傷害前)?隨機吸取對[手方]\s*(\d+)\s*項能力值?\s*-\s*(\d+)$/, (m) => ({ count: n(m[1]), v: n(m[2]) }), (p) => `隨機吸取對手${p.count}項能力 ${p.v}`),
  A("pp_cost_mult", /^(\d+)\s*回合內對[手方]使用(攻擊|屬性)?技能消耗的PP值?變為\s*(\d+)\s*倍$/, (m) => ({ turns: n(m[1]), kind: m[2] || "", mult: n(m[3]) }), (p) => `${p.turns}回合 對手PP消耗×${p.mult}`),
  A("block_attack", /^(?:令自身)?抵擋下\s*(\d+|[一二兩三])?\s*次(?:對[手方]的|受到的)?攻擊(?:傷害)?$/, (m) => ({ count: m[1] ? n(m[1]) : 1 }), (p) => `抵擋下${p.count}次【攻擊傷害】`),
  A("dmg_to_heal_turns", /^(下回合|當回合)受到的傷害轉化為自身體力$/, (m) => ({ next: m[1] === "下回合" }), (p) => `${p.next ? "下回合" : "當回合"}受到的傷害轉為體力`),
  A("pp_drain", /^(?:吸取|降低|減少|扣除)對[手方]所有(?:技能)?PP\s*(\d+)\s*點$/i, (m) => ({ v: n(m[1]), steal: /吸取/.test(m[0]) }), (p) => `${p.steal ? "吸取" : "降低"}對手所有技能 ${p.v} PP`),
  A("pp_restore", /^(?:恢復|回復)自身所有PP\s*(\d+)\s*點$/i, (m) => ({ v: n(m[1]) }), (p) => `恢復自身所有技能 ${p.v} PP`),
  A("evade", new RegExp(`^(\\d+)%閃避對[手方]所有(攻擊)?技能$`), (m) => ({ chance: n(m[1]), kind: m[2] || "" }), (p) => `${p.chance}% 閃避對手${p.kind}技能（必中無效）`),
  A("heal", /^(?:恢復|回復)自身所有體力$/, () => ({ side: "self", ratio: 1 }), () => `恢復全部體力`),

  A("noop", /^(?:.{1,20}時)?(?:額外)?先制\s*[+＋-]\s*\d+(?:且必定命中)?$/, (m) => ({ tag: m[0] }), (p) => `${p.tag}（先制計算時判定）`),
  A("status", new RegExp(`^(?:令|使)(對[手方]|自身)(\\d+)%${ST}$`), (m) => ({ chance: n(m[2]), side: who(m[1]), status: m[3] }), (p) => `${whoLabel(p.side)} ${p.status}${p.chance < 100 ? ` (${p.chance}%)` : ""}`),
  A("status_seq", new RegExp(`^(?:(\\d+)%)?(?:令|使)?對[手方](?:進入)?((?:${STATUS_LIST})(?:、(?:${STATUS_LIST}))+)(?:狀態)?$`), (m) => ({ list: m[2].split("、"), chance: m[1] ? n(m[1]) : 100 }), (p) => `對手 ${p.list.join("、")}`),
  A("status", new RegExp(`^(?:進入|陷入)${ST}(?:狀態)?$`), (m) => ({ chance: 100, side: "opp", status: m[1] }), (p) => `對手 ${p.status}`),
  A("attack_extra_turns", /^下\s*(\d+)\s*回合(?:自身)?攻擊技能附加\s*(\d+)\s*點(真實|固定|百分比)傷害$/, (m) => ({ turns: n(m[1]), flat: n(m[2]), type: m[3] }), (p) => `下${p.turns}回合 攻擊附加【${p.type}傷害】${p.flat}`),
  A("evade_turns", /^(\d+)\s*回合內(\d+)%閃避對[手方](攻擊)?(?:技能)?$/, (m) => ({ turns: n(m[1]), chance: n(m[2]), kind: m[3] || "" }), (p) => `${p.turns}回合 ${p.chance}% 閃避對手${p.kind}技能`),
  A("survive_turns", /^(\d+)\s*回合內自身死亡時強制存活(?:並保留1點體力)?$/, (m) => ({ turns: n(m[1]) }), (p) => `${p.turns}回合內 死亡時保留1點體力`),
  A("pp_cost_mult", /^(?:令)?對[手方]\s*(\d+)\s*回合內(攻擊|屬性)?技能PP消耗提升\s*(\d+)\s*倍$/, (m) => ({ turns: n(m[1]), kind: m[2] || "", mult: n(m[3]) }), (p) => `${p.turns}回合 對手${p.kind}技能 PP消耗×${p.mult}`),
  A("dmg", new RegExp(`^附加(?:對[手方])?護盾值\\s*${RATIO}\\s*(?:的)?(百分比|真實|固定)傷害$`), (m) => ({ base: "護盾值", of: "self", ratio: ratio(m[1]), type: m[2] }), (p) => `【${dmgName(p.type)}】自身護盾值 ${pct(p.ratio)}`),
  A("dmg", /^附加護盾值等量(百分比|真實|固定)傷害$/, (m) => ({ base: "護盾值", of: "self", ratio: 1, type: m[1] }), (p) => `【${dmgName(p.type)}】自身護盾值 100%`),
  A("no_pos_prio_turns", /^對[手方]下\s*(\d+)\s*回合正先制效果失效$/, (m) => ({ turns: n(m[1]) }), (p) => `下${p.turns}回合 對手正先制失效`),
];

// ───────── 條件庫 ─────────
interface CondDef { c: string; re: RegExp; p?: (m: RegExpMatchArray) => Record<string, any>; label: (m: RegExpMatchArray) => string }
const C = (c: string, re: RegExp, label: CondDef["label"], p?: CondDef["p"]): CondDef => ({ c, re, p, label });
export const CONDS: CondDef[] = [
  C("first", /^(?:自身)?先出手$/, () => "先出手"),
  C("last", /^(?:自身)?後出手$/, () => "後出手"),
  C("success", /^(?:消除|吸取|複製|交換|解除|反轉|轉化|附加|無視)成功$/, (m) => m[0]),
  C("fail", /^(?:未觸發|若未觸發|該效果未觸發|消除失敗|任一項未觸發|未觸發或對手.*|觸發失敗)$/, (m) => m[0]),
  C("triggered", /^(?:觸發成功|觸發)$/, (m) => m[0]),
  C("kill", /^(?:當回合)?擊敗對[手方]$/, () => "擊敗對手"),
  C("nokill", /^(?:當回合)?未擊敗對[手方]$/, () => "未擊敗對手"),
  C("has_status", new RegExp(`^(對[手方]|自身|雙方任一方)(?:處於|存在)${ST}(?:狀態)?$`), (m) => `${m[1]}處於${m[2]}`, (m) => ({ side: who(m[1]), status: m[2] })),
  C("abnormal", /^(對[手方]|自身|場上|雙方(?:任一方)?)(不)?(?:處於|存在)(?:異常|異常狀態)(?:狀態)?$/, (m) => `${m[1]}${m[2] || ""}處於異常`, (m) => ({ side: /場上|雙方/.test(m[1]) ? "any" : who(m[1]), neg: !!m[2] })),
  C("abnormal", /^場上存在異常狀態$/, () => "場上存在異常", () => ({ side: "any" })),
  C("stage", /^(對[手方]|自身)(不)?處於能力(提升|上升|下降)狀態$/, (m) => `${m[1]}${m[2] || ""}處於能力${m[3]}`, (m) => ({ side: who(m[1]), kind: m[3] === "下降" ? "down" : "up", neg: !!m[2] })),
  C("hp_ratio", new RegExp(`^(自身|對[手方])(?:當前)?體力(高於|大於|低於|小於|不高於|不低於|不大於|不小於)(?:最大體力(?:的)?)?${RATIO}$`), (m) => `${m[1]}體力${m[2]}${m[3]}`, (m) => ({ side: who(m[1]), op: m[2], ratio: ratio(m[3]) })),
  C("hp_cmp", /^(自身|對[手方])(?:當前)?體力(高於|大於|低於|小於|不高於|不低於)(對[手方]|自身)$/, (m) => `${m[1]}體力${m[2]}${m[3]}`, (m) => ({ side: who(m[1]), op: m[2] })),
  C("shield", /^(對[手方]|自身)(不)?(?:擁有|存在|有|處於)護盾(?:、護罩)?(?:狀態)?$/, (m) => `${m[1]}${m[2] || ""}擁有護盾`, (m) => ({ side: who(m[1]), neg: !!m[2] })),
  C("pp_full", /^(?:該技能)?PP值(?:為滿|已滿)$/, () => "PP值為滿"),
  C("invalid", /^(?:攻擊)?技能無效(?:時)?$|^技能無效時$/, () => "技能無效"),
  C("weak", /^(?:造成的?)?(?:技能)?傷害為微弱$/, () => "傷害為微弱"),
  C("dmg_cmp", /^(?:造成的?|本次)(?:攻擊|技能)?傷害(高於|低於|大於|小於|不高於|不低於)\s*(\d+)$/, (m) => `傷害${m[1]}${m[2]}`, (m) => ({ op: m[1], v: Number(m[2]) })),
  C("type_is", /^對[手方](?:為|是)(.{1,4})系$/, (m) => `對手為${m[1]}系`, (m) => ({ type: m[1] })),
  C("enemy", /^遇到?天敵$|^遇天敵$/, () => "遇到天敵"),
  C("self_enemy", /^自身為(?:對手的)?天敵$/, () => "自身為天敵"),
  C("crit", /^(?:打出|造成)?致命一擊$/, () => "打出致命一擊"),
  C("last_no_dmg", /^(?:附加|吸取)後(?:若)?對[手方]體力未減少$/, () => "對手體力未減少"),
  C("has_mark", /^對[手方]處於(.{2,6}之.)$/, (m) => `對手處於${m[1]}`, (m) => ({ side: "opp", name: m[1] })),
];

// ───────── 觸發時點（魂印標頭 / 持續效果） ─────────
const TRIG: [RegExp, Trigger, string][] = [
  [/^戰鬥開始時?$/, "battle_start", "戰鬥開始時"],
  [/^(?:每次|自身每次|自身)?登場時$|^每次登場時$|^自身每次出戰時$|^出戰時$/, "entrance", "登場時"],
  [/^(?:每)?回合開始(?:時)?$/, "round_start", "回合開始時"],
  [/^(?:每)?回合結束(?:時|後)?$/, "round_end", "回合結束時"],
  [/^戰鬥階段結束時$/, "phase_end", "戰鬥階段結束時"],
  [/^(?:自身)?(?:每次)?使用技能(?:時)?$/, "self_skill", "自身使用技能時"],
  [/^(?:自身)?(?:每次)?使用(?:攻擊|物理\/特殊攻擊)(?:技能)?(?:時)?$/, "self_attack", "自身使用攻擊技能時"],
  [/^(?:自身)?(?:每次)?使用物理攻擊(?:技能)?後$/, "self_after_physical", "自身使用物理攻擊後"],
  [/^(?:自身)?(?:每次)?使用特殊攻擊(?:技能)?後$/, "self_after_special", "自身使用特殊攻擊後"],
  [/^(?:自身)?(?:每次)?使用屬性技能(?:時)?$/, "self_status", "自身使用屬性技能時"],
  [/^(?:自身)?(?:每次)?使用技能後$/, "self_after_skill", "自身使用技能後"],
  [/^(?:自身)?(?:每次)?使用攻擊(?:技能)?後$/, "self_after_attack", "自身使用攻擊後"],
  [/^(?:自身)?(?:每次)?使用屬性技能後$/, "self_after_status", "自身使用屬性技能後"],
  [/^對[手方](?:每次)?使用技能(?:時)?$/, "opp_skill", "對手使用技能時"],
  [/^對[手方](?:每次)?使用攻擊(?:技能)?(?:時)?$/, "opp_attack", "對手使用攻擊技能時"],
  [/^對[手方](?:每次)?使用屬性技能(?:時)?$/, "opp_status", "對手使用屬性技能時"],
  [/^對[手方](?:每次)?使用技能後$/, "opp_after_skill", "對手使用技能後"],
  [/^(?:自身)?(?:每次)?受到(?:攻擊|攻擊傷害)(?:時|後)?$/, "damaged_attack", "受到攻擊時"],
  [/^(?:自身)?(?:每次)?受到技能傷害(?:時|後)?$/, "damaged_skill", "受到技能傷害時"],
  [/^(?:自身)?(?:每次)?受到真實傷害(?:時|後)?$/, "damaged_true", "受到真實傷害時"],
  [/^(?:自身)?(?:每次)?受到固定傷害(?:時|後)?$/, "damaged_fixed", "受到固定傷害時"],
  [/^(?:自身)?(?:每次)?受到百分比傷害(?:時|後)?$/, "damaged_percent", "受到百分比傷害時"],
  [/^(?:自身)?(?:每次)?受到非真實傷害(?:時|後)?$/, "damaged_nontrue", "受到非真實傷害時"],
  [/^(?:自身)?(?:每次)?受到傷害(?:時|後)?$/, "damaged", "受到傷害時"],
  [/^(?:自身)?被擊敗時$|^死亡時$|^自身死亡時$/, "defeated", "被擊敗時"],
  [/^(?:自身)?擊敗對[手方]時$|^擊敗對[手方]後$/, "kill", "擊敗對手時"],
  [/^(?:自身)?(?:首次)?受到致命傷害時$/, "fatal", "受到致命傷害時"],
  [/^(?:自身)?下場時$|^主動切換下場時$/, "switch_out", "下場時"],
  [/^(?:自身)?(?:每次)?受到異常(?:狀態)?時$/, "status_received", "受到異常時"],
  [/^常駐效果$|^常駐$/, "passive", "常駐"],
  [/^(?:自身)?(?:位於|存活於|存活在)背包(?:內)?時$/, "bench", "位於背包時"],
];
export const TRIG_LABEL: Record<string, string> = Object.fromEntries(TRIG.map(([, t, l]) => [t, l]));
TRIG_LABEL.use = "技能效果";
TRIG_LABEL.after_hit = "傷害結算後";
TRIG_LABEL.on_invalid = "技能無效時";
for (const h of Object.values(CUSTOM_HEADERS)) TRIG_LABEL[h.trig] = TRIG_LABEL[h.trig] || h.label;
TRIG_LABEL.custom = "（未分類）";

export function matchTrigger(s: string): Trigger | null {
  const t = s.replace(/[：:]\s*$/, "").trim();
  for (const [re, trig] of TRIG) if (re.test(t)) return trig;
  return null;
}

// ───────── 專屬積木 ─────────
export function customAct(t: string): Act | null {
  const k = t.replace(/^\s*(?:>>|>|■|🎯|◇)\s*/, "").trim();
  const d = CUSTOM[k] || CUSTOM[norm(k)];
  return d ? { op: "custom", p: { key: CUSTOM[k] ? k : norm(k) }, label: `★ ${d.label}` } : null;
}

// ───────── 句子解析 ─────────
export function matchAct(s: string): Act | null {
  const t0 = s.replace(/^(?:並且|並|且|同時|然後|再|命中後|命中時|使用時|則|額外)\s*/, "").replace(/[。！]$/, "").trim();
  if (!t0) return { op: "noop", p: {}, label: "" };
  const variants = [t0, t0.replace(/^附加(?=當回合|若|吸取|令|使)/, ""), t0.replace(/^附加/, ""), t0.replace(/^(?:令|使)/, "")];
  for (const t of variants) {
    for (const d of ACTS) {
      const m = t.match(d.re);
      if (m) {
        const p = d.p(m, t);
        if (!p) continue;
        return { op: d.op, p, label: d.label(p) };
      }
    }
  }
  return null;
}

/** 解析一段動作（可能以「並／且／、」串多個動作） */
export function matchActs(s: string): { acts: Act[]; rest: string[] } {
  const cu = customAct(s);
  if (cu) return { acts: [cu], rest: [] };
  const timed = tryTimed(s);
  if (timed) return { acts: [timed.act], rest: timed.rest };
  const whole = matchAct(s);
  if (whole) return { acts: whole.op === "noop" && !whole.label ? [] : [whole], rest: [] };
  const parts = s.split(/(?:並(?!反彈)|且(?!必定)|同時)/).map(x => x.trim()).filter(Boolean);
  if (parts.length > 1) {
    const acts: Act[] = []; const rest: string[] = [];
    // 「對手3回合內A且B」：後段沿用前段的主詞／回合數
    const pre = (parts[0].match(/^((?:令)?(?:對[手方]|自身)?\s*(?:下\s*)?\d+\s*回合內(?:令)?(?:對[手方]|自身)?)/) || [])[1] || (parts[0].match(/^((?:令|使)?(?:對[手方]|自身))/) || [])[1] || "";
    for (const p of parts) {
      let a = matchAct(p);
      if (!a && pre && !p.startsWith(pre)) a = matchAct(pre + p);
      if (a) { if (a.label) acts.push(a); } else rest.push(p);
    }
    if (acts.length) return { acts, rest };
  }
  return { acts: [], rest: [s] };
}

export function matchCond(s: string): Cond | null {
  const t = s.replace(/^(?:若|如果|當回合|當|在)\s*/, "").replace(/時$/, "").trim();
  for (const d of CONDS) {
    const m = t.match(d.re);
    if (m) return { c: d.c, p: d.p ? d.p(m) : {}, label: d.label(m) };
  }
  return null;
}

/** 一段（以逗號切出）→ Stmt */
function parseSegment(seg: string, rest: string[]): Stmt | null {
  const cu = customAct(seg);
  if (cu) return { acts: [cu] };
  let m = seg.match(/^(?:若)?(消除|吸取|複製|交換|解除|反轉|轉化|附加|無視)成功(?:時|後)?(?:則)?(.+)$/);
  if (m) { const r = matchActs(m[2]); rest.push(...r.rest); return { chain: "success", acts: r.acts }; }
  m = seg.match(/^(?:若)?(?:未觸發|觸發失敗|消除失敗|任一項未觸發(?:或均觸發)?)(?:則|時)?(.+)$/);
  if (m) { const r = matchActs(m[1]); rest.push(...r.rest); return { chain: "fail", acts: r.acts }; }
  m = seg.match(/^(?:若)?觸發成功(?:則|時)?(.+)$/);
  if (m) { const r = matchActs(m[1]); rest.push(...r.rest); return { chain: "success", acts: r.acts }; }
  m = seg.match(/^否則(.+)$/);
  if (m) { const r = matchActs(m[1]); rest.push(...r.rest); return { chain: "fail", acts: r.acts }; }
  // 若A則B / A則B / A時B
  m = seg.match(/^(?:若|如果|當)?(.+?)(?:時)?則(.+)$/) || seg.match(/^(?:若|如果|當)?(.+?(?:狀態|體力.{0,10}|異常|先出手|後出手|擊敗對[手方]|護盾|天敵|微弱|為滿|無效|系))時(.+)$/);
  if (m) {
    const cond = matchCond(m[1]);
    const r = matchActs(m[2]);
    if (cond && r.acts.length) { rest.push(...r.rest); return { cond: [cond], acts: r.acts }; }
  }
  m = seg.match(/^(?:若|當)?(.+?)時(.+)$/);
  if (m) {
    const cond = matchCond(m[1]);
    const r2 = cond ? matchActs(m[2]) : null;
    if (cond && r2 && r2.acts.length && !r2.rest.length) return { cond: [cond], acts: r2.acts };
  }
  const r = matchActs(seg);
  if (r.acts.length || !r.rest.length) { rest.push(...r.rest); return r.acts.length ? { acts: r.acts } : null; }
  rest.push(seg);
  return null;
}

/** 持續效果前綴：「N回合內，自身使用技能則…」「N回合內每回合結束…」 */
const TIMED_EACH_RE = /^(下)?\s*(\d+)\s*回合(?:內)?[，,]?\s*每回合(?!結束|開始|使用|自身使用)(.+)$/;
const TIMED_RE = /^(下)?\s*(\d+)\s*回合(?:內)?[，,]?\s*(?:每回合)?(?:若)?(自身每次使用技能|自身使用技能|每回合使用技能|使用技能(?!後)|自身每次使用攻擊技能|自身使用攻擊技能|自身使用屬性技能|對[手方](?:每次)?使用攻擊技能|對[手方](?:每次)?使用屬性技能|對[手方](?:每次)?使用技能|自身(?:每次)?受到攻擊|自身(?:每次)?受到(?:技能)?傷害|每回合結束|回合結束|每回合開始|回合開始|使用技能後|自身使用技能後)(?:時|後)?(?:則|時)?[，,]?(.+)$/;
const TIMED_TRIG: [RegExp, Trigger][] = [
  [/使用攻擊技能/, "self_attack"], [/使用屬性技能/, "self_status"], [/使用技能後/, "self_after_skill"], [/使用技能/, "self_skill"],
  [/受到攻擊/, "damaged_attack"], [/受到/, "damaged_skill"], [/結束/, "round_end"], [/開始/, "round_start"],
];

/** 同義詞正規化 */
export function norm(t: string): string {
  return t.replace(/概率/g, "機率").replace(/PP\s*一點/g, "PP 1點").replace(/([^\d])一點/g, "$11點").replace(/有(\d+%)/g, "$1")
    .replace(/(?:都)?會(?=使|令)/g, "").replace(/物理攻擊和特殊攻擊/g, "攻擊").replace(/每次直接攻擊/g, "自身使用攻擊技能").replace(/每回合攻擊(?!技能)/g, "自身使用攻擊技能")
    .replace(/對方(?=屬性技能|攻擊技能|技能)/g, "對手").replace(/己方下/g, "自身下");
}

function tryTimed(text: string): { act: Act; rest: string[] } | null {
  const tm = text.match(TIMED_RE);
  if (!tm) return null;
  if (matchAct(text)) return null;
  const rest: string[] = [];
  const phrase = tm[3];
  let tt: Trigger = "round_end";
  for (const [re, t] of TIMED_TRIG) if (re.test(phrase)) { tt = t; break; }
  if (/^對[手方]/.test(phrase)) tt = (/攻擊/.test(phrase) ? "opp_attack" : /屬性/.test(phrase) ? "opp_status" : "opp_skill") as Trigger;
  const inner = parseBody(tm[4], rest);
  if (!inner.length) return null;
  return { act: { op: "timed", p: { turns: Number(tm[2]), from: tm[1] ? "next" : "now", trig: tt, body: inner }, label: `${tm[1] ? "下" : ""}${tm[2]}回合內・${TRIG_LABEL[tt] || tt}` }, rest };
}

export function parseLine(line: string, trig: Trigger = "use"): Clause {
  const raw = line;
  const marker = (line.match(/^\s*(>>|>|■|🎯|◇)/) || [])[1];
  let text = norm(line.replace(/^\s*(?:>>|>|■|🎯|◇|[▸◆•·-])\s*/u, "").replace(/（[^）]*）/g, "").replace(/\([^)]*\)/g, "").trim());
  const rest: string[] = [];
  const body: Stmt[] = [];
  const cu = customAct(line.replace(/^\s*(?:>>|>|■|🎯|◇)\s*/, "").trim()) || customAct(text);
  if (cu) return { raw, marker, trig, body: [{ acts: [cu] }], parsed: true, rest };
  // 整句就是一個動作（避免被誤判為持續效果）
  const whole = text && matchAct(text);
  if (whole) return { raw, marker, trig, body: [{ acts: [whole] }], parsed: true, rest };
  // 持續效果
  const te = text.match(TIMED_EACH_RE);
  if (te) {
    const inner = parseBody(te[3], rest);
    const label = `${te[1] ? "下" : ""}${te[2]}回合內・每回合結束`;
    body.push({ acts: [{ op: "timed", p: { turns: Number(te[2]), from: te[1] ? "next" : "now", trig: "round_end", body: inner }, label }] });
    return { raw, marker, trig, body, parsed: rest.length === 0 && inner.length > 0, rest };
  }
  const tm = text.match(TIMED_RE);
  if (tm) {
    const phrase = tm[3];
    let tt: Trigger = "round_end";
    for (const [re, t] of TIMED_TRIG) if (re.test(phrase)) { tt = t; break; }
    if (/^對[手方]/.test(phrase)) tt = (/攻擊/.test(phrase) ? "opp_attack" : /屬性/.test(phrase) ? "opp_status" : "opp_skill") as Trigger;
    const inner = parseBody(tm[4], rest);
    const label = `${tm[1] ? "下" : ""}${tm[2]}回合內・${TRIG_LABEL[tt] || tt}`;
    body.push({ acts: [{ op: "timed", p: { turns: Number(tm[2]), from: tm[1] ? "next" : "now", trig: tt, body: inner }, label }] });
    return { raw, marker, trig, body, parsed: rest.length === 0 && inner.length > 0, rest };
  }
  if (!text) return { raw, marker, trig, body: [{ acts: [{ op: "noop", p: {}, label: "無特殊效果" }] }], parsed: true, rest };
  body.push(...parseBody(text, rest));
  return { raw, marker, trig, body, parsed: rest.length === 0 && body.length > 0, rest };
}

function parseBody(text: string, rest: string[]): Stmt[] {
  const out: Stmt[] = [];
  // 以「，；」切段；但「若…，則…」要合併
  const segs = text.split(/[，,；;]/).map(s => s.trim()).filter(Boolean);
  for (let i = 0; i < segs.length; i++) {
    let seg = segs[i];
    if (/^若/.test(seg) && !/則/.test(seg) && segs[i + 1] && /^則/.test(segs[i + 1])) { seg = seg + segs[i + 1]; i++; }
    // 修飾上一句：「…時(強化/吸取/恢復)效果翻倍」「若…則效果翻倍」「…時機率翻倍」「每次使用額外附加N點」「最高N點」
    const prev = out[out.length - 1];
    const lastAct = prev?.acts[prev.acts.length - 1];
    const dm = seg.match(/^(?:若)?(.+?)(?:時|則)(?:自身)?(?:強化|吸取|恢復|傷害|恢復效果和百分比傷害)?效果翻倍$/);
    if (dm && prev) {
      const cond = matchCond(dm[1]);
      if (cond) { for (const a of prev.acts) { a.p.x2If = cond; a.label += `（${cond.label}時×2）`; } continue; }
    }
    const cm = seg.match(/^(?:若)?(.+?)(?:時|則)機率翻倍$/);
    if (cm && lastAct) { const cond = matchCond(cm[1]); if (cond) { lastAct.p.chanceX2If = cond; lastAct.label += `（${cond.label}時機率×2）`; continue; } }
    const rm = seg.match(/^(連續)?(?:使用)?每次(?:使用)?(?:額外附加|增加|提升)\s*(\d+)\s*(點|%)$/);
    if (rm && lastAct) { lastAct.p.rampInc = Number(rm[2]); lastAct.p.rampStreak = !!rm[1]; lastAct.label += `（每次+${rm[2]}${rm[3]}）`; continue; }
    const capm = seg.match(/^最高\s*(\d+)\s*(點|%)$/);
    if (capm && lastAct && lastAct.p.rampInc != null) { lastAct.p.rampCap = Number(capm[1]); lastAct.label += `（最高${capm[1]}${capm[2]}）`; continue; }
    const st = parseSegment(seg, rest);
    if (st) out.push(st);
  }
  return out;
}


/** 「回合開始時自身擁有護盾」「回合結束若自身未受到技能傷害」「自身體力高於1/2時」 */
export function parseHeader(head: string): { trig: Trigger; cond?: Cond[] } | null {
  if (/^(?:本場戰鬥僅限一次|每場戰鬥(?:限|僅)(?:觸發)?一次)[，,]?(?:自身)?死亡時$/.test(head)) return { trig: "fatal" };
  const h = head.replace(/^本場戰鬥僅限一次[，,]?/, "");
  const t0 = matchTrigger(h);
  if (t0) return { trig: t0 };
  let m = h.match(/^(.+?時)(?:若)?(.+)$/);
  if (m) { const t = matchTrigger(m[1]); const c = matchCond(m[2]); if (t) return { trig: t, cond: c ? [c] : [{ c: "text", label: m[2], p: { text: m[2] } }] }; }
  m = h.match(/^(.+?)若(.+)$/);
  if (m) { const t = matchTrigger(m[1] + "時") || matchTrigger(m[1]); const c = matchCond(m[2]); if (t) return { trig: t, cond: c ? [c] : [{ c: "text", label: m[2], p: { text: m[2] } }] }; }
  const c = matchCond(h);
  if (c) return { trig: "passive", cond: [c] };
  return null;
}


/** 印記定義段：持有者視角（self＝持有者、opp＝附加者） */
const HOLDER_ACTS: ActDef[] = [
  A("dmg_of_event", new RegExp(`^額外受到傷害值\\s*${RATIO}\\s*(?:的)?(百分比|真實|固定)傷害$`), (m) => ({ ratio: ratio(m[1]), type: m[2] }), (p) => `持有者再受【${p.type}傷害】= 本次傷害 ${pct(p.ratio)}`),
  A("dmg_of_event", new RegExp(`^(?:額外)?附加傷害值\\s*${RATIO}\\s*(?:的)?(百分比|真實|固定)傷害$`), (m) => ({ ratio: ratio(m[1]), type: m[2] }), (p) => `持有者再受【${p.type}傷害】= 本次傷害 ${pct(p.ratio)}`),
  A("heal_reduce", new RegExp(`^體力恢復(?:效果|量)(?:減少|下降|降低)\\s*${NUM}%$`), (m) => ({ ratio: n(m[1]) / 100 }), (p) => `持有者體力恢復 -${p.ratio * 100}%`),
  A("dmg_mod", new RegExp(`^造成的?(非真實|百分比|固定|攻擊|技能)?傷害(?:額外)?(?:減少|降低)\\s*${NUM}%$`), (m) => ({ dir: "out_reduce", kind: m[1] || "", reduce: n(m[2]) / 100 }), (p) => `持有者造成【${p.kind || "所有"}傷害】-${p.reduce * 100}%`),
  A("dmg_mod", /^造成的?(非真實|百分比|固定|攻擊|技能)?傷害減半$/, (m) => ({ dir: "out_reduce", kind: m[1] || "", reduce: 0.5 }), (p) => `持有者造成【${p.kind || "所有"}傷害】減半`),
  A("dmg_mod", new RegExp(`^受到(?:的)?(攻擊技能|攻擊|技能|非真實)?傷害(?:額外)?(?:提升|提高)\\s*${NUM}%$`), (m) => ({ dir: "in_boost", kind: (m[1] || "").replace("攻擊技能", "攻擊"), boost: n(m[2]) / 100 }), (p) => `持有者受到【${p.kind || "所有"}傷害】+${p.boost * 100}%`),
  A("dmg_mod", /^受到(?:的)?(攻擊技能|攻擊|技能|非真實)?傷害翻倍$/, (m) => ({ dir: "in_boost", kind: (m[1] || "").replace("攻擊技能", "攻擊"), boost: 1 }), (p) => `持有者受到【${p.kind || "所有"}傷害】×2`),
  A("dmg_mod", new RegExp(`^受到(?:的)?(攻擊|技能|非真實)?傷害(?:減少|降低)\\s*${NUM}%$`), (m) => ({ dir: "in", kind: m[1] || "", reduce: n(m[2]) / 100 }), (p) => `持有者受到【${p.kind || "所有"}傷害】-${p.reduce * 100}%`),
  A("holder_invalid", /^所使用的(屬性|攻擊)?技能無效$/, (m) => ({ kind: m[1] || "" }), (p) => `持有者${p.kind}技能無效`),
  A("mark_duration", /^持續\s*(\d+)\s*回合(?:[，,]?重複獲取時重置為\s*\d+\s*回合)?$/, (m) => ({ turns: n(m[1]) }), (p) => `持續 ${p.turns} 回合`),
  A("heal_opp_equal", /^恢復對方在場精靈等量體力$/, () => ({}), () => `附加者恢復等量體力`),
  A("pp_restore_opp", /^(?:與)?(\d+)點所有技能PP值$/, (m) => ({ v: n(m[1]) }), (p) => `附加者所有技能 +${p.v} PP`),
  A("pp_restore_opp", /^(?:與)?所有技能全部PP值$/, () => ({ v: 99 }), () => `附加者所有技能 PP 全滿`),
  A("mark_remove", /^(.{2,6}之.)消失$/, (m) => ({ name: m[1] }), (p) => `移除${p.name}`),
];
function matchHolder(t: string): Act | null {
  t = t.replace(/^(?:並|且|則)/, "").trim();
  for (const d of HOLDER_ACTS) { const m = t.match(d.re); if (m) { const p = d.p(m, t); if (p) return { op: d.op, p, label: d.label(p) }; } }
  return null;
}
export function parseMarkLine(line: string, mark: string, prev?: Clause): Clause | null {
  const raw = line;
  const cu0 = customAct(line.replace(/^\s*>+\s*/, "").trim());
  if (cu0) return { raw, marker: ">", trig: "holder_passive", body: [{ acts: [cu0] }], parsed: true, rest: [], markDef: mark };
  let t = norm(line.replace(/^\s*>+\s*/, "").replace(/（[^）]*）/g, "").trim()).replace(/^持有者/, "");
  const rest: string[] = [];
  // 「並恢復對方在場精靈等量體力與1點所有技能PP值」：接在上一句
  if (/^並/.test(t) && prev) {
    const parts = t.replace(/^並/, "").split(/與(?=\d|所有)/);
    const acts: Act[] = [];
    for (const [i, part] of parts.entries()) { const a = matchHolder(i ? "與" + part : part); if (a) acts.push(a); else rest.push(part); }
    const last = prev.body[prev.body.length - 1];
    if (last) last.acts.push(...acts);
    if (rest.length) { prev.parsed = false; prev.rest = [...(prev.rest || []), ...rest]; }
    return null;
  }
  let trig: Trigger = "holder_passive";
  let m = t.match(/^每次受到攻擊傷害後[，,]?(.+)$/);
  if (m) { trig = "holder_damaged_attack"; t = m[1]; }
  const body: Stmt[] = [];
  const cm = t.match(/^若對[手方]為(.{1,4})系則(.+)$/);
  let cond: Cond[] | undefined;
  if (cm) { cond = [{ c: "type_is", p: { side: "self", type: cm[1] }, label: `持有者為${cm[1]}系` }]; t = cm[2]; trig = "holder_damaged_attack"; }
  const acts: Act[] = [];
  const whole = matchHolder(t);
  if (whole) { body.push({ cond, acts: [whole] }); return { raw, marker: ">", trig, body, parsed: true, rest, markDef: mark }; }
  for (const part of t.split(/並(?=額外|附加|恢復)|[，,]/)) {
    const a = matchHolder(part);
    if (a) acts.push(a); else if (part.trim()) rest.push(part.trim());
  }
  body.push({ cond, acts });
  return { raw, marker: ">", trig, body, parsed: rest.length === 0 && acts.length > 0, rest, markDef: mark };
}

// ───────── 描述 → Program ─────────
export function parseSkill(name: string, desc: string): Program {
  const clauses: Clause[] = [];
  for (const line of (desc || "").split(/\n/)) {
    if (!line.trim()) continue;
    // 擊敗／未擊敗相關的放到傷害結算後
    // 「技能無效時，…」：技能無效（含未命中）時才執行
    const im = line.match(/^(\s*(?:■|🎯|◇)?\s*)(?:若)?技能無效時[，,]?(.+)$/);
    if (im) { const c = parseLine(im[1] + im[2], "on_invalid" as Trigger); c.raw = line; clauses.push(c); continue; }
    const trig: Trigger = /(?:未)?擊敗對[手方]|造成的?(?:技能|攻擊)?傷害(?:高於|低於|大於|小於|為微弱)|打出致命一擊則/.test(line) ? "after_hit" : "use";
    const c = parseLine(line, trig);
    const ca = c.body[0]?.acts[0];
    if (ca?.op === "custom" && CUSTOM[ca.p.key]?.trig) c.trig = CUSTOM[ca.p.key].trig!;
    clauses.push(c);
  }
  return { title: name, kind: "skill", clauses };
}

/** 魂印：「XX時：」標頭 + 「>」子行；「名稱：」定義段顯示為說明 */
export function parseSoulMark(title: string, text: string): Program {
  const clauses: Clause[] = [];
  let cur: Trigger = "passive";
  let curCond: Cond[] | undefined;
  let section = "";
  for (const rawLine of (text || "").split(/\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (!/^>/.test(line)) {
      const head = line.replace(/[：:]\s*$/, "");
      const isHead = /[：:]\s*$/.test(line);
      if (isHead && /^每次觸發(?:時|後)?$/.test(head)) { if (cur === "self_after_physical" || cur === "self_after_special") cur = "self_after_attack"; section = ""; continue; }
      if (isHead && CUSTOM_HEADERS[head]) { const h = CUSTOM_HEADERS[head]; cur = h.trig; curCond = h.statuses ? [{ c: "event_status", p: { statuses: h.statuses }, label: h.statuses.join("／") }] : undefined; section = ""; continue; }
      const t = matchTrigger(head);
      if (t && isHead) { cur = t; curCond = undefined; section = ""; continue; }
      if (isHead) {
        const h = parseHeader(head);
        if (h) { cur = h.trig; curCond = h.cond; section = ""; continue; }
      }
      if (/[：:]\s*$/.test(line)) { cur = "custom"; section = head; clauses.push({ raw: line, trig: "custom", body: [], parsed: false, rest: [`（${head}）`], marker: "§", markDef: head }); continue; }
      // 單行魂印（無標頭）：嘗試以「XX時，」開頭
      const m = line.match(/^(.{2,14}?時)[，,：:](.+)$/);
      const t2 = m ? matchTrigger(m[1]) : null;
      if (t2) { clauses.push(parseLine(m![2], t2)); continue; }
      clauses.push(parseLine(line, "passive"));
      continue;
    }
    if (section) {
      const prevMark = [...clauses].reverse().find(x => x.markDef === section);
      const mc = parseMarkLine(line, section, prevMark);
      if (mc) clauses.push(mc);
      continue;
    }
    const c = parseLine(line, cur);
    const ca = c.body[0]?.acts[0];
    const ctrig = ca?.op === "custom" ? CUSTOM[ca.p.key]?.trig : undefined;
    if (ctrig) c.trig = ctrig; else if (curCond) c.cond = curCond;
    clauses.push(c);
  }
  return { title, kind: "soul", clauses };
}

/** 覆蓋率：解析成功的子句數 */
export function coverage(p: Program) {
  const total = p.clauses.filter(c => c.marker !== "§").length;
  const ok = p.clauses.filter(c => c.parsed).length;
  return { ok, total };
}

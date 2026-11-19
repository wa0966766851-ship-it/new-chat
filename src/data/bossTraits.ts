/**
 * 原廠 BOSS 特性資料表。
 * 原廠依據（2026-11-15 起）：百度百科《BOSS特性》29 條（iconId 0–28，https://baike.baidu.com/item/BOSS特性/62808898），
 * 寫在各條的 baike 欄位；沒有 baike 的條目＝【擴展】（來自 BWIKI「赛尔号PVE概论」或專案補充），不冒充原廠。
 * 變體規則：有數值高低之別 → layers（層數＝索引＋1）；無數值高低之別 → variants（A／B 類型）；同一 iconId 的多型共用同一張圖。
 * 純資料：異常資料庫（src/effects/bossTraitStatuses.ts）、戰鬥效果（src/blocks/ops/bossTraits.ts）、
 * 星蝕回廊抽取（modes/interstellar/v2/bossTraitDraw.ts）、介面顯示都讀這一份，不重複定義。
 * 圖示對應見 docs/data/seerapi/boss_trait_icons.md（icon＝battleeffect/bosseffect/<id>.png，與百度 iconId 同號）。
 */
export type TraitIconConf = "sure" | "guess" | "none" | "existing";
export interface BossTraitVariant {
  /** 類型代號（A／B／C…；存進狀態實例 params.v） */
  key: string;
  label: string;
  /** 該類型的說明模板（未給用 def.desc） */
  desc?: string;
  /** 該類型專用圖示（未給用 def.icon） */
  icon?: number;
  /** 該類型對應的百度條目（未給用 def.baike）；沒有任何百度條目的類型＝擴展 */
  baike?: BossTraitBaike;
  extension?: boolean;
}
export interface BossTraitBaike { id: number; name: string; text: string }
export interface BossTraitDef {
  /** 英文代號（測試與存檔用） */
  id: string;
  /** 異常資料庫的狀態 id（神話沿用既有） */
  status: string;
  /** 顯示名稱（繁中） */
  name: string;
  /** BWIKI 分類 */
  cat: string;
  /** 說明模板：{x}{y}{s} 代入參數；【時點】條件 → 效果 */
  desc: string;
  /** 參數預設值；x 為主參數 */
  def: { x?: number; y?: number; s?: string };
  /** 參數名稱（介面與審閱文件用） */
  lab: { x?: string; y?: string; s?: string };
  /** 星蝕回廊：依難度等級 0–3 的 x 值（未列＝不隨等級變化，用預設）；有 layers 時必須取自 layers */
  lv?: [number, number, number, number];
  /** 威脅分級 1 溫和／2 中等／3 強／4 極端；星蝕回廊依等級解鎖 */
  tier: 1 | 2 | 3 | 4;
  /** bosseffect 圖示編號；null＝無圖（用文字徽記）；existing＝沿用既有圖 */
  icon: number | null;
  conf: TraitIconConf;
  /** 無圖時的文字徽記 */
  badge?: string;
  /** 百度百科原廠條目；沒有＝擴展 */
  baike?: BossTraitBaike;
  /** 擴展條目（原廠百科未收錄）；由有無 baike 推得 */
  extension: boolean;
  /** 原廠層數表：主參數 x 的可選值（層數＝索引＋1） */
  layers?: number[];
  /** 第二參數 y 的原廠層數表 */
  layersY?: number[];
  /** 類型（無數值高低之別的變體） */
  variants?: BossTraitVariant[];
  /** 狀態實例沒有 v 時採用的類型（舊存檔相容） */
  defaultVariant?: string;
  /** 星蝕回廊抽到時可隨機落在的類型（未列＝用 defaultVariant） */
  drawVariants?: string[];
  /** 原廠條目上的專案補充說明（顯示時標為擴展） */
  extNote?: string;
  /** 星蝕迴廊：依難度等級 0–3 的第二參數 y（未列＝用預設） */
  lvY?: [number, number, number, number];
  /** 星蝕迴廊：依難度等級 0–3 採用的類型（例：封魔高難改用 B 型） */
  lvVariant?: [string, string, string, string];
}

export const BOSS_TRAIT_PREFIX = "特性·";
export const BOSS_TRAIT_ICON_DIR = "/seerapi/bosseffect/";
/** 原廠彩色圖（百度百科 iconId 0–28，96×96）；有彩色就用彩色，沒有的編號維持藍白色 bosseffect。 */
export const BOSS_TRAIT_COLOR_DIR = "/seerapi/bosseffect-color/";
export const BOSS_TRAIT_COLOR_IDS: ReadonlySet<number> = new Set(Array.from({ length: 29 }, (_, i) => i));
/** 依圖示編號取圖：有彩色用彩色，否則藍白色。 */
export const bossEffectIconPath = (icon: number): string => `${BOSS_TRAIT_COLOR_IDS.has(icon) ? BOSS_TRAIT_COLOR_DIR : BOSS_TRAIT_ICON_DIR}${icon}.png`;
export const BOSS_TRAIT_BADGE_DIR = "/status-icons/boss-trait/";

type Extra = Partial<Pick<BossTraitDef, "baike" | "layers" | "layersY" | "variants" | "defaultVariant" | "drawVariants" | "extNote" | "lvY" | "lvVariant">>;
const B = (id: number, name: string, text: string): BossTraitBaike => ({ id, name, text });
const T = (id: string, name: string, cat: string, tier: BossTraitDef["tier"], icon: number | null, conf: TraitIconConf, desc: string,
  def: BossTraitDef["def"] = {}, lab: BossTraitDef["lab"] = {}, lv?: BossTraitDef["lv"], badge?: string, extra: Extra = {}): BossTraitDef =>
  ({ id, status: BOSS_TRAIT_PREFIX + name, name, cat, desc, def, lab, lv, tier, icon, conf, badge, ...extra, extension: !extra.baike && !extra.variants?.some(v => v.baike) });

const NO_SKILL_DAMAGE = "無法造成技能傷害且技能附加效果失效";

export const BOSS_TRAITS: BossTraitDef[] = [
  // 神話為既有狀態（statusRegistry），只在此登記圖示與分類；星蝕回廊章末首領另掛，不進抽取池。
  { id: "myth", status: "神話", name: "神話", cat: "基本", desc: "【常駐】免疫異常狀態和能力下降狀態；所有技能必中且 PP 值無限。", def: {}, lab: {}, tier: 4, icon: 17, conf: "existing", extension: false,
    baike: B(0, "神話", "免疫異常狀態和能力下降狀態，所有技能必中且PP值無限"), extNote: "免疫異常與能力下降在我方當回合出手後才啟用。" },
  T("swift", "迅捷", "先制", 1, 1, "sure", "【先制判定】自身所有技能先制 +{x}。", { x: 1 }, { x: "先制" }, [1, 2, 3, 6], undefined,
    { baike: B(1, "迅捷", "所有技能先制+1（另有+2/+3/+6）"), layers: [1, 2, 3, 6] }),
  T("rush", "疾行", "先制", 3, 2, "sure", "【先制判定】自身所有技能先制 +6（必定先手）；無視對手的先制效果；免疫瞬殺。", {}, {}, undefined, undefined,
    { baike: B(2, "疾行", "所有技能必定先手") }),
  T("amp", "增傷", "增傷", 2, null, "none", "【造成傷害時】自身造成的攻擊傷害 +{x}%。", { x: 100 }, { x: "增傷%" }, [20, 50, 100, 200], "增"),
  T("guard", "減傷", "增傷", 1, null, "none", "【受到傷害時】自身受到的傷害 −{x}%（真實傷害除外）。", { x: 30 }, { x: "減傷%" }, [15, 25, 30, 50], "減"),
  T("weakpoint", "要害探尋", "增傷", 2, 10, "sure", "【造成攻擊傷害時】{x}% 機率使本次傷害 ×{y}。", { x: 15, y: 5 }, { x: "機率%", y: "倍率" }, [15, 15, 20, 20], undefined,
    { baike: B(10, "要害探尋", "攻擊技能 X% 機率造成 Y 倍傷害"), layers: [5, 15, 20], layersY: [5, 10], lvY: [5, 5, 10, 10] }),
  T("blind", "致盲", "閃避", 2, 12, "sure", "【對手出招時】對手技能有 {x}% 機率未命中（必中技能除外）。", { x: 30 }, { x: "閃避%" }, [25, 40, 50, 70], undefined,
    { baike: B(12, "致盲", "閃避率提升 X%"), layers: [15, 20, 25, 30, 40, 50, 70, 100] }),
  T("sealmagic", "封魔", "免疫", 2, 15, "sure", "【對手使用屬性技能時】{x}% 機率令對手屬性技能附加效果失效。", { x: 100 }, { x: "封屬%" }, undefined, undefined,
    { baike: B(15, "封魔", "100%機率令對手屬性技能失效"), defaultVariant: "A", lvVariant: ["A", "A", "B", "B"], variants: [
      { key: "A", label: "附加效果失效" },
      { key: "B", label: "屬性技能無效", extension: true, desc: "【對手使用屬性技能時】{x}% 機率令對手屬性技能無效（整個技能不生效）。" },
    ] }),
  T("block", "格擋", "免疫", 4, 5, "sure", "【受到攻擊傷害時】{x}% 機率抵擋物理與特殊攻擊的傷害（技能附加效果照常生效）。", { x: 100 }, { x: "格擋%" }, [35, 50, 75, 100], undefined,
    { defaultVariant: "AB", drawVariants: ["A", "B"], variants: [
      { key: "A", label: "物攻格擋", icon: 5, desc: "【受到攻擊傷害時】{x}% 機率抵擋物理攻擊的傷害（技能附加效果照常生效）。", baike: B(5, "物攻格擋", "抵擋物理攻擊傷害") },
      { key: "B", label: "特攻格擋", icon: 6, desc: "【受到攻擊傷害時】{x}% 機率抵擋特殊攻擊的傷害（技能附加效果照常生效）。", baike: B(6, "特攻格擋", "抵擋特殊攻擊傷害") },
      { key: "AB", label: "物攻＋特攻格擋", icon: 5, extension: true },
    ] }),
  T("nullify", "技能無效", "免疫", 4, 27, "sure", `【對手使用攻擊技能時】{x}% 機率令其${NO_SKILL_DAMAGE}。`, { x: 100 }, { x: "無效%" }, [30, 40, 60, 80], undefined,
    { defaultVariant: "A", variants: [
      { key: "A", label: "技能無效（獅盔型）", extension: true },
      { key: "B", label: "先制無效（龍威型）", extension: true, desc: `【對手釋放先制技能時】{x}% 機率令對手釋放的先制技能${NO_SKILL_DAMAGE}（屬性技能僅附加效果失效）。` },
      { key: "C", label: "後手無效", desc: `【對手攻擊技能後出手時】{x}% 機率令其${NO_SKILL_DAMAGE}。`, baike: B(27, "後手無效", "對手攻擊技能後出手則無效") },
    ] }),
  T("vigilance", "戒備", "免疫", 4, 8, "sure", "【受到攻擊傷害時】{x}% 機率戒備：對手本次技能不是先制技能就不受傷害。", { x: 100 }, { x: "戒備%" }, [35, 50, 75, 100], undefined,
    { baike: B(8, "戒備", "抵擋非先制技能的攻擊（只吃先制）") }),
  T("firstguard", "先手免傷", "免疫", 3, 28, "sure", "【受到攻擊傷害時】自身本回合先出手，則當回合免疫受到的攻擊傷害。", {}, {}, undefined, undefined,
    { baike: B(28, "先手免傷", "先出手則當回合免疫受到的攻擊傷害") }),
  T("clearturn", "消除回合", "免疫", 2, null, "none", "【自身出手後】消除對手的回合類效果。", {}, {}, undefined, "斷回"),
  T("fortitude", "堅毅", "免疫", 2, 20, "sure", "【受到傷害時】免疫固定傷害與百分比傷害。", {}, {}, undefined, undefined,
    { baike: B(20, "堅毅", "免疫固定傷害、百分比傷害") }),
  T("immune", "免傷", "免疫", 2, 25, "sure", "【受到傷害時】免疫低於 {x} 點的傷害（真實傷害除外）。", { x: 500 }, { x: "傷害點數" }, [300, 500, 1000, 2000], undefined,
    { baike: B(25, "免疫低於傷害", "免疫低於X點的傷害（另有免疫大於X點）"), layers: [200, 300, 400, 500, 1000, 2000, 3000, 4000], defaultVariant: "A", variants: [
      { key: "A", label: "免疫低於 X 點" },
      { key: "B", label: "免疫大於 X 點", desc: "【受到傷害時】免疫大於 {x} 點的傷害（真實傷害除外）。" },
    ] }),
  T("powerguard", "威力免傷", "免疫", 2, null, "none", "【受到攻擊傷害時】對手攻擊技能的威力低於 {x} 則免疫該次傷害。", { x: 60 }, { x: "威力門檻" }, [40, 60, 80, 100], "威"),
  T("critreflect", "免疫反彈致命", "免疫", 3, 26, "sure", "【受到致命一擊的攻擊傷害時】免疫該次傷害，並將其反彈給攻擊者。", {}, {}, undefined, undefined,
    { baike: B(26, "免疫反彈致命", "免疫並反彈致命一擊傷害") }),
  T("thorns", "反傷", "免疫", 2, null, "none", "【受到攻擊傷害後】對攻擊者造成所受傷害 {x}% 的真實傷害。", { x: 30 }, { x: "反彈%" }, [10, 20, 30, 50], "反"),
  T("evolve", "進化", "強化弱化", 3, 3, "sure", "【自身出手後】自身攻擊、防禦、特攻、特防、速度等級各 +1。", {}, {}, undefined, undefined,
    { baike: B(3, "進化", "自身使用技能後全屬性+1") }),
  T("corrupt", "腐化", "強化弱化", 3, 4, "sure", "【對手出手後】對手攻擊、防禦、特攻、特防、速度等級各 −1。", {}, {}, undefined, undefined,
    { baike: B(4, "腐化", "對手使用技能後全屬性-1") }),
  T("empower", "強化", "強化弱化", 2, null, "none", "【回合開始時】隨機使對手 {x} 項能力等級 −{y}。", { x: 2, y: 1 }, { x: "項數", y: "級數" }, [1, 2, 2, 3], "強"),
  T("weaken", "弱化", "強化弱化", 2, null, "none", "【回合開始時】隨機吸取對手 {x} 項能力 {y} 級加給自身（對手 −{y}、自身 +{y}）。", { x: 2, y: 1 }, { x: "項數", y: "級數" }, [1, 2, 2, 3], "弱化"),
  T("dispel", "驅散", "強化弱化", 2, 11, "sure", "【對手出手後】消除對手的能力提升。", {}, {}, undefined, undefined,
    { baike: B(11, "驅散", "對手技能結束時消除對手的能力提升") }),
  T("devour", "消除強化", "強化弱化", 2, null, "none", "【自身攻擊命中後】吞噬對手的能力提升並加給自身。", {}, {}, undefined, "奪強"),
  T("envy", "嫉妒", "強化弱化", 3, 19, "sure", "【對手出手時／回合開始時】把對手的能力提升視為能力下降；對手處於回合類效果時，自身造成的傷害 +100%。", {}, {}, undefined, undefined,
    { baike: B(19, "嫉妒", "對手能力提升視為能力下降；對手處於回合類效果時造成傷害+100%") }),
  T("greed", "貪婪", "強化弱化", 4, 23, "sure", "【回合開始時】吸取對手的能力提升；對手沒有能力提升時，改為隨機 3 項能力 −2 並加給自身。【回合結束時】吸取對手 {x} 點體力。", { x: 500 }, { x: "點數" }, [100, 200, 500, 800], "貪婪",
    { baike: B(23, "貪婪", "吸取能力提升；無則隨機3項-2加給自身；回合結束吸取500體力") }),
  T("infect", "侵染", "強化弱化", 3, 24, "sure", "【回合開始時】雙方體力恢復效果減少 {x}%（累計）；減少為 0 之前，自身攻擊造成的傷害 +100% 並附加 {y} 點固定傷害。", { x: 10, y: 300 }, { x: "每回合恢復−%", y: "固定傷害" }, undefined, undefined,
    { baike: B(24, "侵染", "每回合開始雙方體力恢復效果-10%，減為0前自身造成傷害+100%並附加300固定傷害") }),
  T("harden", "硬化", "暴擊", 3, 7, "sure", "【受到攻擊傷害時】{x}% 機率抵擋未打出致命一擊的攻擊（只吃致命一擊）。", { x: 100 }, { x: "抵擋%" }, [40, 60, 80, 100], undefined,
    { baike: B(7, "硬化", "抵擋未打出致命一擊的攻擊（只吃暴擊）") }),
  T("recover", "恢復", "暴擊", 2, null, "none", "【回合結束時】若本回合受到致命一擊，恢復自身全部體力。", {}, {}, undefined, "復"),
  T("lock", "鎖定", "暴擊", 2, 13, "sure", "【登場時】自身致命一擊率變為 {x}/16。", { x: 4 }, { x: "致命(/16)" }, [4, 8, 8, 16], undefined,
    { baike: B(13, "鎖定", "100%打出致命一擊（另有25%/50%/12.5%）"), layers: [2, 4, 8, 16] }),
  T("instakill", "秒殺", "暴擊", 3, null, "none", "【受到致命一擊後】{x}% 機率使攻擊者體力歸 0（真實傷害）。", { x: 100 }, { x: "秒殺%" }, [30, 50, 75, 100], "殺"),
  T("awaken", "覺醒", "暴擊", 3, 22, "sure", "【回合結束時】自身體力低於 {x}% 最大體力，獲得 3 回合「力量」（無視強化弱化、攻擊必暴、消除回合、造成傷害回血）。", { x: 30 }, { x: "體力%" }, undefined, undefined,
    { baike: B(22, "覺醒", "回合結束時體力低於30%獲得3回合【力量】") }),
  T("sharp", "鋒銳", "固傷回血", 2, 16, "sure", "【回合結束時】對手受到 {x} 點固定傷害（自身不出手也觸發）。", { x: 220 }, { x: "點數" }, [220, 300, 350, 500], undefined,
    { baike: B(16, "鋒銳", "每回合附加 X 點固定傷害"), layers: [220, 300, 350, 500] }),
  T("vampire", "吸血", "固傷回血", 2, null, "none", "【造成攻擊傷害後】恢復傷害量 {x}% 的體力。", { x: 30 }, { x: "吸血%" }, [10, 20, 30, 50], "吸"),
  T("drain", "生命汲取", "固傷回血", 3, 17, "sure", "【回合結束時】汲取對手 {x} 點體力（真實傷害，不被護盾與抗性減免），自身同量恢復。", { x: 500 }, { x: "點數" }, [300, 400, 500, 1000], "汲取",
    { baike: B(17, "生命汲取", "每回合汲取對手 X 點體力"), layers: [200, 250, 300, 350, 400, 500, 1000] }),
  T("mend", "癒合", "固傷回血", 1, 18, "sure", "【回合結束時】恢復 1/{x} 最大體力。", { x: 10 }, { x: "分母" }, [10, 4, 4, 2], undefined,
    { baike: B(18, "癒合", "每回合恢復 1/X 最大體力"), layers: [10, 4, 2], defaultVariant: "A", variants: [
      { key: "A", label: "比例恢復" },
      { key: "B", label: "定點恢復", desc: "【回合結束時】恢復 {x} 點體力。" },
    ] }),
  T("gluttony", "暴食", "體力上限", 3, 21, "sure", "【回合開始時】體力上限 +{x}%（至多 99999999）。【回合結束時】恢復已損失體力的 {y}%。", { x: 10, y: 30 }, { x: "上限%", y: "回復%" }, undefined, undefined,
    { baike: B(21, "暴食", "回合開始時+10%體力上限；每回合結束恢復已損失體力30%") }),
  T("reducepp", "減PP", "控場", 2, null, "none", "【攻擊命中後】{x}% 機率使對手 {y} 個技能的 PP 歸零。", { x: 30, y: 1 }, { x: "機率%", y: "技能數" }, [15, 25, 30, 40], "減PP"),
  T("inflict", "施加異常", "控場", 2, null, "none", "【攻擊命中後】{x}% 機率使對手陷入「{s}」2 回合。", { x: 30, s: "麻痺" }, { x: "機率%", s: "異常" }, [10, 20, 30, 40], "附"),
  T("typeswap", "屬性反轉", "控場", 3, 14, "sure", "【對戰時】自身與對手精靈互換屬性（下場即還原）。", {}, {}, undefined, undefined,
    { baike: B(14, "屬性反轉", "與對手精靈互換屬性") }),
  T("revive", "復甦", "多命", 4, 9, "sure", "【體力歸零時】恢復全部體力，一場最多 {x} 次。", { x: 1 }, { x: "次數" }, [1, 1, 2, 3], undefined,
    { baike: B(9, "復甦", "首次死亡後恢復全部體力"), layers: [1, 2, 3, 4] }),
];

/** 改名前的狀態名稱（舊存檔與進行中的對局）→ 現行名稱。 */
export const BOSS_TRAIT_STATUS_ALIASES: Record<string, string> = { "特性·系別變化": "特性·屬性反轉" };

export const BOSS_TRAIT_BY_ID: Record<string, BossTraitDef> = Object.fromEntries(BOSS_TRAITS.map(t => [t.id, t]));
export const BOSS_TRAIT_BY_STATUS: Record<string, BossTraitDef> = {
  ...Object.fromEntries(BOSS_TRAITS.map(t => [t.status, t])),
  ...Object.fromEntries(Object.entries(BOSS_TRAIT_STATUS_ALIASES).map(([old, now]) => [old, BOSS_TRAITS.find(t => t.status === now)!])),
};
export const isBossTraitStatus = (status?: string): boolean => !!status && !!BOSS_TRAIT_BY_STATUS[status];

/** 類型：實例沒帶 v 時用 defaultVariant（舊存檔相容）。 */
export function bossTraitVariant(def: BossTraitDef, v?: string): BossTraitVariant | undefined {
  if (!def.variants) return undefined;
  return def.variants.find(x => x.key === v) ?? def.variants.find(x => x.key === def.defaultVariant) ?? def.variants[0];
}
/** 層數：x 落在原廠層數表時回傳第幾層（1 起算）；不在表內（擴展數值）回傳 undefined。 */
export function bossTraitLayer(def: BossTraitDef, x?: number): number | undefined {
  const i = def.layers ? def.layers.indexOf(Number(x)) : -1;
  return i >= 0 ? i + 1 : undefined;
}
/** 該條（含類型）對應的百度條目；沒有＝擴展。 */
export function bossTraitBaike(def: BossTraitDef, v?: string): BossTraitBaike | undefined {
  const variant = bossTraitVariant(def, v);
  return variant?.extension ? undefined : variant?.baike ?? def.baike;
}

/** 圖示路徑：有圖用原廠 bosseffect（類型可有專用圖）；無圖用文字徽記；神話沿用既有 abnormal/17。 */
export function bossTraitIcon(def: BossTraitDef, v?: string): string {
  if (def.conf === "existing") return `/seer/abnormal/${def.icon}.png`;
  const icon = bossTraitVariant(def, v)?.icon ?? def.icon;
  return icon != null ? bossEffectIconPath(icon) : `${BOSS_TRAIT_BADGE_DIR}${def.id}.svg`;
}

/** 說明模板代入參數（未給的用預設；有類型時用該類型的模板）。 */
export function bossTraitText(def: BossTraitDef, p: { x?: number; y?: number; s?: string; v?: string } = {}): string {
  const v = { ...def.def, ...p };
  const tpl = bossTraitVariant(def, p.v)?.desc ?? def.desc;
  return tpl.replace(/\{([xys])\}/g, (_, k: "x" | "y" | "s") => String(v[k] ?? ""));
}
/** 顯示用標題：名稱＋類型＋層數（例：迅捷・2 層、格擋・物攻格擋）。 */
export function bossTraitTitle(def: BossTraitDef, p: { x?: number; v?: string } = {}): string {
  const variant = def.variants && (p.v || def.defaultVariant) ? bossTraitVariant(def, p.v) : undefined;
  const layer = bossTraitLayer(def, p.x ?? def.def.x);
  return [def.name, variant?.label, layer ? `${layer} 層` : ""].filter(Boolean).join("・");
}

/** 狀態實例的說明（參數取自實例 metadata.params，缺值用預設）；介面 tooltip 用。 */
export function bossTraitInstanceText(elf: { effects?: any[] } | undefined, status: string): string | undefined {
  const def = BOSS_TRAIT_BY_STATUS[status];
  if (!def || def.conf === "existing") return undefined;
  const eff = (elf?.effects || []).find((e: any) => e?.id === status);
  return bossTraitText(def, eff?.metadata?.params);
}

/** 精靈身上是否持有某特性（純資料掃描，不依賴戰鬥引擎；含改名前的舊狀態名）。 */
export function holdsBossTrait(elf: { effects?: any[]; battleStatuses?: Record<string, number> } | null | undefined, id: string): boolean {
  if (!elf) return false;
  const is = (name: string) => BOSS_TRAIT_BY_STATUS[name]?.id === id;
  return (elf.effects || []).some((e: any) => Number(e?.duration) > 0 && is(String(e?.id))) || Object.entries(elf.battleStatuses || {}).some(([k, n]) => Number(n) > 0 && is(k));
}

/** 特性參數／規格（資料層，不依賴戰鬥引擎，星蝕回廊與積木 op 共用） */
export interface BossTraitParams { x?: number; y?: number; s?: string; /** 類型（variants 的 key） */ v?: string }
export interface BossTraitSpec extends BossTraitParams { id: string; /** 開啟回合數：給定時本實例照一般附屬類倒數（不再算 BOSS 類） */ turns?: number }
/** 把特性掛到精靈（回傳新物件；不改原物件）。已有同名特性則以新參數覆蓋。 */
export function attachBossTraits<T extends { effects?: any[]; battleStatuses?: Record<string, number> }>(elf: T, specs: readonly BossTraitSpec[]): T {
  const next: any = { ...elf, effects: [...(elf.effects || [])], battleStatuses: { ...(elf.battleStatuses || {}) } };
  for (const s of specs) {
    const def = BOSS_TRAIT_BY_ID[s.id]; if (!def || def.conf === "existing") continue;
    const params: BossTraitParams = { ...def.def };
    for (const k of ["x", "y", "s", "v"] as const) if (s[k] !== undefined) (params as any)[k] = s[k];
    next.effects = next.effects.filter((e: any) => e?.id !== def.status && BOSS_TRAIT_STATUS_ALIASES[e?.id] !== def.status);
    const turns = Number.isInteger(s.turns) && s.turns! > 0 && s.turns! < 99 ? s.turns! : undefined;
    next.effects.push({ id: def.status, name: def.status, duration: turns ?? 999, stacks: def.id === "revive" ? Number(params.x) || 1 : 1, source: "boss-trait", metadata: { params }, ...(turns ? { timed: true } : {}) });
    next.battleStatuses[def.status] = turns ?? 999;
    if (def.id === "lock" && Number.isFinite(params.x)) next.critValue = params.x; // 致命一擊率＝critValue/16（damageCalculator）
  }
  return next;
}


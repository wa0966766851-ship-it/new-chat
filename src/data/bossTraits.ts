/**
 * 原廠 BOSS 特性資料表（來源：BWIKI「赛尔号PVE概论」==BOSS特性==，37 條；名稱與說明見 docs/audits/boss_traits_review_20261025.md）。
 * 純資料：異常資料庫（src/effects/bossTraitStatuses.ts）、戰鬥效果（src/blocks/ops/bossTraits.ts）、
 * 星蝕回廊抽取（modes/interstellar/v2/bossTraitDraw.ts）、介面顯示都讀這一份，不重複定義。
 * 圖示對應見 docs/data/seerapi/boss_trait_icons.md（icon＝battleeffect/bosseffect/<id>.png；conf：sure 確定／guess 推測）。
 */
export type TraitIconConf = "sure" | "guess" | "none" | "existing";
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
  /** 參數預設值（BWIKI 常見值）；x 為主參數 */
  def: { x?: number; y?: number; s?: string };
  /** 參數名稱（介面與審閱文件用） */
  lab: { x?: string; y?: string; s?: string };
  /** 星蝕回廊：依難度等級 0–3 的 x 值（未列＝不隨等級變化，用預設） */
  lv?: [number, number, number, number];
  /** 威脅分級 1 溫和／2 中等／3 強／4 極端；星蝕回廊依等級解鎖 */
  tier: 1 | 2 | 3 | 4;
  /** bosseffect 圖示編號；null＝無圖（用文字徽記）；existing＝沿用既有圖 */
  icon: number | null;
  conf: TraitIconConf;
  /** 無圖時的文字徽記 */
  badge?: string;
}

export const BOSS_TRAIT_PREFIX = "特性·";
export const BOSS_TRAIT_ICON_DIR = "/seerapi/bosseffect/";
export const BOSS_TRAIT_BADGE_DIR = "/status-icons/boss-trait/";

const T = (id: string, name: string, cat: string, tier: BossTraitDef["tier"], icon: number | null, conf: TraitIconConf, desc: string,
  def: BossTraitDef["def"] = {}, lab: BossTraitDef["lab"] = {}, lv?: BossTraitDef["lv"], badge?: string): BossTraitDef =>
  ({ id, status: BOSS_TRAIT_PREFIX + name, name, cat, desc, def, lab, lv, tier, icon, conf, badge });

export const BOSS_TRAITS: BossTraitDef[] = [
  // 神話為既有狀態（statusRegistry），只在此登記圖示與分類；星蝕回廊章末首領另掛，不進抽取池。
  { id: "myth", status: "神話", name: "神話", cat: "基本", desc: "【常駐】免疫能力下降與異常狀態；所有技能必中且 PP 無限（我方出手後才啟用）。", def: {}, lab: {}, tier: 4, icon: 17, conf: "existing" },
  T("swift", "迅捷", "先制", 1, 1, "guess", "【先制判定】自身所有技能先制 +{x}。", { x: 2 }, { x: "先制" }, [1, 1, 2, 3]),
  T("rush", "疾行", "先制", 3, 2, "guess", "【先制判定】自身所有技能先制 +6（必定先手）；免疫瞬殺與束縛。"),
  T("amp", "增傷", "增傷", 2, null, "none", "【造成傷害時】自身造成的攻擊傷害 +{x}%。", { x: 100 }, { x: "增傷%" }, [20, 50, 100, 200]),
  T("guard", "減傷", "增傷", 1, 28, "guess", "【受到傷害時】自身受到的傷害 −{x}%（真實傷害除外）。", { x: 30 }, { x: "減傷%" }, [15, 25, 30, 50]),
  T("weakpoint", "要害探尋", "增傷", 2, 10, "sure", "【造成攻擊傷害時】{x}% 機率使本次傷害 ×{y}。", { x: 30, y: 2 }, { x: "機率%", y: "倍率" }, [15, 20, 30, 40]),
  T("blind", "致盲", "閃避", 2, 12, "sure", "【對手出招時】對手技能有 {x}% 機率未命中（必中技能除外）。", { x: 30 }, { x: "閃避%" }, [10, 20, 30, 40]),
  T("sealmagic", "封魔", "免疫", 2, 15, "guess", "【對手使用屬性技能時】{x}% 機率使該技能無效。", { x: 50 }, { x: "封屬%" }, [25, 40, 50, 75]),
  T("block", "格擋", "免疫", 4, 5, "guess", "【受到攻擊傷害時】{x}% 機率擋下物理／特殊攻擊的傷害（技能附加效果照常生效）。", { x: 100 }, { x: "格擋%" }, [25, 35, 50, 60]),
  T("nullify", "技能無效", "免疫", 4, 27, "guess", "【對手使用攻擊技能時】{x}% 機率使該技能無效（傷害與附加效果皆不生效）。", { x: 100 }, { x: "無效%" }, [20, 30, 40, 50]),
  T("vigilance", "戒備", "免疫", 4, 8, "sure", "【受到攻擊傷害時】{x}% 機率戒備：對手本次技能不是先制技能就不受傷害。", { x: 100 }, { x: "戒備%" }, [25, 35, 50, 60]),
  T("clearturn", "消除回合", "免疫", 2, null, "none", "【自身出手後】消除對手的回合類效果。", {}, {}, undefined, "斷回"),
  T("fortitude", "堅毅", "免疫", 2, 20, "sure", "【受到傷害時】免疫固定傷害與百分比傷害。"),
  T("immune", "免傷", "免疫", 2, 25, "sure", "【受到攻擊傷害時】對手攻擊技能的威力低於 {x} 則免疫該次傷害。", { x: 60 }, { x: "威力門檻" }, [40, 60, 80, 100]),
  T("thorns", "反傷", "免疫", 2, 26, "sure", "【受到攻擊傷害後】對攻擊者造成所受傷害 {x}% 的真實傷害。", { x: 30 }, { x: "反彈%" }, [10, 20, 30, 50]),
  T("evolve", "進化", "強化弱化", 3, 3, "guess", "【自身出手後】自身攻擊、防禦、特攻、特防、速度等級各 +1。"),
  T("corrupt", "腐化", "強化弱化", 3, 4, "sure", "【對手出手後】對手攻擊、防禦、特攻、特防、速度等級各 −1。"),
  T("empower", "強化", "強化弱化", 2, 4, "guess", "【回合開始時】隨機使對手 {x} 項能力等級 −{y}。", { x: 2, y: 1 }, { x: "項數", y: "級數" }, [1, 2, 2, 3]),
  T("weaken", "弱化", "強化弱化", 2, null, "none", "【回合開始時】隨機吸取對手 {x} 項能力 {y} 級加給自身（對手 −{y}、自身 +{y}）。", { x: 2, y: 1 }, { x: "項數", y: "級數" }, [1, 2, 2, 3], "弱化"),
  T("dispel", "驅散", "強化弱化", 2, 11, "sure", "【對手出手後】消除對手的能力提升。"),
  T("devour", "消除強化", "強化弱化", 2, null, "none", "【自身攻擊命中後】吞噬對手的能力提升並加給自身。", {}, {}, undefined, "奪強"),
  T("envy", "嫉妒", "強化弱化", 3, 19, "guess", "【對手出手時／回合開始時】把對手的能力提升視為能力下降；對手處於回合類效果時，自身造成的傷害 +100%。"),
  T("greed", "貪婪", "強化弱化", 4, 23, "sure", "【回合開始時】吸取對手的能力提升；對手沒有能力提升時，改為隨機 3 項能力 −2 並加給自身；另恢復自身 {x} 點體力、對手受 {x} 點固定傷害。", { x: 500 }, { x: "點數" }, [100, 200, 500, 800], "貪婪"),
  T("harden", "硬化", "暴擊", 3, 7, "sure", "【受到攻擊傷害時】{x}% 機率抵擋未打出致命一擊的攻擊（只吃致命一擊）。", { x: 100 }, { x: "抵擋%" }, [30, 40, 60, 80]),
  T("recover", "恢復", "暴擊", 2, 6, "guess", "【回合結束時】若本回合受到致命一擊，恢復自身全部體力。"),
  T("lock", "鎖定", "暴擊", 2, 13, "sure", "【登場時】自身致命一擊率變為 {x}/16。", { x: 4 }, { x: "致命(/16)" }, [2, 3, 4, 6]),
  T("instakill", "秒殺", "暴擊", 3, 23, "guess", "【受到致命一擊後】{x}% 機率使攻擊者體力歸 0（真實傷害）。", { x: 100 }, { x: "秒殺%" }, [30, 50, 75, 100]),
  T("awaken", "覺醒", "暴擊", 3, 22, "guess", "【回合結束時】自身體力低於 {x}% 最大體力，獲得 3 回合「力量」（無視強化弱化、攻擊必暴、消除回合、造成傷害回血）。", { x: 30 }, { x: "體力%" }),
  T("sharp", "鋒銳", "固傷回血", 2, 16, "guess", "【回合結束時】對手受到 {x} 點固定傷害（自身不出手也觸發）。", { x: 220 }, { x: "點數" }, [100, 220, 220, 440]),
  T("vampire", "吸血", "固傷回血", 2, 10, "guess", "【造成攻擊傷害後】恢復傷害量 {x}% 的體力。", { x: 30 }, { x: "吸血%" }, [10, 20, 30, 50]),
  T("drain", "生命汲取", "固傷回血", 3, 17, "sure", "【回合結束時】汲取對手 {x} 點體力（真實傷害，不被護盾與抗性減免），自身同量恢復。", { x: 500 }, { x: "點數" }, [100, 200, 500, 800], "汲取"),
  T("mend", "癒合", "固傷回血", 1, 18, "sure", "【回合結束時】恢復 1/{x} 最大體力。", { x: 10 }, { x: "分母" }, [20, 15, 10, 8]),
  T("gluttony", "暴食", "體力上限", 3, 21, "guess", "【回合結束時】體力上限 +{x}%（至多 99999999），並恢復已損失體力的 {y}%。", { x: 10, y: 30 }, { x: "上限%", y: "回復%" }, [2, 5, 10, 10]),
  T("reducepp", "減PP", "控場", 2, null, "none", "【攻擊命中後】{x}% 機率使對手 {y} 個技能的 PP 歸零。", { x: 30, y: 1 }, { x: "機率%", y: "技能數" }, [15, 25, 30, 40], "減PP"),
  T("inflict", "施加異常", "控場", 2, 17, "guess", "【攻擊命中後】{x}% 機率使對手陷入「{s}」2 回合。", { x: 30, s: "麻痺" }, { x: "機率%", s: "異常" }, [10, 20, 30, 40]),
  T("typeswap", "系別變化", "控場", 3, 14, "sure", "【對戰時】自身與對手精靈互換屬性（下場即還原）。"),
  T("revive", "復甦", "多命", 4, 9, "sure", "【體力歸零時】恢復全部體力，一場最多 {x} 次。", { x: 1 }, { x: "次數" }, [1, 1, 1, 2]),
];

export const BOSS_TRAIT_BY_ID: Record<string, BossTraitDef> = Object.fromEntries(BOSS_TRAITS.map(t => [t.id, t]));
export const BOSS_TRAIT_BY_STATUS: Record<string, BossTraitDef> = Object.fromEntries(BOSS_TRAITS.map(t => [t.status, t]));
export const isBossTraitStatus = (status?: string): boolean => !!status && !!BOSS_TRAIT_BY_STATUS[status];

/** 圖示路徑：有圖用原廠 bosseffect；無圖用文字徽記；神話沿用既有 abnormal/17。 */
export function bossTraitIcon(def: BossTraitDef): string {
  if (def.conf === "existing") return `/seer/abnormal/${def.icon}.png`;
  return def.icon != null ? `${BOSS_TRAIT_ICON_DIR}${def.icon}.png` : `${BOSS_TRAIT_BADGE_DIR}${def.id}.svg`;
}

/** 說明模板代入參數（未給的用預設）。 */
export function bossTraitText(def: BossTraitDef, p: { x?: number; y?: number; s?: string } = {}): string {
  const v = { ...def.def, ...p };
  return def.desc.replace(/\{([xys])\}/g, (_, k: "x" | "y" | "s") => String(v[k] ?? ""));
}

/** 狀態實例的說明（參數取自實例 metadata.params，缺值用預設）；介面 tooltip 用。 */
export function bossTraitInstanceText(elf: { effects?: any[] } | undefined, status: string): string | undefined {
  const def = BOSS_TRAIT_BY_STATUS[status];
  if (!def || def.conf === "existing") return undefined;
  const eff = (elf?.effects || []).find((e: any) => e?.id === status);
  return bossTraitText(def, eff?.metadata?.params);
}

/** 特性參數／規格（資料層，不依賴戰鬥引擎，星蝕回廊與積木 op 共用） */
export interface BossTraitParams { x?: number; y?: number; s?: string }
export interface BossTraitSpec extends BossTraitParams { id: string }
/** 把特性掛到精靈（回傳新物件；不改原物件）。已有同名特性則以新參數覆蓋。 */
export function attachBossTraits<T extends { effects?: any[]; battleStatuses?: Record<string, number> }>(elf: T, specs: readonly BossTraitSpec[]): T {
  const next: any = { ...elf, effects: [...(elf.effects || [])], battleStatuses: { ...(elf.battleStatuses || {}) } };
  for (const s of specs) {
    const def = BOSS_TRAIT_BY_ID[s.id]; if (!def || def.conf === "existing") continue;
    const params: BossTraitParams = { ...def.def };
    for (const k of ["x", "y", "s"] as const) if (s[k] !== undefined) (params as any)[k] = s[k];
    next.effects = next.effects.filter((e: any) => e?.id !== def.status);
    next.effects.push({ id: def.status, name: def.status, duration: 999, stacks: def.id === "revive" ? Number(params.x) || 1 : 1, source: "boss-trait", metadata: { params } });
    next.battleStatuses[def.status] = 999;
    if (def.id === "lock" && Number.isFinite(params.x)) next.critValue = params.x; // 致命一擊率＝critValue/16（damageCalculator）
  }
  return next;
}


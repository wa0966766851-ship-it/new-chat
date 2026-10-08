// 賽爾號資源對應：精靈頭像/全身圖、屬性圖標（資料來源：SeerAPI api-data / seer-unity-assets）
// 圖片一律經由本機伺服器 /seer/* 取得：public/seer → 使用者 pet/、系/ 資料夾 → 快取 → 遠端（自動快取）
import type { Elf } from "../types";
import { appearanceElf } from './illusion';

export interface SeerIndex {
  /** 正規化名稱 → [[寵物ID, 屬性組合ID, 圖片旗標(1=頭像,2=全身)]] */
  pets: Record<string, [number, number, number][]>;
  /** 單屬性名稱 → 屬性ID */
  types: Record<string, number>;
  /** "主ID|副ID" → 屬性組合ID（圖標檔名） */
  combos: Record<string, number>;
}

let indexCache: SeerIndex | null = null;
let indexPromise: Promise<SeerIndex> | null = null;
const listeners = new Set<() => void>();

export function getSeerIndex(): SeerIndex | null { return indexCache; }
export function loadSeerIndex(): Promise<SeerIndex> {
  if (indexCache) return Promise.resolve(indexCache);
  if (!indexPromise) {
    indexPromise = import("../data/seerIndex.json").then((m: any) => {
      indexCache = (m.default || m) as SeerIndex;
      listeners.forEach(fn => fn());
      return indexCache!;
    });
  }
  return indexPromise;
}
export function onSeerIndexLoaded(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }

const VARIANTS: [string, string][] = [["祕", "秘"], ["裏", "裡"], ["爲", "為"], ["衆", "眾"], ["啓", "啟"], ["峯", "峰"], ["剋", "克"], ["咤", "吒"]];
export function normalizeName(n: string): string {
  let s = (n || "").replace(/[\s.·・•‧。．\-_]/g, "");
  for (const [a, b] of VARIANTS) s = s.split(a).join(b);
  return s;
}
function normalizeKeyed(idx: SeerIndex, key: string) {
  return idx.pets[key] || idx.pets[key.split("秘").join("祕")];
}

/** 依名稱找出可用的寵物ID（含同名前置型態），依優先序排列 */
/** 指定圖像（名稱 → 官方寵物 ID）：沒有官方圖或名稱對不上時使用 */
export const SEER_ID_OVERRIDES: Record<string, number> = {
  '御天龍神·哈莫': 3809, // 本機 SeerAPI 索引：龍神哈莫，不冒用其他型態。
  "天蓬元帥八戒": 1536,            // 使用者指定：菲爾蓬格
  "混濁海妖.布林克克": 359,        // 布林克克（原版）
  "治癒.龍魂再臨 次元龍": 4586,    // 空元行者
  "恐懼的化身·咤克斯": 5010,       // 舊版吒克斯「恐懼的化身」外觀（Seer 靜態圖資）
  "湮滅之主・咤克斯": 4762,        // 湮滅之主吒克斯（官方）
  "變革·馬爾修斯": 3393,           // 馬爾修斯（最新型態）
  "帝皇之盾": 3404,                // 帝皇之鉞
  "六界神王": 3045,                // SeerAPI 正式名稱「六界神王」；4032 是另一隻「六界御神」
  "星核寰宇·艾斯菲亞": 79,          // SeerAPI 艾斯菲亞
  "星軌重構·艾斯菲格": 418,          // SeerAPI 艾斯菲格
  "邪靈主宰·摩哥斯": 3561,           // SeerAPI 邪靈主宰·摩哥斯
  // 幻域精靈競技場的自創型態：以索引中的最近名稱作暫用圖，缺圖仍走既有 fallback。
  "無為龍者": 4661,                // 無為覺者
  "龍錄天鋒": 4903,                // 帝錄天鋒
  "無極聖武": 4800,                // 無極聖武
  "命運龍輪 莫伊萊": 4275,        // 命運之輪莫伊萊
};

/** 戰鬥場景專用立繪比例。大型首領立繪放在資訊卡下層，避免遮住戰鬥資料。 */
export type BattleSpriteProfile = {
  width?: string;
  height?: string;
  scale?: number;
};

export const BATTLE_SPRITE_PROFILES: Record<string, BattleSpriteProfile> = {
  [normalizeName("恐懼的化身·咤克斯")]: { width: "54%", height: "118%", scale: 1.08 },
  [normalizeName("湮滅之主・咤克斯")]: { width: "54%", height: "118%", scale: 1.08 },
};

export function battleSpriteProfile(name: string): BattleSpriteProfile | null {
  return BATTLE_SPRITE_PROFILES[normalizeName(name || "")] || null;
}

/**
 * 依實際立繪方向標註。Seer 的戰鬥全身素材多數原生朝左；正面素材與
 * 專案自訂立繪另外標記，避免用單一方向盲目翻轉整個名冊。
 */
type SpriteFacing = "left" | "right" | "front";
const BATTLE_SPRITE_FACING: Record<string, SpriteFacing> = {
  [normalizeName("悲歌.索比拉特")]: "left",
  [normalizeName("帝皇之盾")]: "left",
  [normalizeName("天蓬元帥八戒")]: "left",
  [normalizeName("皮特薩拉羅")]: "left",
  [normalizeName("布萊克")]: "left",
  [normalizeName("譜尼")]: "left",
  [normalizeName("星光·魔焰猩猩")]: "left",
  [normalizeName("混濁海妖.布林克克")]: "left",
  // Seer body 177 的巴弗洛立繪為斜側朝左，不是正面；P1 需鏡射，P2 保留原向。
  [normalizeName("鎮魂.巴弗洛")]: "left",
  [normalizeName("誑獅魔軀.魔獅迪露")]: "left",
  [normalizeName("聖靈譜尼")]: "left",
  [normalizeName("星光·魯斯王")]: "left",
  [normalizeName("星光·麗莎布布")]: "left",
  [normalizeName("冰魄·柯爾德")]: "left",
  [normalizeName("柯爾霍德")]: "left",
  [normalizeName("聖光斯嘉麗")]: "left",
  [normalizeName("混沌·布萊克")]: "left",
  [normalizeName("變革·馬爾修斯")]: "front",
  [normalizeName("人皇·帝辛")]: "left",
  [normalizeName("蟲后·奧佩婭")]: "left",
  [normalizeName("眾神之父·奧丁")]: "left",
  [normalizeName("皮皮")]: "left",
  [normalizeName("治癒.龍魂再臨 次元龍")]: "left",
  [normalizeName("無序.六刃")]: "right",
  [normalizeName("無序·蝕言")]: "left",
  [normalizeName("湮滅之主・咤克斯")]: "left",
  [normalizeName("恐懼的化身·咤克斯")]: "left",
  [normalizeName("無序.墜星")]: "left",
  [normalizeName("蓓麗安特")]: "left",
  [normalizeName("怒濤·滄嵐")]: "left",
  [normalizeName("異境神霆·雷伊")]: "left",
  // 逐圖核對 body 79／418／3809：三者皆斜側朝左，P1 鏡射、P2 原圖。
  [normalizeName("星核寰宇·艾斯菲亞")]: "left",
  [normalizeName("星軌重構·艾斯菲格")]: "left",
  [normalizeName("御天龍神·哈莫")]: "left",
  [normalizeName("邪靈主宰·摩哥斯")]: "left",
  [normalizeName("六界神王")]: "front",
  [normalizeName("聖靈邁爾斯")]: "left",
  [normalizeName("無為龍者")]: "left",
  [normalizeName("龍錄天鋒")]: "left",
  [normalizeName("無極聖武")]: "left",
  [normalizeName("命運龍輪 莫伊萊")]: "left",
};

// 同名精靈的備用型態可能具有不同朝向，以實際載入的素材為準。
const BODY_SOURCE_FACING: Record<string, SpriteFacing> = {
  "/elf-art/unknown_myth_ghost_body.png": "front",
  "/elf-art/emperor_dixin_body.png": "left",
  "/elf-art/wuxu_liuren_body.png": "right",
  "/elf-art/wuxu_shiyan_body.png": "left",
  "/elf-art/zhakesi_fear_body.png": "right",
  ...Object.fromEntries([10,1204,177,187,2647,2844,303,306,309,3098,3404,343,3432,3456,359,3626,3740,3886,4647,4648,4649,4762,5000,875].map(id => [`/seer/body/${id}.png`, "left" as SpriteFacing])),
  ...Object.fromEntries([300,3539,4586,4643,1536].map(id => [`/seer/body/${id}.png`, "left" as SpriteFacing])),
  ...Object.fromEntries([3105,3393,4032,2882].map(id => [`/seer/body/${id}.png`, "front" as SpriteFacing])),
  ...Object.fromEntries([3045].map(id => [`/seer/body/${id}.png`, "front" as SpriteFacing])),
  ...Object.fromEntries([79,418,3809,3561].map(id => [`/seer/body/${id}.png`, "left" as SpriteFacing])),
  // 幻域競技場暫用圖（2026-10-03 使用者確認）：四張皆以朝左處理，P1 鏡射、P2 原圖。
  ...Object.fromEntries([4661,4903,4800,4275].map(id => [`/seer/body/${id}.png`, "left" as SpriteFacing])),
};

/** 只有 ElfAvatar 會直接載入的 URL/資料網址才算自訂圖片；內建美術 key（如 otherworld_thunder_rey）仍使用方向表。 */
export function hasRenderableElfImagePath(path?: string): boolean {
  return !!path && /^(\/|https?:|data:)/.test(path);
}

/** P1 應朝右、P2 應朝左，彼此面對；未逐圖核實的精靈保留原圖。 */
export function shouldMirrorBattleSprite(name: string, side: "p1" | "p2", hasCustomPath = false, source?: string): boolean {
  const facing = source && BODY_SOURCE_FACING[source] || (hasCustomPath ? "front"
    : !source && normalizeName(name) === normalizeName("恐懼的化身·咤克斯") ? "right"
    : BATTLE_SPRITE_FACING[normalizeName(name || "")]);
  if (!facing || facing === "front") return false;
  const target = side === "p1" ? "right" : "left";
  return facing !== target;
}

/** 依精靈身高縮放立繪；極端哨兵值改由場景比例設定控制。 */
export function battleSpriteScale(name: string, rawHeight: number): number {
  const heightScale = !Number.isFinite(rawHeight) || rawHeight <= 0 || rawHeight >= 10000
    ? 1
    : Math.min(1.85, Math.max(0.68, Math.sqrt(rawHeight / 180)));
  return heightScale * (battleSpriteProfile(name)?.scale ?? 1);
}

/** 自訂美術（public/elf-art/{key}_head.png / _body.png），優先於官方圖 */
export const CUSTOM_ART: Record<string, string> = {
  "無序墜星": "wuxu_zhuixing",
  "無序蝕言": "wuxu_shiyan",
  "無序六刃": "wuxu_liuren",
  "異境神霆雷伊": "otherworld_thunder_rey",
};

/** 只替換戰鬥全身立繪；恐懼化身的頭像維持既有來源。 */
const CUSTOM_BODY_ART: Record<string, string> = {
  [normalizeName("人皇·帝辛")]: "emperor_dixin",
  [normalizeName("恐懼的化身·咤克斯")]: "zhakesi_fear",
};

export function resolvePetIds(elf: Pick<Elf, "name" | "id"> & { seerId?: number | string }, kind: "head" | "body" = "head"): number[] {
  const idx = indexCache;
  const out: number[] = [];
  const push = (n: number) => { if (Number.isFinite(n) && n > 0 && !out.includes(n)) out.push(n); };
  if (elf.seerId != null && elf.seerId !== "") push(Number(elf.seerId));
  const ov = SEER_ID_OVERRIDES[elf.name || ""];
  if (ov) push(ov);
  if (!idx) return out;
  const flag = kind === "head" ? 1 : 2;
  const full = normalizeName(elf.name || "");
  // 名稱候選：全名 → 以分隔符切開後的各段（後段優先，例：悲歌.索比拉特 → 索比拉特）
  const parts = (elf.name || "").split(/[.·・•‧]/).map(s => normalizeName(s)).filter(Boolean);
  const candidates = [full, ...parts.slice().reverse()];
  // 名稱含空白時（例：治癒.龍魂再臨 次元龍）也試最後一個詞
  const lastWord = (elf.name || "").trim().split(/\s+/).pop();
  if (lastWord && lastWord !== elf.name) candidates.push(normalizeName(lastWord));
  for (const key of candidates) {
    const list = normalizeKeyed(idx, key);
    if (!list || !list.length) continue;
    // 若應用內 ID 剛好就是同名寵物 ID，優先
    const own = list.find(e => String(e[0]) === String(elf.id));
    if (own && (own[2] & flag)) push(own[0]);
    // 同名多型態：取最早（前置）型態
    list.filter(e => e[2] & flag).sort((a, b) => a[0] - b[0]).forEach(e => push(e[0]));
  }
  return out;
}

export function petImageUrls(elf: Pick<Elf, "name" | "id"> & { seerId?: number | string }, kind: "head" | "body" = "head"): string[] {
  elf = appearanceElf(elf);
  const name = normalizeName(elf.name || "");
  if (kind === "head" && name === normalizeName("人皇·帝辛")) return ["/elf-art/emperor_dixin_body.png", ...resolvePetIds(elf, kind).map(id => `/seer/head/${id}.png`)];
  const art = kind === "body" ? (CUSTOM_BODY_ART[name] || CUSTOM_ART[name]) : CUSTOM_ART[name];
  const urls = [...(art ? [`/elf-art/${art}_${kind}.png`] : []), ...resolvePetIds(elf, kind).map(id => `/seer/${kind}/${id}.png`)];
  // 全身圖缺圖時退回頭像
  // 全身圖缺圖時不以方形頭像替代（會擋住背景），改由 ElfAvatar 顯示圓形頭像
  return urls;
}

// ── 屬性
const ALIAS: Record<string, string> = { 地: "地面", 神祕: "神秘" };
export function splitTypes(type: string): string[] {
  if (!type || type === "--" || type === "無屬性" || type === "未知") return [];
  const t = type.replace(/系$/, "");
  let parts = t.split(/[.·・/／\s]+/).filter(Boolean);
  if (parts.length === 1 && indexCache && !indexCache.types[toIndexType(parts[0])]) {
    // 無分隔的雙屬性（例：混沌暗影）→ 依屬性名拆分
    const names = Object.keys(indexCache.types).map(fromIndexType).sort((a, b) => b.length - a.length);
    const found: string[] = [];
    let rest = parts[0];
    while (rest) {
      const hit = names.find(n => rest.startsWith(n));
      if (!hit) break;
      found.push(hit); rest = rest.slice(hit.length);
    }
    if (!rest && found.length) parts = found;
  }
  return parts.map(p => ALIAS[p] || p);
}
const toIndexType = (t: string) => (t === "神秘" ? "神祕" : t);
const fromIndexType = (t: string) => (t === "神祕" ? "神秘" : t);

/** 回傳官方屬性組合圖標 ID（找不到回傳 null） */
export function typeComboId(type: string): number | null {
  const idx = indexCache;
  if (!idx) return null;
  const parts = splitTypes(type);
  if (!parts.length) return null;
  const ids = parts.map(p => idx.types[toIndexType(p)]);
  if (ids.some(v => v == null)) return null;
  if (ids.length === 1) return idx.combos[`${ids[0]}|`] ?? ids[0];
  const k1 = `${ids[0]}|${ids[1]}`, k2 = `${ids[1]}|${ids[0]}`;
  return idx.combos[k1] ?? idx.combos[k2] ?? null;
}

/** 屬性圖標網址候選：官方組合 → 使用者「系」資料夾 */
/** 無屬性（含屬性技能誤填「屬性」）→ 官方 pettype/prop.png */
export const isNoneType = (type?: string) => !type || ["無屬性", "无属性", "屬性", "--", "無"].includes(type.replace(/系$/, ""));
/** public/seer/xi 目前的檔案（新增圖檔時同步加入）。 */
const XI_FILES = new Set(["機械.暗影", "混沌.水系", "混沌.電系", "神秘.電系", "邪靈.戰鬥系"]);

export function typeIconUrls(type: string): string[] {
  if (isNoneType(type)) return ["/seer/type/prop.png"];
  const parts = splitTypes(type);
  if (!parts.length) return [];
  const urls: string[] = [];
  const combo = typeComboId(type);
  if (combo != null) urls.push(`/seer/type/${combo}.png`);
  // 使用者「系」資料夾（public/seer/xi）：只引用實際存在的檔案，避免逐一試錯產生 404。
  const orders = parts.length > 1 ? [parts, [...parts].reverse()] : [parts];
  for (const o of orders) for (const name of [o.join(".") + "系", o.join("."), o.join("") + "系"]) {
    if (XI_FILES.has(name)) urls.push(`/seer/xi/${encodeURIComponent(name)}.png`);
  }
  return urls;
}

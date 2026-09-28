// 賽爾號資源對應：精靈頭像/全身圖、屬性圖標（資料來源：SeerAPI api-data / seer-unity-assets）
// 圖片一律經由本機伺服器 /seer/* 取得：public/seer → 使用者 pet/、系/ 資料夾 → 快取 → 遠端（自動快取）
import type { Elf } from "../types";

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
  "混濁海妖.布林克克": 359,        // 布林克克（原版）
  "治癒.龍魂再臨 次元龍": 4586,    // 空元行者
  "恐懼的化身·咤克斯": 3665,       // 厲魘魔王吒克斯
  "湮滅之主・咤克斯": 4762,        // 湮滅之主吒克斯（官方）
  "變革·馬爾修斯": 3393,           // 馬爾修斯（最新型態）
  "帝皇之盾": 3404,                // 帝皇之鉞
  "六界神王": 4032,                // 命運之輪：六界御神
};

/** 自訂美術（public/elf-art/{key}_head.png / _body.png），優先於官方圖 */
export const CUSTOM_ART: Record<string, string> = {
  "無序墜星": "wuxu_zhuixing",
  "無序蝕言": "wuxu_shiyan",
  "無序六刃": "wuxu_liuren",
  "異境神霆雷伊": "otherworld_thunder_rey",
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
  const art = CUSTOM_ART[normalizeName(elf.name || "")];
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
export function typeIconUrls(type: string): string[] {
  if (isNoneType(type)) return ["/seer/type/prop.png"];
  const parts = splitTypes(type);
  if (!parts.length) return [];
  const urls: string[] = [];
  const combo = typeComboId(type);
  if (combo != null) urls.push(`/seer/type/${combo}.png`);
  // 使用者「系」資料夾：雙屬性兩種順序都試（例：水.混沌 ↔ 混沌.水系.png）
  const orders = parts.length > 1 ? [parts, [...parts].reverse()] : [parts];
  for (const o of orders) {
    urls.push(`/seer/xi/${encodeURIComponent(o.join("") + "系")}.png`);
    if (o.length > 1) {
      urls.push(`/seer/xi/${encodeURIComponent(o.join(".") + "系")}.png`);
      urls.push(`/seer/xi/${encodeURIComponent(o.join("."))}.png`);
    }
  }
  return urls;
}

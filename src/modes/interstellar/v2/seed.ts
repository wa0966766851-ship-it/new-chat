/**
 * 星蝕回廊：局碼（種子＋開局設定）。
 * 同一個局碼＝同一張地圖、敵人、獎勵、商店、事件與戰鬥亂數。
 * 局碼包含開局會影響隨機結果的全部設定（N 等級、裝備、契約、禁用名單）與精靈池指紋。
 */
export interface RunSetup {
  seed: number; nLevel: number; equipType: "suit" | "title"; equipId: string; modifiers: string[]; bans: string[]; poolSig?: string;
}
const PREFIX = "ECL1.";
const b64 = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));

/** FNV-1a，輸出 31 位元非負整數。 */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0) & 0x7fffffff;
}
/** 以種子與標籤衍生子種子（戰鬥亂數等）；同輸入必得同輸出。 */
export function deriveSeed(seed: number, ...labels: (string | number)[]): number {
  return hashSeed(`${seed >>> 0}|${labels.join("|")}`);
}
/** 精靈池指紋：池不同，同一種子不會產生同一局。 */
export function poolSignature(ids: readonly (string | number)[]): string {
  return hashSeed([...ids].map(String).sort().join(",")).toString(36).padStart(6, "0").slice(0, 6);
}
export function encodeRunCode(s: RunSetup): string {
  return PREFIX + b64(JSON.stringify([s.seed >>> 0, s.nLevel, s.equipType === "suit" ? "s" : "t", s.equipId, [...s.modifiers].sort(), [...s.bans].sort(), s.poolSig ?? ""]));
}
export type ParsedSeed = { kind: "code"; setup: RunSetup } | { kind: "seed"; seed: number } | null;
/** 輸入可以是完整局碼、純數字種子，或任意文字（雜湊成種子）。空白回傳 null。 */
export function parseSeedInput(raw: string): ParsedSeed {
  const text = raw.trim(); if (!text) return null;
  if (text.startsWith(PREFIX)) {
    try {
      const [seed, n, t, id, mods, bans, sig] = JSON.parse(unb64(text.slice(PREFIX.length)));
      if (!Number.isFinite(seed) || !Number.isInteger(n) || n < 0 || n > 18 || !Array.isArray(mods) || !Array.isArray(bans)) return null;
      return { kind: "code", setup: { seed: seed >>> 0, nLevel: n, equipType: t === "t" ? "title" : "suit", equipId: String(id), modifiers: mods.map(String), bans: bans.map(String), poolSig: sig || undefined } };
    } catch { return null; }
  }
  if (/^\d{1,10}$/.test(text)) return { kind: "seed", seed: Number(text) & 0x7fffffff };
  return { kind: "seed", seed: hashSeed(text) };
}

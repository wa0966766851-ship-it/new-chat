/**
 * 經 API 匯入的原廠精靈（只有資料與預先煉成的連鎖 Kit；沒有任何專屬 handler）。
 * 產生流程見 docs/目標_原廠新精靈經系統實裝_20261012.md：
 *   scripts/import_seer_wiki.ts（BWIKI＋SeerAPI → 繁體資料）→ scripts/build_imported_kits.ts（煉成 Kit）
 * 描述與 Kit 的 sourceSha256 不一致時（描述改了、Kit 沒重煉），該定義不啟用。
 */
import type { Elf, Skill } from '../types';
import type { KitEntry } from '../effects/effectSystem.schema';
import compressed from './imported/imported.compressed.json';
import { gunzipSync, strFromU8 } from 'fflate';

type Kits = { soul: { sourceSha256: string; kit: KitEntry[] } | null; skills: Record<string, { sourceSha256: string; kit: KitEntry[] }> };

/** 瀏覽器與 Node 共用的 SHA-256（同步，供資料載入時核對 Kit 是否對應目前描述）。 */
function sha256(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const len = bytes.length, total = ((len + 9 + 63) >> 6) << 6, m = new Uint8Array(total);
  m.set(bytes); m[len] = 0x80;
  const bits = len * 8; for (let i = 0; i < 4; i++) m[total - 1 - i] = (bits / 2 ** (8 * i)) & 0xff;
  const w = new Uint32Array(64), r = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < total; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = (m[o + 4 * i] << 24) | (m[o + 4 * i + 1] << 16) | (m[o + 4 * i + 2] << 8) | m[o + 4 * i + 3];
    for (let i = 16; i < 64; i++) { const s0 = r(w[i - 15], 7) ^ r(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = r(w[i - 2], 17) ^ r(w[i - 2], 19) ^ (w[i - 2] >>> 10); w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0; }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
      const t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0; H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }
  return H.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
}

/** 打包時省略的 customText 由子句原文補回 */
const restoreText = (kit: KitEntry[]): KitEntry[] => kit.map(e => e.customText !== undefined ? e : { ...e, customText: (e.params as any)?.clause?.raw ?? '' });

function withKits(raw: any, kits: Kits): Omit<Elf, 'calculatedStats' | 'currentHp' | 'maxHp'> {
  const skill = (s: any): Skill | null => {
    const k = kits.skills[s.name];
    if (!k || k.sourceSha256 !== sha256(s.description)) return null; // 不完整或過期：不放進可用技能
    const { source, ...rest } = s;
    return { ...rest, maxPp: rest.pp, effectMode: 'kit', kit: restoreText(k.kit) } as Skill;
  };
  const skills = raw.skills.map(skill).filter(Boolean) as Skill[];
  const pool = raw.skillPool.map(skill).filter(Boolean) as Skill[];
  const soulOk = !!kits.soul && kits.soul.sourceSha256 === sha256(raw.soulMark.description);
  const { seerId, ...elf } = raw;
  return {
    ...elf,
    seerId,
    soulMark: { name: raw.soulMark.name || '魂印', badgeChar: raw.soulMark.badgeChar || '魂', description: raw.soulMark.description,
      effectType: 'none', effectValue: 0, ...(soulOk ? { effectMode: 'kit' as const, kit: restoreText(kits.soul!.kit) } : {}) },
    skills, skillPool: pool,
  } as any;
}

// 原始資料：src/data/imported/wiki_<ID>.json 與 .kits.json；打包檔由 scripts/build_imported_kits.ts 產生（首頁初始 JS 預算）
if ((compressed as any).schemaVersion !== 1) throw new Error('匯入精靈資料版本不相容');
const PACK: { elf: any; kits: Kits }[] = JSON.parse(strFromU8(gunzipSync(Uint8Array.from(atob((compressed as any).gzip), c => c.charCodeAt(0)))));
export const IMPORTED_ELF_SEEDS = PACK.map(p => withKits(p.elf, p.kits));
export { sha256 as importedKitSha256 };

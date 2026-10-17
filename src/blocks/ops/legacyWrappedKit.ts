// legacy_handler 包裝 Kit 的建構與精簡封裝（過渡用）。
// 包裝 Kit 只由 (種類, 持有者, 名稱, 原文) 決定；首頁封裝因此只存「種類／持有者／名稱／原文指紋」，
// 執行時用精靈自己的原文還原完整 Kit（指紋不符＝原文已變更，不套用）。完整原文仍保存在來源檔
// migratedLegacyWrappedKits.ts，由封裝腳本及測試逐一深比較還原結果，沒有任何原文被丟棄。
import type { KitEntry } from '../../effects/effectSystem.schema';

export type WrappedKind = 'skill' | 'soul' | 'trait';

export function buildWrappedKit(kind: WrappedKind, elf: string, key: string, description: string, label: string): KitEntry[] {
  const skill = kind === 'skill';
  const trig = skill ? 'use' : 'passive';
  return [{
    codeId: 'effect_sequence', node: skill ? 'on_skill_use' : 'passive_always', source: skill ? 'skill' : kind === 'soul' ? 'soulmark' : 'mechanic', role: 'innate', order: 0, customText: description,
    params: { clause: { raw: description, trig, parsed: true, body: [{ acts: [{ op: 'legacy_handler', p: { elf, key, kind }, label }] }] } },
  } as KitEntry];
}
/** 魂印以精靈名稱為鍵；技能與特質以自身名稱為鍵。 */
export const wrappedKey = (kind: WrappedKind, elfName: string, name: string) => (kind === 'soul' ? elfName : name);
export const wrappedLabel = (kind: WrappedKind, elfName: string, name: string) => '專屬機制：' + (kind === 'skill' ? name : `${elfName}·${name}`);

/** cyrb53：53 位元同步指紋（只用於「原文是否變更」比對，不作安全用途）。 */
export function textFingerprint(text: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36) + text.length.toString(36);
}

export type SlimWrapped = { wrapped: true; kind: WrappedKind; elfIds: string[]; name: string; fp: string };
export const isSlimWrapped = (d: any): d is SlimWrapped => d?.wrapped === true;

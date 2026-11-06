import {ELF_ID_MAPPING} from './elfRegistry';

/**
 * 內建精靈改名別名表（存檔／名稱鍵相容）。
 *
 * 命名規範（2026-11-06 決定）：名稱只放精靈本名，屬性系（type）不得寫進名稱；
 * 分隔符統一用中點「·」（U+00B7，47 隻精靈中 18 隻使用，且新精靈 5032–5035、wiki 匯入皆採用），
 * 不用 ASCII「.」、全形「・」或空白。名稱鍵暫存器以 id 為主，名稱鍵只作別名。
 *
 * 比對時忽略空白與分隔符（. · ・ ‧ •），所以「治癒.龍魂再臨 次元龍」「治癒·龍魂再臨次元龍」等寫法都會對到新名稱。
 */
const normalize = (name: string) => name.normalize('NFKC').replace(/[\s.·・‧•]/g, '');

export const LEGACY_ELF_NAME_ALIASES: readonly {id: string; name: string; legacy: readonly string[]}[] = [
  {id: '5021', name: '治癒·龍魂再臨', legacy: ['治癒.龍魂再臨 次元龍', '治癒·龍魂再臨 次元龍', '治癒.龍魂再臨', '治癒龍魂再臨 次元龍']},
];

const byKey = new Map<string, {id: string; name: string}>();
for (const entry of LEGACY_ELF_NAME_ALIASES) {
  byKey.set(normalize(entry.name), entry);
  for (const legacy of entry.legacy) byKey.set(normalize(legacy), entry);
}

/** 任何舊寫法（含空白／分隔符不同）→ 目前正式名稱；沒有別名時原樣返回。 */
export function canonicalElfName(name: string): string;
export function canonicalElfName(name: string | undefined): string | undefined;
export function canonicalElfName(name: string | undefined): string | undefined {
  return name === undefined ? name : byKey.get(normalize(name))?.name ?? name;
}

/** 內建精靈（非自訂、id 對得上）帶舊名稱時改為正式名稱；其餘物件原樣返回（同一個參照）。 */
export function upgradeLegacyElfName<T extends {id?: unknown; name?: string; isCustom?: boolean}>(elf: T): T {
  if (!elf || typeof elf.name !== 'string' || elf.isCustom) return elf;
  const entry = byKey.get(normalize(elf.name));
  if (!entry || elf.name === entry.name) return elf;
  const id = String(elf.id);
  if (id.startsWith('custom_') || (id !== entry.id && ELF_ID_MAPPING[id] !== entry.id)) return elf;
  return {...elf, name: entry.name};
}

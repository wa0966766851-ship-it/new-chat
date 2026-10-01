import type { Elf } from '../types';

/** 搜尋共用契約：空白分隔為 AND；數字／id:／# 為精確序號，不誤中 15002。 */
export function normalizeElfSearch(value: unknown): string {
  return String(value ?? '').normalize('NFKC').toLowerCase()
    .replace(/战/g, '戰').replace(/斗/g, '鬥').replace(/飞/g, '飛').replace(/电/g, '電')
    .replace(/龙/g, '龍').replace(/圣/g, '聖').replace(/灵/g, '靈').replace(/远/g, '遠')
    .replace(/轮/g, '輪').replace(/虫/g, '蟲').replace(/[·・‧.。/／＋+·\s_-]/g, '');
}

export function matchesElfQuery(elf: Partial<Elf>, query: string, types: string[] = []): boolean {
  const type = normalizeElfSearch(elf.type);
  if (!types.every(selected => type.includes(normalizeElfSearch(selected)))) return false;
  const ids = [elf.id, elf.seerId].filter(v => v !== undefined && v !== null).map(normalizeElfSearch);
  const name = normalizeElfSearch(elf.name), soul = normalizeElfSearch(elf.soulMark?.name);
  return query.trim().split(/\s+/).filter(Boolean).every(raw => {
    const id = raw.match(/^(?:id[:：]|#)(.+)$/i);
    if (id || /^\d+$/.test(raw)) return ids.includes(normalizeElfSearch(id?.[1] ?? raw));
    const attribute = raw.match(/^(?:type|屬性|属性)[:：](.+)$/i);
    const term = normalizeElfSearch(attribute?.[1] ?? raw);
    return attribute ? type.includes(term) : [name, type, soul, ...ids].some(value => value.includes(term));
  });
}

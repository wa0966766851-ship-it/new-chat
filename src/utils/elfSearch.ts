import type { Elf } from '../types';

export const ELF_SEARCH_PLACEHOLDER = '名稱、編號、屬性、魂印、技能（空白組合）';
export const ELF_SEARCH_HINT = '空白分隔需同時符合；數字、#編號、id:編號精確搜尋；type:屬性、skill:技能可指定欄位。支援全形與常用簡繁字。';

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
  const skills = [...(elf.skills ?? []), ...(elf.skillPool ?? [])].map(s => normalizeElfSearch(s.name));
  return query.normalize('NFKC').trim().split(/\s+/).filter(Boolean).every(raw => {
    const id = raw.match(/^(?:id[:：]|#)(.+)$/i);
    if (id || /^\d+$/.test(raw)) return ids.includes(normalizeElfSearch(id?.[1] ?? raw));
    const skill = raw.match(/^(?:skill|技能)[:：](.+)$/i);
    if (skill) return skills.some(value => value.includes(normalizeElfSearch(skill[1])));
    const attribute = raw.match(/^(?:type|屬性|属性)[:：](.+)$/i);
    const term = normalizeElfSearch(attribute?.[1] ?? raw);
    return attribute ? type.includes(term) : [name, type, soul, ...ids, ...skills].some(value => value.includes(term));
  });
}

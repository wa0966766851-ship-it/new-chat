export const SEER_TYPES = [
  '草', '水', '火', '飛行', '電', '機械', '地面', '普通', '冰', '超能', '戰鬥', '光', '暗影', '神秘',
  '龍', '聖靈', '次元', '遠古', '邪靈', '自然', '王', '混沌', '神靈', '輪迴', '蟲', '虛空', '無屬性',
];

const traditionalLetters: Record<string, string> = {
  飞: '飛', 电: '電', 机: '機', 战: '戰', 斗: '鬥', 龙: '龍',
  圣: '聖', 灵: '靈', 远: '遠', 轮: '輪', 回: '迴', 虫: '蟲',
  虚: '虛', 无: '無', 属: '屬',
};

export function cleanTypeQuery(text: string): string {
  return text.normalize('NFKC')
    .replace(/[飞机战斗龙电圣灵远轮回虫虚无属]/g, character => traditionalLetters[character])
    .replace(/系(?=$|[.·・/、+\s])/g, '').replace(/神祕/g, '神秘')
    .replace(/(^|[.·・/、+\s])地(?=$|[.·・/、+\s])/g, '$1地面')
    .replace(/[.·・/、+\s]+/g, '.').replace(/^\.|\.$/g, '');
}

export function resolveTypeQuery(text: string, types: readonly string[] = SEER_TYPES): string[] | undefined {
  const cleaned = cleanTypeQuery(text);
  if (types.includes(cleaned)) return [cleaned];

  for (const first of types) {
    if (!cleaned.startsWith(first) || first === '無屬性') continue;
    const second = cleaned.slice(first.length).replace(/^\./, '');
    if (first !== second && second !== '無屬性' && types.includes(second)) return [first, second];
  }
  return undefined;
}

// Search compares the constituent types, so either input order selects the same cell.
export function typeQueryKey(text: string, types: readonly string[] = SEER_TYPES): string | undefined {
  return resolveTypeQuery(text, types)?.sort((a, b) => types.indexOf(a) - types.indexOf(b)).join('.');
}

export function battleTypeKey(text?: string): string {
  if (!text) return '';
  return typeQueryKey(text) ?? cleanTypeQuery(text);
}

export function battleTypeParts(text?: string): string[] {
  return battleTypeKey(text).split('.').filter(Boolean);
}

export function sameBattleType(a?: string, b?: string): boolean {
  const key = battleTypeKey(a);
  return Boolean(key) && key === battleTypeKey(b);
}

export function sharesBattleType(a?: string, b?: string): boolean {
  const parts = battleTypeParts(b);
  return battleTypeParts(a).some(part => parts.includes(part));
}

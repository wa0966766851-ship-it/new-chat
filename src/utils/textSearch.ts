/**
 * 通用文字搜尋（2026-11-07）：效果庫、效果查詢、道具共用。
 * - 正規化：全形轉半形、大小寫、常見簡體字轉繁體（遊戲用語）、「·／.」與空白差異。
 * - 多關鍵字：空白分隔＝全部符合；「-詞」＝排除；「"片語"」＝整段比對。
 * - 同義詞：必中／必定命中、秒殺／瞬殺、免死／強制存活…任一命中即算。
 * - 排序：標題命中 > 標籤 > 內文；同分維持原順序。
 */
const SIMPLIFIED: Record<string, string> = {
  体: '體', 伤: '傷', 害: '害', 无: '無', 击: '擊', 护: '護', 罩: '罩', 药: '藥', 剂: '劑', 异: '異', 态: '態', 级: '級', 闪: '閃', 败: '敗',
  胜: '勝', 战: '戰', 术: '術', 杀: '殺', 复: '復', 阶: '階', 转: '轉', 灵: '靈', 属: '屬', 系: '系', 麻: '麻', 痹: '痺', 冻: '凍', 烧: '燒',
  疲: '疲', 惫: '憊', 惧: '懼', 睡: '睡', 眠: '眠', 毒: '毒', 寄: '寄', 乱: '亂', 衰: '衰', 弱: '弱', 盲: '盲', 缚: '縛', 默: '默', 缴: '繳', 械: '械',
  龙: '龍', 圣: '聖', 机: '機', 动: '動', 时: '時', 间: '間', 对: '對', 场: '場', 带: '帶', 发: '發', 优: '優', 减: '減', 疗: '療', 值: '值',
  个: '個', 们: '們', 进: '進', 还: '還', 际: '際', 与: '與', 为: '為', 这: '這', 从: '從', 后: '後', 制: '制', 先: '先', 获: '獲', 数: '數',
  双: '雙', 两: '兩', 将: '將', 应: '應', 断: '斷', 门: '門', 状: '狀', 隐: '隱', 匿: '匿', 净: '淨', 炼: '煉', 恶: '惡', 魂: '魂', 印: '印',
};
const SYNONYMS: string[][] = [
  ['必中', '必定命中'], ['秒殺', '瞬殺', '即死'], ['免死', '強制存活', '保留1點體力'], ['先制', '優先'], ['麻痺', '麻痹'],
  ['回合類效果', '回合效果', '回合類'], ['能力提升', '強化', '能力上升'], ['能力下降', '弱化'], ['護盾', '精靈護盾'], ['護罩', '精靈護罩'],
  ['技能無效', '無效'], ['附加效果失效', '附加失效'], ['固定傷害', '固傷'], ['百分比傷害', '百分比'], ['真實傷害', '真傷'],
  ['藥劑反噬', '反噬'], ['體力', 'hp'], ['pp', 'pp值', '活力'],
];

export function normalizeSearchText(s: unknown): string {
  return String(s ?? '')
    .replace(/[！-～]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/　/g, ' ')
    .toLowerCase()
    .replace(/[一-鿿]/g, ch => SIMPLIFIED[ch] || ch)
    .replace(/[·．.・]/g, '·');
}

export interface ParsedQuery { must: string[][]; not: string[] }
/** 解析查詢：每個必要詞展開成同義詞清單（任一命中即可）。 */
export function parseSearchQuery(query: string): ParsedQuery {
  const must: string[][] = [], not: string[] = [];
  const re = /(-)?"([^"]+)"|(-)?(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(normalizeSearchText(query)))) {
    const negate = !!(m[1] || m[3]);
    const word = (m[2] ?? m[4] ?? '').trim();
    if (!word) continue;
    if (negate) { not.push(word); continue; }
    const group = SYNONYMS.find(g => g.some(x => normalizeSearchText(x) === word));
    must.push(group ? [...new Set([word, ...group.map(normalizeSearchText)])] : [word]);
  }
  return { must, not };
}

export interface SearchFields { title?: unknown; tags?: unknown[]; body?: unknown[] }
/** 比對並計分；不符合回傳 -1。 */
export function searchScore(q: ParsedQuery, f: SearchFields): number {
  const title = normalizeSearchText(f.title);
  const tags = (f.tags || []).map(normalizeSearchText);
  const body = (f.body || []).map(normalizeSearchText).join('\n');
  const all = `${title}\n${tags.join('\n')}\n${body}`;
  if (q.not.some(w => all.includes(w))) return -1;
  let score = 0;
  for (const alts of q.must) {
    if (alts.some(w => title === w)) { score += 6; continue; }
    if (alts.some(w => title.includes(w))) { score += 4; continue; }
    if (alts.some(w => tags.some(t => t.includes(w)))) { score += 2; continue; }
    if (alts.some(w => body.includes(w))) { score += 1; continue; }
    return -1;
  }
  return score;
}

/** 過濾＋依相關度排序（同分保持原順序）。空查詢原樣回傳。 */
export function searchList<T>(items: readonly T[], query: string, fields: (item: T) => SearchFields): T[] {
  const q = parseSearchQuery(query);
  if (!q.must.length && !q.not.length) return [...items];
  return items.map((item, i) => ({ item, i, s: searchScore(q, fields(item)) }))
    .filter(x => x.s >= 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map(x => x.item);
}

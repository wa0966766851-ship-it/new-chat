/**
 * 傷害文字分類（共用）：精靈描述／積木詞條裡「X傷害」的寫法必須對應固定的傷害種類。
 *
 * 規則（2026-11-06 擁有者確認）：
 * - 固定傷害：固定數值（300點、能力等級*30點…）；比例／分數／「等量（來自比例的恢復量）」一律是百分比傷害。
 *   「以固定傷害形式反彈」屬「以XX形式」寫法，合規，分類為 form。
 * - 百分比傷害：以百分比或分數表示（Z%、Y/X、⅓…），含由比例衍生的「等量」。
 * - X系技能傷害：以屬性 X 計算的技能傷害（吃屬性相剋，走技能傷害節點）。寫法一律「X系技能傷害」，
 *   不寫「X系傷害」「X系直接傷害」。與攻擊傷害同一次行動時各自獨立結算後合併同一擊（dmg 參數 appendToAttack）。
 * - 真實傷害、攻擊傷害：維持原義。
 *
 * 本檔只處理文字，不依賴引擎；tests/damageTextClassification.semantic.test.ts 以它掃描全部精靈描述與積木詞條。
 */
export type DamageTextClass = 'fixed' | 'percent' | 'typed_skill' | 'true' | 'attack' | 'form';

export interface DamagePhrase {
  cls: DamageTextClass;
  /** 傷害詞本身，例如「固定傷害」「光系技能傷害」。 */
  text: string;
  index: number;
  /** typed_skill：傷害詞前的屬性字串（可能帶前綴雜字，比對請用 endsWith）。 */
  elem?: string;
  /** typed_skill：是否寫成「X系技能傷害」。 */
  canonical: boolean;
  /** 只是提到傷害種類而沒有給出數量（免疫固定傷害、固定傷害減半…）。 */
  mention: boolean;
  /** 傷害詞之前、同一子句內的最後一段文字（判斷數量用）。 */
  window: string;
  /** 傷害詞之前、同一句（；。換行為界）內的文字。 */
  sentenceBefore: string;
  /** 傷害詞前的數量寫法。 */
  amount: 'number' | 'ratio' | 'derived' | 'none';
}

const RATIO = String.raw`(?:\d+\s*\/\s*\d+|[⅓¼½⅔¾⅕⅙⅛⅐⅑⅒]|\d+(?:\.\d+)?\s*%)`;
const NUMBER_POINTS = /(?:\d+(?:\.\d+)?\s*點|[*×]\s*\d+(?:\.\d+)?\s*點?)\s*(?:的|之)?$/;
const RATIO_TAIL = new RegExp(String.raw`${RATIO}[^點，；。]{0,10}$`);
const DERIVED_TAIL = /(?:等量|等同於?|等同)[^，；。]{0,14}$/;
const TOKEN = new RegExp(String.raw`(\d+(?:\.\d+)?\s*點)|(${RATIO})`, 'g');
// 「傷害詞前面緊接這些字」或「後面緊接這些字」＝只是提到種類，沒有給數量。
const MENTION_BEFORE = /(?:(?:免疫|無視|受到|遭受|所受|受|造成)(?:的)?|[、／/與和及或]|^)$/;
const MENTION_AFTER = /^(?:[、與和及或]|減半|翻倍|提升|提高|降低|減少|增加|轉化|轉為|不超過|無法|若|則|後|時|減免|形式|限制|上限|減傷)/;
const NOUN = /(?:([一-鿿.·・]{1,8})系(技能|直接)?傷害)|固定傷害|百分比傷害|(?<!非)真實傷害|攻擊傷害/g;

/** 取出一段文字中所有「X傷害」詞並分類（順序＝文字順序）。 */
export function extractDamagePhrases(text: string): DamagePhrase[] {
  const out: DamagePhrase[] = [];
  for (const m of text.matchAll(NOUN)) {
    const index = m.index!, word = m[0], after = text.slice(index + word.length);
    const clauseStart = Math.max(text.lastIndexOf('，', index - 1), text.lastIndexOf('；', index - 1), text.lastIndexOf('。', index - 1), text.lastIndexOf('\n', index - 1)) + 1;
    const sentenceStart = Math.max(text.lastIndexOf('；', index - 1), text.lastIndexOf('。', index - 1), text.lastIndexOf('\n', index - 1)) + 1;
    const window = text.slice(clauseStart, index).slice(-28), sentenceBefore = text.slice(sentenceStart, index);
    const mention = MENTION_BEFORE.test(window.replace(/\s+$/, '')) || MENTION_AFTER.test(after);
    const amount: DamagePhrase['amount'] = NUMBER_POINTS.test(window) ? 'number'
      : DERIVED_TAIL.test(window) ? 'derived'
      : RATIO_TAIL.test(window) ? 'ratio' : 'none';
    const base = {text: word, index, mention, window, sentenceBefore, amount, canonical: true};
    if (m[1] !== undefined) out.push({...base, cls: 'typed_skill', elem: m[1], canonical: m[2] === '技能'});
    else if (word === '固定傷害') out.push({...base, cls: /以[^，；。]{0,10}$/.test(window) && /^形式/.test(after) ? 'form' : 'fixed'});
    else if (word === '百分比傷害') out.push({...base, cls: 'percent'});
    else if (word === '真實傷害') out.push({...base, cls: 'true'});
    else out.push({...base, cls: 'attack'});
  }
  return out;
}

/** 單一傷害詞（或含一個傷害詞的短語）的種類；沒有傷害詞時為 null。多個詞時取第一個。 */
export function classifyDamagePhrase(text: string): DamageTextClass | null {
  return extractDamagePhrases(text)[0]?.cls ?? null;
}

/** 「等量」「等同」的數量是否來自比例：同一句內最後一個數量記號是比例（不是 N 點）。 */
export function derivedFromRatio(phrase: Pick<DamagePhrase, 'sentenceBefore'>, previousText = ''): boolean {
  const last = (s: string) => [...s.matchAll(TOKEN)].pop();
  const token = last(phrase.sentenceBefore) ?? last(previousText);
  return !!token && token[2] !== undefined;
}

/** 單一傷害詞的寫法問題（空陣列＝合規）。previousText＝同一段描述中前面的行（等量衍生判斷用）。 */
export function damagePhraseProblems(phrase: DamagePhrase, previousText = ''): string[] {
  const problems: string[] = [];
  if (phrase.cls === 'typed_skill') {
    if (!phrase.canonical) problems.push(`「${phrase.text}」須寫成「${phrase.elem}系技能傷害」`);
    return problems;
  }
  if (phrase.mention) return problems;
  if (phrase.cls === 'fixed') {
    if (phrase.amount === 'ratio') problems.push('固定傷害不得以比例／分數表示，須寫成百分比傷害');
    else if (phrase.amount === 'derived' && derivedFromRatio(phrase, previousText)) problems.push('「等量」來自比例的恢復量，須寫成百分比傷害');
    else if (phrase.amount === 'none' && !/[值量]|總和|累計/.test(phrase.window)) problems.push('固定傷害缺少固定數值');
  } else if (phrase.cls === 'percent') {
    if (phrase.amount === 'number') problems.push('百分比傷害不得以固定點數表示，須寫成固定傷害');
    else if (phrase.amount === 'derived' && /\d+\s*點(?:固定)?(?:體力|傷害|護盾|護罩)/.test(phrase.sentenceBefore) && !derivedFromRatio(phrase, previousText)) problems.push('「等量」來自固定點數，須寫成固定傷害');
    else if (phrase.amount === 'none' && !new RegExp(RATIO).test(phrase.sentenceBefore) && !/[值量]/.test(phrase.window)) problems.push('百分比傷害缺少比例');
  }
  return problems;
}

/** 對一整段描述逐詞檢查，回傳 {phrase, problems}；problems 為空者不回傳。 */
export function damageTextProblems(text: string): {phrase: DamagePhrase; problems: string[]}[] {
  const lines = text.split('\n');
  const result: {phrase: DamagePhrase; problems: string[]}[] = [];
  let offset = 0;
  for (let i = 0; i < lines.length; i++) {
    const previous = lines.slice(Math.max(0, i - 2), i).join('\n');
    for (const phrase of extractDamagePhrases(lines[i])) {
      const problems = damagePhraseProblems(phrase, previous);
      if (problems.length) result.push({phrase: {...phrase, index: phrase.index + offset}, problems});
    }
    offset += lines[i].length + 1;
  }
  return result;
}

/** 積木 dmg 類 op 的傷害種類（type 欄位）→ 文字種類。 */
export const OP_TYPE_TO_TEXT_CLASS: Record<string, DamageTextClass> = {固定: 'fixed', 百分比: 'percent', 真實: 'true', 技能: 'typed_skill'};

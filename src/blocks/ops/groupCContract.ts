/** C 組專屬動作／條件的純資料合約（不載入執行器，供 sequenceContract 使用）。 */
export const GROUP_C_ACTION_FIELDS: Record<string, readonly string[]> = {
  // 造成技能傷害後，額外隨機選擇對方場下／額外精靈作為攻擊目標（同一技能以該目標的屬性與雙防另算一次傷害）。
  extra_random_target: ['pool', 'count'],
  // 背包／全隊名單查詢：符合條件的精靈數寫入「上一數值」，供其後動作使用。
  roster_query: ['sides', 'types', 'filter', 'scope'],
  // 以上一數值為等級，改變能力（全屬性／指定項）。
  stat_by_last: ['side', 'stats'],
  // 屬性取最優克制：本次造成技能傷害時，克制倍數取清單中最高者；未擊敗對手則延續到之後 N 次造成技能傷害。
  type_best_of: ['types', 'extend'],
  // 多次各自獨立的固定吸取；吸取後該次對手體力未減少則改為汲取（真實傷害＋等量恢復）。
  drain_repeat_independent: ['flat', 'repeat', 'fallback'],
  // 消耗對方指定名稱額外精靈的最大體力比例（不足則令其體力歸零）；找不到存活的該額外精靈則失敗。
  consume_extra_hp: ['name', 'ratio'],
};
export const GROUP_C_CONDITION_FIELDS: Record<string, readonly string[]> = {
  // 上一個傷害動作使對手實際減少的體力（扣除護盾／護罩吸收後）
  last_hp_lost: ['op', 'amount'],
  // 指定方當前速度（含能力等級）與另一方比較
  speed_cmp: ['side', 'op'],
};

const compare = ['低於', '小於', '高於', '大於', '不低於', '不小於', '不高於', '不大於'];
const POOLS = ['foe_bench', 'foe_extra'];
const FILTERS = ['any', 'alive', 'dead'];
const STAT_NAMES = ['全屬性', '全能力', '所有能力', '雙攻', '雙防', '攻擊', '防禦', '特攻', '特防', '速度', '命中'];

export function groupCActionIssue(op: string, p: any, trig: string, inMark: boolean): string | null {
  if (!GROUP_C_ACTION_FIELDS[op]) return null;
  if (inMark) return 'C組動作不能放在印記規則內';
  if (op === 'extra_random_target') {
    if (!['self_after_attack', 'self_after_physical', 'self_after_special', 'self_after_skill'].includes(trig)) return '額外攻擊目標需在自身技能傷害結算後';
    if (!Array.isArray(p.pool) || !p.pool.length || p.pool.some((x: any) => !POOLS.includes(x)) || new Set(p.pool).size !== p.pool.length) return '額外攻擊目標需明確場下／額外精靈範圍';
    if (!Number.isInteger(p.count) || p.count < 1 || p.count > 6) return '額外攻擊目標數量需1至6整數';
  }
  if (op === 'roster_query') {
    if (!Array.isArray(p.sides) || !p.sides.length || p.sides.some((x: any) => !['self', 'opp'].includes(x)) || new Set(p.sides).size !== p.sides.length) return '名單查詢需明確陣營';
    if (!Array.isArray(p.types) || p.types.length > 8 || p.types.some((x: any) => typeof x !== 'string' || !x || x.length > 20)) return '名單查詢屬性需為短文字陣列';
    if (!FILTERS.includes(p.filter) || !['team', 'bench'].includes(p.scope)) return '名單查詢需明確存活條件與範圍';
  }
  if (op === 'stat_by_last') {
    if (!['self', 'opp'].includes(p.side) || !Array.isArray(p.stats) || !p.stats.length || p.stats.some((s: any) => !STAT_NAMES.includes(s))) return '依上一數值改能力需明確目標與能力名稱';
  }
  if (op === 'type_best_of') {
    if (!Array.isArray(p.types) || p.types.length < 2 || p.types.length > 8 || p.types.some((t: any) => typeof t !== 'string' || !t || t.length > 20)) return '最優克制需2至8個屬性';
    if (!Number.isInteger(p.extend) || p.extend < 0 || p.extend > 100) return '最優克制延續次數需0至100整數';
    if (!['use', 'self_skill', 'self_attack'].includes(trig)) return '最優克制需在自身技能使用時設定';
  }
  if (op === 'consume_extra_hp') {
    if (typeof p.name !== 'string' || !p.name || p.name.length > 40) return '消耗額外精靈體力需明確名稱';
    if (!(p.ratio > 0 && p.ratio <= 1)) return '消耗額外精靈體力需0至100%最大體力比例';
    if (trig !== 'fatal') return '消耗額外精靈體力僅限致命傷害事件';
  }
  if (op === 'drain_repeat_independent') {
    if (!Number.isInteger(p.flat) || p.flat < 1 || p.flat > 1000000) return '獨立吸取需正整數點數';
    if (p.repeat !== undefined) {
      const r = p.repeat;
      if (!r || typeof r !== 'object' || Object.keys(r).some(k => !['per', 'amount'].includes(k)) || r.per !== 'stage_kinds_both' || !Number.isInteger(r.amount) || r.amount < 1 || r.amount > 1000000) return '額外獨立吸取需明確計數基準與正整數點數';
    }
    if (p.fallback !== undefined) {
      const f = p.fallback;
      if (!f || typeof f !== 'object' || Object.keys(f).some(k => k !== 'ratioCur') || !(f.ratioCur > 0 && f.ratioCur <= 1)) return '吸取未減少後備需0至100%當前體力比例';
    }
  }
  return null;
}
export function groupCConditionIssue(name: string, p: any): string | null {
  if (name === 'last_hp_lost' && (!compare.includes(p?.op) || !Number.isFinite(p?.amount) || p.amount < 0)) return '體力減少量比較需明確運算與非負數值';
  if (name === 'speed_cmp' && (!['self', 'opp'].includes(p?.side) || !compare.includes(p?.op))) return '速度比較需明確持有者與運算';
  return null;
}

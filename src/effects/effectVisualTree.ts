/** 顯示／編輯共用同一份參數樹，不以動作白名單省略尚未命名的分支。 */
export type EffectValuePath = Array<string | number>;
export const EFFECT_FIELD_LABELS: Record<string, string> = {
  clause:'效果連鎖', raw:'原文', parsed:'已解析', trig:'觸發時點', cond:'條件', c:'條件種類', p:'參數',
  body:'執行流程', acts:'執行動作', elseActs:'否則執行', op:'動作種類', label:'顯示名稱',
  bodyHigh:'達到門檻時', bodyLow:'未達門檻時', onMatch:'符合時', onMismatch:'不符合時',
  onExpire:'自然到期時', onRoundMiss:'本回合未觸發時', onBlock:'抵擋成功時', onClose:'關閉時',
  rules:'規則', branches:'分支', choices:'候選流程', fallback:'未符合時',
  side:'目標陣營', target:'目標', of:'數值來源', scope:'作用範圍', kind:'效果類別', type:'傷害／屬性類型',
  turns:'持續回合', uses:'剩餘次數', duration:'持續時間', from:'開始時點', next:'下回合起',
  amount:'數量', ratio:'比例（1＝100%）', ratioCur:'當前體力比例', flat:'固定值', percent:'百分比',
  chance:'機率（%）', cap:'上限', min:'下限', max:'上限', count:'次數', unit:'單位',
  v:'等級變化', stats:'能力項目', stat:'能力', boost:'增幅（1＝100%）', reduce:'減幅', mult:'倍率',
  threshold:'門檻', perMark:'逐層資源', perMarkTurns:'逐層回合', perStage:'逐能力等級',
  id:'識別碼', key:'狀態鍵', name:'名稱', status:'異常', statuses:'異常清單',
  source:'來源', role:'效果類別', node:'戰鬥節點', order:'順序', codeId:'積木種類', customText:'原文', params:'積木參數',
  chain:'前項結果條件', live:'即時條件', pre:'句首快照', afterHit:'傷害結算後', neg:'條件反轉',
  observer:'觀察範圍', includeDead:'包含陣亡持有者', includeIncoming:'包含本次異常',
  clearable:'可被消除', persistsOffField:'下場保留', bound:'綁定持有者', attackOnly:'限攻擊技能',
  damageRatio:'傷害比例', elem:'屬性', damageTypes:'傷害範圍', types:'類型清單',
  countFromMark:'數量來源印記',turnsFromCount:'以數量決定期限',priorityBonus:'先制修正',vsOpponentName:'對手名稱條件',
  excludeSelf:'排除自身',matchedWeight:'符合時計數',unmatchedWeight:'不符合時計數',traitSources:'特性來源範圍',
};
export function effectFieldLabel(key: string | number): string {
  return typeof key === 'number' ? `第 ${key + 1} 項` : (Object.hasOwn(EFFECT_FIELD_LABELS, key) ? EFFECT_FIELD_LABELS[key] : key);
}
export function effectValueLeaves(value: unknown, path: EffectValuePath = []): Array<{path: EffectValuePath; value: unknown}> {
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length) return entries.flatMap(([key, child]) => effectValueLeaves(child, [...path, Array.isArray(value) ? Number(key) : key]));
  }
  return [{path, value}];
}
/** 僅修改既有欄位；不能經欄位路徑新增原型、未知欄位或改變其他資料。 */
export function replaceEffectValue<T>(value: T, path: EffectValuePath, replacement: unknown): T {
  const copy = structuredClone(value);
  if (!path.length) return replacement as T;
  let target: any = copy;
  for (const key of path.slice(0, -1)) {
    if (['__proto__','prototype','constructor'].includes(String(key)) || !target || !Object.hasOwn(target, key)) throw new Error('無效的積木欄位路徑');
    target = target[key];
  }
  const key = path.at(-1)!;
  if (['__proto__','prototype','constructor'].includes(String(key)) || !target || !Object.hasOwn(target, key)) throw new Error('無效的積木欄位路徑');
  target[key] = replacement;
  return copy;
}

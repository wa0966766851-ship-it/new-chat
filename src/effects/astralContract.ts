// 星核系（5032/5033/5034）積木合約：欄位白名單與專用驗證。
// 獨立檔案；sequenceContract 僅 import 展開（協作分工 20261015 預先核准追加）。
// 原則：只登記通用機制；body 內動作由 sequenceIssue 統一遞迴驗證（ASTRAL_ACTION_FIELDS 展開後自動納入）。
export const ASTRAL_ACTION_FIELDS: Record<string, readonly string[]> = {
  // 位置/條件選取（relation 未填＝既有 orderBy/direction 行為）。
  astral_select: ['side', 'scope', 'state', 'orderBy', 'direction', 'relation', 'anchor', 'body'],
  pp_max_offset_selected: ['delta', 'overflowDamage', 'overflowFlat', 'overflowType', 'elem'],
  pp_slot_steal: ['from', 'to', 'amount', 'zeroThen'],
  damage_selected: ['type', 'elem', 'flat', 'perNonFullPp'],
  heal_selected_pp: ['perLostPp'],
  illusion_start: ['source', 'ppBonus', 'pick'],
  illusion_end: [],
  // 通用條件性額外行動容器（變思遷憶等）：body 由 sequenceIssue 遞迴驗證。
  queue_extra_action: ['label', 'body', 'onceKey', 'damageRatio', 'elem'],
  // 回合類效果攜帶引擎 payload 鍵（白名單）；期限由通用掃描遞減。
  effect_turns: ['keys', 'turns', 'side', 'label'],
  // 能力值拉平（差值總和寫 lastAmount）與技能傷害¼反彈（殞星衝擊；引擎 reflectSkillQuarter 讀取端）。
  stat_match: ['stats'],
  reflect_skill_quarter: ['turns'],
  // 場下已損PP總和（×mult 寫 lastAmount）與重複執行容器（寰宇幻影閃）。
  bench_pp_lost_sum: ['mult'],
  repeat: ['count', 'body'],
  // 5033 思維固化三條件解除聯合查詢（fieldDamageCounts/fieldStatusCount/teamEntranceHistory）。
  aesfig_release_check: [],
  // 本次攻擊連擊次數（N~M 隨機；引擎 attackHitCountThisAction）。
  // perMarkHits（5012 凝寒止喧）：每達 per 點指定印記加 extra 次連擊；doubleIf 條件成立時額外翻倍。
  multi_hit: ['min', 'max', 'perMarkHits'],
  // 能力等級交換（低於對手項互換）與本次攻擊追加連擊（摧妖斬）。
  stat_swap: [],
  combo_add: ['amount'],
  // 對方接下來 N 次受到的攻擊必定致命（次數制；心像重構）。
  crit_received_uses: ['uses'],
  // 僅自身受到指定類型傷害（幻影閃變思遷憶；計數寫 battleDamageCounts）。
  self_damage: ['type', 'flat', 'elem'],
  // 清除登場/在場紀錄＋下次出戰觸發出戰效果（幻影閃變思遷憶非異常分支）。
  entrance_fresh_start: [],
  // 場上傷害類型計數查詢（條件型動作；結果寫 st.last 供後續 chain 使用）。
  damage_count: ['types', 'atLeast'],
  // 魂珠狀態機（5034）：期別／數值／上限全由 Kit 給；op 只提供容器。
  orb_draw: ['initialPhase', 'remaining', 'clearStatuses', 'heal', 'restorePp', 'calmStatus', 'calmPerAlive', 'calmPerAlien', 'calmAlienElem',
    'chaosElem', 'chaosPhase', 'abundancePhase', 'abundanceFlag'],
  orb_query: ['phase', 'neg', 'fatalUsed'],
  orb_phase_set: ['targetPhase', 'fatalUsed', 'remaining', 'decrementRemaining', 'remove'],
  orb_mark_add: ['id', 'name', 'displayChar', 'count', 'max', 'unit', 'markedSide', 'consumer', 'healMult', 'typeExchange', 'description', 'effects'],
  drain_fixed_overflow: ['flat', 'doubleBelowRatio', 'doubleMultiplier', 'turns', 'id', 'label'],
  stat_scale: ['ratio', 'includeMaxHp'],
  // 讀取能力值×ratio 寫 lastAmount（「附加自身攻擊值15%的肅霜之禁」）。
  stat_to_last: ['side', 'stat', 'ratio'],
  ignore_negative_priority: [],
  power_from_last: ['ratio'],
  mark_gap_to_last: ['sideA', 'idA', 'sideB', 'idB'],
  clear_faith_target: ['side'],
  expel: ['side', 'deferToDamageChain', 'keepHp'],
  sure_hit: [],
  round_once: ['key'],
  field_pp_zero: [],
  field_status: ['status'],
};

export function astralActionIssue(op: string, p: any, _trig: string, inMark: boolean): string | null {
  if (op === 'astral_select') {
    if (!['self', 'opp'].includes(p.side)) return '星核選取需明確陣營';
    if (!['team', 'bench'].includes(p.scope ?? 'team')) return '星核選取需明確範圍';
    if (!['any', 'alive', 'dead'].includes(p.state ?? 'any')) return '星核選取需明確存活範圍';
    if (p.relation !== undefined && !['active', 'adjacent', 'separated', 'first', 'last'].includes(p.relation)) return '位置關係不明';
    if (p.anchor !== undefined && p.anchor !== 'active') return '星核選取僅支援在場參照錨點';
    if (!Array.isArray(p.body) || !p.body.length) return '星核選取需子流程';
    return null;
  }
  if (op === 'pp_max_offset_selected') {
    if (!Number.isInteger(p.delta) || p.delta === 0) return 'PP上限偏移需非零整數';
    if (p.overflowType !== undefined && !['skill_extra_action', 'fixed', 'percent', 'true'].includes(p.overflowType)) return '溢出傷害類型不明';
    if (p.overflowFlat !== undefined && !(p.overflowFlat > 0)) return '溢出傷害需正數值';
    return null;
  }
  if (op === 'pp_slot_steal') {
    if (!['opp_adjacent', 'opp_separated'].includes(p.from)) return '竊取來源需為對手鄰位或隔位';
    if (!(p.amount > 0)) return '竊取量需正整數';
    if (p.zeroThen !== undefined && !['lock_switch', 'clear_active_slot'].includes(p.zeroThen)) return '歸零後續行為不明';
    return null;
  }
  if (op === 'damage_selected') {
    if (!['skill_extra_action', 'fixed', 'percent', 'true'].includes(p.type ?? 'skill_extra_action')) return '選取者傷害類型不明';
    if (p.flat !== undefined && !Number.isFinite(p.flat)) return '選取者傷害需有限數值';
    if (p.perNonFullPp !== undefined) {
      if (!p.perNonFullPp || typeof p.perNonFullPp !== 'object' || Array.isArray(p.perNonFullPp)) return 'PP 參照需物件參數';
      if (!['self', 'opp'].includes(p.perNonFullPp.side)) return 'PP 參照需明確陣營';
      if (!Number.isFinite(p.perNonFullPp.flat) || p.perNonFullPp.flat <= 0) return 'PP 參照需正增量';
      if (Object.keys(p.perNonFullPp).some(k => !['side', 'flat'].includes(k))) return 'PP 參照含未知欄位';
    }
    return null;
  }
  if (op === 'heal_selected_pp') {
    if (!(p.perLostPp > 0)) return '已損PP恢復需正倍率';
    return null;
  }
  if (op === 'illusion_start') {
    if (!['opp_active', 'paired_initial'].includes(p.pick ?? 'opp_active')) return '幻化目標選取不明';
    if ((p.ppBonus || 0) < 0) return '幻化PP加成不可為負';
    return null;
  }
  if (op === 'queue_extra_action') {
    if (p.damageRatio !== undefined && (!Number.isFinite(p.damageRatio) || p.damageRatio <= 0 || p.damageRatio > 10 || typeof p.elem !== 'string' || !p.elem)) return '額外行動傷害需正體力比例與明確屬性';
    if (p.elem !== undefined && p.damageRatio === undefined) return '額外行動屬性需同時指定傷害比例';
    if (inMark) return '額外行動容器不可在印記程式內執行';
    if (typeof p.label !== 'string' || !p.label) return '額外行動需明確標籤';
    if (p.onceKey !== undefined && (typeof p.onceKey !== 'string' || !p.onceKey || p.onceKey.length > 200)) return '每場一次鍵需有限文字';
    if (!Array.isArray(p.body) || !p.body.length) return '額外行動需子流程';
    return null;
  }
  if (op === 'aesfig_release_check') {
    if (inMark) return '解除查詢不可在印記程式內執行';
    return null;
  }
  if (op === 'entrance_fresh_start') {
    if (inMark) return '登場重置不可在印記程式內執行';
    return null;
  }
  if (op === 'self_damage') {
    if (!['skill_extra_action', 'fixed', 'percent', 'true'].includes(p.type)) return '自傷類型不明';
    if (!Number.isFinite(p.flat) || p.flat < 0 || p.flat > 1000000) return '自傷需 0 至 1000000 數值';
    if (p.elem !== undefined && typeof p.elem !== 'string') return '自傷屬性需文字';
    return null;
  }
  if (op === 'crit_received_uses') {
    if (!Number.isInteger(p.uses) || p.uses < 1 || p.uses > 50) return '致命次數需 1 至 50 整數';
    return null;
  }
  if (op === 'stat_swap') {
    if (inMark) return '能力交換不可在印記程式內執行';
    return null;
  }
  if (op === 'combo_add') {
    if (!Number.isInteger(p.amount) || p.amount < 1 || p.amount > 100) return '追加連擊需 1 至 100 整數';
    if (inMark) return '追加連擊不可在印記程式內執行';
    return null;
  }
  if (op === 'multi_hit') {
    if (!Number.isInteger(p.min) || !Number.isInteger(p.max) || p.min < 1 || p.max < p.min || p.max > 1000) return '連擊需 1 至 1000 的整數範圍';
    if (inMark) return '連擊不可在印記程式內執行';
    if (p.perMarkHits !== undefined) {
      const q = p.perMarkHits;
      if (!q || typeof q !== 'object' || Array.isArray(q)) return '印記連擊加成需物件參數';
      if (!['self', 'opp'].includes(q.side)) return '印記連擊加成需明確陣營';
      if (typeof q.id !== 'string' || !q.id) return '印記連擊加成需明確印記識別';
      if (!Number.isInteger(q.per) || q.per < 1 || q.per > 100000) return '印記連擊門檻需正整數';
      if (!Number.isInteger(q.extra) || q.extra < 0 || q.extra > 1000) return '印記連擊增量需 0 至 1000 整數';
      if (q.doubleIf !== undefined) {
        if (!Array.isArray(q.doubleIf) || !q.doubleIf.length) return '印記連擊翻倍條件需非空條件';
        if (q.doubleIf.some((c: any) => !c || typeof c !== 'object' || Array.isArray(c) || !c.c)) return '印記連擊翻倍條件格式不符';
      }
    }
    return null;
  }
  if (op === 'bench_pp_lost_sum') {
    if (p.mult !== undefined && (!Number.isFinite(p.mult) || p.mult <= 0)) return '場下PP總和需正倍率';
    return null;
  }
  if (op === 'repeat') {
    if (inMark) return '重複容器不可在印記程式內執行';
    if (p.count !== 'star_statuses' && (!Number.isInteger(p.count) || p.count < 1 || p.count > 100)) return '重複次數需1至100或 star_statuses';
    if (!Array.isArray(p.body) || !p.body.length) return '重複容器需子流程';
    return null;
  }
  if (op === 'stat_match') {
    if (!Array.isArray(p.stats) || !p.stats.length || p.stats.some((k: string) => !['hp','atk','def','spatk','spdef','speed'].includes(k))) return '拉平需明確六項能力清單';
    return null;
  }
  if (op === 'reflect_skill_quarter') {
    if (!Number.isInteger(p.turns) || p.turns <= 0) return '反彈需正整數期限';
    return null;
  }
  if (op === 'effect_turns') {
    const ALLOWED_KEYS = ['blockSkillDamage', 'spaceShift', 'halveNonTrue', 'preventAction', 'lockSwitch', 'inherentInvalid', 'nonTrueOutputLimit', 'nextAttackHalves'] as const;
    if (!p.keys || typeof p.keys !== 'object' || Array.isArray(p.keys) || !Object.keys(p.keys).length) return '持續效果需至少一個 payload 鍵';
    for (const k of Object.keys(p.keys)) {
      if (!ALLOWED_KEYS.includes(k as any)) return `持續效果鍵 ${k} 尚未接通引擎讀取端`;
      if (['nonTrueOutputLimit', 'nextAttackHalves'].includes(k)) {
        if (!Number.isInteger(p.keys[k]) || p.keys[k] < 1) return `持續效果鍵 ${k} 需正整數`;
      } else if (p.keys[k] !== true) return `持續效果鍵 ${k} 僅接受布林 true`;
    }
    if (!Number.isInteger(p.turns) || p.turns <= 0) return '持續效果需正整數期限';
    if (p.side !== undefined && !['self', 'opp'].includes(p.side)) return '持續效果需明確受影響側';
    return null;
  }
  if (op === 'damage_count') {
    if (!Array.isArray(p.types) || !p.types.length || p.types.some((t: string) => !['skill_extra_action', 'fixed', 'percent', 'true'].includes(t))) return '傷害計數類型不明';
    if (p.atLeast !== undefined && (!Number.isInteger(p.atLeast) || p.atLeast < 1)) return '計數門檻需正整數';
    return null;
  }
  if (op === 'orb_draw') {
    if (p.initialPhase !== undefined && !['豐腴期', '竭擇期', '混沌期'].includes(p.initialPhase)) return '魂珠初始期別不明';
    if (p.chaosPhase !== undefined && !['豐腴期', '竭擇期', '混沌期'].includes(p.chaosPhase)) return '魂珠混沌期別不明';
    if (p.abundancePhase !== undefined && !['豐腴期', '竭擇期', '混沌期'].includes(p.abundancePhase)) return '魂珠豐腴期別不明';
    if (p.remaining !== undefined && (!Number.isInteger(p.remaining) || p.remaining < 0)) return '魂珠剩餘次數需非負整數';
    if (p.calmStatus !== undefined && (typeof p.calmStatus !== 'string' || !p.calmStatus)) return '平靜狀態名需文字';
    if (p.calmPerAlive !== undefined && (!Number.isFinite(p.calmPerAlive) || p.calmPerAlive < 0)) return '平靜存活加成需非負數';
    if (p.calmPerAlien !== undefined && (!Number.isFinite(p.calmPerAlien) || p.calmPerAlien < 0)) return '平靜邪靈加成需非負數';
    return null;
  }
  if (op === 'orb_query') {
    const phases: string[] = Array.isArray(p.phase) ? p.phase : [p.phase];
    if (!phases.length || phases.some((x: string) => !['豐腴期', '竭擇期', '混沌期'].includes(x))) return '魂珠查詢期別不明';
    return null;
  }
  if (op === 'orb_phase_set') {
    if (!p.remove && p.targetPhase !== undefined && !['豐腴期', '竭擇期', '混沌期'].includes(p.targetPhase)) return '魂珠設定期別不明';
    if (p.remaining !== undefined && (!Number.isInteger(p.remaining) || p.remaining < 0)) return '魂珠剩餘次數需非負整數';
    if (p.decrementRemaining !== undefined && (!Number.isInteger(p.decrementRemaining) || p.decrementRemaining < 1)) return '魂珠遞減需正整數';
    return null;
  }
  if (op === 'orb_mark_add') {
    if (typeof p.id !== 'string' || !p.id) return '魂珠印記需明確識別';
    if (typeof p.name !== 'string' || !p.name) return '魂珠印記需明確名稱';
    if (p.count !== undefined && (!Number.isInteger(p.count) || p.count < 1)) return '魂珠印記附加數需正整數';
    if (p.max !== undefined && (!Number.isInteger(p.max) || p.max < 1)) return '魂珠印記上限需正整數';
    if (p.markedSide !== undefined && !['self', 'opp'].includes(p.markedSide)) return '魂珠印記受方不明';
    if (p.consumer !== undefined && !['self', 'opp'].includes(p.consumer)) return '魂珠印記使用方不明';
    if (p.healMult !== undefined && (!Number.isFinite(p.healMult) || p.healMult <= 0)) return '魂珠印記恢復倍率需正數';
    if (p.effects !== undefined) {
      if (!p.effects || typeof p.effects !== 'object' || Array.isArray(p.effects)) return '魂珠印記效果需物件';
      if (Object.keys(p.effects).some(k => !['nonTrueDamageTakenMultiplier', 'damageTakenTypes'].includes(k))) return '魂珠印記效果含未知鍵';
      const m = p.effects.nonTrueDamageTakenMultiplier;
      if (m !== undefined && (!Number.isFinite(m) || m <= 0)) return '魂珠印記非真實倍率需正數';
    }
    return null;
  }
  if (op === 'round_once') {
    if (typeof p.key !== 'string' || !p.key || p.key.length > 200) return '每回合一次需明確鍵名';
    if (inMark) return '每回合一次不可在印記程式內執行';
    return null;
  }
  if (op === 'sure_hit') {
    if (inMark) return '必中不可在印記程式內執行';
    return null;
  }
  if (op === 'field_status') {
    if (typeof p.status !== 'string' || !p.status) return '場上異常查詢需明確狀態名';
    return null;
  }
  if (op === 'clear_faith_target') {
    if (!['self', 'opp'].includes(p.side)) return '消除信仰對象需明確陣營';
    return null;
  }
  if (op === 'mark_gap_to_last') {
    if (!['self', 'opp'].includes(p.sideA) || !['self', 'opp'].includes(p.sideB)) return '印記差值需明確雙方陣營';
    if (p.sideA === p.sideB) return '印記差值需兩個不同陣營';
    if (typeof p.idA !== 'string' || !p.idA || typeof p.idB !== 'string' || !p.idB) return '印記差值需明確印記識別';
    return null;
  }
  if (op === 'power_from_last') {
    if (!Number.isFinite(p.ratio) || p.ratio <= 0 || p.ratio > 1000) return '威力加成比例需有限正數';
    return null;
  }
  if (op === 'stat_to_last') {
    if (!['self', 'opp'].includes(p.side)) return '能力值讀取需明確陣營';
    if (!['hp', 'atk', 'def', 'spatk', 'spdef', 'speed'].includes(p.stat)) return '能力值讀取需明確六項之一';
    if (!Number.isFinite(p.ratio) || p.ratio <= 0 || p.ratio > 1) return '能力值讀取比例需 0 至 1';
    return null;
  }
  if (op === 'stat_scale') {
    if (!Number.isFinite(p.ratio) || p.ratio <= 0 || p.ratio > 100) return '能力縮放需 0 至 100 比例';
    return null;
  }
  if (op === 'expel') {
    if (p.side !== undefined && !['self', 'opp'].includes(p.side)) return '驅逐需明確陣營';
    if (p.keepHp !== undefined && (!Number.isFinite(p.keepHp) || p.keepHp < 0)) return '驅逐保留體力需非負數';
    return null;
  }
  if (op === 'drain_fixed_overflow') {
    if (!Number.isFinite(p.flat) || p.flat <= 0) return '吸取固定體力需正數';
    if (p.doubleBelowRatio !== undefined && (!Number.isFinite(p.doubleBelowRatio) || p.doubleBelowRatio <= 0 || p.doubleBelowRatio > 1)) return '翻倍門檻需 0 至 1 比例';
    if (p.doubleMultiplier !== undefined && (!Number.isFinite(p.doubleMultiplier) || p.doubleMultiplier <= 0)) return '翻倍倍率需正數';
    if (p.turns !== undefined && (!Number.isInteger(p.turns) || p.turns <= 0)) return '溢出真傷期限需正整數';
    if (inMark) return '吸取溢出不可在印記程式內執行';
    return null;
  }
  return null;
}

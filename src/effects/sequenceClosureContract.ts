/** 已核對讀取端的閉合原子；未知鍵仍不可執行。 */
export const CLOSURE_ACTION_FIELDS: Record<string, readonly string[]> = {
  crit_uses: ['uses', 'scope'], immune_attack_turns: ['turns','extendByStatusTurns'], block_attack: ['count'],
  evade_turns: ['turns', 'chance', 'kind', 'onExpire'], survive_turns: ['turns'],
  pp_zero_random: ['count'], pp_cost_mult: ['turns', 'mult', 'kind'],
  no_pos_prio_turns: ['turns', 'next'], power_streak: ['step', 'cap'],
  hp_adjust: ['side', 'delta', 'ratio', 'base', 'direction','perStack'], rebirth_once: [],
  stat_mirror: ['side', 'kind','fromKind','mult'], pp_lost_damage: ['mult', 'type'],
  status_guard:['cls'], survive:[], once:['key','body'],once_per_round:['key','body'],
  crit_turns:['turns','next','now'],mercy:[],hp_match:['side'],
  stat_steal_random:['count','v'],shield_from_last:['ratio'],
  block_damage:['kind','key'],damage_from_counter:['key','ratio','type','consume'],heal_from_counter:['key','ratio','consume'],
  status_replace:['status','durationMode'],
  // 既有執行器的欄位清單；有函數仍不等於語意接通。
  // 下方校驗拒絕原文回查、未讀取參數及未接通事件；可用者仍需情境驗證。
  mark:['side','name','count'], mark_turns:['side','name','turns'], mark_remove:['name'],
  status_random:['count','cls'], add_invalid_turns:['turns','kind','next'], add_invalid_next:['uses','kind'],
  first_turns:['turns','attackOnly','next'], ignore_def_turns:['turns','ratio','stat','next'], consume_hp_all:[],
  immune_status_perm:[], per_statdown_bonus:['ratio','turns'], atk_sum_calc:[],
  dmg_to_heal_turns:['next'], absorb_now:[], prio_next:['uses','v','attackOnly'],
  dmg_of_event:['ratio','type','source'], heal_opp_equal:[], pp_restore_opp:['v','mode'],
  status_chance_turns:['chance','side','status','turns'], attack_inflict_turns:['turns','status'],
  bench_entrance_status:['chance','status'], crit_now:[], dmg_taken_x2:['turns'],
  pp_drain:['v','steal'], pp_restore:['v','mode'], pp_zero_all:[],
  boost_turns_x2:['turns','boost','dir','kind','next'], dmg_mod_uses:['uses','boost','kind','attackOnly'],
  dmg_taken_uses:['uses','mult','kind'],
  attack_extra_turns:['turns','flat','type'], stat_transfer:[],
};
export function closureActionIssue(op: string, p: any): string | null {
  if(op==='immune_attack_turns'&&p.extendByStatusTurns!==undefined&&!['self','opp','both'].includes(p.extendByStatusTurns))return '異常期限加總需明確持有者';
  if(op==='status_replace'&&(typeof p.status!=='string'||!p.status||p.durationMode!=='keep'))return '本次異常替換需名稱並明確保留本次附加期限';
  if(['block_damage','damage_from_counter','heal_from_counter'].includes(op)&&(typeof p.key!=='string'||!p.key||p.key.length>200))return '傷害計數需穩定有限識別碼';
  if(op==='heal_from_counter'&&(!(p.ratio>0)||typeof p.consume!=='boolean'))return '抵擋量恢復需正比例與明確消耗規則';
  if(op==='block_damage'&&!['攻擊','技能'].includes(p.kind))return '抵擋需明確攻擊／技能傷害範圍';
  if(op==='damage_from_counter'&&(!(p.ratio>0)||!['固定','百分比','真實'].includes(p.type)||typeof p.consume!=='boolean'))return '抵擋量轉化需比例、傷害類型與是否消耗計數';
  if(op==='stat_steal_random'&&(!Number.isInteger(p.count)||p.count<1||p.count>6||!Number.isInteger(p.v)||p.v<1||p.v>6))return '隨機吸取需1至6個不同能力及1至6級';
  if(op==='shield_from_last'&&!(p.ratio>0))return '恢復／傷害轉護盾需明確比例';
  if(op==='crit_turns' && !(Number.isInteger(p.turns)&&p.turns>0))return '致命一擊需正整數期限';
  if(op==='hp_match'&&!['self','opp'].includes(p.side))return '體力匹配需單一目標';
  if(['once','once_per_round'].includes(op) && (typeof p.key!=='string'||!p.key||p.key.length>200))return '一次性容器需穩定有限識別碼';
  if(op==='status_guard' && !['','控制類','弱化類','非附屬類'].includes(p.cls ?? ''))return '異常防護分類不明';
  if (op === 'crit_uses' && (!(p.uses > 0) || !['elf', 'team'].includes(p.scope ?? 'elf'))) return '必定致命需明確次數與作用域';
  if (['immune_attack_turns', 'survive_turns', 'no_pos_prio_turns'].includes(op) && !(p.turns > 0)) return '效果需正整數回合期限';
  if (['block_attack', 'pp_zero_random'].includes(op) && !(p.count > 0)) return '效果需正整數次數';
  if (op === 'evade_turns' && (!(p.turns > 0) || !(p.chance > 0 && p.chance <= 100) || !['攻擊', '屬性', 'all', ''].includes(p.kind ?? ''))) return '閃避需期限、機率與技能範圍';
  if (op === 'pp_cost_mult' && (!(p.turns > 0) || !(p.mult > 0) || !['攻擊', '屬性', ''].includes(p.kind ?? ''))) return 'PP倍率需期限、倍率與範圍';
  if (op === 'power_streak' && (!Number.isInteger(p.step) || p.step <= 0 || !Number.isInteger(p.cap) || p.cap <= 0)) return '連續威力需正整數增量與威力上限';
  if (op === 'hp_adjust' && (!['self', 'opp'].includes(p.side) || (typeof p.delta === 'number') === (typeof p.ratio === 'number') || (p.delta !== undefined && !Number.isFinite(p.delta)) || (p.ratio !== undefined && (!['最大體力', '當前體力'].includes(p.base) || !['add', 'subtract'].includes(p.direction))))) return '體力調整需單一目標與明確數值／基數及方向';
  if (op === 'stat_mirror' && (!['self', 'opp'].includes(p.side) || !['up', 'down'].includes(p.kind)||!['up','down'].includes(p.fromKind ?? 'up')||(p.mult!==undefined&&!(p.mult>0)))) return '能力鏡像需單一目標、來源方向與目的方向';
  if (op === 'pp_lost_damage' && (!(p.mult > 0) || !['固定', '百分比', '真實'].includes(p.type))) return '已損失PP傷害需倍率及傷害類型';
  // 新增合約的嚴格校驗：缺讀取端或數值不合法一律拒絕，不讓空殼參數通過。
  if (['mark', 'mark_turns'].includes(op) && (typeof p.name !== 'string' || !p.name || p.name.length > 200)) return '印記需明確名稱';
  if (op === 'mark' && (!Number.isInteger(p.count) || p.count < 1 || p.count > 10000)) return '印記需正整數層數';
  if (op === 'mark_turns' && (!Number.isInteger(p.turns) || p.turns < 1 || p.turns > 10000)) return '印記需正整數回合期限';
  // 舊執行器以施放者名稱回查文本；可編輯印記必須攜帶自己的規則。
  if (op === 'mark_turns') return '期限印記仍依賴原施放者文本，請使用自帶規則的mark_program';
  if (op === 'mark_remove' && (typeof p.name !== 'string' || !p.name)) return '移除印記需名稱';
  if (op === 'status_random' && (!Number.isInteger(p.count) || p.count < 1 || p.count > 8)) return '隨機異常需1至8個正整數名額';
  if (op === 'status_random' && !['', '控制類', '弱化類', '非附屬類'].includes(p.cls ?? '')) return '隨機異常分類不明';
  if (['add_invalid_turns', 'first_turns', 'dmg_taken_x2'].includes(op) && !(p.turns > 0)) return '效果需正整數回合期限';
  if (op === 'add_invalid_next' && !(p.uses > 0)) return '附加失效需正整數次數';
  if (op === 'ignore_def_turns' && (!(p.turns > 0) || !(p.ratio > 0 && p.ratio <= 1))) return '忽略雙防需期限與0至100%比例';
  if (op === 'ignore_def_turns' && p.stat !== undefined && p.stat !== '雙防') return '忽略防禦目標僅有雙防讀取端';
  if (op === 'per_statdown_bonus' && (!(p.ratio > 0 && p.ratio <= 1) || !(p.turns > 0))) return '每層能力下降需比例與回合數';
  if (op === 'prio_next' && (!(p.uses > 0) || !Number.isInteger(p.v) || p.v === 0)) return '下次先制需次數與非零整數';
  if (op === 'dmg_of_event' && (!(p.ratio > 0) || !['固定', '百分比', '真實'].includes(p.type))) return '事件傷害需比例與傷害類型';
  if (op === 'dmg_of_event' && p.source !== undefined && !['self','opp'].includes(p.source)) return '事件傷害來源需持有者或當前對手';
  if (op === 'pp_restore_opp' && p.mode !== 'recover' && (!Number.isInteger(p.v) || p.v < 0)) return '對手PP恢復需非負整數或全部恢復';
  if (op === 'status_chance_turns' && (!(p.chance > 0 && p.chance <= 100) || typeof p.status !== 'string' || !p.status)) return '機率異常需1至100%與名稱';
  if (op === 'status_chance_turns' && p.turns !== undefined) return '此動作僅附加一次異常，期限監控需使用timed';
  if (op === 'attack_inflict_turns' && (!(p.turns > 0) || typeof p.status !== 'string' || !p.status)) return '攻擊附加異常需期限與名稱';
  if (op === 'bench_entrance_status' && (!(p.chance > 0 && p.chance <= 100) || typeof p.status !== 'string' || !p.status)) return '登場異常需1至100%與名稱';
  if (op === 'pp_drain' && (!Number.isInteger(p.v) || p.v < 0)) return 'PP操作需非負整數點數';
  if (op === 'pp_restore' && p.mode !== 'recover' && (!Number.isInteger(p.v) || p.v < 0)) return 'PP恢復需非負整數或全部恢復';
  if (op === 'boost_turns_x2' && (!(p.turns > 0) || !(p.boost > 0))) return '威力翻倍需期限與倍率';
  if (op === 'dmg_mod_uses' && (!(p.uses > 0) || !(p.boost > 0))) return '次數增傷需次數與增傷比例';
  if (op === 'dmg_taken_uses' && (!(Number.isInteger(p.uses) && p.uses > 0) || !Number.isFinite(p.mult) || p.mult <= 1 || !['物理','技能'].includes(p.kind))) return '受方次數增傷需正整數次數、大於1倍率與物理/技能範圍';
  if (op === 'dmg_mod_uses' && p.attackOnly === true && (!Number.isInteger(p.uses) || !['攻擊','技能','非真實','固定','百分比','真實'].includes(p.kind))) return '攻擊行動次數增傷需整數次數與明確傷害範圍';
  if (op === 'attack_extra_turns' && (!(p.turns > 0) || !Number.isFinite(p.flat) || p.flat <= 0 || !['真實', '固定', '百分比'].includes(p.type))) return '攻擊附加傷害需期限、正數值與傷害類型';
  return null;
}

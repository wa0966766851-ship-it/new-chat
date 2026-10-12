/** 已核對讀取端的閉合原子；未知鍵仍不可執行。 */
export const CLOSURE_ACTION_FIELDS: Record<string, readonly string[]> = {
  crit_uses: ['uses', 'scope'], immune_attack_turns: ['turns'], block_attack: ['count'],
  evade_turns: ['turns', 'chance', 'kind'], survive_turns: ['turns'],
  pp_zero_random: ['count'], pp_cost_mult: ['turns', 'mult', 'kind'],
  no_pos_prio_turns: ['turns', 'next'], power_streak: ['step', 'cap'],
  hp_adjust: ['side', 'delta', 'ratio', 'base', 'direction','perStack'], rebirth_once: [],
  stat_mirror: ['side', 'kind','fromKind','mult'], pp_lost_damage: ['mult', 'type'],
  status_guard:['cls'], survive:[], once:['key','body'],
  crit_turns:['turns','next','now'],mercy:[],hp_match:['side'],
  stat_steal_random:['count','v'],shield_from_last:['ratio'],
  block_damage:['kind','key'],damage_from_counter:['key','ratio','type','consume'],
  status_replace:['status','durationMode'],
};
export function closureActionIssue(op: string, p: any): string | null {
  if(op==='status_replace'&&(typeof p.status!=='string'||!p.status||p.durationMode!=='keep'))return '本次異常替換需名稱並明確保留本次附加期限';
  if(['block_damage','damage_from_counter'].includes(op)&&(typeof p.key!=='string'||!p.key||p.key.length>200))return '傷害計數需穩定有限識別碼';
  if(op==='block_damage'&&!['攻擊','技能'].includes(p.kind))return '抵擋需明確攻擊／技能傷害範圍';
  if(op==='damage_from_counter'&&(!(p.ratio>0)||!['固定','百分比','真實'].includes(p.type)||typeof p.consume!=='boolean'))return '抵擋量轉化需比例、傷害類型與是否消耗計數';
  if(op==='stat_steal_random'&&(!Number.isInteger(p.count)||p.count<1||p.count>6||!Number.isInteger(p.v)||p.v<1||p.v>6))return '隨機吸取需1至6個不同能力及1至6級';
  if(op==='shield_from_last'&&!(p.ratio>0))return '恢復／傷害轉護盾需明確比例';
  if(op==='crit_turns' && !(Number.isInteger(p.turns)&&p.turns>0))return '致命一擊需正整數期限';
  if(op==='hp_match'&&!['self','opp'].includes(p.side))return '體力匹配需單一目標';
  if(op==='once' && (typeof p.key!=='string'||!p.key||p.key.length>200))return '一次性容器需穩定有限識別碼';
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
  return null;
}

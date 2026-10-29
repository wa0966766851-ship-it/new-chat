/** 畫布欄位只是參數的投影；不能讓未動過的預設欄位覆寫既存效果。 */
import { normalizeBlockAtom } from './blockParams';
const STATS = ['atk', 'def', 'spatk', 'spdef', 'speed', 'accuracy'] as const;
export function canvasParams(atom: string, raw: Record<string, any>) {
  const p = { ...raw };
  p.target = normalizeBlockAtom(atom, raw).target;
  if (atom === 'stat_change') {
    const direct = STATS.filter(key => raw[key] !== undefined);
    if (!raw.stat && raw.all !== undefined) { p.stat = 'all'; p.stages = raw.all; }
    else if (!raw.stat && direct.length === 1) { p.stat = direct[0]; p.stages = raw[direct[0]]; }
    else if (!raw.stat && direct.length === 6 && direct.every(key => raw[key] === raw[direct[0]])) { p.stat = 'all'; p.stages = raw[direct[0]]; }
    else if (!raw.stat && direct.length > 1) return null; // 不同能力值不可顯示為同一個攻擊欄位。
    p.stat = ({ spatk: 'spAtk', spdef: 'spDef' } as Record<string, string>)[p.stat] || p.stat;
    p.stages ??= raw.value;
  }
  if (atom === 'clear_stat') p.statType = raw.type === 'buff' ? 'boost' : raw.type === 'debuff' ? 'drop' : raw.type || raw.statType;
  if (atom === 'pp_op') p.mode = raw.op === 'add' ? 'recover' : raw.op === 'recover' ? 'full' : raw.op || raw.mode;
  if (atom === 'priority') p.level = raw.bonus ?? raw.level;
  if (atom === 'damage_multiplier') p.multiplier = raw.multiplier ?? raw.value;
  if (atom === 'damage_reduce') p.percent = raw.percent ?? raw.amount;
  p.damageType = raw.dmgType ?? raw.damageType;
  if (p.damageType === 'skill_attribute') p.damageType = 'skill';
  if (raw.ratio !== undefined) {
    if (atom === 'damage_reflect') p.percent = raw.ratio * 100;
    else { p.amount = raw.ratio * 100; if (atom === 'heal') p.mode = 'percent'; else p.amountMode = 'max_hp_percent'; }
  }
  return p;
}

export function mergeCanvasParams(atom: string, original: Record<string, any>, visible: Record<string, any>, changed: string[]) {
  const p = { ...original, ...visible };
  if (atom === 'stat_change' && changed.some(field => ['STAT_NAME', 'STAGES'].includes(field))) {
    for (const key of [...STATS, 'all', 'value']) delete p[key];
  }
  if (atom === 'clear_stat' && changed.includes('STAT_TYPE')) delete p.type;
  if (atom === 'pp_op' && changed.includes('MODE')) delete p.mode;
  if (atom === 'priority' && changed.includes('LEVEL')) delete p.bonus;
  if (atom === 'damage_multiplier' && changed.includes('MULTIPLICITY')) delete p.value;
  if (atom === 'damage_reduce' && changed.includes('PERCENT')) delete p.amount;
  if (changed.some(field => ['AMOUNT', 'MODE', 'AMOUNT_MODE', 'PERCENT', 'DAMAGE_TYPE'].includes(field))) delete p.ratio;
  if (changed.includes('DAMAGE_TYPE')) delete p.dmgType;
  if (atom === 'condition_gate') {
    delete p.inner; delete p.innerParams; delete p.innerTarget;
    if (!changed.some(field=>['COND_TYPE','COND_VAL'].includes(field))) {
      for(const key of ['hp_below','hp_above','has_shield','is_first','is_second']) if(key in original) p[key]=original[key];
    }
    if (changed.includes('COND_TYPE')) for (const key of ['hp_below','hp_above','has_shield','is_first','is_second']) if (!(key in visible)) delete p[key];
  }
  if (atom === 'turn_effect_apply') {
    delete p.wraps; delete p.wrapParams;
    for(const [key,field] of [['duration','DURATION'],['applyMode','APPLY_MODE'],['timerName','TIMER_NAME'],['displayChar','DISPLAY_CHAR'],['clearable','CLEARABLE']]) {
      if(key in original && !changed.includes(field)) p[key]=original[key];
    }
  }
  return p;
}

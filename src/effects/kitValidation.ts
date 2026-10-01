import type { AtomId } from './effectSystem.schema';
import { canonicalStatusName } from './statusIdentity';
import { StatusRegistry } from './statusRegistry';

export const EFFECT_NODES = ['battle_start','on_entered','before_action','before_skill','before_damage','on_hit','on_damaged','after_action','round_start','round_end','battle_phase_end','on_kill','self_fatal','cthyaat_death','battle_end','on_skill_use','on_attacked','any_battle_node','passive_always','modify_priority'] as const;
export const ATOM_PARAMETER_FIELDS: Record<AtomId, string[]> = {
  extra_damage: ['amount','ratio','dmgType','damageType','amountMode','elem','damageNode','incremental','label'],
  damage_multiplier: ['multiplier','value','damageTypes'], damage_reduce: ['percent','amount','damageTypes'],
  damage_reflect: ['ratio','percent','damageType','dmgType','elem'], heal: ['amount','ratio','mode'],
  drain_hp: ['amount','ratio','damageType','dmgType','amountMode','elem','incremental'], hp_cost: ['amount','ratio'], maxhp_change: ['amount','mode'],
  apply_status: ['status','duration','turns','chance'], cure_status: [],
  stat_change: ['all','stat','value','stages','atk','def','spatk','spdef','speed','accuracy'], clear_stat: ['type','statType'],
  shield: ['amount','shieldType'], pp_op: ['op','mode','amount'], priority: ['bonus','level'], accuracy: ['mode','alwaysHit','evade'],
  pierce: ['type'], crit: ['mode'], extra_action: [], summon_extra: ['elfName','extraElf'], vanish: [], rebirth: ['turns','fixedCap'],
  copy_transfer: ['mode'], immune: ['type'], turn_effect_apply: ['duration','timerId','id','timerName','name','displayChar','char','applyMode','tickAt','clearable','polarity','wraps','wrapParams','wrapItems'],
  turn_effect_clear: [], copy_stat_sum: [], condition_gate: ['hp_below','hp_above','has_shield','is_gender','enemy_type','layer_gte','timerId','has_status','is_first','is_second','inner','innerParams','innerTarget','innerItems','template'],
};
export const DAMAGE_FILTER_TYPES = ['attack','skill','fixed','percent','true','non_true'] as const;
const obj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
function bad(path: string, detail: string): never { throw new Error(`圖紙格式錯誤：${path} ${detail}`); }
function num(v: unknown, path: string, min: number, max: number) {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) bad(path, `需為 ${min}–${max} 有限數值`);
}
function str(v: unknown, path: string, max = 100000) { if (typeof v !== 'string' || v.length > max) bad(path, '需為有長度限制的文字'); }
function choice(v: unknown, path: string, options: readonly string[]) { if (!options.includes(v as string)) bad(path, `不支援 ${String(v)}`); }
export function validateAtomParams(atom: string, p: unknown, path = 'params', depth = 0): void {
  if (depth > 12) bad(path, '巢狀積木超過 12 層');
  if (!obj(p)) bad(path, '需為參數物件');
  const fields = ATOM_PARAMETER_FIELDS[atom];
  if (!fields) bad(path, `未知或尚未實裝原子 ${atom}`);
  const allowed = new Set(['target', ...fields]);
  for (const key of Object.keys(p)) if (!allowed.has(key)) bad(`${path}.${key}`, `不是 ${atom} 的參數`);
  if (p.target !== undefined) choice(p.target, `${path}.target`, ['self','opponent']);
  for (const key of ['amount','multiplier','percent','ratio','value','all','stages','atk','def','spatk','spdef','speed','accuracy','bonus','level','duration','turns','chance','fixedCap','hp_below','hp_above','layer_gte']) {
    if (p[key] === undefined) continue;
    const signed = ['maxhp_change','stat_change','priority'].includes(atom) && ['amount','value','all','stages','atk','def','spatk','spdef','speed','accuracy','bonus','level'].includes(key);
    const max = ['hp_below','hp_above','fixedCap'].includes(key) ? 1 : key === 'chance' || (key === 'percent' && atom === 'damage_reduce') ? 100 : ['duration','turns'].includes(key) ? 10000 : 1_000_000;
    num(p[key], `${path}.${key}`, signed ? -1_000_000 : 0, max);
    if (['duration','turns','layer_gte'].includes(key) && !Number.isInteger(p[key])) bad(`${path}.${key}`, '需為整數');
  }
  for (const key of ['alwaysHit','evade','clearable','has_shield','is_first','is_second']) if (p[key] !== undefined && typeof p[key] !== 'boolean') bad(`${path}.${key}`, '需為布林值');
  for (const key of ['elem','label','timerId','id','timerName','name','displayChar','char','is_gender','enemy_type','has_status','elfName','template']) if (p[key] !== undefined) str(p[key], `${path}.${key}`);
  const damageType = p.dmgType ?? p.damageType;
  if (damageType !== undefined) choice(damageType, `${path}.damageType`, ['fixed','percent','skill','skill_attribute','true']);
  if (damageType === 'skill' || damageType === 'skill_attribute') { if (typeof p.elem !== 'string' || !p.elem.trim()) bad(path, '技能傷害缺少屬性'); }
  if (p.amountMode !== undefined) choice(p.amountMode, `${path}.amountMode`, ['flat','max_hp_percent']);
  if (p.damageNode !== undefined) choice(p.damageNode, `${path}.damageNode`, ['attack_damage','skill_effect','extra_action']);
  if (p.damageTypes !== undefined) {
    if (!Array.isArray(p.damageTypes) || p.damageTypes.length === 0 || p.damageTypes.length > 6) bad(path, '傷害範圍需選 1–6 類');
    for (const type of p.damageTypes) choice(type, `${path}.damageTypes`, DAMAGE_FILTER_TYPES);
  }
  if (p.stat !== undefined) choice(p.stat, `${path}.stat`, ['all','atk','def','spatk','spdef','spAtk','spDef','speed','accuracy']);
  if (atom === 'apply_status') { str(p.status, `${path}.status`, 200); if (!StatusRegistry[canonicalStatusName(p.status)]) bad(path, '異常名稱尚未登記'); }
  const modes: Record<string, string[]> = { heal: ['fixed','flat','percent'], maxhp_change: ['add','reduce'], pp_op: ['recover','drain','reduce','add','zero'], accuracy: ['sure_hit','sure','boost','drop','evade'], crit: ['must','sure','always','must_crit'], copy_transfer: ['swap_hp','copy_stats'] };
  if (p.mode !== undefined && modes[atom]) choice(p.mode, `${path}.mode`, modes[atom]);
  if (p.op !== undefined) choice(p.op, `${path}.op`, ['zero','recover','drain','add','reduce']);
  if (p.type !== undefined && atom !== 'clear_stat') str(p.type, `${path}.type`, 200);
  if (p.shieldType !== undefined) choice(p.shieldType, `${path}.shieldType`, ['shield','barrier']);
  if (p.wrapParams !== undefined && !obj(p.wrapParams)) bad(path, 'wrapParams 需為物件');
  if (p.innerParams !== undefined && !obj(p.innerParams)) bad(path, 'innerParams 需為物件');
  if (p.inner !== undefined) str(p.inner, `${path}.inner`, 200);
  if (p.wraps !== undefined && !((typeof p.wraps === 'string') || (Array.isArray(p.wraps) && p.wraps.every(a => typeof a === 'string')))) bad(path, 'wraps 需為原子名稱或名稱陣列');
  if (atom === 'clear_stat') {
    if (p.type !== undefined) choice(p.type, `${path}.type`, ['buff','debuff','all']);
    if (p.statType !== undefined) choice(p.statType, `${path}.statType`, ['boost','drop','all']);
  }
  if (p.incremental !== undefined) {
    if (!obj(p.incremental)) bad(path, 'incremental');
    for (const key of Object.keys(p.incremental)) if (!['stateKey','base','step','max'].includes(key)) bad(path, 'incremental 未知參數');
    str(p.incremental.stateKey, `${path}.incremental.stateKey`, 200);
    for (const key of ['base','step','max']) num(p.incremental[key], `${path}.incremental.${key}`, 0, 1_000_000);
    if (p.incremental.max < p.incremental.base) bad(path, 'incremental 上限小於起始值');
  }
  const nested = (a: string, params: unknown, suffix: string) => validateAtomParams(a, params, `${path}.${suffix}`, depth + 1);
  const items = (value: unknown, suffix: string) => {
    if (!Array.isArray(value) || value.length > 100) bad(path, `${suffix} 超過100個或非陣列`);
    value.forEach((item, i) => { if (!obj(item)) bad(path, suffix); str(item.atom, path, 200); nested(item.atom, item.params ?? {}, `${suffix}[${i}].params`); if (item.text !== undefined) str(item.text, path); });
  };
  if (atom === 'turn_effect_apply') {
    if (p.applyMode !== undefined) choice(p.applyMode, `${path}.applyMode`, ['gate','per_tick','on_expire']);
    if (p.tickAt !== undefined) choice(p.tickAt, `${path}.tickAt`, ['round_end','action_end','never']);
    if (p.polarity !== undefined) choice(p.polarity, `${path}.polarity`, ['POSITIVE','NEGATIVE','NEUTRAL','MIXED']);
    if (p.wrapItems !== undefined) items(p.wrapItems, 'wrapItems');
    else {
      const wraps = Array.isArray(p.wraps) ? p.wraps : p.wraps ? [p.wraps] : [];
      if (wraps.length > 100) bad(path, '包裝原子過多');
      for (const a of wraps) nested(a, p.wrapParams ?? {}, 'wrapParams');
    }
  }
  if (atom === 'condition_gate') {
    if (p.layer_gte !== undefined && (typeof p.timerId !== 'string' || !p.timerId.trim())) bad(path, '層數條件缺少 timerId');
    if (p.has_status !== undefined && !StatusRegistry[canonicalStatusName(p.has_status)]) bad(path, '條件異常名稱尚未登記');
    if (p.innerItems !== undefined) items(p.innerItems, 'innerItems');
    else if (p.inner) nested(p.inner, p.innerParams ?? {}, 'innerParams');
    if (p.innerTarget !== undefined) choice(p.innerTarget, path, ['self','opponent']);
  }
  if (p.extraElf !== undefined) {
    if (!obj(p.extraElf)) bad(path, '額外精靈需為物件');
    str(p.extraElf.name, `${path}.extraElf.name`, 200);
    num(p.extraElf.maxHp, `${path}.extraElf.maxHp`, 1, 1_000_000);
    if (p.extraElf.kit !== undefined) validateKit(p.extraElf.kit, `${path}.extraElf.kit`, depth + 1);
  }
}
/** 非原子引用只校驗槽位結構；不把專屬 codeId 的存在當成語意通過。 */
export function validateKit(value: unknown, path = 'kit', depth = 0): void {
  if (depth > 12 || !Array.isArray(value) || value.length > 1000) bad(path, 'Kit 過深／過多或非陣列');
  value.forEach((entry, i) => {
    const at = `${path}[${i}]`;
    if (!obj(entry) || !obj(entry.params)) bad(at, '需為詞條與參數物件');
    str(entry.codeId, `${at}.codeId`, 200); choice(entry.node, `${at}.node`, EFFECT_NODES);
    choice(entry.source, `${at}.source`, ['skill','soulmark','mechanic','item']); num(entry.order, `${at}.order`, 0, 1_000_000);
    if (!Number.isInteger(entry.order)) bad(at, '順序需為整數');
    if (entry.customText !== undefined) str(entry.customText, `${at}.customText`);
    if (ATOM_PARAMETER_FIELDS[entry.codeId]) validateAtomParams(entry.codeId, entry.params, `${at}.params`, depth);
    else if (['mark_op','force_switch'].includes(entry.codeId)) bad(at, '此舊積木沒有對應原子執行器，請保留原圖紙並人工核對');
  });
}

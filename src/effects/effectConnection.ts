/** 編輯、顯示、儲存與戰鬥共用的來源合約。未知語意保留，不以近似模板代替。 */
import type { KitEntry } from './effectSystem.schema';
import type { Program } from '../blocks/model';
import { parseSkill, parseSoulMark } from '../blocks/parse';
import { validateKit } from './kitValidation';
import { BoundedCache } from '../utils/boundedCache';
import { EFFECT_NODES, EFFECT_NODE_LABELS } from './effectNodes';
import { sequenceIssue, skillPropertyIssue } from './sequenceContract';
import { soulPropertyIssue } from './soulProperty';
export { EFFECT_NODE_LABELS } from './effectNodes';

export type EffectExecutionMode = 'auto' | 'description' | 'kit' | 'registry';
export interface EffectDefinition {
  name: string;
  description?: string;
  kit?: KitEntry[];
  effectMode?: EffectExecutionMode;
}
export type EffectRoute = 'description' | 'kit' | 'registry';
export interface ConnectionIssue { index: number; text: string; reason: string }

/** 存在入口不代表該原子所有選項均已實裝。先擋住已知替代／僅日誌入口。 */
const issueCache = new BoundedCache<string, { reason: string | null }>(512);
export function kitEntryIssue(entry: KitEntry, gateContext = false): string | null {
  let key: string;
  try {key=JSON.stringify([gateContext,entry]);} catch {return '效果資料包含循環引用，不能序列化或執行。';}
  // 用內容作鍵，而非只認物件身分，舊程式原地修改參數也不會讀到過期驗證。
  const cached=issueCache.get(key);
  if(cached) return cached.reason;
  const reason=uncachedKitEntryIssue(entry,gateContext);
  if(key.length <= 16384) issueCache.set(key,{reason});
  return reason;
}
function uncachedKitEntryIssue(entry: KitEntry, gateContext: boolean): string | null {
  try { validateKit([entry]); } catch (error) { return (error as Error).message; }
  if(entry.codeId==='effect_sequence') {
    if(entry.node==='pp_consumed'&&(entry.source!=='skill'||entry.role!=='carried'))return 'PP被消耗節點只允許逐槽攜帶效果';
    return gateContext ? '連鎖需正式事件觸發，不可放在只讀增減傷閘門。' : sequenceIssue(entry.params.clause,entry.node);
  }
  if(entry.codeId==='skill_property')return gateContext?'技能本體查詢不可嵌入傷害閘門。':skillPropertyIssue(entry);
  if(entry.codeId==='soul_property')return gateContext?'被動命中查詢不可嵌入傷害閘門。':soulPropertyIssue(entry);
  if (['pierce','copy_stat_sum','rebirth','extra_action'].includes(entry.codeId))
    return '此舊原子尚無符合完整語意的通用結算；保留資料，不以真傷／日誌／重用技能代替。';
  if (entry.codeId === 'shield' && entry.params.shieldType === 'barrier') return '護罩與護盾不同，此入口尚未接護罩。';
  if (entry.codeId === 'immune' && entry.params.type && entry.params.type !== 'all') return '此入口僅支援全部技能免疫，不代替分類免疫。';
  if (entry.codeId === 'condition_gate' && !entry.params.inner && !entry.params.innerItems?.length) return '條件沒有可執行行為。';
  if (['damage_multiplier','damage_reduce','crit'].includes(entry.codeId) && !['before_damage','passive_always'].includes(entry.node)) return '此原子需要傷害計算節點，不能在命中後修改已結算傷害。';
  if (gateContext && !['damage_multiplier','damage_reduce','condition_gate'].includes(entry.codeId)) return '持續生效閘門只讀增減傷；其他行為應選每回合或結束時觸發。';
  if (entry.codeId === 'priority' && entry.node !== 'modify_priority') return '先制需放在先制判定節點，舊動態旗標沒有統一讀取端。';
  if (entry.codeId === 'accuracy' && !['boost','drop'].includes(entry.params.mode)) return '必中／閃避需要命中前查詢機制；此舊原子的旗標尚未接通。';
  if (entry.codeId === 'immune') return '技能免疫旗標尚未接通傷害／命中判定；保留而不偽稱生效。';
  if (entry.codeId === 'crit') return '此入口在公式後才寫入暴擊旗標，尚未接通公式前的致命一擊判定。';
  if (entry.codeId === 'extra_damage' && entry.params.damageNode === 'extra_action') return '額外行動需完整獨立節點，不能以直接附加技能傷害代替。';
  if (entry.codeId === 'turn_effect_apply' && !entry.params.wraps && !entry.params.wrapItems?.length) return '回合效果沒有可執行內容。';
  // 編號／文字詞條保留，不能將關鍵字近似匹配當作已接通。
  const direct = ['extra_damage','damage_multiplier','damage_reduce','damage_reflect','heal','drain_hp','hp_cost','maxhp_change','apply_status','cure_status','stat_change','clear_stat','shield','pp_op','priority','accuracy','crit','summon_extra','vanish','copy_transfer','immune','turn_effect_apply','turn_effect_clear','condition_gate'];
  if (!direct.includes(entry.codeId)) return '引用詞條尚需轉為明確原子；不在戰鬥中重新猜測文字。';
  if (entry.codeId === 'summon_extra' && !entry.params.extraElf) return '召喚缺少額外精靈資料。';
  const wrapsGate = entry.codeId === 'turn_effect_apply' && (entry.params.applyMode || 'gate') === 'gate';
  const nestedNode = wrapsGate ? 'before_damage' : entry.node;
  for (const item of entry.params.innerItems || entry.params.wrapItems || []) {
    const reason = kitEntryIssue({ ...entry, node: nestedNode, codeId: item.atom, params: item.params || {} }, gateContext || wrapsGate);
    if (reason) return `巢狀效果：${reason}`;
  }
  if (entry.params.inner) return kitEntryIssue({ ...entry, codeId: entry.params.inner, params: entry.params.innerParams || {} }, gateContext);
  if (entry.params.wraps) for (const atom of Array.isArray(entry.params.wraps) ? entry.params.wraps : [entry.params.wraps]) {
    const reason = kitEntryIssue({ ...entry, node: nestedNode, codeId: atom, params: entry.params.wrapParams || {} }, gateContext || wrapsGate);
    if (reason) return `持續效果：${reason}`;
  }
  return null;
}

export function effectRoute(definition: EffectDefinition, hasHandler = false): EffectRoute {
  if (definition.effectMode && definition.effectMode !== 'auto') return definition.effectMode;
  if (hasHandler) return 'registry';
  return definition.kit?.length ? 'kit' : 'description';
}

const planCache = new BoundedCache<string, ReturnType<typeof buildEffectPlan>>(512);
export function compileEffectPlan(definition: EffectDefinition, kind: 'skill' | 'soul', hasHandler = false) {
  const key = JSON.stringify([kind, hasHandler, definition.name, definition.description, definition.effectMode, definition.kit]);
  const cached = planCache.get(key);
  if (cached) return cached;
  const plan = buildEffectPlan(definition, kind, hasHandler);
  planCache.set(key, plan);
  return plan;
}
function buildEffectPlan(definition: EffectDefinition, kind: 'skill' | 'soul', hasHandler: boolean) {
  const route = effectRoute(definition, hasHandler);
  // 手輸描述常省略逗號；只補明確的時點分隔，不替換原句的條件／數值。
  const soulText = (definition.description || '').replace(/^(回合開始時|回合結束時|登場時|戰鬥開始時)(?![，,：:\n])(?=\S)/gm, '$1，');
  const parsed = kind === 'skill' ? parseSkill(definition.name, definition.description || '') : parseSoulMark(definition.name, soulText);
  // 舊解析器會剝去「命中後」而留下use；新來源／煉成不能丟失這個限制。
  // 只修明確句首；內嵌條件與未知時點仍由嚴格解析回報，不猜整句時點。
  const descriptionProgram = kind === 'skill' ? { ...parsed, clauses: parsed.clauses.map(clause =>
    clause.trig === 'use' && /^(?:[🎯■◇]\s*)?命中(?:後|時)/u.test(clause.raw.trim())
      ? { ...clause, trig: 'after_hit' as const } : clause) } : parsed;
  const issues: ConnectionIssue[] = [];
  let program: Program = descriptionProgram;
  if (route === 'kit') {
    program = { title: definition.name, kind, clauses: (definition.kit || []).map((entry, index) => {
      const reason = kitEntryIssue(entry);
      if (reason) issues.push({ index, text: entry.customText || entry.codeId, reason });
      if(entry.codeId==='effect_sequence')return reason ? {
        raw:entry.customText || '待修正連鎖',trig:'custom',parsed:false,rest:[reason],
        body:[{acts:[{op:'text',p:{text:reason},label:reason}]}],
      } : {...entry.params.clause,parsed:true,rest:[]};
      return { raw: entry.customText || entry.codeId, trig: EFFECT_NODES[entry.node]?.trigger || 'custom', parsed: !reason, rest: reason ? [reason] : [],
        body: [{ acts: [{ op: entry.codeId, p: { node: entry.node, ...entry.params }, label: `${EFFECT_NODE_LABELS[entry.node]} · ${entry.customText || entry.codeId}` }] }] };
    }) };
    if (!definition.kit?.length) issues.push({ index: -1, text: '', reason: '選擇積木執行但沒有詞條。' });
  } else if (route === 'registry') {
    if (!hasHandler) issues.push({ index: -1, text: definition.name, reason: '沒有對應專屬註冊表。' });
  } else {
    // 解析器可辨認標籤，不等於事件執行器會讀取它。僅新來源使用嚴格路徑，保留舊登記行為。
    program = { ...descriptionProgram, clauses: descriptionProgram.clauses.map((clause, index) => {
      const acts = clause.body.flatMap(b => [...b.acts, ...(b.elseActs || [])]);
      let reason = '';
      if (clause.parsed && clause.marker !== '§') {
        if (['custom','bench','team_round_start'].includes(clause.trig)) reason = '此時點尚未接入自訂效果生命週期。';
        if (kind === 'soul' && clause.trig === 'passive' && acts.some(a => !['dmg_mod','boost','note','noop','evade'].includes(a.op))) reason = '此常駐行為需要對應查詢／事件，不能在每次傷害時重播。';
        if (acts.some(a => a.op === 'evade') && (clause.cond?.length || clause.body.some(b => b.cond?.length))) reason = '條件式常駐閃避尚未接入條件查詢。';
        if (acts.some(a => a.op === 'noop' && a.p.tag && !/^(?:該技能(?:為)?)?必中$|^(?:.+?時)?(?:額外)?先制\s*[+＋-]\s*\d+(?:且必定命中)?$|^無特殊效果$|^（無特殊效果）$/.test(a.p.tag))) reason = '僅辨認說明標籤，尚無符合此行為的執行查詢。';
        if (kind === 'soul' && acts.some(a => a.op === 'noop' && /必中|先制/.test(a.p.tag || ''))) reason = '魂印／特質的此常駐命中或先制標籤尚無查詢入口；不能沿用技能自身的查詢。';
      }
      const result = reason ? { ...clause, parsed: false, rest: [...(clause.rest || []), reason] } : clause;
      if (!result.parsed && result.marker !== '§') issues.push({ index, text: result.raw, reason: (result.rest || ['未完整解析']).join('；') });
      return result;
    }) };
  }
  return { route, program, issues, total: program.clauses.length,
    connected: route === 'registry' ? null : program.clauses.filter(c => c.parsed).length };
}

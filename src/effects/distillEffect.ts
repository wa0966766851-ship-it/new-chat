import { matchCond } from '../blocks/parse';
import type { Act, Cond, Trigger, Clause, Stmt } from '../blocks/model';
import { STAT_KEYS } from '../blocks/parse';
import type { KitEntry, Node } from './effectSystem.schema';
import { compileEffectPlan, kitEntryIssue, type EffectDefinition, type ConnectionIssue } from './effectConnection';
import { sequenceClause, sequenceIssue, SEQUENCE_TRIGGERS } from './sequenceContract';

const NODES: Partial<Record<Trigger, Node>> = { use: 'on_skill_use', after_hit: 'on_hit', on_invalid: 'on_invalid',
  entrance: 'on_entered', battle_start: 'battle_start', round_start: 'round_start', round_end: 'round_end',
  phase_end: 'battle_phase_end', kill: 'on_kill', defeated: 'cthyaat_death', switch_out: 'on_switch_out',
  damaged: 'on_damaged', self_skill: 'on_skill_use', opp_skill: 'on_attacked', opp_after_skill: 'opponent_after_action',
  extra_action_start: 'extra_action_start', extra_action_end: 'extra_action_end' };
const target = (side: string) => side === 'self' ? 'self' : 'opponent';
type Item = { atom: string; params: Record<string, any>; text?: string };
/** pp_restore 已不使用99哨兵：「全部」＝mode:'recover'，數字＝mode:'add'。 */
function editableClause(clause:Clause):Clause {
  const act=(a:Act):Act=>{
    if(a.op==='pp_restore'&&Object.keys(a.p).every(k=>k==='v'||k==='mode'))return a.p.mode==='recover'?
      {...a,op:'pp_op',label:'恢復自身所有 PP',p:{side:'self',mode:'recover'}}:
      {...a,op:'pp_op',label:`恢復自身所有技能 ${a.p.v} PP`,p:{side:'self',mode:'add',amount:a.p.v}};
    if(a.op==='pp_drain'&&Object.keys(a.p).every(k=>['v','steal'].includes(k)))return {...a,op:'pp_op',p:{side:'opp',mode:a.p.steal?'drain':'reduce',amount:a.p.v}};
    return a.op==='timed'?{...a,p:{...a.p,body:a.p.body.map(stmt)}}:a;
  };
  const stmt=(s:Stmt):Stmt=>({...s,acts:s.acts.map(act),...(s.elseActs?{elseActs:s.elseActs.map(act)}:{})});
  return sequenceClause({...clause,body:clause.body.map(stmt)});
}
function propertyEntry(clause:any,kind:'skill'|'soul',order:number): KitEntry | null {
  if(kind!=='skill'||clause.body.length!==1||clause.body[0].acts.length!==1||clause.body[0].chain||clause.body[0].elseActs?.length)return null;
  const a=clause.body[0].acts[0];if(a.op!=='noop')return null;
  let tag=String(a.p.tag||'');const extra:any[]=[];
  // 「X時先制+N」：把前綴交給既有條件解析；解析不了就不轉換，不能留在標籤裡當空動作。
  const lead=tag.match(/^(.+?時)((?:額外)?先制\s*[+＋-]\s*\d+)$/);
  if(lead&&!/(額外)/.test(lead[2])){const c=matchCond(lead[1]);if(!c)return null;extra.push(c);tag=lead[2];}
  const match=tag.match(/^(?:該技能(?:為)?)?先制\s*([+＋-])\s*(\d+)$/);
  const sure=/^(?:該技能(?:為)?)?必中$/.test(tag);if(!sure&&!match)return null;
  // 只辨識技能固有，不把附加句自動提升成無法封印的本體屬性。
  if(clause.marker!=='■')return null;
  return {codeId:'skill_property',node:sure?'before_skill':'modify_priority',source:'skill',role:'innate',order,customText:clause.raw,
    params:{property:sure?'sure_hit':'base_priority',value:sure?true:(match![1]==='-'?-1:1)*Number(match![2]),conditions:[...(clause.cond || []),...(clause.body[0].cond || []),...extra]}};
}

/** 只轉換可完全保留語意的動作；範圍、成功分支、特殊公式等不允許近似降級。 */
function action(a: Act, raw: string): Item[] | null {
  const p = a.p;
  // 簡單原子不能悄悄丟掉翻倍、遞增或其他附帶參數；有這些欄位必須走完整連鎖。
  const fields:Record<string,string[]>={heal_flat:['amount'],heal:['side','ratio'],status:['side','status','turns','chance'],
    stat:['side','stats','v','chance'],stat_clear:['side','kind'],cure_status:['side'],clear_turn:['side'],shield:['flat'],
    pp_restore:['v','mode'],dmg:['flat','both','type','elem','base','of','ratio']};
  if(!fields[a.op]||Object.keys(p || {}).some(key=>!fields[a.op].includes(key)))return null;
  if (a.op === 'heal_flat') return [{ atom: 'heal', params: { target: 'self', amount: p.amount } }];
  if (a.op === 'heal' && p.side !== 'both') return [{ atom: 'heal', params: { target: target(p.side), ratio: p.ratio, mode: 'percent' } }];
  if (a.op === 'status' && p.side !== 'both') return [{ atom: 'apply_status', params: { target: target(p.side), status: p.status, duration: p.turns ?? 3, chance: p.chance ?? 100 } }];
  if (a.op === 'stat' && (p.chance ?? 100) === 100 && !p.stats2 && p.side !== 'both') {
    const changes = Object.fromEntries((p.stats as string[]).flatMap(s => (STAT_KEYS[s] || []).map(key => [key, p.v])));
    return [{ atom: 'stat_change', params: { target: p.side === 'auto' ? (p.v > 0 ? 'self' : 'opponent') : target(p.side), ...changes } }];
  }
  if (a.op === 'stat_clear' && p.side !== 'both') return [{ atom: 'clear_stat', params: { target: target(p.side), type: p.kind === 'up' ? 'buff' : p.kind === 'down' ? 'debuff' : 'all' } }];
  if (a.op === 'cure_status' && p.side !== 'both') return [{ atom: 'cure_status', params: { target: target(p.side) } }];
  if (a.op === 'clear_turn' && p.side !== 'both') return [{ atom: 'turn_effect_clear', params: { target: target(p.side) } }];
  if (a.op === 'shield' && p.flat !== undefined) return [{ atom: 'shield', params: { target: 'self', amount: Math.max(0, Math.floor(p.flat)) } }];
  // 舊文字入口把「全部」用99哨兵表示；真正寫99點不能悄悄改成補滿。
  if (a.op === 'pp_restore' && p.mode !== 'recover') return [{ atom: 'pp_op', params: { target: 'self', op: 'add', amount: p.v } }];
  if (a.op === 'pp_restore' && p.mode === 'recover') return [{ atom: 'pp_op', params: { target: 'self', op: 'recover' } }];
  if (a.op === 'dmg' && !p.both) {
    const type = { 固定: 'fixed', 百分比: 'percent', 真實: 'true', 技能: 'skill_attribute' }[p.type];
    if (p.flat !== undefined && type && type !== 'percent') return [{ atom: 'extra_damage', params: { target: 'opponent', amount: p.flat, damageType: type, ...(p.elem ? { elem: p.elem, damageNode: 'attack_damage' } : {}) } }];
    if (p.base === '最大體力' && p.of === 'opp' && type === 'percent') return [{ atom: 'extra_damage', params: { target: 'opponent', ratio: p.ratio, damageType: 'percent' } }];
  }
  return null;
}
function conditions(list: Cond[]): Record<string, any> | null {
  const params: Record<string, any> = {};
  for (const c of list) {
    if (c.neg) return null;
    if (c.c === 'hp_ratio' && c.p?.side === 'self' && ['低於','小於','高於','大於'].includes(c.p.op)) {
      const key = ['低於','小於'].includes(c.p.op) ? 'hp_below' : 'hp_above';
      if (params[key] !== undefined) return null;
      params[key] = c.p.ratio;
    } else return null;
  }
  return params;
}

/**
 * 本專案描述慣例把「必中」「先制+N」寫在無標記的開頭分句（例：「必中；恢復自身最大體力的1/2」）。
 * 只有技能欄位（isSureHit／priority）同意時，才把它視為技能固有屬性拆成獨立子句；欄位不符就維持原樣（交由合約拒絕）。
 */
function splitLeadingProperties(clauses: Clause[], definition: any, kind: 'skill' | 'soul'): Clause[] {
  if (kind !== 'skill') return clauses;
  const agrees = (tag: string) => {
    if (/^(?:該技能(?:為)?)?必中$/.test(tag)) return definition?.isSureHit === true || definition?.alwaysHit === true;
    const m = tag.match(/^(?:該技能(?:為)?)?先制\s*([+＋-])\s*(\d+)$/);
    return !!m && Number(definition?.priority) === (m[1] === '-' ? -1 : 1) * Number(m[2]);
  };
  const lone = (st: any) => st && !st.cond?.length && !st.chain && !st.elseActs?.length && st.acts?.length === 1 && st.acts[0].op === 'noop' && agrees(String(st.acts[0].p?.tag || ''));
  const out: Clause[] = [];
  for (const c of clauses) {
    if (c.marker || c.trig !== 'use' || c.cond?.length || !c.parsed) { out.push(c); continue; }
    let body = c.body;
    while (body.length && lone(body[0])) {
      out.push({ ...c, raw: String(body[0].acts[0].p.tag), marker: '■', body: [body[0]] } as Clause);
      body = body.slice(1);
    }
    if (body.length) out.push(body === c.body ? c : { ...c, body });
  }
  return out;
}

export function distillEffect(definition: EffectDefinition, kind: 'skill' | 'soul') {
  const plan0 = compileEffectPlan({ ...definition, effectMode: 'description' }, kind);
  const plan = { ...plan0, program: { ...plan0.program, clauses: splitLeadingProperties(plan0.program.clauses, definition, kind) } };
  const kit: KitEntry[] = [], issues: ConnectionIssue[] = [...plan.issues];
  plan.program.clauses.forEach((clause, index) => {
    if (!clause.parsed || clause.marker === '§') return;
    const node = NODES[clause.trig];
    const local: KitEntry[] = [];
    let reason = !node ? `「${clause.trig}」尚無完全等價的畫布時點。` : '';
    for (const stmt of clause.body) {
      if (reason) break;
      if (stmt.chain || stmt.elseActs?.length || stmt.afterHit || stmt.pre || stmt.live) { reason = '成功／失敗、快照或等量關聯尚無等價畫布容器。'; break; }
      const cond = conditions([...(clause.cond || []), ...(stmt.cond || [])]);
      if (!cond) { reason = '此條件尚不能完整表達成畫布參數。'; break; }
      const items = stmt.acts.flatMap(a => action(a, clause.raw) || []);
      if (!items.length || stmt.acts.some(a => !action(a, clause.raw))) { reason = '有動作尚無完全等價畫布原子；原文保留，不替代。'; break; }
      const entries = Object.keys(cond).length ? [{ atom: 'condition_gate', params: { ...cond, innerItems: items } }] : items;
      for (const item of entries) {
        const entry: KitEntry = { codeId: item.atom, params: item.params, node: node!, source: kind === 'skill' ? 'skill' : 'soulmark',
          order: kit.length + local.length, customText: clause.raw, role: clause.marker === '■' ? 'innate' : clause.marker === '◇' ? 'carried' : 'attached' };
        reason = kitEntryIssue(entry) || '';
        if (reason) break;
        local.push(entry);
      }
    }
    if (reason) issues.push({ index, text: clause.raw, reason }); else kit.push(...local);
  });
  // 結果連鎖必須保留同一事件內的成敗歷史與條件快照。不能把前句清除、後句成功分支分成不相干的原子。
  // 整份可用才採此路徑；未解析句仍阻止替換，沒有fallback到原主handler。
  // 使用者決定（2026-10-10）：一律走連鎖，每句一個獨立連鎖項；不再把簡單句煉成單一原子。
  {
    const sequenceKit: KitEntry[]=[], sequenceIssues: ConnectionIssue[]=[...plan.issues];
    for(const [index,clause] of plan.program.clauses.entries()) {
      if(clause.marker==='§')continue;
      if(!clause.parsed)continue;
      const property=propertyEntry(clause,kind,sequenceKit.length);
      if(property) {
        const reason=kitEntryIssue(property);
        if(reason)sequenceIssues.push({index,text:clause.raw,reason});else sequenceKit.push(property);
        continue;
      }
      const clean=editableClause(clause),node=SEQUENCE_TRIGGERS[clause.trig] as Node;
      const entry: KitEntry={codeId:'effect_sequence',params:{clause:clean},node,source:kind==='skill'?'skill':'soulmark',
        order:sequenceKit.length,customText:clause.raw,role:clause.marker==='■'?'innate':clause.marker==='◇'?'carried':'attached'};
      const reason=sequenceIssue(clean,node)||kitEntryIssue(entry);
      if(reason)sequenceIssues.push({index,text:clause.raw,reason});else sequenceKit.push(entry);
    }
    // 未完整草稿只供逐句對照；呼叫端禁止套用，不能讓後面的成功分支失去前句。
    return {kit:sequenceKit,issues:sequenceIssues,complete:sequenceIssues.length===0&&sequenceKit.length>0};
  }
  return { kit, issues, complete: issues.length === 0 && kit.length > 0 };
}

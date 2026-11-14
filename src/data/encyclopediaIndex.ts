/**
 * 戰鬥百科總索引（2026-11-14）：把戰鬥節點、觸發詞、積木代號、異常、效果詞庫、
 * 判定分類、機制條目與玩法說明攤平成同一份可搜尋清單。
 * 每筆都帶 tab，可從總索引跳到原分頁。純資料，不參與結算。
 */
import { BATTLE_NODES } from '../engine/nodes';
import { EFFECT_NODES } from '../effects/effectNodes';
import { TRIGGER_CAPTIONS } from '../battle/effectPresentation';
import { OP_CATALOG } from './opCatalog';
import { ALIAS_BY_OP } from './opAliases';
import { OP_DISPLAY_NAMES } from '../battle/opDisplayNames';
import { StatusRegistry } from '../effects/statusRegistry';
import { EFFECT_CATALOG } from './effectCatalog';
import { MAJOR_EFFECT_CATEGORIES, INVALIDATION_MECHANISMS, DAMAGE_CATEGORIES, EXECUTION_MECHANICS } from './effectClassificationCatalog';
import { MECHANIC_TOPICS, MECHANIC_GROUPS, MODE_GUIDES, CONDITION_DISPLAY_NAMES } from './encyclopediaGuide';

export type IndexKind = 'battleNode' | 'effectNode' | 'trigger' | 'op' | 'status' | 'effect' | 'rule' | 'mechanic' | 'mode';
export type IndexTab = 'nodes' | 'opCodes' | 'status' | 'effectQuery' | 'mechanics' | 'modes';

export interface IndexEntry {
  id: string;
  kind: IndexKind;
  title: string;
  code?: string;
  tags: string[];
  body: string;
  tab: IndexTab;
}

export const INDEX_KIND_LABEL: Record<IndexKind, string> = {
  battleNode: '戰鬥節點', effectNode: '效果節點', trigger: '觸發詞', op: '積木', status: '異常',
  effect: '效果詞庫', rule: '判定分類', mechanic: '機制', mode: '玩法',
};

const text = (v: unknown) => (typeof v === 'string' ? v : '');

/** 積木的顯示名稱：動作看 OP_DISPLAY_NAMES，條件看 CONDITION_DISPLAY_NAMES；兩者都沒有時回傳 undefined。 */
export function opTitle(op: string): string | undefined {
  return OP_DISPLAY_NAMES[op] ?? CONDITION_DISPLAY_NAMES[op];
}

function safeDescribe(e: any): string {
  try { return typeof e.describe === 'function' ? String(e.describe({}) ?? '') : text(e.description); } catch { return text(e.description); }
}

export function buildEncyclopediaIndex(): IndexEntry[] {
  const out: IndexEntry[] = [];

  for (const n of BATTLE_NODES) {
    out.push({ id: `bn:${n.id}`, kind: 'battleNode', title: n.name, code: n.id, tags: ['官方節點'], body: `官方戰鬥節點 ${n.id}`, tab: 'nodes' });
  }

  const nodeTriggers = new Set<string>();
  for (const [key, n] of Object.entries(EFFECT_NODES)) {
    nodeTriggers.add(n.trigger);
    out.push({ id: `en:${key}`, kind: 'effectNode', title: n.label, code: key, tags: [n.phase, n.trigger, n.event ? String(n.event) : 'derived'], body: [n.help, n.derived ? `衍生：${n.derived}` : ''].filter(Boolean).join('\n'), tab: 'nodes' });
  }

  for (const [trigger, caption] of Object.entries(TRIGGER_CAPTIONS)) {
    out.push({ id: `tr:${trigger}`, kind: 'trigger', title: caption, code: trigger, tags: [nodeTriggers.has(trigger) ? '有效果節點' : '觸發詞'], body: `描述前綴「${caption}：」`, tab: 'nodes' });
  }

  for (const e of Object.values(OP_CATALOG)) {
    const name = opTitle(e.op);
    const codes = [e.code, e.conditionCode].filter(Boolean) as string[];
    const aliases = ALIAS_BY_OP[e.op] ?? [];
    out.push({
      id: `op:${e.op}`, kind: 'op', title: name ?? e.op, code: codes.join(' / '),
      tags: [e.familyLabel, e.kind, ...aliases],
      body: [`積木 ${e.op}`, name ? '' : '內部積木，無顯示名稱', e.deprecatedCode ? `舊代號 ${e.deprecatedCode}` : ''].filter(Boolean).join('\n'),
      tab: 'opCodes',
    });
  }

  for (const [key, s] of Object.entries(StatusRegistry)) {
    out.push({ id: `st:${key}`, kind: 'status', title: s.name, tags: s.categories.map(String), body: s.description, tab: 'status' });
  }

  const statusNames = new Set(Object.values(StatusRegistry).map(s => s.name));
  for (const e of Object.values(EFFECT_CATALOG) as any[]) {
    if (!e?.label || statusNames.has(e.label)) continue;
    out.push({ id: `ef:${e.id}`, kind: 'effect', title: e.label, code: e.id, tags: (e.categories || []).map(String), body: safeDescribe(e), tab: 'effectQuery' });
  }

  const rules: Array<[string, Record<string, any>]> = [
    ['效果大類', MAJOR_EFFECT_CATEGORIES], ['失效機制', INVALIDATION_MECHANISMS], ['傷害分類', DAMAGE_CATEGORIES], ['執行機制', EXECUTION_MECHANICS],
  ];
  for (const [group, table] of rules) {
    for (const [key, r] of Object.entries(table)) {
      out.push({ id: `ru:${key}`, kind: 'rule', title: text(r.name) || key, code: key, tags: [group], body: [text(r.description), text(r.triggerRequirement)].filter(Boolean).join('\n'), tab: 'effectQuery' });
    }
  }

  const groupTitle = Object.fromEntries(MECHANIC_GROUPS.map(g => [g.id, g.title]));
  for (const m of MECHANIC_TOPICS) {
    out.push({ id: `me:${m.id}`, kind: 'mechanic', title: m.title, tags: [groupTitle[m.group] ?? m.group, m.tag], body: m.body, tab: 'mechanics' });
  }

  for (const g of MODE_GUIDES) {
    out.push({ id: `mo:${g.id}`, kind: 'mode', title: g.title, tags: [g.tag, g.entry], body: [g.summary, ...g.rules].join('\n'), tab: 'modes' });
  }

  return out;
}

let cached: IndexEntry[] | null = null;
export function encyclopediaIndex(): IndexEntry[] {
  return (cached ??= buildEncyclopediaIndex());
}

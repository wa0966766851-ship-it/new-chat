/**
 * 舊原子 → 連鎖（effect_sequence）轉換器。
 * 只轉換「語意與舊原子執行器完全等價」的情況；其餘回傳 null，維持原狀執行，不近似替代。
 * 等價性由 tests/atomToSequence.equivalence.test.ts 以同一個模擬戰鬥比對轉換前後的結果。
 */
import type { Act, Clause } from '../blocks/model';
import type { KitEntry, Node } from './effectSystem.schema';
import { kitEntryIssue } from './effectConnection';
import { normalizeBlockAtom } from './blockParams';
import { SEQUENCE_TRIGGERS } from './sequenceContract';

/** 節點 → 連鎖觸發。只列「節點與觸發一對一」的；before_damage／on_damaged 等多義節點不轉。 */
const NODE_TRIGGER: Partial<Record<Node, Clause['trig']>> = {
  on_skill_use: 'use', on_hit: 'after_hit', on_entered: 'entrance', battle_start: 'battle_start',
  round_start: 'round_start', round_end: 'round_end', battle_phase_end: 'phase_end', on_kill: 'kill',
};
const STAT_NAME: Record<string, string> = { atk: '攻擊', def: '防禦', spatk: '特攻', spdef: '特防', speed: '速度', accuracy: '命中' };
const posInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0;
const side = (target: string) => (target === 'self' ? 'self' : 'opp');

function convertAtom(atom: string, p: Record<string, any>, target: 'self' | 'opponent'): Act[] | null {
  switch (atom) {
    case 'heal': {
      if (target !== 'self' || p.mode === 'reflect_equal') return null;
      if (Object.keys(p).some(k => !['amount', 'ratio', 'mode'].includes(k))) return null;
      if (posInt(p.amount) && !p.ratio) return [{ op: 'heal_flat', p: { amount: p.amount }, label: `恢復 ${p.amount} 點體力` }];
      if (typeof p.ratio === 'number' && p.ratio > 0 && !p.amount) return [{ op: 'heal', p: { side: 'self', ratio: p.ratio }, label: `恢復最大體力 ${Math.round(p.ratio * 100)}%` }];
      return null;
    }
    case 'extra_damage': {
      if (target !== 'opponent' || Object.keys(p).some(k => !['amount', 'dmgType', 'label'].includes(k))) return null;
      if (!['fixed', 'true'].includes(p.dmgType) || !posInt(p.amount)) return null;
      const type = p.dmgType === 'fixed' ? '固定' : '真實';
      return [{ op: 'dmg', p: { flat: p.amount, both: false, type }, label: `【${type}傷害】${p.amount}` }];
    }
    case 'apply_status': {
      if (Object.keys(p).some(k => !['status', 'duration', 'turns', 'chance'].includes(k)) || typeof p.status !== 'string') return null;
      const turns = p.duration ?? p.turns ?? 3;
      const chance = Number(p.chance ?? 100);
      if (!posInt(turns) || !Number.isFinite(chance) || chance <= 0 || chance > 100) return null;
      return [{ op: 'status', p: { side: side(target), status: p.status, turns, chance }, label: `${side(target) === 'self' ? '自身' : '對手'} ${p.status}` }];
    }
    case 'stat_change': {
      const keys = Object.keys(p).filter(k => !['stat', 'value', 'all'].includes(k));
      let stats: string[], v: number;
      if (p.all !== undefined && !p.stat && !keys.length) { v = Number(p.all); stats = ['全屬性']; }
      else if (p.stat && STAT_NAME[p.stat] && !keys.length && p.all === undefined) { v = Number(p.value ?? 1); stats = [STAT_NAME[p.stat]]; }
      else return null;
      if (!Number.isInteger(v) || v === 0 || Math.abs(v) > 6) return null;
      return [{ op: 'stat', p: { chance: 100, side: side(target), stats, v }, label: `${side(target) === 'self' ? '自身' : '對手'} ${stats[0]} ${v > 0 ? '+' : ''}${v}` }];
    }
    case 'clear_stat': {
      if (Object.keys(p).some(k => !['type', 'statType'].includes(k)) || !['buff', 'debuff', 'all'].includes(p.type)) return null;
      const kind = p.type === 'buff' ? 'up' : p.type === 'debuff' ? 'down' : 'all';
      return [{ op: 'stat_clear', p: { side: side(target), kind }, label: '消除能力變化' }];
    }
    case 'shield': {
      if (target !== 'self' || Object.keys(p).some(k => k !== 'amount') || !posInt(p.amount)) return null;
      return [{ op: 'shield', p: { flat: p.amount }, label: `護盾 ${p.amount}` }];
    }
    case 'pp_op': {
      if (Object.keys(p).some(k => !['op', 'mode', 'amount'].includes(k))) return null;
      const mode = p.op;
      if (!['zero', 'recover', 'drain', 'add', 'reduce'].includes(mode)) return null;
      const needsAmount = ['drain', 'add', 'reduce'].includes(mode);
      const amount = p.amount ?? 1;
      if (needsAmount && !posInt(amount)) return null;
      return [{ op: 'pp_op', p: { side: side(target), mode, ...(needsAmount ? { amount } : {}) }, label: `PP ${mode}` }];
    }
    default: return null;
  }
}

/** 單一 Kit 條目轉成 effect_sequence；不能完全等價轉換時回傳 null。 */
export function atomEntryToSequence(entry: KitEntry): KitEntry | null {
  if (!entry || entry.codeId === 'effect_sequence' || entry.codeId === 'skill_property') return null;
  const trig = NODE_TRIGGER[entry.node];
  if (!trig || SEQUENCE_TRIGGERS[trig] !== entry.node) return null;
  let normalized;
  try { normalized = normalizeBlockAtom(entry.codeId, entry.params || {}); } catch { return null; }
  const acts = convertAtom(normalized.atom, normalized.params, normalized.target);
  if (!acts) return null;
  const raw = entry.customText || acts.map(a => a.label).join('；');
  const converted: KitEntry = { ...entry, codeId: 'effect_sequence', customText: entry.customText ?? raw,
    params: { clause: { raw, trig, parsed: true, body: [{ acts }] } } };
  // 轉出來的連鎖若通不過連鎖合約，就維持原子，不降級。
  return kitEntryIssue(converted) ? null : converted;
}

/** 整份 Kit 轉換：可轉的換成連鎖，其餘原樣保留；原資料不被修改（不快取，避免舊程式原地改參數後讀到過期結果）。 */
export function kitToSequences(kit: KitEntry[] | undefined): KitEntry[] {
  if (!kit?.length) return kit || [];
  const out = kit.map(entry => atomEntryToSequence(entry) || entry);
  return out.some((e, i) => e !== kit[i]) ? out : kit;
}

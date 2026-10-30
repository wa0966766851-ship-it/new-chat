import {consumedHealthAmount} from '../../effects/mechSupportLifecycle';
/** 末批可攜印記、面板結算與體力鎖。參數決定行為，不按精靈或技能名稱分流。 */
import type { BattleEventContext } from '../../effects/types';
import type { RunState } from '../runtime';
import { clearAllStatuses, getStatuses } from '../../utils/battleHelpers';
import { canonicalStatusName } from '../../effects/statusIdentity';
import { getTypeMatchup } from '../../utils/statCalculator';
import { getMaxPp } from '../../utils/battleHelpers';
import { skillSlot } from '../../battle/skillSlot';
import {StatusRegistry} from '../../effects/statusRegistry';
import {applyOrExtendStatus} from '../../effects/statusCollection';
import {queueHpDrain} from '../../battle/hpDrain';
import { deriveContext } from '../../effects/deriveContext';

type Side = 'p1' | 'p2';
const sideOf = (ctx: BattleEventContext, side: string): Side => side === 'opp' ? ctx.targetSide : ctx.actor;
const elfOf = (ctx: BattleEventContext, side: Side): any => side === ctx.actor ? ctx.self : ctx.target;
const idOf = (elf: any) => String(elf?.battleId || elf?.id || '');
export const FINAL_ODB_ACTION_FIELDS: Record<string, readonly string[]> = {
  maximum_health_lock: ['value', 'resetCurrent'],
  portable_mark: ['side', 'id', 'name', 'displayChar', 'description', 'count', 'maxCount', 'effects', 'rules', 'persistsOffField'],
  portable_mark_transfer: ['id', 'count', 'maxCount'],
  panel_health: ['stats', 'ratio', 'mode'],
  copy_statuses: ['from', 'to'],
  hp_gate_snapshot: ['key', 'ratio', 'latch'],
  hp_gate_clear: ['keys'],
  incoming_health_floor: ['ratio'],
  consume_current_health: ['side', 'ratio'],
  self_health_damage: ['ratio', 'type'],
  opponent_incoming_floor_turns: ['ratio', 'turns'],
  fatal_survival_window: ['turns', 'cure'],
  resistance_record: ['key'], entry_maximum_snapshot: ['key'],
  energy_form_enter: ['key', 'snapshotKey', 'name', 'displayChar'],
  energy_form_ally_defeat: ['key', 'amount'],
  energy_form_spend: ['key', 'ratio', 'minimum', 'mode', 'conversionReward'],
  team_status_replace: ['key', 'recordKey', 'status', 'turns', 'loseUniversalResistance'],
  energy_conversion_reward: ['key'],
  stat_points_scale: ['side', 'ratio', 'stats','perLastAmount'],
  battle_mark_grant: ['side', 'id', 'name', 'displayChar', 'statRatio', 'duel'],
  battle_mark_to_last_ally: ['id', 'name', 'displayChar', 'statRatio', 'duel'],
  battle_mark_entrance: [],
  status_bound_round_end: ['side', 'body'], status_bound_resolve: ['targetId', 'key', 'body'],
  typed_damage_checked: ['amount', 'elem'],
  skill_marks_assign: ['side', 'withinRounds', 'marks'],
  status_duration_floor: ['side','cls','turns'],
  held_resources_damage: ['resources','ratio'],
  drain_to_opponent: ['ratio'],
  skill_marks_strip: ['side', 'restorePp', 'hpRatio', 'damageRatio', 'nonlethal', 'zeroHighestMaxPp'],
  skill_marks_priority: ['perKinds', 'bonus'],
  skill_mark_pp_match: ['perPp'],
  skill_mark_inherit_arm: ['when', 'mode'],
  combat_record_reset: ['side', 'stages', 'shields', 'clearUses', 'fieldRounds'],
};
export const FINAL_ODB_CONDITION_FIELDS: Record<string, readonly string[]> = { stored_flag: ['key', 'neg'], event_damage_kind: ['kind'], event_hp_unchanged: [], last_typed_damage_weak: [] };
export function finalOdbConditionIssue(c: any): string | undefined {
  if (c.c === 'event_damage_kind') return ['真實', '固定', '百分比', '技能', '攻擊'].includes(c.p?.kind) ? undefined : '傷害事件種類不明';
  if (c.c !== 'stored_flag') return undefined;
  return typeof c.p?.key === 'string' && c.p.key.length > 0 && c.p.key.length < 160 ? undefined : '旗標必須有有限鍵名';
}
export function finalOdbEvalCond(ctx: BattleEventContext, c: any, st?: RunState): boolean | undefined {
  if (c.c === 'event_hp_unchanged') {
    const data: any = (ctx as any).effectEventData || st?.event?.data;
    return Number.isFinite(data?.hpReduced) && data.hpReduced === 0;
  }
  if (c.c === 'last_typed_damage_weak') return (st as any)?.lastTypedDamageWeak === true;
  if (c.c === 'event_damage_kind') {
    const data: any = st?.event?.data || (ctx as any).effectEventData;
    const kind = (data?.damageComp || data)?.damageCategory || data?.damageType;
    return c.p.kind === '真實' ? kind === 'true' : c.p.kind === '固定' ? kind === 'fixed' : c.p.kind === '百分比' ? kind === 'percent' : c.p.kind==='攻擊'?kind==='skill_attack':String(kind).startsWith('skill');
  }
  if (c.c !== 'stored_flag') return undefined;
  const value = Boolean(ctx.getPlayerState(c.p.key)); return c.p.neg ? !value : value;
}
export function finalOdbActionIssue(op: string, p: any): string | null {
  if (!(op in FINAL_ODB_ACTION_FIELDS)) return null;
  if(op==='status_duration_floor'&&(!['self','opp'].includes(p.side)||!['弱化類'].includes(p.cls)||!Number.isInteger(p.turns)||p.turns<1||p.turns>10000))return '期限保底需明確分類、持有者與回合';
  if(op==='held_resources_damage'&&(!Array.isArray(p.resources)||!p.resources.length||p.resources.some((v:any)=>!['shield','barrier'].includes(v))||!Number.isFinite(p.ratio)||p.ratio<=0))return '持有資源傷害需明確資源與正比例';
  if(op==='drain_to_opponent'&&(!Number.isFinite(p.ratio)||p.ratio<=0||p.ratio>1))return '吸取需正體力比例';
  if (op === 'maximum_health_lock' && (!Number.isInteger(p.value) || p.value < 1 || p.value > 1e9 || typeof p.resetCurrent !== 'boolean')) return '體力上限鎖需正整數與明確是否重設當前體力';
  if (op === 'portable_mark' && (!['self', 'opp'].includes(p.side) || !p.id || !p.name || !p.displayChar || !p.description || !Number.isInteger(p.count) || p.count < 1 || !Number.isInteger(p.maxCount) || p.maxCount < p.count || typeof p.persistsOffField !== 'boolean' || !Array.isArray(p.rules))) return '可攜印記需明確目標、識別、文字、層數、上限、保留與規則';
  if (op === 'portable_mark_transfer' && (!p.id || !Number.isInteger(p.count) || p.count < 1 || !Number.isInteger(p.maxCount) || p.maxCount < p.count)) return '印記轉移需識別碼、正層數與上限';
  if (op === 'panel_health' && (!Array.isArray(p.stats) || !p.stats.length || p.stats.some((k: string) => !['atk', 'def', 'spatk', 'spdef', 'speed'].includes(k)) || !(p.ratio > 0) || !['heal', 'drain'].includes(p.mode))) return '面板體力結算需明確能力清單、正比例與恢復或吸取';
  if (op === 'copy_statuses' && (!['self', 'opp'].includes(p.from) || !['self', 'opp'].includes(p.to) || p.from === p.to)) return '異常複製必須指定不同來源與目標';
  if (op === 'hp_gate_snapshot' && (!p.key || !(p.ratio > 0 && p.ratio <= 1) || typeof p.latch !== 'boolean')) return '體力旗標需鍵名、比例與是否鎖存';
  if (op === 'hp_gate_clear' && (!Array.isArray(p.keys) || !p.keys.length || p.keys.some((k: any) => typeof k !== 'string' || !k))) return '旗標清理需鍵名清單';
  if (op === 'incoming_health_floor' && !(p.ratio > 0)) return '受傷保底需正體力比例';
  if (op === 'consume_current_health' && !['self', 'opp'].includes(p.side)) return '體力消耗需明確目標';
  if (op === 'consume_current_health' && p.ratio !== undefined && (!Number.isFinite(p.ratio) || p.ratio <= 0 || p.ratio > 1)) return '目前體力消耗比例需大於0且不超過1';
  if (op === 'self_health_damage' && (!(p.ratio > 0) || !['真實', '百分比', '固定'].includes(p.type))) return '自身體力比例傷害需正比例與傷害分類';
  if (op === 'opponent_incoming_floor_turns' && (!(p.ratio > 0) || !Number.isInteger(p.turns) || p.turns < 1)) return '受傷保底需正比例與回合期限';
  if (op === 'fatal_survival_window' && (!Number.isInteger(p.turns) || p.turns < 1 || typeof p.cure !== 'boolean')) return '存活窗口需正回合與明確是否解除異常';
  if (['resistance_record', 'entry_maximum_snapshot', 'energy_form_enter', 'energy_form_ally_defeat', 'energy_form_spend', 'team_status_replace', 'energy_conversion_reward'].includes(op) && (typeof p.key !== 'string' || !p.key || p.key.length > 160)) return '隊伍能力需有限狀態識別碼';
  if (op === 'energy_form_enter' && (!p.snapshotKey || !p.name || !p.displayChar)) return '能量形態需快照鍵與顯示文字';
  if (op === 'energy_form_ally_defeat' && (!Number.isInteger(p.amount) || p.amount < 1)) return '隊員死亡能量需正整數';
  if (op === 'energy_form_spend' && (!(p.ratio > 0 && p.ratio <= 1) || !Number.isInteger(p.minimum) || p.minimum < 1 || !Number.isInteger(p.conversionReward) || p.conversionReward < 0 || !['damage', 'heal'].includes(p.mode))) return '能量消耗需正比例、最低整數、明確用途與後續轉化獎勵';
  if (op === 'team_status_replace' && (!p.recordKey || !p.status || !Number.isInteger(p.turns) || p.turns < 1 || typeof p.loseUniversalResistance !== 'boolean')) return '隊伍轉化需記錄鍵、狀態、回合、全免抗性規則';
  if(op==='stat_points_scale'&&p.perLastAmount!==undefined&&(!Number.isFinite(p.perLastAmount)||p.perLastAmount<0||p.perLastAmount>10))return '逐回執能力點數增幅需0至1000%有限比例';
  if (op === 'stat_points_scale' && (!['self', 'opp'].includes(p.side) || !(p.ratio > 0) || !Array.isArray(p.stats) || !p.stats.length || p.stats.some((k: string) => !['atk', 'def', 'spatk', 'spdef', 'speed'].includes(k)))) return '能力點數倍率需單一目標、正倍率與明確能力清單';
  if (['battle_mark_grant', 'battle_mark_to_last_ally'].includes(op) && (!p.id || !p.name || !p.displayChar || !(p.statRatio > 0) || typeof p.duel !== 'boolean' || op === 'battle_mark_grant' && !['self', 'opp'].includes(p.side))) return '常駐戰鬥印記需識別、文字、正能力倍率及決鬥宣告';
  if (op === 'status_bound_round_end' && (p.side !== 'opp' || !Array.isArray(p.body) || !p.body.length)) return '異常結束監控需明確對手與非空子流程';
  if (op === 'status_bound_resolve' && (!p.targetId || !p.key || !Array.isArray(p.body) || !p.body.length)) return '異常綁定結算需目標身分與監控鍵';
  if (op === 'typed_damage_checked' && (!Number.isFinite(p.amount) || p.amount <= 0 || !p.elem)) return '屬性技能傷害需確切正點數與元素';
  if (op === 'skill_marks_assign' && (!['self', 'opp'].includes(p.side) || !Number.isInteger(p.withinRounds) || p.withinRounds < 1 || !Array.isArray(p.marks) || p.marks.length < 1 || p.marks.length > 5 || p.marks.some((m: any) => !m.symbol || !m.description || !Array.isArray(m.rules) || typeof m.capabilities !== 'object'))) return '技能槽印記需目標、登場回合限制、1至5個完整印記';
  if (op === 'skill_marks_strip' && (!['self', 'opp'].includes(p.side) || typeof p.restorePp !== 'boolean' || !(p.hpRatio >= 0) || !(p.damageRatio >= 0) || typeof p.nonlethal !== 'boolean' || typeof p.zeroHighestMaxPp !== 'boolean')) return '技能印記剝離需目標、PP方向、體力比例及致死規則';
  if (op === 'skill_marks_priority' && (!Number.isInteger(p.perKinds) || p.perKinds < 1 || !Number.isInteger(p.bonus))) return '符文先制需正種類階梯與整數增量';
  if (op === 'skill_mark_pp_match' && (!Number.isInteger(p.perPp) || p.perPp < 1)) return '同位PP上限同步需每點正真傷';
  if (op === 'skill_mark_inherit_arm' && (!['kill', 'defeated'].includes(p.when) || !['activation', 'runes'].includes(p.mode))) return '符文繼承需擊敗或被擊敗及激活狀態或完整符文';
  if (op === 'combat_record_reset' && (!['self', 'opp'].includes(p.side) || ['stages', 'shields', 'clearUses', 'fieldRounds'].some(k => typeof p[k] !== 'boolean'))) return '戰鬥紀錄重置需目標與明確四類清理';
  return null;
}
/** 共用最大體力寫入處及消逝入口須呼叫；保留生命上限不等於免疫消逝本身。 */
export function enforceMaximumHealthLock(elf: any): void {
  const value = elf?.maximumHealthLock;
  if (!Number.isInteger(value) || value < 1) return;
  elf.maxHp = value;
  if (elf.calculatedStats) elf.calculatedStats.hp = value;
  elf.currentHp = Math.min(value, elf.currentHp);
}
/** FATAL_RESIST 共用入口；窗口本身不消耗，僅按回合到期，不誤限為每場一次。 */
export function resistFatalFromWindow(ctx: BattleEventContext): boolean {
  const timers = ctx.actor === 'p1' ? ctx.p1Timers : ctx.p2Timers;
  const timer = (timers || []).find((t: any) => t.remaining > 0 && !t.pendingActivation &&
    (!t.ownerBattleId || t.ownerBattleId === idOf(ctx.self)) && t.payload?.block?.fatalSurvivalWindow);
  if (!timer) return false;
  const self: any = ctx.self;
  self.currentHp = 1; self.isDead = false; self.hasDied = false;
  if (timer.payload.block.fatalSurvivalWindow.cure) clearAllStatuses(self);
  ctx.updateElf(ctx.actor, { ...self }); return true;
}
const stateKey = (key: string) => `portableTeamEnergy:${key}`;
const liveActive = (ctx: BattleEventContext): any => ctx.actor === 'p1' ? ctx.activeP1 : ctx.activeP2;
function refreshEnergyMark(ctx: BattleEventContext, key: string, form: any) {
  if (!(form.energy > 0)) { ctx.clearMark(key, ctx.actor, null); return; }
  ctx.setMark({ id: key, name: form.name, displayChar: form.displayChar, count: form.energy, unit: '點', scope: 'team', persistsOffField: true, clearable: false,
    description: `能量${form.energy}；下次異常轉化待領${form.pendingReward || 0}。`, effects: { energy: form.energy, pendingReward: form.pendingReward || 0 } }, ctx.actor);
}
function grantBattleMark(ctx: BattleEventContext, p: any, side: Side, elf: any): boolean {
  const own = elf.portableBattleMarks || {};
  if (own[p.id]) return false;
  const calculatedStats = { ...elf.calculatedStats };
  for (const key of ['atk', 'def', 'spatk', 'spdef', 'speed']) calculatedStats[key] = Math.max(1, Math.floor((Number(calculatedStats[key]) || 0) * p.statRatio));
  const targetCtx = ctx.contextForElf?.(side, elf) || ctx;
  targetCtx.updateElf(side, { id: elf.id, calculatedStats, portableBattleMarks: { ...own, [p.id]: { ...p } } } as any);
  targetCtx.setMark({ id: p.id, name: p.name, displayChar: p.displayChar, count: 1, maxCount: 1, unit: '道', scope: 'elf', ownerBattleId: idOf(elf),
    persistsOffField: true, clearable: false, description: `能力值×${p.statRatio}${p.duel ? '，每次登場發起決鬥' : ''}`, effects: { statRatio: p.statRatio, duel: p.duel } }, side);
  const field=side==='p1'?ctx.activeP1:ctx.activeP2,other=side==='p1'?ctx.activeP2:ctx.activeP1;
  if(p.duel&&idOf(field)===idOf(elf)&&elf.currentHp>0&&other.currentHp>0){
    targetCtx.updateElf(side,{id:elf.id,portableDuelOpponent:idOf(other)} as any);
    targetCtx.updateElf(side==='p1'?'p2':'p1',{id:other.id,portableDuelOpponent:idOf(elf)} as any);
  }
  return true;
}
export {hasPortableDuel,portableSkillCapabilities} from '../../battle/portableSkillMarks';
/** 由共用事件入口調用；執行持有者自帶規則，不回頭查奧丁或呼叫其handler。 */
export function runPortableSkillMarkPrograms(ctx: BattleEventContext, trigs: string[], data: any,
  run: (ctx: BattleEventContext, rule: any, state: RunState) => boolean): void {
  const selectedIndex = skillSlot(ctx.self, data?.skill || ctx.skill);
  for (const [index, skill] of (ctx.self.skills || []).entries() as any) {
    const def = skill.portableSkillMark; if (!def) continue;
    const activate = !skill.isRuneActive && (trigs.includes('skill_selected') && selectedIndex === index || (ctx.self as any).portableInheritedActiveSlots?.includes(index));
    if (activate) {
      skill.isRuneActive = true;
      const ratio=def.capabilities?.statMultiplier;
      if(ratio&&ratio!==1&&!skill.portableAppliedStatsRatio){
        skill.portableAppliedStatsRatio=ratio;
        const calculatedStats={...ctx.self.calculatedStats};
        skill.portableAppliedStatRatios={};
        for(const key of ['atk','def','spatk','spdef','speed']){const before=calculatedStats[key];calculatedStats[key]=Math.floor(before*ratio);skill.portableAppliedStatRatios[key]=before?calculatedStats[key]/before:1;}
        ctx.updateElf(ctx.actor,{id:ctx.self.id,calculatedStats});
      }
      skill.specialBadge = { ...skill.specialBadge, text: def.symbol, description: def.description };
      ctx.updateElf(ctx.actor, { id: ctx.self.id, skills: ctx.self.skills.map((s: any) => ({ ...s })) });
      if((ctx.self as any).portableInheritedActiveSlots?.includes(index))ctx.updateElf(ctx.actor,{id:ctx.self.id,portableInheritedActiveSlots:(ctx.self as any).portableInheritedActiveSlots.filter((i:number)=>i!==index)} as any);
    }
    if (!skill.isRuneActive) continue;
    for (const rule of def.rules||[]) {
      if (rule.activationOnly ? !activate : !trigs.includes(rule.trig)) continue;
      const markCtx = deriveContext(ctx, { portableSkillMarkSlot: index });
      run(markCtx, rule, { last: null, lastAmount: 0, sourceKind: 'soul', event: { trig: rule.trig, data } });
    }
  }
}
export function finalOdbOperations(addTimer: (ctx: BattleEventContext, side: Side, name: string, n: number, mode: 'turns' | 'uses', payload: Record<string, any>) => void,
  runStatements?: (ctx: BattleEventContext, body: any[], st: RunState) => void) {
  return {
    maximum_health_lock(ctx: BattleEventContext, p: any) {
      const elf: any = ctx.self; elf.maximumHealthLock = p.value;
      if (p.resetCurrent) elf.currentHp = p.value;
      enforceMaximumHealthLock(elf); ctx.updateElf(ctx.actor, { ...elf }); return true;
    },
    portable_mark(ctx: BattleEventContext, p: any) {
      const side = sideOf(ctx, p.side), elf = elfOf(ctx, side);
      ctx.setMark({ id: p.id, name: p.name, displayChar: p.displayChar, description: p.description,
        count: p.count, maxCount: p.maxCount, unit: '道', scope: 'elf', ownerBattleId: idOf(elf),
        persistsOffField: p.persistsOffField, clearable: false,
        effects: { ...structuredClone(p.effects || {}), blockProgram: structuredClone(p.rules) } }, side);
      return true;
    },
    portable_mark_transfer(ctx: BattleEventContext, p: any) {
      const owner = idOf(ctx.self), other = idOf(ctx.target);
      const source = ctx.getMarks(ctx.actor).find(m => m.id === p.id && (!m.ownerBattleId || m.ownerBattleId === owner));
      if (!source || source.count < 1) return false;
      const destination = ctx.getMarks(ctx.targetSide).find(m => m.id === p.id && (!m.ownerBattleId || m.ownerBattleId === other));
      const amount = Math.min(p.count, source.count, Math.max(0, p.maxCount - (destination?.count || 0)));
      if (!amount) return false;
      if (source.count === amount) ctx.clearMark(p.id, ctx.actor, owner);
      else ctx.setMark({ ...structuredClone(source), count: source.count - amount }, ctx.actor);
      ctx.setMark({ ...structuredClone(source), count: (destination?.count || 0) + amount, ownerBattleId: other }, ctx.targetSide);
      return true;
    },
    panel_health(ctx: BattleEventContext, p: any, st: RunState) {
      const amount = Math.floor(p.stats.reduce((sum: number, key: string) => sum + (Number((ctx.self.calculatedStats as any)?.[key]) || 0), 0) * p.ratio);
      if (p.mode === 'heal') { ctx.applyHeal(ctx.actor, amount); st.lastAmount = amount; return amount > 0; }
      const actual = ctx.applyPinkDamage(ctx.targetSide, amount, '面板吸取', ctx.activeP1, ctx.activeP2, '百分比傷害');
      ctx.applyHeal(ctx.actor, actual); st.lastAmount = actual; return actual > 0;
    },
    copy_statuses(ctx: BattleEventContext, p: any) {
      const from = elfOf(ctx, sideOf(ctx, p.from)), to = sideOf(ctx, p.to); let success = false;
      for (const [name, turns] of Object.entries(getStatuses(from))) {
        success = Boolean(ctx.applyStatusWithImmunityCheck(to, name, Math.max(1, Number(turns) || 1))?.success) || success;
      }
      return success;
    },
    hp_gate_snapshot(ctx: BattleEventContext, p: any) {
      const below = ctx.self.currentHp < ctx.self.maxHp * p.ratio;
      ctx.setPlayerState(p.key, below || (p.latch && Boolean(ctx.getPlayerState(p.key)))); return true;
    },
    hp_gate_clear(ctx: BattleEventContext, p: any) { for (const key of p.keys) ctx.setPlayerState(key, false); return true; },
    incoming_health_floor(ctx: BattleEventContext, p: any, st: RunState) {
      const comp: any = st.event?.data?.damageComp || st.event?.data;
      if (!comp?.isIncoming || !Number.isFinite(comp.base)) return false;
      comp.floor = Math.max(Number(comp.floor) || 0, Math.floor(ctx.self.maxHp * p.ratio)); return true;
    },
    consume_current_health(ctx: BattleEventContext, p: any, st: RunState) {
      const side = sideOf(ctx, p.side), elf = elfOf(ctx, side);
      const amount = Math.min(elf.currentHp, consumedHealthAmount(ctx, Math.floor(Math.max(0, elf.currentHp) * (p.ratio ?? 1))));
      ctx.adjustHp(side, -amount); st.lastAmount = amount; return amount > 0;
    },
    self_health_damage(ctx: BattleEventContext, p: any) {
      const amount = Math.floor(ctx.self.maxHp * p.ratio);
      if (p.type === '真實') ctx.applyTrueDamage(ctx.actor, amount, '體力反噬');
      else ctx.applyPinkDamage(ctx.actor, amount, '體力反噬', ctx.activeP1, ctx.activeP2, p.type === '百分比' ? '百分比傷害' : '固定傷害');
      return amount > 0;
    },
    opponent_incoming_floor_turns(ctx: BattleEventContext, p: any) {
      addTimer(ctx, ctx.targetSide, '受到傷害保底', p.turns, 'turns', { trig: 'incoming', body: [{ acts: [{ op: 'incoming_health_floor', p: { ratio: p.ratio }, label: '受到傷害保底' }] }], sourceKind: 'soul' });
      return true;
    },
    fatal_survival_window(ctx: BattleEventContext, p: any) {
      addTimer(ctx, ctx.actor, '致死存活窗口', p.turns, 'turns', { fatalSurvivalWindow: { cure: p.cure }, sourceKind: 'soul' }); return true;
    },
    resistance_record(ctx: BattleEventContext, p: any) {
      const slots = (ctx.self.resistances?.statusResist?.slots || []).filter((s: any) => s.status && Number.isFinite(s.rate));
      const maximum = Math.max(-1, ...slots.map((s: any) => s.rate));
      const values = [...new Set(slots.filter((s: any) => s.rate === maximum).map((s: any) => canonicalStatusName(s.status)))];
      ctx.setPlayerState(p.key, values);
      return true;
    },
    entry_maximum_snapshot(ctx: BattleEventContext, p: any) { ctx.setPlayerState(p.key, ctx.self.maxHp); return true; },
    energy_form_enter(ctx: BattleEventContext, p: any) {
      if (ctx.getPlayerState(stateKey(p.key))) return false;
      const energy = Math.max(0, Number(ctx.getPlayerState(p.snapshotKey)) || ctx.self.maxHp);
      const form = { energy, name: p.name, displayChar: p.displayChar, pendingReward: 0 };
      ctx.setPlayerState(stateKey(p.key), form);
      ctx.updateElf(ctx.actor, { id: ctx.self.id, isVanished: true });
      refreshEnergyMark(ctx, p.key, form); return true;
    },
    energy_form_ally_defeat(ctx: BattleEventContext, p: any, st: RunState) {
      const data = st.event?.data || (ctx as any).effectEventData;
      if (data?.eventOwnerBattleId === idOf(ctx.self)) return false;
      const form = ctx.getPlayerState(stateKey(p.key)); if (!(form?.energy > 0)) return false;
      const next = { ...form, energy: form.energy + p.amount }; ctx.setPlayerState(stateKey(p.key), next);
      refreshEnergyMark(ctx, p.key, next); return true;
    },
    energy_form_spend(ctx: BattleEventContext, p: any) {
      const form = ctx.getPlayerState(stateKey(p.key)); if (!(form?.energy > 0)) return false;
      const amount = Math.min(form.energy, Math.max(p.minimum, Math.floor(form.energy * p.ratio)));
      const next = { ...form, energy: form.energy - amount, pendingReward: (form.pendingReward || 0) + p.conversionReward };
      ctx.setPlayerState(stateKey(p.key), next); refreshEnergyMark(ctx, p.key, next);
      const active = liveActive(ctx);
      if (p.mode === 'damage') ctx.applyTrueDamage(ctx.targetSide, amount, form.name);
      else if (active?.currentHp > 0) {
        const activeCtx = ctx.contextForElf?.(ctx.actor, active) || ctx;
        activeCtx.applyHeal(ctx.actor, amount);
      }
      return true;
    },
    team_status_replace(ctx: BattleEventContext, p: any, st: RunState) {
      const data = st.event?.data || (ctx as any).effectEventData; if (!data?.status) return false;
      const status = canonicalStatusName(data.status), recorded: string[] = ctx.getPlayerState(p.recordKey) || [];
      const form = ctx.getPlayerState(stateKey(p.key));
      if (status === canonicalStatusName(p.status) || (!(form?.energy > 0) && !recorded.includes(status))) return false;
      const active = liveActive(ctx);
      data.status = canonicalStatusName(p.status); data.duration = p.turns;
      if (p.loseUniversalResistance && active?.resistances) {
        const resistance = structuredClone(active.resistances); resistance.statusResist.allImmune = false;
        (ctx.contextForElf?.(ctx.actor, active) || ctx).updateElf(ctx.actor, { id: active.id, resistances: resistance });
      }
      data.portableConversions = [...(data.portableConversions || []), { ownerBattleId: idOf(ctx.self), key: p.key, targetBattleId: idOf(active) }];
      return true;
    },
    energy_conversion_reward(ctx: BattleEventContext, p: any, st: RunState) {
      const data = st.event?.data || (ctx as any).effectEventData;
      const conversion = data?.portableConversions?.find((v: any) => v.key === p.key && v.ownerBattleId === idOf(ctx.self));
      const form = ctx.getPlayerState(stateKey(p.key));
      if (!conversion || !(form?.pendingReward > 0)) return false;
      const amount = form.pendingReward, next = { ...form, energy: form.energy + amount, pendingReward: 0 };
      ctx.setPlayerState(stateKey(p.key), next); refreshEnergyMark(ctx, p.key, next);
      const active = liveActive(ctx);
      if (active?.currentHp > 0) (ctx.contextForElf?.(ctx.actor, active) || ctx).applyHeal(ctx.actor, amount);
      return true;
    },
    stat_points_scale(ctx: BattleEventContext, p: any, st: RunState) {
      const side = sideOf(ctx, p.side), elf = elfOf(ctx, side), stats = { ...elf.calculatedStats };
      for (const key of p.stats) stats[key] = Math.max(1, Math.floor((Number(stats[key]) || 0) * (p.ratio+(p.perLastAmount||0)*Math.max(0,st.lastAmount))));
      ctx.updateElf(side, { id: elf.id, calculatedStats: stats }); return true;
    },
    battle_mark_grant(ctx: BattleEventContext, p: any) { const side = sideOf(ctx, p.side); return grantBattleMark(ctx, p, side, elfOf(ctx, side)); },
    battle_mark_to_last_ally(ctx: BattleEventContext, p: any) {
      const elf = [...ctx.getFullTeam(ctx.actor)].reverse().find((e: any) => !e.portableBattleMarks?.[p.id]);
      return elf ? grantBattleMark(ctx, p, ctx.actor, elf) : false;
    },
    battle_mark_entrance(ctx: BattleEventContext, _p: any, st: RunState) {
      const data = st.event?.data || (ctx as any).effectEventData, side: Side = data?.eventSide;
      if (side !== 'p1' && side !== 'p2') return false;
      const incoming: any = side === 'p1' ? ctx.activeP1 : ctx.activeP2, otherSide: Side = side === 'p1' ? 'p2' : 'p1';
      const opponent: any = otherSide === 'p1' ? ctx.activeP1 : ctx.activeP2;
      if (!Object.values(incoming?.portableBattleMarks || {}).some((m: any) => m.duel) || !(incoming?.currentHp > 0) || !(opponent?.currentHp > 0)) return false;
      (ctx.contextForElf?.(side, incoming) || ctx).updateElf(side, { id: incoming.id, portableDuelOpponent: idOf(opponent) } as any);
      (ctx.contextForElf?.(otherSide, opponent) || ctx).updateElf(otherSide, { id: opponent.id, portableDuelOpponent: idOf(incoming) } as any);
      return true;
    },
    status_bound_round_end(ctx: BattleEventContext, p: any) {
      const key = `${idOf(ctx.self)}:${idOf(ctx.target)}:${ctx.actionId ?? ctx.roundNumber}:${ctx.skill?.name}`;
      addTimer(ctx, ctx.actor, '下次異常回合結束', 1, 'uses', { trig: 'round_end', sourceKind: 'skill', boundStatusKey: key,
        body: [{ acts: [{ op: 'status_bound_resolve', p: { targetId: idOf(ctx.target), key, body: structuredClone(p.body) }, label: '異常綁定結算' }] }] });
      return true;
    },
    status_bound_resolve(ctx: BattleEventContext, p: any, st: RunState) {
      if (idOf(ctx.target) !== p.targetId || !Object.keys(getStatuses(ctx.target)).length || !runStatements) return false;
      const timers = ctx.actor === 'p1' ? ctx.p1Timers : ctx.p2Timers;
      for (const timer of timers || []) if (timer.payload?.block?.boundStatusKey === p.key) ctx.consumeTimer?.(ctx.actor, timer.id);
      runStatements(ctx, p.body, st); return true;
    },
    typed_damage_checked(ctx: BattleEventContext, p: any, st: RunState) {
      (st as any).lastTypedDamageWeak = getTypeMatchup(p.elem, ctx.target.type) < 1;
      st.lastAmount = ctx.applySkillTypeDamage(ctx.targetSide, p.amount, ctx.skill?.name || '屬性技能傷害', { elem: p.elem, node: 'attack_damage' });
      return true;
    },
    skill_marks_assign(ctx: BattleEventContext, p: any) {
      const side = sideOf(ctx, p.side), elf: any = elfOf(ctx, side), get = side === ctx.actor ? ctx.getPlayerState : ctx.getOpponentState;
      // 2026-10-31：符文附加只在「魂印持有者本人在場」時進行。
      // 官方描述是「若自身在場回合數未超過2回合」—— 持有者在後台時不該為任何人附加符文。
      // 引擎會把 ROUND_START 廣播給全隊（battleEngine.ts:2370），所以後台持有者也會被呼叫到。
      const holder: any = ctx.self;
      const activeHolder: any = ctx.actor === 'p1' ? (ctx as any).activeP1 : (ctx as any).activeP2;
      const holderId = String(holder?.battleId || holder?.id || '');
      const activeId = String(activeHolder?.battleId || activeHolder?.id || '');
      if (!holderId || holderId !== activeId) return false;
      // 2026-10-30：改用「該精靈自己的在場回合數」，不是該側的整場回合數。
      // 原本讀 ${side}_turnsInBattle（不隨換人重置），第 3 回合後換上的精靈明明在場 1 回合也被擋。
      const entryTurn = Number(get('fieldEntryTurn')) || 0;
      const nowTurn = Number(ctx.roundNumber) || 0;
      const onFieldRounds = entryTurn > 0 && nowTurn >= entryTurn ? (nowTurn - entryTurn + 1) : 1;
      if (onFieldRounds > p.withinRounds) return false;
      let changed = false;
      const skills = elf.skills.map((skill: any, index: number) => {
        if (!p.marks[index] || skill.skillRune || skill.portableSkillMark) return skill;
        changed = true; const def = structuredClone(p.marks[index]);
        const active = false;
        return { ...skill, skillRune: def.symbol, isRuneActive: active, portableSkillMark: def,
          specialBadge: { id: `slot_mark_${def.symbol}`, text: def.symbol, description: def.description },
        };
      });
      if (changed) ctx.updateElf(side, { id: elf.id, skills }); return changed;
    },
    status_duration_floor(ctx:BattleEventContext,p:any){const side=sideOf(ctx,p.side),elf=elfOf(ctx,side);let changed=false;for(const [status,duration]of Object.entries(getStatuses(elf)))if(StatusRegistry[canonicalStatusName(status)]?.categories?.includes('WEAKENING')&&Number(duration)<p.turns){changed=applyOrExtendStatus(ctx,side,elf,status,p.turns,p.turns-Number(duration))||changed;}return changed;},
    held_resources_damage(ctx:BattleEventContext,p:any){const amount=Math.floor(p.resources.reduce((n:number,k:string)=>n+Math.max(0,Number((ctx.self as any)[k])||0),0)*p.ratio);if(amount>0)ctx.applyTrueDamage(ctx.actor,amount,'持有資源結算');return amount>0;},
    drain_to_opponent(ctx:BattleEventContext,p:any){const enemy=ctx.contextForElf?.(ctx.targetSide,ctx.target);if(!enemy)return false;queueHpDrain(enemy,ctx.actor,Math.floor(ctx.self.maxHp*p.ratio),'percent','吸取持有者體力');return true;},
    skill_marks_strip(ctx: BattleEventContext, p: any) {
      const side=sideOf(ctx,p.side),elf:any=elfOf(ctx,side);
      let changed=false,statRatio=1,healRatio=0;
      const damagePolicies:any[]=[],statRatios:Record<string,number>=Object.fromEntries(['atk','def','spatk','spdef','speed'].map(k=>[k,1]));
      const skills=elf.skills.map((skill:any)=>{
        if(!skill.skillRune&&!skill.portableSkillMark)return skill;
        const policy={...p,...skill.portableSkillMark?.strip};
        changed=true;statRatio*=skill.portableAppliedStatsRatio||1;
        for(const key of Object.keys(statRatios))statRatios[key]*=skill.portableAppliedStatRatios?.[key]??skill.portableAppliedStatsRatio??1;
        if(skill.isRuneActive){healRatio+=policy.hpRatio;if(policy.damageRatio>0)damagePolicies.push(policy);}
        const next={...skill,pp:policy.restorePp?getMaxPp(skill,elf):0,currentPp:policy.restorePp?getMaxPp(skill,elf):0};
        delete next.portableAppliedStatsRatio;delete next.portableAppliedStatRatios;delete next.skillRune;delete next.portableSkillMark;delete next.specialBadge;delete next.isRuneActive;
        return next;
      });
      if(!changed)return false;
      const calculatedStats={...elf.calculatedStats};
      if(statRatio!==1)for(const key of ['atk','def','spatk','spdef','speed'])calculatedStats[key]=Math.round(calculatedStats[key]/(statRatios[key]||1));
      ctx.updateElf(side,{id:elf.id,skills,...(statRatio===1?{}:{calculatedStats})});
      if(healRatio>0)ctx.adjustHp(side,Math.floor(elf.maxHp*healRatio));
      if(damagePolicies.length){
        const amount=Math.floor(elf.maxHp*damagePolicies.reduce((sum,policy)=>sum+policy.damageRatio,0)),lethal=amount>=elf.currentHp;
        const nonlethal=damagePolicies.every(policy=>policy.nonlethal),actual=nonlethal?Math.min(amount,Math.max(0,elf.currentHp-1)):amount;
        const sourceSide:Side=side==='p1'?'p2':'p1',source=sourceSide==='p1'?ctx.activeP1:ctx.activeP2;
        (ctx.contextForElf?.(sourceSide,source)||ctx).applyTrueDamage(side,actual,'印記剝離');
        if(lethal&&nonlethal&&damagePolicies.some(policy=>policy.zeroHighestMaxPp)){
          const live:any=side===ctx.actor?ctx.self:ctx.target,maxima=live.skills.map((s:any)=>getMaxPp(s,live)),highest=maxima.indexOf(Math.max(...maxima));
          ctx.updateElf(side,{id:live.id,skills:live.skills.map((s:any,i:number)=>i===highest?{...s,maxPp:0,pp:0,currentPp:0}:s)});
        }
      }
      return true;
    },
    skill_marks_priority(ctx: BattleEventContext, p: any, st: RunState) {
      const comp: any = st.event?.data?.priorityComp || (ctx as any).priorityComp;
      if (!comp) return false;
      const symbols = new Set([ctx.activeP1, ctx.activeP2].flatMap(elf => elf.skills.filter(s => s.isRuneActive && s.skillRune).map(s => s.skillRune)));
      comp.bonus += Math.floor(symbols.size / p.perKinds) * p.bonus; return true;
    },
    skill_mark_pp_match(ctx: BattleEventContext, p: any) {
      const index = (ctx as any).portableSkillMarkSlot;
      const skill = ctx.self.skills[index], other = ctx.target.skills[index]; if (!skill || !other) return false;
      const maximum = getMaxPp(skill, ctx.self), before = getMaxPp(other, ctx.target), difference = Math.max(0, before - maximum);
      ctx.updateElf(ctx.targetSide, { id: ctx.target.id, skills: ctx.target.skills.map((s, i) => i === index ? { ...s, maxPp: maximum, pp: Math.min(s.pp, maximum), currentPp: Math.min(s.currentPp ?? s.pp, maximum) } : s) });
      if (difference) ctx.applyTrueDamage(ctx.targetSide, difference * p.perPp, 'PP上限差額'); return true;
    },
    skill_mark_inherit_arm(ctx: BattleEventContext, p: any) { ctx.setPlayerState(`portableSkillInheritance:${p.when}`, { mode: p.mode }); return true; },
    combat_record_reset(ctx: BattleEventContext, p: any) {
      const side = sideOf(ctx, p.side), elf: any = elfOf(ctx, side), updates: any = { id: elf.id };
      if (p.stages) updates.statStages = Object.fromEntries(Object.keys(elf.statStages || {}).map(key => [key, 0]));
      if (p.shields) { updates.shield = 0; updates.barrier = 0; }
      if (p.fieldRounds) (side === ctx.actor ? ctx.setPlayerState : ctx.setOpponentState)(`${side}_turnsInBattle`, 0);
      if (p.clearUses) for (const t of (side === 'p1' ? ctx.p1Timers : ctx.p2Timers) || []) if (t.kind === 'use_counter' && (!t.ownerBattleId || t.ownerBattleId === idOf(elf))) {for(let i=0;i<t.remaining;i++)ctx.consumeTimer?.(side,t.id);}
      ctx.updateElf(side, updates); return true;
    },
  };
}

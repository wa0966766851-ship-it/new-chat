// 背包名單統計與登場能力調整通用件（legacyWrapped 拆解；DSH 20261018 第十三批·第一波，5018 魂印「后」）。
// 資料來源：groupC.roster_query 的計數（st.lastAmount）。
// temp_stats_by_last：六維（含體力上限）總和×上一數值×scale 加到每一維；原始六維快照寫入
//   blkTempStatsOriginal:<個體>（個體鍵），下場由 temp_stats_restore 還原（currentHp 夾回原上限）。
//   語意同舊 handler opeiaTemporaryStats（含體力上限的六維暫增，不平均分配、不自行回血）。
// bench_type_stat_transfer：敵我雙方存在識別帶指定屬性者即回 true（供 chain 分支）；場下（雙方在場者除外）
//   所有同屬性精靈六維各降 ratio（floor）並附加給自身（語意同舊 handler 混沌轉移，逐隻結算 currentHp 夾至新上限）。
// attack_bypass_until_switch：寫引擎既有讀取端 ignoreAttackImmunityUntilSwitch／attackDefenseBypassUntilSwitch
//   （battle/attackImmunity＋battle/attackDefense；「直到下場前無視攻擊免疫／抵擋／轉化／傷害限制」），
//   下場由 until_switch_keys_clear 清除。
// counter_from_last／counter_power_ratio：上一數值寫入計數鍵＋依計數比例改受方攻擊威力
//   （modify_power／incoming_power 入口；「每有 n 隻…受到攻擊威力降低 perUnit×n」）。
// attack_combo_uses_by_last：前 N 次（N=上一數值）自身攻擊技能連擊次數+1——個體綁定 use_counter 計時器，
//   每次以 combo_add 寫引擎 attackBonusHitCountThisAction（與 astralOperations 同一讀取端）；
//   下場由 timer_consume_all 作廢剩餘次數。
// pp_no_cost：本次技能 PP 消耗歸零（before_skill；effectEventData.ppCostComp.multiplier＝0，與舊 handler 同時點）。
// reduction_override_turns：N 回合內自身受到非真實傷害降低效果觸發時比例變為 percent%
//   （battle/damageReduction.reductionPolicy 讀計時器 payload.damageReductionOverridePercent）。
// seal_used_skill_pp_phase_end／pp_zero_seal：快照對手本次使用的技能與使用者身分，於當回合戰鬥階段結束時
//   令該精靈該技能（sameCategory 時含全部同類型技能）PP 歸 0——身分於建立時快照，不因中途死亡換人而改指向。
// until_switch_keys_clear：下場清理——列舉玩家狀態鍵歸零（無視鍵／計數鍵通用）。
// timer_consume_all：清除指定 id 的全部計時器（次數容器隨下場作廢）。
import type { BattleEventContext } from '../../effects/types';
import type { RunState } from '../runtime';

type S = 'p1' | 'p2';
const TEMP_KEYS = ['hp', 'atk', 'def', 'spatk', 'spdef', 'speed'] as const;
const idOf = (e: any) => String(e?.battleId || e?.id || '');
const hasType = (e: any, type: string) => String(e?.type || '').replace(/系/g, '').split(/[.·・]/).includes(type);
/** ON_ENTRANCE／ON_SWITCH_OUT 的 ctx 可能尚未繫結新精靈——沿用 entranceStack 的 fallback 鏈。 */
const resolveSelf = (ctx: BattleEventContext): any =>
  (ctx as any).self ?? (ctx as any).effectEventData?.elf ?? (ctx as any).effectEventData?.incomingElf
  ?? ((ctx as any).actor === 'p1' ? (ctx as any).activeP1 : (ctx as any).activeP2);
const snapshotKey = (id: string) => `blkTempStatsOriginal:${id}`;

/** 契約欄位（登記於 sequenceContract）。 */
export const ROSTER_STATS_ACTION_FIELDS: Record<string, readonly string[]> = {
  temp_stats_by_last: ['scale'],
  temp_stats_restore: [],
  bench_type_stat_transfer: ['type', 'ratio'],
  attack_bypass_until_switch: ['immunity', 'block', 'conversion', 'limit', 'shield'],
  counter_from_last: ['key', 'label'],
  counter_power_ratio: ['key', 'perUnit'],
  attack_combo_uses_by_last: ['id'],
  pp_no_cost: [],
  reduction_override_turns: ['turns', 'percent'],
  seal_used_skill_pp_phase_end: ['sameCategory'],
  pp_zero_seal: ['targetId', 'name', 'category'],
  until_switch_keys_clear: ['keys'],
  timer_consume_all: ['id'],
};

/** 契約補充檢查；回傳 null 代表通過。 */
export function rosterStatsActionIssue(op: string, p: any, trig: string): string | null {
  if (op === 'temp_stats_by_last') {
    if (trig !== 'entrance') return '臨時能力值只能於登場時計算';
    if (!(p.scale > 0 && p.scale <= 1)) return '臨時能力值需0至100%比例';
    return null;
  }
  if (op === 'temp_stats_restore') {
    if (trig !== 'switch_out') return '臨時能力值還原只能在下場執行';
    return null;
  }
  if (op === 'bench_type_stat_transfer') {
    if (trig !== 'entrance') return '屬性轉移只能於登場時結算';
    if (typeof p.type !== 'string' || !p.type || p.type.length > 20) return '屬性轉移需明確短屬性名';
    if (!(p.ratio > 0 && p.ratio <= 1)) return '屬性轉移需0至100%比例';
    return null;
  }
  if (op === 'attack_bypass_until_switch') {
    if (trig !== 'entrance') return '攻擊無視只能於登場時取得';
    if (![p.immunity, p.block, p.conversion, p.limit, p.shield].some(Boolean)) return '攻擊無視需至少指定一項';
    return null;
  }
  if (op === 'counter_from_last') {
    if (trig !== 'entrance') return '計數鍵寫入只能於登場時計算';
    if (typeof p.key !== 'string' || !p.key || p.key.length > 100) return '計數鍵需有限識別碼';
    return null;
  }
  if (op === 'counter_power_ratio') {
    if (trig !== 'incoming_power') return '威力計數比例只能在受方威力事件執行';
    if (typeof p.key !== 'string' || !p.key || p.key.length > 100) return '計數鍵需有限識別碼';
    if (!(p.perUnit > 0 && p.perUnit <= 1)) return '威力比例需0至100%單位';
    return null;
  }
  if (op === 'attack_combo_uses_by_last') {
    if (trig !== 'entrance') return '連擊次數容器只能於登場時建立';
    if (typeof p.id !== 'string' || !p.id || p.id.length > 200) return '連擊容器需有限識別碼';
    return null;
  }
  if (op === 'pp_no_cost') {
    if (trig !== 'before_skill') return 'PP免耗只能在本次技能消耗結算前執行';
    return null;
  }
  if (op === 'reduction_override_turns') {
    if (!Number.isInteger(p.turns) || p.turns < 1 || p.turns > 100) return '減傷覆寫需1至100回合';
    if (!Number.isInteger(p.percent) || p.percent < 1 || p.percent > 100) return '減傷覆寫需1至100百分比';
    return null;
  }
  if (op === 'seal_used_skill_pp_phase_end') {
    if (typeof p.sameCategory !== 'boolean') return 'PP封印需明確是否含同類型';
    if (!['opp_skill', 'opp_attack', 'opp_status'].includes(trig)) return 'PP封印需正式對手使用事件';
    return null;
  }
  if (op === 'pp_zero_seal') {
    if (typeof p.targetId !== 'string' || !p.targetId || p.targetId.length > 100) return 'PP封印結算需明確個體';
    if (typeof p.name !== 'string' || !p.name || p.name.length > 100) return 'PP封印結算需明確技能名';
    if (p.category !== undefined && typeof p.category !== 'string') return 'PP封印同類型需為技能類別或留空';
    return null;
  }
  if (op === 'until_switch_keys_clear') {
    if (!Array.isArray(p.keys) || !p.keys.length || p.keys.length > 20 || p.keys.some((k: any) => typeof k !== 'string' || !k || k.length > 120)) return '下場清理需有限狀態鍵清單';
    return null;
  }
  if (op === 'timer_consume_all') {
    if (typeof p.id !== 'string' || !p.id || p.id.length > 200) return '計時器清理需有限識別碼';
    return null;
  }
  return null;
}

/** 執行端（併入 runtime 的 OPS）。 */
export function rosterStatsOperations() {
  return {
    temp_stats_by_last: (ctx: BattleEventContext, p: any, st: RunState): boolean => {
      const n = Math.floor(Number(st.lastAmount) || 0);
      const self = resolveSelf(ctx);
      if (!self || n <= 0) return false;
      const stats = { ...self.calculatedStats, hp: self.maxHp };
      const bonus = Math.floor(TEMP_KEYS.reduce((sum, k) => sum + (Number(stats[k]) || 0), 0) * n * p.scale);
      if (!bonus) return false;
      const next: Record<string, number> = { ...stats };
      for (const k of TEMP_KEYS) next[k] += bonus;
      // 原始六維快照（個體鍵）：下場還原用；重複登場覆寫，不複利。
      ctx.setPlayerState(snapshotKey(idOf(self)), { stats: { ...self.calculatedStats }, maxHp: self.maxHp });
      ctx.updateElf(ctx.actor, { calculatedStats: next, maxHp: next.hp } as any);
      ctx.addLog(`👑 【${self.name}】：六維總和×${n}×${Math.round(p.scale * 100)}%＝${bonus}，含體力上限的每一維暫時增加 ${bonus}，直到下場。`, 'effect');
      return true;
    },
    temp_stats_restore: (ctx: BattleEventContext): boolean => {
      const self = resolveSelf(ctx);
      if (!self) return false;
      const snap = ctx.getPlayerState(snapshotKey(idOf(self)));
      if (!snap) return false;
      ctx.updateElf(ctx.actor, { calculatedStats: snap.stats, maxHp: snap.maxHp,
        currentHp: Math.min(Number(self.currentHp) || 0, snap.maxHp) } as any);
      ctx.setPlayerState(snapshotKey(idOf(self)), null);
      ctx.addLog(`👑 【${self.name}】：下場，臨時能力值還原。`, 'effect');
      return true;
    },
    bench_type_stat_transfer: (ctx: BattleEventContext, p: any): boolean => {
      const self = resolveSelf(ctx);
      const target = ctx.target ?? (ctx.targetSide === 'p1' ? (ctx as any).activeP1 : (ctx as any).activeP2);
      if (!self) return false;
      let present = false;
      const gained: Record<string, number> = {};
      for (const side of [ctx.actor, ctx.targetSide] as S[]) {
        for (const e of ctx.getFullTeam(side) || []) {
          if (!e || e.isVanished || !hasType(e, p.type)) continue;
          present = true;
          if (idOf(e) === idOf(self) || (target && idOf(e) === idOf(target))) continue;
          const stats = { ...e.calculatedStats, hp: e.maxHp };
          for (const k of TEMP_KEYS) {
            const amount = Math.floor(Number(stats[k]) * p.ratio);
            stats[k] -= amount; gained[k] = (gained[k] || 0) + amount;
          }
          ctx.updateAnyElf?.(side, idOf(e), { calculatedStats: stats, maxHp: stats.hp,
            currentHp: Math.min(Number(e.currentHp) || 0, stats.hp) } as any);
        }
      }
      if (!present) return false;
      if (Object.keys(gained).length) {
        const next = { ...self.calculatedStats, hp: self.maxHp };
        for (const k of TEMP_KEYS) next[k] = (Number(next[k]) || 0) + (gained[k] || 0);
        ctx.updateElf(ctx.actor, { calculatedStats: next, maxHp: next.hp } as any);
      }
      ctx.addLog(`👑 【${self.name}】：場下${p.type}系精靈能力值降低 ${Math.round(p.ratio * 100)}% 並附加給自身。`, 'effect');
      return true;
    },
    attack_bypass_until_switch: (ctx: BattleEventContext, p: any): boolean => {
      const self = resolveSelf(ctx);
      if (!self) return false;
      if (p.immunity === true) ctx.setPlayerState('ignoreAttackImmunityUntilSwitch', true);
      if ([p.block, p.conversion, p.limit, p.shield].some(Boolean)) ctx.setPlayerState('attackDefenseBypassUntilSwitch', {
        ownerBattleId: idOf(self), block: p.block === true, conversion: p.conversion === true,
        limit: p.limit === true, shield: p.shield === true,
      });
      ctx.addLog(`👑 【${self.name}】：直到下場前無視對手攻擊免疫／抵擋／轉化／傷害限制效果。`, 'effect');
      return true;
    },
    counter_from_last: (ctx: BattleEventContext, _p: any, st: RunState): boolean => {
      ctx.setPlayerState(_p.key, Math.max(0, Math.floor(Number(st.lastAmount) || 0)));
      return true;
    },
    counter_power_ratio: (ctx: BattleEventContext, p: any): boolean => {
      const comp = (ctx as any).powerComp || (ctx as any).effectEventData?.powerComp;
      if (!comp || !Number.isFinite(comp.power)) return false;
      const count = Number(ctx.getPlayerState(p.key)) || 0;
      if (count <= 0) return false;
      const before = comp.power;
      comp.power = comp.power * Math.max(0, 1 - count * p.perUnit);
      if (comp.power !== before) ctx.addLog(`👑 【后】：敵方蟲群計數 ${count}——對手攻擊威力降低 ${Math.round(count * p.perUnit * 100)}%。`, 'effect');
      return true;
    },
    attack_combo_uses_by_last: (ctx: BattleEventContext, p: any, st: RunState): boolean => {
      const n = Math.floor(Number(st.lastAmount) || 0);
      const self = resolveSelf(ctx);
      if (!self || n <= 0 || !p.id) return false;
      (ctx as any).addTimerTo?.(ctx.actor, {
        id: p.id, name: `前${n}次攻擊連擊+1`, kind: 'use_counter', source: 'soulmark',
        remaining: n, tickAt: 'never', scope: 'elf', ownerBattleId: idOf(self), stackRule: 'refresh',
        payload: { block: { trig: 'self_attack', skillKind: '攻擊', consumeOnFire: true, sourceKind: st.sourceKind || 'soul',
          body: [{ acts: [{ op: 'combo_add', p: { amount: 1 }, label: '蟲群連擊+1' }] }] } },
      } as any, false);
      ctx.addLog(`👑 【${self.name}】：接下來 ${n} 次攻擊技能連擊次數+1。`, 'effect');
      return true;
    },
    pp_no_cost: (ctx: BattleEventContext): boolean => {
      const comp = (ctx as any).effectEventData?.ppCostComp;
      if (!comp) return false;
      comp.multiplier = 0;
      return true;
    },
    reduction_override_turns: (ctx: BattleEventContext, p: any): boolean => {
      (ctx as any).addTimerTo?.(ctx.actor, {
        id: 'blk_reduction_override', name: `${p.percent}%減傷覆寫`, kind: 'round_counter', source: 'soulmark',
        remaining: p.turns, tickAt: 'round_end', scope: 'elf', persistsOffField: false,
        payload: { damageReductionOverridePercent: p.percent },
      } as any, (ctx as any).moveIndex === 1);
      ctx.addLog(`👑 【后】：${p.turns} 回合內自身受到非真實傷害降低效果觸發時比例變為 ${p.percent}%。`, 'effect');
      return true;
    },
    // 對手本次使用技能的 PP 封印：身分／技能於建立時快照，戰鬥階段結束（phase_end 計時器觸發）才結算。
    seal_used_skill_pp_phase_end: (ctx: BattleEventContext, p: any, st: RunState): boolean => {
      const skill = (ctx as any).skill || (ctx as any).effectEventData?.skill;
      const target = ctx.target ?? (ctx.targetSide === 'p1' ? (ctx as any).activeP1 : (ctx as any).activeP2);
      if (!skill || !target) return false;
      const category = p.sameCategory ? (skill.category !== '屬性' ? skill.category : null) : null;
      (ctx as any).addTimerTo?.(ctx.actor, {
        id: `blk_pp_seal:${(ctx as any).actionId ?? ctx.roundNumber ?? 0}:${skill.name}`, name: '使用技能PP歸0',
        kind: 'use_counter', source: 'soulmark', remaining: 1, tickAt: 'never', scope: 'elf', stackRule: 'refresh',
        payload: { block: { trig: 'phase_end', consumeOnFire: true, sourceKind: st.sourceKind || 'soul',
          body: [{ acts: [{ op: 'pp_zero_seal', p: { targetId: idOf(target), name: skill.name, category }, label: '使用的技能PP歸0' }] }] } },
      } as any, false);
      return true;
    },
    pp_zero_seal: (ctx: BattleEventContext, p: any): boolean => {
      const holder = (ctx.getFullTeam(ctx.targetSide) || []).find((e: any) => idOf(e) === p.targetId);
      if (!holder) return false;
      const skills = (holder.skills || []).map((s: any) =>
        s.name === p.name || (p.category && s.category === p.category) ? { ...s, pp: 0, currentPp: 0 } : s);
      ctx.updateAnyElf?.(ctx.targetSide, p.targetId, { skills } as any);
      return true;
    },
    until_switch_keys_clear: (ctx: BattleEventContext, p: any): boolean => {
      for (const key of p.keys) ctx.setPlayerState(key, null);
      return true;
    },
    timer_consume_all: (ctx: BattleEventContext, p: any): boolean => {
      const list = ctx.actor === 'p1' ? ctx.p1Timers : ctx.p2Timers;
      const hits = (list || []).filter((t: any) => t.id === p.id);
      for (const _t of hits) ctx.consumeTimer?.(ctx.actor, p.id);
      return hits.length > 0;
    },
  };
}

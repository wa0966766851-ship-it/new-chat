import type { BattleEventContext } from '../../effects/types';
import type { RunState } from '../runtime';
import { applyKitPpOperation } from '../../effects/ppOperations';
import { clearStatuses } from '../../effects/semanticOperations';
import { readMarkStacks } from '../../effects/markQueries';
import { multiplyDamageReduction } from '../../battle/damageReduction';
import { queueActionPowerAdd } from '../../battle/actionDamageModifiers';
import { queueHpDrain } from '../../battle/hpDrain';
import { requestSkillRecalculation } from '../../battle/skillRecalculation';
import {installTeamForcedHit} from '../../battle/forcedHitRules';

export const FINAL_MARS_LAN_DRAGON_ACTION_FIELDS: Record<string, readonly string[]> = {
  recalculate_skill: ['powerMultiplier'],
  team_force_hit: ['untilSkill','powerAdd','perMarkId','perMarkAdd'],
  charge_add: ['amount', 'fromLast', 'onlyBelowMax'],
  charge_if: ['mode', 'body'],
  pp_zero_to_charge: ['count', 'onlyBelowMax'],
  archive_cure: ['key'],
  any_effect: ['body'],
  status_batch_failure: ['statuses', 'turns', 'body'],
  snapshot_resource_rule: ['id', 'name', 'displayChar', 'snapshotKey', 'perRound', 'receiverKey'],
  resource_priority: ['id', 'perUnit'],
  resource_damage_modifier: ['id', 'dir', 'kind', 'perUnit'],
  shield_power_steps: ['step', 'powerPerGroup'],
  receipt_shields: ['ratio', 'shield', 'barrier'],
  hp_difference_damage: ['ratio', 'type', 'doublePerFullPp'],
  resource_query_rule: ['id', 'min', 'ignorePpLimit', 'selfDownAsUp', 'oppUpAsDown', 'ignoreDamageLimit', 'ignoreDamageBlock', 'ignoreAttackImmunity'],
  flag_set: ['key', 'value','thisRound'],
  resource_drain: ['id', 'baseRatio', 'bonusPerGroup', 'step'],
  next_skill_reduction: ['ratio'],
  consume_skill_reduction: [],
};
export function finalMarsLanDragonActionIssue(op: string, p: any, nested?: (body: any[], trig: string) => string | null, trig = 'use'): string | null {
  if(op==='team_force_hit'&&(typeof p.untilSkill!=='string'||!p.untilSkill||typeof p.perMarkId!=='string'||![p.powerAdd,p.perMarkAdd].every(v=>Number.isFinite(v)&&v>=0)))return '全隊強制命中效果需解除技能及有限非負固定威力參數';
  if (op === 'recalculate_skill' && (trig !== 'self_invalid' || !Number.isFinite(p.powerMultiplier) || p.powerMultiplier <= 0)) return '傷害公式重算需技能無效入口及正威力倍率';
  if (op === 'consume_skill_reduction' && trig !== 'incoming') return '下次技能減傷消耗需正式受傷修正入口';
  if (op === 'resource_drain' && (typeof p.id !== 'string' || !(p.baseRatio > 0) || !(p.bonusPerGroup > 0) || !Number.isInteger(p.step) || p.step < 1)) return '印記比例吸取需明確基礎比例、階梯和增幅';
  if (op === 'next_skill_reduction' && (!(p.ratio > 0) || p.ratio > 1)) return '下次技能減傷需0至100%正比例';
  if (op === 'resource_query_rule' && (!['battle_start','use','self_skill'].includes(trig) || typeof p.id !== 'string' || !p.id || !Number.isInteger(p.min) || p.min < 1 || !['ignorePpLimit', 'selfDownAsUp', 'oppUpAsDown'].every(k => typeof p[k] === 'boolean') || !['ignoreDamageLimit','ignoreDamageBlock','ignoreAttackImmunity'].every(k=>p[k]===undefined||typeof p[k]==='boolean'))) return '資源查詢需明確印記門檻與PP/能力視圖旗標';
  if (op === 'flag_set' && (typeof p.key !== 'string' || !p.key || p.key.length > 100 || typeof p.value !== 'boolean'||(p.thisRound!==undefined&&typeof p.thisRound!=='boolean'))) return '旗標需明確有限鍵與布林值';
  if (op === 'snapshot_resource_rule') {
    if (trig !== 'battle_start' || !['id', 'name', 'displayChar', 'snapshotKey', 'receiverKey'].every(k => typeof p[k] === 'string' && p[k].length > 0 && p[k].length <= 100) || !Number.isInteger(p.perRound) || p.perRound < 1 || p.perRound > 10) return '資源快照規則需戰鬥開始、明確個體集合鍵與1至10份數';
  }
  if (op === 'resource_priority' && (trig !== 'modify_priority' || typeof p.id !== 'string' || !Number.isFinite(p.perUnit))) return '印記先制需正式先制節點與明確係數';
  if (op === 'resource_damage_modifier' && (!['incoming', 'outgoing'].includes(trig) || !['in', 'out'].includes(p.dir) || !['技能', '攻擊'].includes(p.kind) || typeof p.id !== 'string' || !(p.perUnit > 0))) return '印記傷害修正需明確方向、類型、比例及傷害節點';
  if (op === 'shield_power_steps' && (trig !== 'outgoing_power' || !(p.step > 0) || !(p.powerPerGroup > 0))) return '護盾階梯威力需威力節點及正階梯與威力';
  if (op === 'receipt_shields' && (trig !== 'attack_hit' || !(p.ratio > 0) || typeof p.shield !== 'boolean' || typeof p.barrier !== 'boolean' || !(p.shield || p.barrier))) return '傷害轉盾需逐擊實際命中節點及明確盾罩';
  if(op==='hp_difference_damage' && p.doublePerFullPp!==undefined && (!Number.isInteger(p.doublePerFullPp)||p.doublePerFullPp<1||p.doublePerFullPp>7))return '滿PP技能翻倍次數需1至7整數';
  if (op === 'hp_difference_damage' && (!(p.ratio > 0) || !['真實', '固定', '百分比'].includes(p.type))) return '體力差值傷害需明確正比例與傷害類別';
  if (op === 'charge_add') {
    if (typeof p.fromLast !== 'boolean' || typeof p.onlyBelowMax !== 'boolean') return '充能增加須明確數值來源與未滿範圍';
    if (!p.fromLast && (!Number.isFinite(p.amount) || p.amount <= 0)) return '充能增加須為正數';
  }
  if (op === 'pp_zero_to_charge' && (!Number.isInteger(p.count) || p.count < 1 || p.count > 10 || typeof p.onlyBelowMax !== 'boolean')) return 'PP轉充能須為1至10個不重複技能與明確範圍';
  if (op === 'archive_cure' && (typeof p.key !== 'string' || !p.key || p.key.length > 100)) return '異常紀錄需明確集合鍵';
  if (op === 'charge_if' && !['any_positive', 'any_zero'].includes(p.mode)) return '充能條件需明確正充能或零充能';
  if (op === 'status_batch_failure' && (!Array.isArray(p.statuses) || !p.statuses.length || p.statuses.length > 10 || !p.statuses.every((n: any) => typeof n === 'string') || !Number.isInteger(p.turns) || p.turns < 1)) return '異常批次需明確狀態及回合';
  if (op === 'charge_if' || op === 'any_effect' || op === 'status_batch_failure') {
    if (!Array.isArray(p.body) || !p.body.length) return '條件或合併結果需非空主體';
    return nested?.(p.body, trig) || null;
  }
  return null;
}
export function finalMarsLanDragonOperations(h: { liveElf: (ctx: BattleEventContext, side: 'p1' | 'p2') => any; runStmts: (ctx: BattleEventContext, body: any[], st: RunState) => void; dealDamage: (ctx: BattleEventContext, side: 'p1' | 'p2', amount: number, type: string, elem?: string, st?: RunState) => number }) {
  const addCharge = (ctx: BattleEventContext, amount: number, onlyBelowMax: boolean) => {
    const e = h.liveElf(ctx, ctx.actor); let changed = false;
    const skills = e.skills.map((sk: any) => {
      const charge = Math.max(0, Number(sk.charge ?? sk.pp) || 0);
      if (!(amount > 0) || (onlyBelowMax && charge >= sk.maxPp)) return sk;
      changed = true; return { ...sk, charge: charge + amount };
    });
    if (changed) ctx.updateElf(ctx.actor, { skills });
    return changed;
  };
  return {
    team_force_hit: (ctx:BattleEventContext,p:any)=>installTeamForcedHit(ctx,p),
    recalculate_skill: (ctx: BattleEventContext, p: any, st: RunState) => st.event?.data?.invalid === true && requestSkillRecalculation(ctx, { powerMultiplier: p.powerMultiplier }),
    next_skill_reduction: (ctx: BattleEventContext, p: any) => {
      ctx.setPlayerState('resourceNextSkillReduction', { ownerBattleId: ctx.self.battleId || ctx.self.id, ratio: p.ratio });
      return true;
    },
    consume_skill_reduction: (ctx: BattleEventContext, _p: any, st: RunState) => {
      const pending = ctx.getPlayerState('resourceNextSkillReduction'), comp = st.event?.data?.damageComp || st.event?.data;
      if (!pending || pending.ownerBattleId !== (ctx.self.battleId || ctx.self.id) || !comp?.isIncoming || !String(comp.damageCategory).startsWith('skill')) return false;
      multiplyDamageReduction(comp, 1 - pending.ratio);
      ctx.setPlayerState('resourceNextSkillReduction', null); return true;
    },
    resource_drain: (ctx: BattleEventContext, p: any, st: RunState) => {
      const ratio = p.baseRatio + Math.floor(readMarkStacks(ctx, { side: 'self', id: p.id }) / p.step) * p.bonusPerGroup;
      st.lastAmount = queueHpDrain(ctx, ctx.targetSide, h.liveElf(ctx, ctx.targetSide).maxHp * ratio, 'percent'); return st.lastAmount > 0;
    },
    flag_set: (ctx: BattleEventContext, p: any) => { ctx.setPlayerState(p.key, p.value); if(p.thisRound)ctx.setPlayerState(p.key+':round',ctx.roundNumber); return true; },
    resource_query_rule: (ctx: BattleEventContext, p: any) => {
      const e = h.liveElf(ctx, ctx.actor), rules = e.resourceQueryRules || [];
      ctx.updateAnyElf(ctx.actor, e.battleId || e.id, { resourceQueryRules: [...rules.filter((r: any) => !(r.id === p.id && r.min === p.min)), { ...p }] } as any);
      return true;
    },
    snapshot_resource_rule: (ctx: BattleEventContext, p: any) => {
      const e = h.liveElf(ctx, ctx.actor);
      ctx.updateAnyElf(ctx.actor, e.battleId || e.id, { snapshotResourceRules: { ...e.snapshotResourceRules, [p.id]: { ...p } }, snapshotResourceRoundStamps: {} } as any);
      return true;
    },
    resource_priority: (ctx: BattleEventContext, p: any, st: RunState) => {
      const comp = st.event?.data?.priorityComp || (ctx as any).effectEventData?.priorityComp;
      if (!comp) return false;
      comp.bonus += readMarkStacks(ctx, { side: 'self', id: p.id }) * p.perUnit; return true;
    },
    resource_damage_modifier: (ctx: BattleEventContext, p: any, st: RunState) => {
      const comp = st.event?.data?.damageComp || st.event?.data;
      if (!comp || (p.dir === 'in') !== !!comp.isIncoming || !(p.kind === '攻擊' ? comp.damageCategory === 'skill_attack' : String(comp.damageCategory).startsWith('skill'))) return false;
      const value = readMarkStacks(ctx, { side: 'self', id: p.id }) * p.perUnit;
      if (p.dir === 'in') multiplyDamageReduction(comp, Math.max(0, 1 - value)); else comp.increasePercent = (comp.increasePercent || 0) + value;
      return value > 0;
    },
    shield_power_steps: (ctx: BattleEventContext, p: any, st: RunState) => {
      if (!ctx.skill || ctx.skill.category === '屬性') return false;
      const total = [h.liveElf(ctx, ctx.actor), h.liveElf(ctx, ctx.targetSide)].reduce((sum, e) => sum + (e.shield || 0) + (e.barrier || 0), 0);
      queueActionPowerAdd(ctx, Math.floor(total / p.step) * p.powerPerGroup); return true;
    },
    receipt_shields: (ctx: BattleEventContext, p: any, st: RunState) => {
      const data = st.event?.data || (ctx as any).effectEventData;
      const amount = Math.floor(Math.max(0, Number(data?.damage ?? data?.hpReduced ?? ctx.mainSkillHpReduced) || 0) * p.ratio);
      if (!amount) return false;
      const e = h.liveElf(ctx, ctx.actor);
      if (p.shield) ctx.applyShield(ctx.actor, amount);
      if (p.barrier) ctx.updateElf(ctx.actor, { barrier: (h.liveElf(ctx, ctx.actor).barrier || 0) + amount });
      return true;
    },
    hp_difference_damage: (ctx: BattleEventContext, p: any, st: RunState) => {
      const full = [ctx.actor, ctx.targetSide].reduce((n, side) => n + (h.liveElf(ctx, side).skills || []).filter((sk:any) => sk.maxPp > 0 && sk.pp === sk.maxPp).length, 0);
      const amount = Math.floor(Math.abs(h.liveElf(ctx, ctx.actor).currentHp - h.liveElf(ctx, ctx.targetSide).currentHp) * p.ratio * 2 ** (full * (p.doublePerFullPp || 0)));
      if (!amount) return false;
      st.lastAmount = h.dealDamage(ctx, ctx.targetSide, amount, p.type, undefined, st); return true;
    },
    status_batch_failure: (ctx: BattleEventContext, p: any, st: RunState) => {
      let failed = false;
      for (const status of p.statuses) if (!ctx.applyStatusWithImmunityCheck(ctx.targetSide, status, p.turns).success) failed = true;
      if (failed) h.runStmts(ctx, p.body, st);
      return true;
    },
    charge_add: (ctx: BattleEventContext, p: any, st: RunState) => addCharge(ctx, p.fromLast ? st.lastAmount : p.amount, p.onlyBelowMax),
    charge_if: (ctx: BattleEventContext, p: any, st: RunState) => {
      const match = h.liveElf(ctx, ctx.actor).skills.some((sk: any) => p.mode === 'any_positive' ? (sk.charge ?? sk.pp) > 0 : (sk.charge ?? sk.pp) === 0);
      if (!match) return false;
      h.runStmts(ctx, p.body, st); return st.last === true;
    },
    any_effect: (ctx: BattleEventContext, p: any, st: RunState) => {
      let any = false;
      for (const stmt of p.body) { h.runStmts(ctx, [stmt], st); any ||= st.last === true; }
      return any;
    },
    archive_cure: (ctx: BattleEventContext, p: any) => {
      const e = h.liveElf(ctx, ctx.actor);
      const names = Object.entries(ctx.getStatuses(e) || {}).filter(([, n]) => Number(n) > 0).map(([name]) => name);
      if (!names.length) return false;
      clearStatuses(ctx, ctx.actor, e, name => names.includes(name));
      const removed = names.filter(name => !Number(ctx.getStatuses(h.liveElf(ctx, ctx.actor))?.[name]));
      if (removed.length) ctx.setPlayerState(p.key, [...new Set([...(ctx.getPlayerState(p.key) || []), ...removed])]);
      return removed.length > 0;
    },
    pp_zero_to_charge: (ctx: BattleEventContext, p: any, st: RunState) => {
      const e = h.liveElf(ctx, ctx.targetSide), before = e.skills.map((sk: any) => Number(sk.pp) || 0);
      const pool = e.skills.map((_: any, i: number) => i).filter((i: number) => before[i] > 0), chosen = new Set<number>();
      const rng = ctx.rng || Math.random;
      while (pool.length && chosen.size < p.count) chosen.add(pool.splice(Math.min(pool.length - 1, Math.floor(rng() * pool.length)), 1)[0]);
      applyKitPpOperation(ctx, ctx.targetSide, 'zero', 0, sk => chosen.has(e.skills.indexOf(sk)));
      const after = h.liveElf(ctx, ctx.targetSide).skills;
      st.lastAmount = [...chosen].reduce((sum, i) => sum + Math.max(0, before[i] - (after[i]?.pp || 0)), 0);
      // 使用實際降低量；免疫PP清除時不憑名目PP補充充能。
      return st.lastAmount > 0 && addCharge(ctx, st.lastAmount, p.onlyBelowMax);
    },
  };
}

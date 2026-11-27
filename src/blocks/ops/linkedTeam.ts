// 全隊逐隻印記／共生召回／能力等級翻轉等通用件（2026-11-21；趙雲、晻藹夜靈.布萊克、虯螭淵玄.索蘭特首用）。
// 只以參數表達對象（陣營、名稱片段、印記識別碼），不含任何精靈專屬分支。
import { FATAL_SEAL_DESCRIPTION, FATAL_SEAL_MARK_ID } from '../../battle/fatalHold';
import { checkElfDead } from '../../battle/elfAlive';
import type { BattleEventContext } from '../../effects/types';
import type { RunState } from '../runtime';
import { applyMarkProgram, markProgramIssue, MARK_PROGRAM_FIELDS } from '../../effects/markProgram';
import { readMarkStacks } from '../../effects/markQueries';
import { EffectTiming } from '../../effects/types';
import { queueActionDamageModifier } from '../../battle/actionDamageModifiers';
import { timed as addConstraint } from '../../effects/newElfOperations';

type S = 'p1' | 'p2';
const idOf = (e: any) => String(e?.battleId || e?.id || '');
const STAT_KEYS = ['atk', 'def', 'spatk', 'spdef', 'speed', 'accuracy'] as const;
const alive = (e: any) => !!e && !e.isVanished && !e.isExtra && Number(e.currentHp) > 0;
const nameHas = (e: any, names: string[]) => names.some(n => String(e?.name || '').includes(n));
const text = (v: any, max = 200) => typeof v === 'string' && !!v && v.length <= max;
const names = (v: any) => Array.isArray(v) && v.length >= 1 && v.length <= 8 && v.every((n: any) => text(n, 40));
const resourceFields = ['id', 'name', 'displayChar', 'unit', 'description', 'maxCount'];
const resourceIssue = (p: any) => {
  for (const key of ['id', 'name', 'displayChar']) if (!text(p[key])) return '資源印記需完整識別碼、名稱與顯示字';
  if (!text(p.description, 100000)) return '資源印記需說明';
  if (!['層', '道', '點', '篇', '枚', '株', '回合'].includes(p.unit)) return '資源印記單位不明';
  if (!Number.isSafeInteger(p.maxCount) || p.maxCount < 1 || p.maxCount > 10000) return '資源印記需有效上限';
  return null;
};

export const LINKED_TEAM_ACTION_FIELDS: Record<string, readonly string[]> = {
  // 為指定陣營「每隻存活精靈（含背包）」各附加一份逐隻印記程式；印記規則仍只在持有者在場時執行。
  mark_program_team: ['team', ...MARK_PROGRAM_FIELDS.filter(k => k !== 'side')],
  // 印記規則內：消耗目前印記指定層數（歸零即移除）；tallyKey 另記入指定陣營的消耗計數。
  mark_consume_current: ['amount', 'tallySide', 'tallyKey'],
  // 讀取自身陣營的消耗計數並清零，換成等量資源印記（持有者＝自身）。
  resource_mark_from_tally: ['key', ...resourceFields],
  // 隨機抽 count 項能力：對手與自身同一批能力各變化 v（同方向）。
  stat_random_shared: ['count', 'v'],
  // 本次行動附加到自身的能力下降改為下降量×mult 的提升（先抵銷再提升）。
  stage_flip_down: ['mult'],
  // 吸取（自身提升等級＋對手下降等級…）×unit；perMarkId＝再乘自身該資源印記層數。
  drain_stage_levels: ['unit', 'terms', 'perMarkId'],
  // 恢復持有者（可在背包）與己方在場精靈各 amount 體力。
  heal_holder_and_active: ['amount'],
  // 為己方名稱含指定片段的存活精靈各附加資源印記；onlyIfMissing＝只補給未持有者。
  resource_mark_team_named: ['names', 'amount', 'onlyIfMissing', ...resourceFields],
  // 共生循環：戰鬥開始記錄夥伴（名稱片段）與其能力值；可同時放入不可使用的顯示道具。
  partner_link: ['names', 'key', 'itemId'],
  // 共生循環：夥伴已被擊敗且已記錄 → 重生（恢復記錄的能力值）並移到己方背包末位；每組一次。
  partner_revive: ['names', 'key'],
  // 下次受到的技能傷害轉為等量護盾與護罩（受到傷害前入口）。
  incoming_skill_to_shields: [],
  // 對手既有護盾／護罩調整為 cap（包括低於 cap 者），持有者承受差值真實傷害（至多當前體力-1）。
  opp_shield_cap_with_cost: ['cap'],
  // 對敵方背包每隻存活精靈造成 flat 點指定分類傷害；每隻體力未減少（免疫）令本次攻擊傷害×mult（乘算）。
  bench_probe_boost: ['flat', 'type', 'mult'],
  // N回合內對手受到的固定／百分比傷害轉為真實傷害。
  incoming_true_turns: ['turns'],
  // 自身能力提升等級×mult（上限仍由能力變化結算）。
  stage_scale_up: ['mult'],
  // 對手能力提升轉移到自身、能力下降反轉後附加到自身（對手清空兩者）。
  stage_absorb_all: [],
  // 每有1項能力提升（及每1枚指定資源印記視為1項）附加 flat 點指定分類傷害。
  dmg_per_stage_items: ['flat', 'type', 'perMarkId'],
  // 本回合自身先制+amount 時，抵銷對手等量正先制（「無視對手同等級先制」；讀取端 effects/skillProperty）。
  priority_offset_round: ['amount'],
  // 為己方名稱含片段的精靈剝離指定屬性（精靈與所有技能屬性），本場有效。
  strip_type_team_named: ['names', 'type'],
  // 從指定陣營道具欄移除道具（全部持有量）。
  item_discard: ['side', 'itemId'],
  // 令對方在場精靈下次觸發致死保留體力效果後，本場無法再觸發（battle/fatalHold）。
  seal_fatal_resist: ['side'],
  stage_view_rule: ['selfUpAsOppDown'],
  // 依序附加異常；對手不存在非次數類異常免疫時，逐項持續嘗試直到對手不存在次數免疫為止，再附加後續各項。
  status_seq_until_success: ['list', 'loopList', 'turns'],
  // 恢復自身擁有護盾＋護罩總和×ratio 的體力。
  heal_shield_sum: ['ratio'],
  // 吸取 min～max 之間的隨機固定量。
  drain_random: ['min', 'max'],
  // 雙方所有能力等級各自隨機變為 min～max。
  stage_randomize: ['min', 'max'],
  // 與對手交換自身低於對手的能力等級。
  stage_swap_lower: [],
  // 本回合受到非真實傷害降低 reduce、下次攻擊造成非真實傷害提升 boost；雙方每項異常各增加 perStatus 次增傷翻倍與減傷乘算；cap 保留舊資料相容。
  status_doubling_mods: ['reduce', 'boost', 'cap', 'perStatus'],
};

export const LINKED_TEAM_CONDITION_FIELDS: Record<string, readonly string[]> = {
  // 指定方在場精靈名稱含任一片段。
  name_has: ['side', 'names', 'neg'],
  // 雙方任意一方存在PP低於 amount 的技能（neg＝雙方皆無）。
  pp_below_either: ['amount', 'neg'],
  // 對手當回合選擇的是必中技能。
  opp_selected_sure: ['neg'],
};

export function linkedTeamConditionIssue(c: any): string | undefined {
  if (c?.c === 'opp_selected_sure') return c.p?.neg === undefined || typeof c.p.neg === 'boolean' ? undefined : '反向需布林值';
  if (c?.c === 'pp_below_either') return Number.isSafeInteger(c.p?.amount) && c.p.amount >= 1 && c.p.amount <= 999 && (c.p.neg === undefined || typeof c.p.neg === 'boolean') ? undefined : 'PP門檻需正整數';
  if (c?.c !== 'name_has') return undefined;
  if (!['self', 'opp'].includes(c.p?.side) || !names(c.p?.names)) return '名稱條件需明確對象與1至8個名稱片段';
  return undefined;
}

export function linkedTeamEvalCond(ctx: BattleEventContext, c: any, liveElf: (ctx: BattleEventContext, side: S) => any): boolean | undefined {
  if (c?.c === 'opp_selected_sure') {
    const sk: any = (ctx as any).opponentSkill;
    const sure = !!sk?.name && (sk.isSureHit === true || (sk.kit || []).some((k: any) => k.codeId === 'sure_hit' || k.params?.property === 'sure_hit'));
    return c.p?.neg ? !sure : sure;
  }
  if (c?.c === 'pp_below_either') {
    const low = [ctx.actor, ctx.targetSide].some(side => (liveElf(ctx, side)?.skills || []).some((s: any) => Number.isFinite(s.pp) && s.pp < c.p.amount));
    return c.p.neg ? !low : low;
  }
  if (c?.c !== 'name_has') return undefined;
  const side = c.p.side === 'self' ? ctx.actor : ctx.targetSide;
  const hit = nameHas(liveElf(ctx, side), c.p.names);
  return c.p.neg ? !hit : hit;
}

export function linkedTeamActionIssue(op: string, p: any, trig: string, inMark: boolean): string | null {
  if (op === 'mark_program_team') {
    if (!['self', 'opp'].includes(p.team) || 'side' in p) return '全隊印記需以 team 指定陣營';
    if (p.scope !== 'elf') return '全隊印記程式需逐隻作用域';
    const { team, ...program } = p;
    return markProgramIssue({ ...program, side: 'self' });
  }
  if (op === 'mark_consume_current') {
    if (!inMark) return '消耗目前印記只能用於印記規則';
    if (!Number.isSafeInteger(p.amount) || p.amount < 1 || p.amount > 10000) return '消耗層數需正整數';
    if ((p.tallyKey !== undefined || p.tallySide !== undefined) && (!/^[a-zA-Z][a-zA-Z0-9]{0,79}$/.test(p.tallyKey || '') || !['self', 'opp'].includes(p.tallySide))) return '消耗計數需合法鍵名與陣營';
    return null;
  }
  if (op === 'resource_mark_from_tally') return /^[a-zA-Z][a-zA-Z0-9]{0,79}$/.test(p.key || '') ? resourceIssue(p) : '計數需合法鍵名';
  if (op === 'stat_random_shared') return Number.isSafeInteger(p.count) && p.count >= 1 && p.count <= 6 && Number.isSafeInteger(p.v) && p.v !== 0 && Math.abs(p.v) <= 6 ? null : '隨機能力需1至6項與非零等級';
  if (op === 'stage_flip_down') return Number.isSafeInteger(p.mult) && p.mult >= 1 && p.mult <= 4 ? null : '翻轉倍率需1至4整數';
  if (op === 'drain_stage_levels') {
    if (!(p.unit > 0 && p.unit <= 10000)) return '每級吸取量需正數';
    if (!Array.isArray(p.terms) || !p.terms.length || p.terms.length > 4 || !p.terms.every((t: any) => ['self_up', 'opp_down'].includes(t))) return '吸取等級來源需為自身提升／對手下降';
    if (p.perMarkId !== undefined && !text(p.perMarkId)) return '印記倍率需識別碼';
    return null;
  }
  if (op === 'heal_holder_and_active') return Number.isSafeInteger(p.amount) && p.amount > 0 && p.amount <= 1e6 ? null : '恢復量需正整數';
  if (op === 'resource_mark_team_named') {
    if (!names(p.names) || !Number.isSafeInteger(p.amount) || p.amount < 1 || p.amount > 10000 || (p.onlyIfMissing !== undefined && typeof p.onlyIfMissing !== 'boolean')) return '名稱資源印記需名稱片段與正整數層數';
    return resourceIssue(p);
  }
  if (op === 'partner_link') {
    if (!names(p.names) || !/^[a-zA-Z][a-zA-Z0-9]{0,79}$/.test(p.key || '') || (p.itemId !== undefined && !text(p.itemId))) return '共生紀錄需夥伴名稱與合法鍵名';
    if (!['battle_start', 'entrance'].includes(trig)) return '共生紀錄只能在戰鬥開始或登場時建立';
    return null;
  }
  if (op === 'partner_revive') return names(p.names) && /^[a-zA-Z][a-zA-Z0-9]{0,79}$/.test(p.key || '') ? null : '共生召回需夥伴名稱與合法鍵名';
  if (op === 'incoming_skill_to_shields') return trig === 'incoming_skill' ? null : '技能傷害轉護盾只能在受到技能傷害前';
  if (op === 'bench_probe_boost') return Number.isSafeInteger(p.flat) && p.flat > 0 && p.flat <= 1e6 && ['fixed', 'true'].includes(p.type) && Number.isFinite(p.mult) && p.mult > 1 && p.mult <= 100 ? null : '背包試探需正整數傷害、固定／真實分類與倍率';
  if (op === 'stage_scale_up') return Number.isSafeInteger(p.mult) && p.mult >= 2 && p.mult <= 4 ? null : '提升倍率需2至4整數';
  if (op === 'heal_shield_sum') return p.ratio > 0 && p.ratio <= 10 ? null : '護盾恢復比例需正數';
  if (op === 'drain_random') return Number.isSafeInteger(p.min) && Number.isSafeInteger(p.max) && p.min > 0 && p.max >= p.min && p.max <= 1e6 ? null : '隨機吸取需正整數範圍';
  if (op === 'stage_randomize') return Number.isSafeInteger(p.min) && Number.isSafeInteger(p.max) && p.min >= -6 && p.max <= 6 && p.max > p.min ? null : '隨機能力等級需-6至6範圍';
  if (op === 'status_doubling_mods') return p.reduce > 0 && p.reduce <= 1 && p.boost > 0 && p.boost <= 100 && (p.perStatus === undefined || Number.isSafeInteger(p.perStatus) && p.perStatus > 0 && p.perStatus <= 100) ? null : '異常乘算需減傷0至1、增傷正數與每項正整數次數';
  if (op === 'dmg_per_stage_items') return Number.isSafeInteger(p.flat) && p.flat > 0 && p.flat <= 1e5 && ['固定', '真實', '百分比'].includes(p.type) && (p.perMarkId === undefined || text(p.perMarkId)) ? null : '每項附加傷害需正整數、分類與印記識別碼';
  if (op === 'priority_offset_round') return Number.isSafeInteger(p.amount) && p.amount >= 1 && p.amount <= 6 ? null : '抵銷先制需1至6整數';
  if (op === 'strip_type_team_named') return names(p.names) && text(p.type, 20) ? null : '剝離屬性需名稱片段與屬性';
  if (op === 'item_discard') return ['self', 'opp'].includes(p.side) && text(p.itemId, 100) ? null : '移除道具需陣營與道具識別碼';
  if (op === 'seal_fatal_resist') return ['self', 'opp'].includes(p.side) ? null : '封印致死保留需明確對象';
  if (op === 'stage_view_rule') return p.selfUpAsOppDown === true && (trig === undefined || ['battle_start', 'entrance'].includes(trig)) ? null : '能力視圖規則需戰鬥開始或登場設定，並明確旗標';
  if (op === 'status_seq_until_success') return [p.list, p.loopList].every(l => Array.isArray(l) && l.length >= 1 && l.length <= 6 && l.every((x: any) => text(x, 20))) && Number.isSafeInteger(p.turns) && p.turns >= 1 && p.turns <= 99 ? null : '循環附加需異常清單與回合';
  if (op === 'incoming_true_turns') return Number.isSafeInteger(p.turns) && p.turns >= 1 && p.turns <= 99 ? null : '轉真實需正整數回合';
  if (op === 'opp_shield_cap_with_cost') return Number.isSafeInteger(p.cap) && p.cap >= 0 && p.cap <= 1e6 ? null : '護盾上限需非負整數';
  return null;
}

export function linkedTeamOperations(helpers: { liveElf: (ctx: BattleEventContext, side: S) => any; runStmts: (ctx: BattleEventContext, body: any[], st: RunState) => void }) {
  const { liveElf } = helpers;
  const sideOf = (ctx: BattleEventContext, s: string): S => s === 'opp' ? ctx.targetSide : ctx.actor;
  const addResource = (ctx: BattleEventContext, side: S, owner: any, p: any, amount: number) => {
    const ownerId = idOf(owner);
    const previous = ctx.getMarks(side).find(m => m.id === p.id && m.ownerBattleId === ownerId);
    const before = previous?.count || 0, count = Math.min(p.maxCount, before + amount);
    if (count === before) return false;
    ctx.setMark({ ...previous, id: p.id, name: p.name, displayChar: p.displayChar, unit: p.unit, description: p.description, count, maxCount: p.maxCount,
      scope: 'elf', ownerBattleId: ownerId, persistsOffField: true, clearable: false } as any, side);
    ctx.emitElfEvent?.(side, owner, EffectTiming.RESOURCE_CHANGED, { side, targetBattleId: ownerId, id: p.id, before, after: count });
    return true;
  };
  const stageSum = (elf: any, up: boolean) => Object.values(elf?.statStages || {}).reduce((n: number, v: any) => n + (typeof v === 'number' && (up ? v > 0 : v < 0) ? Math.abs(v) : 0), 0);
  return {
    mark_program_team: (ctx: BattleEventContext, p: any): boolean => {
      const side = sideOf(ctx, p.team);
      const { team, ...program } = p;
      const local = { ...program, side: 'self' };
      let any = false;
      for (const elf of (ctx.getFullTeam(side) || []).filter(alive)) {
        // applyMarkProgram 以 actor 為 self 側；換成目標陣營的視角後附加，ownerBattleId 為該隻精靈。
        const frame = Object.assign(Object.create(ctx), { actor: side, targetSide: side === 'p1' ? 'p2' : 'p1' });
        any = applyMarkProgram(frame, structuredClone(local), elf) || any;
      }
      if (any) ctx.addLog(`🔖 ${side === ctx.actor ? '己方' : '對方'}全隊精靈各獲得【${p.name}】${p.count}${p.unit}！`, 'effect');
      return any;
    },
    mark_consume_current: (ctx: BattleEventContext, p: any, st: RunState): boolean => {
      const ref = (st as any).holderMark;
      if (!ref) return false;
      const side = ctx.actor;
      const mark = ctx.getMarks(side).find(m => m.id === ref.id && (m.ownerBattleId || null) === (ref.ownerBattleId || null));
      if (!mark || !(mark.count > 0)) return false;
      const used = Math.min(mark.count, p.amount), left = mark.count - used;
      if (left > 0) ctx.setMark({ ...mark, count: left }, side); else ctx.clearMark(mark.id, side, mark.ownerBattleId || null);
      if (p.tallyKey) {
        const tallySide = p.tallySide === 'opp' ? ctx.targetSide : ctx.actor;
        const set = tallySide === ctx.actor ? ctx.setPlayerState : ctx.setOpponentState;
        const get = tallySide === ctx.actor ? ctx.getPlayerState : ctx.getOpponentState;
        set(p.tallyKey, (Number(get(p.tallyKey)) || 0) + used);
      }
      ctx.addLog(`🔖 【${mark.name}】消耗 ${used}${mark.unit || '層'}（剩餘 ${left}）。`, 'effect');
      return true;
    },
    resource_mark_from_tally: (ctx: BattleEventContext, p: any): boolean => {
      const amount = Math.floor(Number(ctx.getPlayerState(p.key)) || 0);
      if (amount <= 0) return false;
      ctx.setPlayerState(p.key, 0);
      const ok = addResource(ctx, ctx.actor, liveElf(ctx, ctx.actor), p, amount);
      if (ok) ctx.addLog(`🔖 【${ctx.self.name}】依累計消耗獲得 ${amount}${p.unit}【${p.name}】！`, 'effect');
      return ok;
    },
    stat_random_shared: (ctx: BattleEventContext, p: any): boolean => {
      const picks = (ctx.shuffleArray ? ctx.shuffleArray([...STAT_KEYS]) : [...STAT_KEYS]).slice(0, p.count);
      const changes = Object.fromEntries(picks.map(k => [k, p.v]));
      const opp = ctx.applyStatChange(ctx.targetSide, changes)?.success === true;
      const before = { ...(liveElf(ctx, ctx.actor)?.statStages || {}) };
      ctx.applyStatChange(ctx.actor, changes);
      const after = liveElf(ctx, ctx.actor)?.statStages || {};
      // 記錄本次實際附加到自身的下降量，供「自身獲得等同能力下降N倍的提升」讀取（同一行動內）。
      const received = Object.fromEntries(STAT_KEYS.map(k => [k, Math.min(0, Number(after[k] || 0) - Number(before[k] || 0))]).filter(([, v]) => Number(v) < 0));
      ctx.setPlayerState('stageSharedReceived', { round: ctx.roundNumber, action: ctx.actionId, received });
      return opp;
    },
    stage_flip_down: (ctx: BattleEventContext, p: any): boolean => {
      // 本次行動附加到自身的能力下降：先抵銷，再獲得下降量×mult 的提升（-1 → +2）。
      const rec = ctx.getPlayerState('stageSharedReceived');
      const received: Record<string, number> = rec && rec.round === ctx.roundNumber && rec.action === ctx.actionId ? rec.received || {} : {};
      const changes: Record<string, number> = {};
      for (const [k, v] of Object.entries(received)) if (v < 0) changes[k] = -v * (p.mult + 1);
      ctx.setPlayerState('stageSharedReceived', undefined);
      if (!Object.keys(changes).length) return false;
      return ctx.applyStatChange(ctx.actor, changes)?.success === true;
    },
    drain_stage_levels: (ctx: BattleEventContext, p: any): boolean => {
      const self = liveElf(ctx, ctx.actor), opp = liveElf(ctx, ctx.targetSide);
      const levels = (p.terms as string[]).reduce((n: number, t) => n + Number(t === 'self_up' ? stageSum(self, true) : stageSum(opp, false)), 0);
      const marks = p.perMarkId ? readMarkStacks(ctx, { side: 'self', id: p.perMarkId }) : 1;
      const amount = Math.floor(levels * marks * p.unit);
      if (amount <= 0) return false;
      ctx.applyAbsorb(ctx.targetSide, amount, '等級吸取');
      return true;
    },
    heal_holder_and_active: (ctx: BattleEventContext, p: any): boolean => {
      const holder = liveElf(ctx, ctx.actor), active = ctx.actor === 'p1' ? ctx.activeP1 : ctx.activeP2;
      const ids = [...new Set([idOf(holder), idOf(active)].filter(Boolean))];
      let any = false;
      for (const id of ids) {
        const elf = (ctx.getFullTeam(ctx.actor) || []).find(e => idOf(e) === id);
        if (!alive(elf)) continue;
        if (ctx.applyHealToElf) ctx.applyHealToElf(ctx.actor, id, p.amount); else ctx.applyHeal(ctx.actor, p.amount);
        any = true;
      }
      return any;
    },
    resource_mark_team_named: (ctx: BattleEventContext, p: any): boolean => {
      let any = false;
      for (const elf of (ctx.getFullTeam(ctx.actor) || []).filter(e => alive(e) && nameHas(e, p.names))) {
        if (p.onlyIfMissing && ctx.getMarks(ctx.actor).some(m => m.id === p.id && m.ownerBattleId === idOf(elf) && m.count > 0)) continue;
        if (addResource(ctx, ctx.actor, elf, p, p.amount)) { any = true; ctx.addLog(`🔖 【${elf.name}】獲得 ${p.amount}${p.unit}【${p.name}】！`, 'effect'); }
      }
      return any;
    },
    partner_link: (ctx: BattleEventContext, p: any): boolean => {
      const self = liveElf(ctx, ctx.actor);
      const partner = (ctx.getFullTeam(ctx.actor) || []).find(e => alive(e) && idOf(e) !== idOf(self) && nameHas(e, p.names));
      if (!partner) return false;
      const key = `${p.key}:${idOf(partner)}`;
      if (ctx.getPlayerState(key)) return false;
      ctx.setPlayerState(key, { holder: idOf(self), maxHp: partner.maxHp, calculatedStats: structuredClone(partner.calculatedStats || {}), used: false });
      if (p.itemId && ctx.grantBattleItem && !ctx.getBattleItem?.(ctx.actor, p.itemId)?.left) ctx.grantBattleItem(ctx.actor, p.itemId, 1);
      ctx.addLog(`♾️ 【${self.name}】與【${partner.name}】計入共生循環，互相記錄能力值。`, 'effect');
      return true;
    },
    partner_revive: (ctx: BattleEventContext, p: any): boolean => {
      const self = liveElf(ctx, ctx.actor);
      for (const partner of (ctx.getFullTeam(ctx.actor) || []).filter(e => !e.isVanished && !e.isExtra && idOf(e) !== idOf(self) && nameHas(e, p.names) && checkElfDead(e))) {
        const key = `${p.key}:${idOf(partner)}`;
        const record = ctx.getPlayerState(key);
        if (!record || record.used) continue;
        ctx.setPlayerState(key, { ...record, used: true });
        const skills = (partner.skills || []).map((s: any) => ({ ...s, currentPp: s.maxPp ?? s.pp, pp: s.maxPp ?? s.pp }));
        ctx.updateAnyElf(ctx.actor, idOf(partner), { maxHp: record.maxHp, currentHp: record.maxHp, calculatedStats: { ...partner.calculatedStats, ...record.calculatedStats },
          statStages: { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0, accuracy: 0 }, battleStatuses: {}, skills, deathImmunity: undefined, fatalHold: undefined } as any);
        ctx.moveElfToEnd?.(ctx.actor, idOf(partner));
        ctx.addLog(`♾️ 共生循環：【${partner.name}】被召回己方背包末位並重生！`, 'effect');
        return true;
      }
      return false;
    },
    incoming_skill_to_shields: (ctx: BattleEventContext, _p: any, st: RunState): boolean => {
      const comp = st.event?.data?.damageComp;
      if (!comp?.isIncoming || !String(comp.damageCategory || '').startsWith('skill')) return false;
      comp.damageConversions ??= new Map();
      comp.damageConversions.set('skillToShields', (amount: number) => {
        if (!(amount > 0)) return;
        ctx.applyShield(ctx.actor, amount);
        const elf = liveElf(ctx, ctx.actor);
        ctx.updateElf(ctx.actor, { barrier: Math.max(0, Number((elf as any)?.barrier) || 0) + amount } as any);
        ctx.addLog(`🛡️ 【${ctx.self.name}】將 ${amount} 點技能傷害轉化為等量護盾與護罩！`, 'effect');
      });
      return true;
    },
    opp_shield_cap_with_cost: (ctx: BattleEventContext, p: any): boolean => {
      const opp = liveElf(ctx, ctx.targetSide), holder = liveElf(ctx, ctx.actor);
      const shield = Number(opp?.shield) || 0, barrier = Number((opp as any)?.barrier) || 0;
      const diff = (shield > 0 ? Math.abs(shield - p.cap) : 0) + (barrier > 0 ? Math.abs(barrier - p.cap) : 0);
      if (diff <= 0) return false;
      ctx.updateAnyElf(ctx.targetSide, idOf(opp), { ...(shield > 0 ? { shield: p.cap } : {}), ...(barrier > 0 ? { barrier: p.cap } : {}) } as any);
      const cost = Math.min(diff, Math.max(0, Number(holder?.currentHp || 0) - 1));
      if (cost > 0) ctx.applyTrueDamageToElf ? ctx.applyTrueDamageToElf(ctx.actor, idOf(holder), cost, '護盾壓制代價') : ctx.applyTrueDamage(ctx.actor, cost, '護盾壓制代價');
      ctx.addLog(`🌑 對手護盾／護罩調整為 ${p.cap}，【${holder?.name}】承受 ${cost} 點真實傷害。`, 'effect');
      return true;
    },
    bench_probe_boost: (ctx: BattleEventContext, p: any): boolean => {
      const side = ctx.targetSide;
      let immune = 0, hit = 0;
      for (const elf of (ctx.getFullTeam(side) || []).filter(alive)) {
        const active = side === 'p1' ? ctx.activeP1 : ctx.activeP2;
        if (idOf(elf) === idOf(active)) continue;
        const settled = Number(ctx.applyDamageToElf?.(side, idOf(elf), p.flat, p.type, { label: '背包試探' } as any));
        hit++;
        if (!(settled > 0)) immune++;
      }
      if (!hit) return false;
      if (immune) {
        const mult = Math.min(1e6, Math.pow(p.mult, immune));
        queueActionDamageModifier(ctx, mult, '攻擊');
        ctx.addLog(`⚡ 敵方背包 ${immune} 隻精靈免疫，此次攻擊傷害×${mult}！`, 'effect');
      }
      return true;
    },
    incoming_true_turns: (ctx: BattleEventContext, p: any): boolean => {
      addConstraint(ctx, ctx.targetSide, 'fixedPercentAsTrue:' + idOf(ctx.self), p.turns, { fixedPercentAsTrue: true } as any, false, 'skill', false);
      ctx.addLog(`⚡ ${p.turns}回合內對手受到的固定／百分比傷害轉為真實傷害！`, 'effect');
      return true;
    },
    stage_scale_up: (ctx: BattleEventContext, p: any): boolean => {
      const elf = liveElf(ctx, ctx.actor), changes: Record<string, number> = {};
      for (const k of STAT_KEYS) { const v = Number(elf?.statStages?.[k] || 0); if (v > 0) changes[k] = v * (p.mult - 1); }
      return Object.keys(changes).length > 0 && ctx.applyStatChange(ctx.actor, changes)?.success === true;
    },
    stage_absorb_all: (ctx: BattleEventContext): boolean => {
      const opp = liveElf(ctx, ctx.targetSide), gains: Record<string, number> = {}, cleared: Record<string, number> = { ...(opp?.statStages || {}) };
      for (const k of STAT_KEYS) { const v = Number(opp?.statStages?.[k] || 0); if (v) { gains[k] = Math.abs(v); cleared[k] = 0; } }
      if (!Object.keys(gains).length) return false;
      ctx.updateElf(ctx.targetSide, { statStages: cleared as any });
      ctx.applyStatChange(ctx.actor, gains);
      ctx.addLog(`🔄 【${ctx.self.name}】轉移對手能力提升並反轉其能力下降至自身！`, 'effect');
      return true;
    },
    heal_shield_sum: (ctx: BattleEventContext, p: any): boolean => {
      const elf = liveElf(ctx, ctx.actor), amount = Math.floor(((Number(elf?.shield) || 0) + (Number((elf as any)?.barrier) || 0)) * p.ratio);
      if (amount <= 0) return false;
      ctx.applyHeal(ctx.actor, amount);
      return true;
    },
    drain_random: (ctx: BattleEventContext, p: any, st: RunState): boolean => {
      const roll = (ctx.rng || Math.random)();
      const amount = p.min + Math.floor(roll * (p.max - p.min + 1));
      ctx.applyAbsorb(ctx.targetSide, amount, '隨機吸取');
      st.lastAmount = amount;
      return true;
    },
    stage_randomize: (ctx: BattleEventContext, p: any): boolean => {
      for (const side of [ctx.actor, ctx.targetSide] as S[]) {
        const elf = liveElf(ctx, side), changes: Record<string, number> = {};
        for (const k of STAT_KEYS) {
          const target = p.min + Math.floor((ctx.rng || Math.random)() * (p.max - p.min + 1));
          const now = Number(elf?.statStages?.[k] || 0);
          if (target !== now) changes[k] = target - now;
        }
        if (Object.keys(changes).length) ctx.applyStatChange(side, changes);
      }
      ctx.addLog(`🎲 雙方所有能力等級隨機變化為 ${p.min > 0 ? '+' : ''}${p.min}～+${p.max}！`, 'effect');
      return true;
    },
    stage_swap_lower: (ctx: BattleEventContext): boolean => {
      const self = liveElf(ctx, ctx.actor), opp = liveElf(ctx, ctx.targetSide);
      const mine: Record<string, number> = {}, theirs: Record<string, number> = {};
      for (const k of STAT_KEYS) {
        const a = Number(self?.statStages?.[k] || 0), b = Number(opp?.statStages?.[k] || 0);
        if (a < b) { mine[k] = b - a; theirs[k] = a - b; }
      }
      if (!Object.keys(mine).length) return false;
      ctx.updateElf(ctx.actor, { statStages: { ...(self?.statStages || {}), ...Object.fromEntries(Object.keys(mine).map(k => [k, Number(opp.statStages[k])])) } as any });
      ctx.updateElf(ctx.targetSide, { statStages: { ...(opp?.statStages || {}), ...Object.fromEntries(Object.keys(mine).map(k => [k, Number(self?.statStages?.[k] || 0)])) } as any });
      ctx.addLog(`🔄 【${ctx.self.name}】與對手交換了較低的能力等級！`, 'effect');
      return true;
    },
    status_doubling_mods: (ctx: BattleEventContext, p: any, st: RunState): boolean => {
      const count = [ctx.actor, ctx.targetSide].reduce((n: number, side) => n + Object.values(ctx.getStatuses(liveElf(ctx, side as S)) || {}).filter((v: any) => Number(v) > 0).length, 0);
      const doubles = count * (p.perStatus ?? 10);
      const retention = p.reduce===1 ? 0 : Math.max(Number.MIN_VALUE,Math.pow(1 - p.reduce, 1 + doubles));
      const boost = Math.min(Number.MAX_VALUE, p.boost * Math.pow(2, Math.min(1023, doubles)));
      helpers.runStmts(ctx, [{ acts: [
        { op: 'damage_multiplier_turns', p: { dir: 'in', kind: '非真實', mult: retention, turns: 1 }, label: '本回合非真實逐次減傷' },
        { op: 'dmg_mod_uses', p: { uses: 1, boost, kind: '非真實', attackOnly: true }, label: '下次攻擊非真實增傷' },
      ] }], st);
      ctx.addLog(`🌑 雙方共 ${count} 種異常（翻倍 ${doubles} 次）：本回合承受非真實傷害倍率 ${retention.toExponential(6)}，下次攻擊非真實傷害提升 ${Math.round(boost * 100)}%！`, 'effect');
      return true;
    },
    dmg_per_stage_items: (ctx: BattleEventContext, p: any, st: RunState): boolean => {
      const self = liveElf(ctx, ctx.actor);
      const ups = STAT_KEYS.filter(k => Number(self?.statStages?.[k] || 0) > 0).length;
      const marks = p.perMarkId ? readMarkStacks(ctx, { side: 'self', id: p.perMarkId }) : 0;
      const count = ups + marks;
      if (count <= 0) return false;
      helpers.runStmts(ctx, [{ acts: [{ op: 'dmg', p: { flat: p.flat * count, type: p.type }, label: `每項${p.flat}` }] }], st);
      return true;
    },
    priority_offset_round: (ctx: BattleEventContext, p: any): boolean => {
      ctx.setPlayerState('roundPriorityOffset', { amount: p.amount, round: ctx.roundNumber });
      return true;
    },
    strip_type_team_named: (ctx: BattleEventContext, p: any): boolean => {
      const strip = (type: any) => {
        const parts = String(type || '').split(/[.·・]/).filter(Boolean);
        if (!parts.includes(p.type)) return null;
        const left = parts.filter(t => t !== p.type);
        return left.length ? left.join('.') : '普通';
      };
      let any = false;
      for (const elf of (ctx.getFullTeam(ctx.actor) || []).filter(e => !e.isVanished && nameHas(e, p.names))) {
        const type = strip(elf.type);
        const skills = (elf.skills || []).map((s: any) => { const t = strip(s.type); return t ? { ...s, type: t } : s; });
        if (!type && skills.every((s: any, i: number) => s === elf.skills[i])) continue;
        ctx.updateAnyElf(ctx.actor, idOf(elf), { ...(type ? { type, originalType: (elf as any).originalType || elf.type } : {}), skills } as any);
        ctx.addLog(`🌑 【${elf.name}】的${p.type}系從自身與技能屬性中剝離！`, 'effect');
        any = true;
      }
      return any;
    },
    item_discard: (ctx: BattleEventContext, p: any): boolean => ctx.discardBattleItem?.(sideOf(ctx, p.side), p.itemId) === true,
    // 能力視圖規則（趙雲）：自身各項提升等級額外視為對手同項下降（battle/stageViewRules.ts 讀取）。
    stage_view_rule: (ctx: BattleEventContext, p: any): boolean => {
      const elf = liveElf(ctx, ctx.actor);
      if (!elf) return false;
      ctx.updateAnyElf(ctx.actor, idOf(elf), { stageViewRules: { ...((elf as any).stageViewRules || {}), selfUpAsOppDown: !!p.selfUpAsOppDown } } as any);
      return true;
    },
    seal_fatal_resist: (ctx: BattleEventContext, p: any): boolean => {
      const side = sideOf(ctx, p.side), elf = liveElf(ctx, side);
      if (!elf || elf.fatalResistSeal || checkElfDead(elf)) return false;
      ctx.updateAnyElf(side, idOf(elf), { fatalResistSeal: 'armed' });
      ctx.setMark({
        id: FATAL_SEAL_MARK_ID, name: '幻滅', displayChar: '幻', count: 1,
        description: FATAL_SEAL_DESCRIPTION, source: ctx.skill?.name || ctx.self.name,
        ownerBattleId: idOf(elf), scope: 'elf', persistsOffField: true, clearable: false, polarity: 'negative',
      }, side);
      ctx.addLog(`⛓️ 【${elf.name}】下次觸發致死保留後，本場戰鬥無法再觸發！`, 'effect');
      return true;
    },
    status_seq_until_success: (ctx: BattleEventContext, p: any): boolean => {
      // 非次數類免疫：回合類異常免疫（含反彈）或回合型異常防護計時器。存在時照原序列各附加一次。
      const side = ctx.targetSide;
      const timers: any[] = (ctx as any)[`${side}Timers`] || [];
      const turnImmune = (Number(ctx.getOpponentState('immuneStatusTurns')) || 0) > 0 || (Number(ctx.getOpponentState('reflectStatusTurns')) || 0) > 0
        || timers.some(t => t?.payload?.statusGuard && t.mode !== 'uses' && t.kind !== 'use_counter');
      const apply = (name: string) => (ctx.applyStatusWithImmunityCheck(side, name, p.turns) as any)?.success === true;
      if (turnImmune) { let ok = false; for (const name of p.list) ok = apply(name) || ok; return ok; }
      // 否則依序附加 loopList；失敗且對手的次數類免疫有被消耗（防護狀態有變化）就繼續嘗試同一項，
      // 直到對手不存在次數免疫為止，再把後續各項附加上去。失敗卻沒有任何防護被消耗（無法附加）時才換下一項，避免無限循環。
      const guardState = () => JSON.stringify({
        reg: [ctx.getOpponentState('blkImmuneStatusCount'), ctx.getOpponentState('blkReflectStatusCount')],
        timers: ((ctx as any)[`${side}Timers`] || []).map((t: any) => [t.id, t.remaining]),
        marks: (ctx.getMarks(side) || []).map((m: any) => [m.id, m.ownerBattleId, m.count]),
        elf: (() => { const e: any = liveElf(ctx, side); return [e?.statusImmunityCount, e?.bossTraitState]; })(),
      });
      let any = false;
      for (const name of p.loopList) {
        for (let guard = 0; guard < 999; guard++) {
          if (Number(liveElf(ctx, side)?.currentHp) <= 0) return any;
          const before = guardState();
          if (apply(name)) { any = true; break; }
          if (guardState() === before) break;
        }
      }
      return any;
    },
  };
}

// 星核系（5032/5033/5034）專用積木操作：鄰位/隔位/首位/末位選取、PP 上限偏移、
// 鄰位 PP 竊取、選取者傷害/恢復、幻化接線、通用條件性額外行動容器。
// 獨立檔案：只透過 helpers 注入依賴，runtime/contract 僅 import 展開（協作分工 20261015）。
// 原則：op 只提供通用機制（集合、傷害、計數、額外行動容器）；一切數值/條件/範圍由 Kit 條目表達。
import type { BattleEventContext } from './types';
import type { RunState } from '../blocks/runtime';
import type { Stmt } from '../blocks/model';
import { checkElfDead } from '../battle/elfAlive';
import { getMaxPp } from '../utils/battleHelpers';
import { changePp, purge, restorePp } from './newElfOperations';
import { startIllusion, endIllusion, correspondingInitialElf } from '../battle/illusion';
import { STAR_STATUSES } from './newElfOperations';
import { getTypeMatchup } from '../utils/statCalculator';
import { skillSlot } from '../battle/skillSlot';

type Side = 'p1' | 'p2';
const identity = (elf: any) => String(elf?.battleId || elf?.id || '');
const alive = (e: any) => !!e && !checkElfDead(e);

export function astralOperations(helpers: {
  liveElf: (ctx: BattleEventContext, side: Side) => any;
  run: (ctx: BattleEventContext, body: Stmt[], state: RunState) => void;
  evalCond?: (ctx: BattleEventContext, cond: any, st: RunState) => boolean | undefined;
}) {
  const selected = (ctx: BattleEventContext, st: RunState) =>
    st.selectedElf && ctx.getFullTeam(st.selectedElf.side).find(e => identity(e) === st.selectedElf!.id);

  /** relation 選取：以 anchor（默認該側在場者）為參照取鄰位/隔位/首位/末位。 */
  const pickByRelation = (ctx: BattleEventContext, side: Side, p: any): any[] => {
    const team = ctx.getFullTeam(side).filter((e: any) => !e.isVanished && !e.isExtra);
    if (p.relation === 'first') return team.length ? [team[0]] : [];
    if (p.relation === 'last') return team.length ? [team[team.length - 1]] : [];
    const anchorElf = side === 'p1' ? ctx.activeP1 : ctx.activeP2;
    const anchorId = identity(anchorElf);
    const idx = team.findIndex(e => identity(e) === anchorId);
    if (idx === -1) return [];
    if (p.relation === 'active') return [team[idx]];
    if (p.relation === 'adjacent') {
      const out: any[] = [];
      if (idx > 0) out.push(team[idx - 1]);
      if (idx < team.length - 1) out.push(team[idx + 1]);
      return out;
    }
    if (p.relation === 'separated') {
      const out: any[] = [];
      if (idx > 1) out.push(team[idx - 2]);
      if (idx < team.length - 2) out.push(team[idx + 2]);
      return out;
    }
    return [];
  };

  return {
    /** 位置/條件選取（select_elf 泛化；relation 未填＝orderBy/direction 照舊）。
     *  命中多個時逐一執行 body（selectedElf 依序輪替）。 */
    astral_select: (ctx: BattleEventContext, p: any, st: RunState): boolean => {
      const side: Side = p.side === 'self' ? ctx.actor : ctx.targetSide;
      const candidates = p.relation
        ? pickByRelation(ctx, side, p).filter(e => p.state === 'dead' ? checkElfDead(e) : p.state === 'alive' ? alive(e) : true)
        : (() => {
            const active = side === 'p1' ? ctx.activeP1 : ctx.activeP2;
            const list = ctx.getFullTeam(side).filter((e: any) => !e.isVanished && !e.isExtra
              && (p.scope === 'team' || identity(e) !== identity(active))
              && (p.state === 'any' || (p.state === 'dead' ? checkElfDead(e) : alive(e))));
            if (p.orderBy === 'max_hp') list.sort((a: any, b: any) => (p.direction === 'asc' ? 1 : -1) * (a.maxHp - b.maxHp));
            else if (p.direction === 'desc') list.reverse();
            return list;
          })();
      if (!candidates.length) return false;
      let any = false;
      for (const elf of candidates) {
        helpers.run(ctx, p.body, { ...st, last: null, lastAmount: 0, conditionSnapshots: undefined,
          selectedElf: { side, id: identity(elf) } });
        any = true;
      }
      return any;
    },

    /** 對選中精靈做 globalPpMaxOffset ±delta；overflowDamage 時超上限 PP 每點轉傷害（flat 可調）。 */
    pp_max_offset_selected: (ctx: BattleEventContext, p: any, st: RunState): boolean => {
      const elf = selected(ctx, st);
      if (!elf || !Number.isInteger(p.delta)) return false;
      const changed = { ...elf, globalPpMaxOffset: (elf.globalPpMaxOffset || 0) + p.delta };
      ctx.updateAnyElf(st.selectedElf!.side, identity(elf), { globalPpMaxOffset: changed.globalPpMaxOffset });
      const overflow = (elf.skills || []).reduce((n: number, s: any) => n + Math.max(0, (s.pp || 0) - getMaxPp(s, changed)), 0);
      if (p.overflowDamage) {
        for (let i = 0; i < overflow; i++) ctx.applyDamageToElf?.(st.selectedElf!.side, identity(elf), p.overflowFlat || 50, p.overflowType || 'skill_extra_action', { elem: p.elem || '超能' });
      } else if (overflow > 0) {
        changePp(ctx, st.selectedElf!.side, changed, (s: any) => Math.min(s.pp, getMaxPp(s, changed)), false, 'cap_change');
      }
      return true;
    },

    /** 鄰位/隔位 PP 竊取：逐槽吸 amount 歸自身同槽；歸零→依 zeroThen 對在場者鎖切換或清同槽。 */
    pp_slot_steal: (ctx: BattleEventContext, p: any): boolean => {
      if (!(p.amount > 0) || !['opp_adjacent', 'opp_separated'].includes(p.from)) return false;
      const relation = p.from === 'opp_adjacent' ? 'adjacent' : 'separated';
      const active = ctx.targetSide === 'p1' ? ctx.activeP1 : ctx.activeP2;
      const team = ctx.getFullTeam(ctx.targetSide).filter((e: any) => !e.isVanished && !e.isExtra);
      const idx = team.findIndex(e => identity(e) === identity(active));
      if (idx === -1) return false;
      const offsets = relation === 'adjacent' ? [idx - 1, idx + 1] : [idx - 2, idx + 2];
      const targets = offsets.filter(i => i >= 0 && i < team.length).map(i => team[i]);
      const self = helpers.liveElf(ctx, ctx.actor);
      let any = false;
      for (const e of targets) {
        const bySlot = (e.skills || []).map((s: any) => Math.min(p.amount, s.pp || 0));
        const result = changePp(ctx, ctx.targetSide, e, (s: any) => Math.max(0, (s.pp || 0) - p.amount), false, 'drain');
        changePp(ctx, ctx.actor, self, (s: any, i: number) => Math.min(getMaxPp(s, self), (s.pp || 0) + (bySlot[i] || 0)), true, 'restore');
        if (result.emptied?.length) {
          if (p.zeroThen === 'lock_switch') ctx.addTimerTo(ctx.targetSide, { id: 'astral_switch_lock', name: '無法切換', kind: 'turn_effect', source: 'skill', remaining: 1, tickAt: 'round_end', pendingActivation: true, payload: { lockSwitch: true } } as any, false);
          if (p.zeroThen === 'clear_active_slot') changePp(ctx, ctx.targetSide, active, (s: any, i: number) => result.emptied.includes(i) ? 0 : s.pp, false, 'clear');
        }
        any = true;
      }
      return any;
    },

    /** 對選中精靈造傷害；perNonFullPp 時參照 side 每非滿槽 +flat（數值全由 Kit 給）。 */
    damage_selected: (ctx: BattleEventContext, p: any, st: RunState): boolean => {
      const elf = selected(ctx, st);
      if (!elf) return false;
      let amount = p.flat ?? 0;
      if (p.perNonFullPp) {
        const ref = helpers.liveElf(ctx, p.perNonFullPp.side === 'self' ? ctx.actor : ctx.targetSide);
        const nonFull = (ref?.skills || []).filter((s: any) => (s.pp || 0) < getMaxPp(s, ref)).length;
        amount += (p.perNonFullPp.flat || 0) * nonFull;
      }
      if (!(amount > 0)) return false;
      st.lastAmount = ctx.applyDamageToElf?.(st.selectedElf!.side, identity(elf), amount, p.type || 'skill_extra_action', { elem: p.elem || '超能' }) ?? amount;
      return true;
    },

    /** 場下己方每隻恢復 選中精靈已損PP×perLostPp 體力（數值由 Kit 給）。 */
    heal_selected_pp: (ctx: BattleEventContext, p: any, st: RunState): boolean => {
      const elf = selected(ctx, st);
      if (!elf || !(p.perLostPp > 0)) return false;
      const lost = (elf.skills || []).reduce((n: number, s: any) => n + Math.max(0, getMaxPp(s, elf) - (s.pp || 0)), 0);
      let any = false;
      for (const e of ctx.getFullTeam(ctx.actor)) {
        if (identity(e) === identity(ctx.self) || checkElfDead(e)) continue;
        ctx.applyHealToElf?.(ctx.actor, identity(e), lost * p.perLostPp);
        any = true;
      }
      return any;
    },

    /** 幻化開始：pick='opp_active'（在場對手）或 'paired_initial'（初始背包配對）。正式 illusion 接口。 */
    illusion_start: (ctx: BattleEventContext, p: any): boolean => {
      const target = p.pick === 'paired_initial'
        ? correspondingInitialElf(ctx.getFullTeam(ctx.actor), ctx.self)
        : ctx.target;
      // 目標缺失時仍交給 startIllusion：幻化指令的覆寫對象可以補上缺失的原目標。
      const started = startIllusion(ctx, target, p.source || '幻化', p.ppBonus || 0);
      if (!started) ctx.addLog('【幻化】：目標缺失，未觸發。', 'effect');
      return started;
    },

    /** 幻化解除。 */
    illusion_end: (ctx: BattleEventContext): boolean => endIllusion(ctx),

    /** 通用條件性額外行動容器：把 body 排入獨立額外行動節點執行（變思遷憶等）。
     *  條件、傷害、數值、範圍全部由 Kit 條目在 body 內用正式動作組合；本 op 不含任何專屬邏輯。
     *  guards 條件（cond 通過）由外層 Kit 子句表達；onceKey 提供本體每場一次防護（可選）。 */
    queue_extra_action: (ctx: BattleEventContext, p: any, st: RunState): boolean => {
      if (!Array.isArray(p.body) || !p.body.length) return false;
      if (p.onceKey) {
        const key = `blockOnce:${(ctx as any).illusionEffectKey || ''}:${p.onceKey}`;
        if (ctx.getPlayerState(key)) return false;
        ctx.setPlayerState(key, true);
      }
      const ownerId = identity(ctx.self);
      const label = p.label || '額外行動';
      ctx.queueExtraAction(ctx.actor, { label, run: (c: BattleEventContext) => {
        if (identity(c.self) !== ownerId || !alive(c.self)) return 0;
        helpers.run(c, p.body, { last: null, lastAmount: 0, sourceKind: st.sourceKind, event: { trig: 'extra_action_start', data: c } } as RunState);
        return 0;
      } });
      return true;
    },

    /** 回合類效果攜帶引擎 payload 鍵（空間躍遷 blockSkillDamage、後手減半 halveNonTrue 等）。
     *  與 5017 invalid_turns 同模式：引擎結算端直讀 timer.payload 白名單鍵；期限由通用掃描遞減。 */
    effect_turns: (ctx: BattleEventContext, p: any, st: any): boolean => {
      if (!p.keys || typeof p.keys !== 'object' || Array.isArray(p.keys) || !Object.keys(p.keys).length) return false;
      if (!Number.isInteger(p.turns) || p.turns <= 0) return false;
      if (p.side !== undefined && p.side !== 'self' && p.side !== 'opp') return false;
      const side: Side = p.side === 'opp' ? ctx.targetSide : ctx.actor;
      // ownerBattleId 綁定受影響側的本體：opp 時為對手（效果掛在對手身上，隨對手下場失效）。
      const ownerElf = p.side === 'opp' ? (ctx.targetSide === 'p1' ? ctx.activeP1 : ctx.activeP2) : ctx.self;
      const payload: Record<string, any> = { ...p.keys, owner: side, src: ctx.skill?.name || ctx.self?.name };
      ctx.addTimerTo(side, { id: `effect_${p.label || '持續效果'}_${Object.keys(p.keys).join('_')}`,
        name: p.label || '持續效果', kind: (st && st.sourceKind === 'soul') ? 'round_counter' : 'turn_effect',
        source: (st && st.sourceKind === 'soul') ? 'soulmark' : 'skill', remaining: p.turns, tickAt: 'round_end',
        scope: 'elf', ownerBattleId: identity(ownerElf), payload } as any, false);
      return true;
    },

    /** 能力值拉平：逐項將自身能力提升至與對方相同（僅對方較高項）；差值總和寫 st.lastAmount。 */
    stat_match: (ctx: BattleEventContext, p: any, st: any): boolean => {
      if (!Array.isArray(p.stats) || !p.stats.length) return false;
      const self = helpers.liveElf(ctx, ctx.actor), opp = helpers.liveElf(ctx, ctx.targetSide);
      if (!self?.calculatedStats || !opp?.calculatedStats) return false;
      let diff = 0;
      const stats = { ...self.calculatedStats };
      for (const k of p.stats) if ((opp.calculatedStats[k] || 0) > (self.calculatedStats[k] || 0)) {
        diff += opp.calculatedStats[k] - self.calculatedStats[k];
        stats[k] = opp.calculatedStats[k];
      }
      if (!diff) return false;
      ctx.updateElf(ctx.actor, { calculatedStats: stats, maxHp: Math.max(self.maxHp, stats.hp) });
      st.lastAmount = diff;
      ctx.addLog(`⚖️ 能力值拉平：提升 ${diff} 點總和（每差1點附加1點固定傷害）。`, 'effect');
      return true;
    },

    /** 3回合內對方所受技能傷害¼以固定傷害反彈（上限：反射者 maxHp-1；引擎 reflectSkillQuarter 讀取端）。 */
    reflect_skill_quarter: (ctx: BattleEventContext, p: any): boolean => {
      if (!(p.turns > 0)) return false;
      ctx.addTimerTo(ctx.targetSide, { id: 'reflect_quarter', name: '技能傷害¼反彈',
        kind: 'turn_effect', source: 'skill', remaining: p.turns, tickAt: 'round_end', scope: 'elf',
        ownerBattleId: identity(helpers.liveElf(ctx, ctx.targetSide)),
        payload: { reflectSkillQuarter: true, reflectToSide: ctx.actor, reflectToId: identity(ctx.self) } } as any, false);
      ctx.addLog(`🛡️ ${p.turns} 回合內對方所受技能傷害¼反彈（上限自身體力-1）。`, 'effect');
      return true;
    },

    /** 雙方場下精靈已損 PP 總和×mult 寫 lastAmount（寰宇幻影閃「場下已損PP值總和×10」）。 */
    bench_pp_lost_sum: (ctx: BattleEventContext, p: any, st: any): boolean => {
      const mult = p.mult ?? 1;
      let lost = 0;
      for (const side of [ctx.actor, ctx.targetSide] as Side[]) {
        const active = side === 'p1' ? ctx.activeP1 : ctx.activeP2;
        for (const e of ctx.getFullTeam(side)) {
          if (identity(e) === identity(active) || e.isExtra) continue;
          lost += (e.skills || []).reduce((n: number, s: any) => n + Math.max(0, getMaxPp(s, e) - (s.pp || 0)), 0);
        }
      }
      st.lastAmount = lost * mult;
      return lost > 0;
    },

    /** 重複執行 body：count 為整數或 'star_statuses'（自身當前星附屬異常項數）。 */
    repeat: (ctx: BattleEventContext, p: any, st: any): boolean => {
      const count = p.count === 'star_statuses'
        ? STAR_STATUSES.filter((s: string) => (ctx.getStatuses?.(ctx.self) || {})[s]).length
        : Number(p.count);
      if (!Number.isInteger(count) || count <= 0 || count > 100) return false;
      if (!Array.isArray(p.body) || !p.body.length) return false;
      let any = false;
      for (let i = 0; i < count; i++) {
        helpers.run(ctx, p.body, { ...st, last: null, lastAmount: st.lastAmount, conditionSnapshots: undefined });
        any = true;
      }
      return any;
    },

    /** 本次攻擊連擊次數（N~M 隨機）：寫入引擎 attackHitCountThisAction（引擎合併為一次結算）。
     *  perMarkHits（5012 凝寒止喧「每50點肅霜之禁額外攻擊10次」）：每達 per 點印記加 extra 次連擊；
     *  doubleIf 條件成立時額外部分翻倍。基礎 min~max 不受印記影響。 */
    multi_hit: (ctx: BattleEventContext, p: any, st: any): boolean => {
      if (!(p.min >= 1) || !(p.max >= p.min)) return false;
      const count = p.min + Math.floor((ctx.rng?.() ?? Math.random()) * (p.max - p.min + 1));
      let extra = 0;
      if (p.perMarkHits) {
        const q = p.perMarkHits;
        const markSide: Side = q.side === 'self' ? ctx.actor : ctx.targetSide;
        const stacks = (ctx.getMarks(markSide) || []).find((m: any) => m.id === q.id)?.count || 0;
        extra = Math.floor(stacks / (q.per || 1)) * (q.extra || 0);
        if (extra > 0 && q.doubleIf && helpers.evalCond) {
          // doubleIf 支援單一條件或條件陣列：陣列為「任一滿足即翻倍」
          // （5012 凝寒止喧「自身處於能力提升/下降狀態時效果翻倍」——OR 語意）。
          const conds: any[] = Array.isArray(q.doubleIf) ? q.doubleIf : [q.doubleIf];
          if (conds.some(cd => helpers.evalCond!(ctx, cd, st) === true)) extra *= 2;
        }
        if (extra > 0) ctx.addLog(`⚔️ 印記加成連擊 +${extra} 次！`, 'effect');
      }
      const total = count + extra;
      ctx.setPlayerState('attackHitCountThisAction', Math.max(total, Number(ctx.getPlayerState('attackHitCountThisAction')) || 0) || total);
      ctx.addLog(`⚔️ 本次攻擊連擊 ${total} 次！`, 'effect');
      void st;
      return true;
    },

    /** 能力等級交換：自身低於對手的項互相交換（摧妖斬「交換自身低於對手的能力等級」）。 */
    /** 僅自身受到指定類型傷害（寰宇幻影閃變思遷憶「分別使自身受到1點四類傷害」；
     *  結算寫入 battleDamageCounts 供「均受到次數達到5次」計數句讀取）。 */
    self_damage: (ctx: BattleEventContext, p: any, st: any): boolean => {
      if (!Number.isFinite(p.flat) || p.flat < 0) return false;
      if (!['skill_extra_action', 'fixed', 'percent', 'true'].includes(p.type)) return false;
      if (!ctx.applyDamageToElf) return false;
      st.lastAmount = ctx.applyDamageToElf(ctx.actor, identity(ctx.self), Math.max(0, Math.floor(p.flat)),
        p.type === 'skill_extra_action' ? 'skill_attack' : p.type, { label: '自身受到', reaction: false });
      return true;
    },

    /** 清除自身本場戰鬥登場次數紀錄與在場紀錄，並令自身下次出戰節點結算時觸發出戰效果。 */
    entrance_fresh_start: (ctx: BattleEventContext): boolean => {
      const history = ctx.getPlayerState('teamEntranceHistory') || {};
      ctx.setPlayerState('teamEntranceHistory', { ...history, [identity(ctx.self)]: 0 });
      ctx.setPlayerState('fieldStatusCount', 0);
      ctx.setPlayerState('entranceEffectNextOut', true);
      ctx.addLog('🌀 清除登場次數與在場紀錄，下次出戰結算時觸發出戰效果！', 'effect');
      return true;
    },

    /** 對方接下來 N 次受到的攻擊必定致命（次數制；引擎 incomingAttackCritical 讀取端）。 */
    crit_received_uses: (ctx: BattleEventContext, p: any): boolean => {
      if (!Number.isInteger(p.uses) || p.uses < 1) return false;
      ctx.addTimerTo(ctx.targetSide, { id: 'crit_received_uses', name: `接下來 ${p.uses} 次受到的攻擊必定致命`,
        kind: 'uses', source: 'skill', remaining: p.uses, tickAt: 'round_end', scope: 'elf',
        ownerBattleId: identity(helpers.liveElf(ctx, ctx.targetSide)),
        payload: { incomingAttackCritical: true } } as any, false);
      ctx.addLog(`🎯 令對方接下來 ${p.uses} 次受到的攻擊必定為致命一擊！`, 'effect');
      return true;
    },

    stat_swap: (ctx: BattleEventContext): boolean => {
      const self = helpers.liveElf(ctx, ctx.actor), opp = helpers.liveElf(ctx, ctx.targetSide);
      if (!self?.statStages || !opp?.statStages) return false;
      const own = { ...self.statStages }, other = { ...opp.statStages };
      let changed = false;
      for (const k of ['atk', 'def', 'spatk', 'spdef', 'speed', 'accuracy']) if ((own[k] || 0) < (other[k] || 0)) {
        [own[k], other[k]] = [other[k] || 0, own[k] || 0]; changed = true;
      }
      if (!changed) return false;
      ctx.updateElf(ctx.actor, { statStages: own });
      ctx.updateElf(ctx.targetSide, { statStages: other });
      ctx.addLog('⚖️ 與對手交換低於對手的能力等級！', 'effect');
      return true;
    },

    /** 本次攻擊追加連擊次數（引擎 attackBonusHitCountThisAction 讀取後清零）。 */
    combo_add: (ctx: BattleEventContext, p: any): boolean => {
      if (!Number.isInteger(p.amount) || p.amount < 1) return false;
      ctx.setPlayerState('attackBonusHitCountThisAction', (Number(ctx.getPlayerState('attackBonusHitCountThisAction')) || 0) + p.amount);
      ctx.addLog(`⚔️ 本次攻擊追加 ${p.amount} 次連擊！`, 'effect');
      return true;
    },

    /** 幻化解除三條件聯合查詢（5033 思維固化）：fieldDamageCounts 五類各≥5＋fieldStatusCount≥5＋
     *  teamEntranceHistory[self]>5 全滿足寫 st.last=true；條件型動作，不滿足不消耗。 */
    aesfig_release_check: (ctx: BattleEventContext, _p: any, st: RunState): boolean => {
      const counts = ctx.getPlayerState('fieldDamageCounts') || {};
      const dmgOk = ['skill', 'fixed', 'percent', 'true'].every((k: string) => (counts[k] || 0) >= 5);
      const statusOk = (ctx.getPlayerState('fieldStatusCount') || 0) >= 5;
      const history = ctx.getPlayerState('teamEntranceHistory') || {};
      const entranceOk = ((history[identity(ctx.self)] || 0) > 5);
      const ok = dmgOk && statusOk && entranceOk;
      st.last = ok;
      return ok;
    },

    /** 自身受到的傷害類型計數查詢（battleDamageCounts 為受擊方 scoped registry，按持有者天然隔離）。
     *  條件型動作：命中寫 st.last 供 chain 分支；不命中不消耗。 */
    damage_count: (ctx: BattleEventContext, p: any, st: RunState): boolean => {
      if (!Array.isArray(p.types) || !p.types.length) return false;
      const counts = ctx.getPlayerState('battleDamageCounts') || {};
      const hit = p.types.every((t: string) => (counts[t] || 0) >= (p.atLeast || 1));
      st.last = hit;
      return hit;
    },

    // ───────── 魂珠狀態機（5034；通用容器，期別與數值全由 Kit 給） ─────────
    /** 抽取魂珠：無珠→建立（期別/次數由 Kit 給）；有珠→沿用。
     *  抽取結算：解除自身所有異常、恢復全部體力與 PP；額外附加平靜（回合數＝存活數＋邪靈識別數，由 Kit 給數值來源）。
     *  混沌判定：敵我任一方在場或技能識別含混沌系則轉混沌期。豐腴期旗標供回合末剝奪。 */
    orb_draw: (ctx: BattleEventContext, p: any, st: RunState): boolean => {
      const setState = (k: string, v: any) => ctx.setPlayerState(k, v);
      let value = ctx.getPlayerState('teamMogosOrb');
      const isNew = !value;
      if (!value) {
        value = { phase: p.initialPhase || '豐腴期', fatalUsed: false, remaining: p.remaining ?? 2 };
        setState('teamMogosOrb', value);
      }
      // 解除異常（自身在場者）＋恢復全部體力與 PP
      if (p.clearStatuses !== false) purge(ctx, ctx.actor);
      if (p.heal !== false) ctx.applyHeal(ctx.actor, ctx.self.maxHp);
      if (p.restorePp !== false) restorePp(ctx, ctx.actor, ctx.self);
      // 平靜：敵我雙方每存活1隻精靈或識別屬性帶邪靈系者額外1回合（數值由 Kit 給）
      if (p.calmStatus) {
        const all = [...ctx.getFullTeam(ctx.actor), ...ctx.getFullTeam(ctx.targetSide)];
        const comps = (t: string) => String(t || '').replace(/系/g, '').split(/[·.・]/);
        const duration = all.reduce((n: number, e: any) =>
          n + (alive(e) ? (p.calmPerAlive ?? 0) : 0) + (comps(e.type).includes(p.calmAlienElem || '邪靈') ? (p.calmPerAlien ?? 0) : 0), 0);
        if (duration > 0) ctx.applyStatusWithImmunityCheck(ctx.actor, p.calmStatus, duration);
      }
      // 混沌判定：在場精靈識別屬性及技能識別屬性存在混沌系
      if (p.chaosElem) {
        const comps = (t: string) => String(t || '').replace(/系/g, '').split(/[·.・]/);
        const chaos = [ctx.self, ctx.target].some((e: any) =>
          comps(e.type).includes(p.chaosElem) || (e.skills || []).some((s: any) => comps(s.type).includes(p.chaosElem)));
        if (chaos) { value = { ...value, phase: p.chaosPhase || '混沌期' }; setState('teamMogosOrb', value); }
      }
      if (value.phase === (p.abundancePhase || '豐腴期')) setState(p.abundanceFlag || 'orbAbundanceThisRound', true);
      ctx.addLog(`🔮 【${ctx.self?.name}】${isNew ? '獲得' : '吸取'}魂珠（${value.phase}）！`, 'effect');
      return true;
    },

    /** 魂珠期別查詢（條件型動作）：符合寫 st.last=true 供 chain 分支；不符合不消耗。
     *  neg=true 表示「非該期別」。 */
    orb_query: (ctx: BattleEventContext, p: any, st: RunState): boolean => {
      const value = ctx.getPlayerState('teamMogosOrb');
      const phases: string[] = Array.isArray(p.phase) ? p.phase : [p.phase];
      let has = !!value && phases.includes(value.phase);
      // fatalUsed:false 要求「本顆魂珠尚未觸發過保留體力」（混沌期不可進入竭擇的條件之一）。
      if (has && p.fatalUsed === false) has = value.fatalUsed !== true;
      const hit = p.neg ? !has : has;
      st.last = hit;
      return hit;
    },

    /** 設定魂珠期別（FATAL 轉竭擇）；exists=false 或 remove=true 時移除魂珠。 */
    orb_phase_set: (ctx: BattleEventContext, p: any, st: RunState): boolean => {
      const value = ctx.getPlayerState('teamMogosOrb');
      if (p.remove) { ctx.setPlayerState('teamMogosOrb', undefined); return true; }
      if (!value) return false;
      const next = { ...value, phase: p.targetPhase || value.phase };
      if (p.fatalUsed !== undefined) next.fatalUsed = p.fatalUsed;
      if (p.remaining !== undefined) next.remaining = p.remaining;
      if (p.decrementRemaining) next.remaining = Math.max(0, (next.remaining || 0) - p.decrementRemaining);
      if (p.targetPhase) ctx.addLog(`🔮 魂珠轉變為【${next.phase}】！`, 'effect');
      ctx.setPlayerState('teamMogosOrb', next);
      return true;
    },

    /** 附加魂珠印記（埒殘銜闕）1道（上限由 Kit 給）：寫入層數與非真實傷害倍率。
     *  「附加成功或道數已滿」時，依 consumePp 讓技能使用方該槽 PP 歸0，並以消耗量×healMult
     *  恢復己方場下體力最低者、記入下次出戰臨時體力上限；typeExchange 時做天敵判定→克制倍數交換。
     *  使用方由 consumer 指定：self＝持有者（自身使用技能）、opp＝對手（對手使用技能）。
     *  回傳 st.last＝「附加成功或已滿」供 chain 判定。 */
    orb_mark_add: (ctx: BattleEventContext, p: any, st: RunState): boolean => {
      const markedSide: Side = p.markedSide === 'self' ? ctx.actor : ctx.targetSide;
      const holder = helpers.liveElf(ctx, markedSide);
      if (!holder) { st.last = false; return false; }
      const findCount = (side: Side) => (ctx.getMarks(side) || []).find((m: any) => m.id === p.id)?.count || 0;
      const before = findCount(markedSide);
      const count = Math.min(p.max ?? 3, before + (p.count ?? 1));
      ctx.setMark({ id: p.id, name: p.name, displayChar: p.displayChar, count, maxCount: p.max ?? 3, unit: p.unit,
        source: ctx.self?.soulMark?.name || ctx.self?.name, scope: 'elf', ownerBattleId: identity(holder),
        persistsOffField: true, clearable: false, description: p.description, effects: p.effects } as any, markedSide);
      const actual = findCount(markedSide);
      const ok = actual > before || before >= (p.max ?? 3);
      st.last = ok;
      if (!ok) return false;
      // 使用方該技能全部 PP 值消耗
      const consumer = p.consumer === 'opp' ? ctx.target : ctx.self;
      const consumerSide: Side = p.consumer === 'opp' ? ctx.targetSide : ctx.actor;
      const usedSkill = p.consumer === 'opp' ? ((ctx as any).opponentSkill || ctx.skill) : ctx.skill;
      const slot = skillSlot(consumer, usedSkill);
      const consumed = slot >= 0 ? (consumer.skills[slot]?.pp || 0) : 0;
      if (consumed > 0) changePp(ctx, consumerSide, consumer, (s: any, i: number) => i === slot ? 0 : s.pp);
      // 己方（持有者隊伍）場下體力最低者恢復，並記入下次出戰臨時體力上限
      if (consumed > 0 && p.healMult) {
        const bench = ctx.getFullTeam(ctx.actor).filter((e: any) => identity(e) !== identity(ctx.self) && alive(e))
          .sort((a: any, b: any) => a.currentHp - b.currentHp)[0];
        if (bench) {
          const gain = consumed * p.healMult;
          ctx.applyHealToElf?.(ctx.actor, identity(bench), gain);
          ctx.setPlayerState('teamOrbHpBonuses', { ...(ctx.getPlayerState('teamOrbHpBonuses') || {}), [identity(bench)]: gain });
        }
      }
      // 對手攜帶技能中識別屬性存在為自身天敵→交換雙方克制倍數（對手較高時歸1），每道額外+1
      if (p.typeExchange) {
        const own = ctx.self, foe = ctx.target;
        if ((foe.skills || []).some((s: any) => getTypeMatchup(s.type, own.type) > 1)) {
          let a = getTypeMatchup(foe.type, own.type), b = getTypeMatchup(own.type, foe.type);
          if (b > a) { a = 1; b = 1; }
          ctx.setPlayerState('typeMultiplierUntilSwitch', a + actual);
          ctx.setOpponentState('typeMultiplierUntilSwitch', b);
        }
      }
      return true;
    },

    /** 能力值比例縮放（竭擇期提升所有能力值25%）：calculatedStats 逐項 ×ratio；
     *  includeMaxHp 時同步縮放 maxHp 與 hp 項。數值由 Kit 給。 */
    stat_scale: (ctx: BattleEventContext, p: any): boolean => {
      const elf = helpers.liveElf(ctx, ctx.actor);
      if (!elf?.calculatedStats || !(p.ratio > 0)) return false;
      const stats: Record<string, number> = {};
      for (const [k, n] of Object.entries(elf.calculatedStats)) stats[k] = Math.floor(Number(n) * p.ratio);
      const patch: any = { calculatedStats: stats };
      if (p.includeMaxHp) {
        const newMax = Math.floor(elf.maxHp * p.ratio);
        patch.maxHp = newMax;
        // 能力值提升不改變現有體力（「保留1點」由 survive 動作決定，不因上限提高被抬高）。
        patch.currentHp = Math.min(elf.currentHp, newMax);
        if (stats.hp !== undefined) stats.hp = newMax;
      }
      ctx.updateElf(ctx.actor, patch);
      ctx.addLog(`⚖️ 【${elf.name}】所有能力值變為 ${Math.round(p.ratio * 100)}%！`, 'effect');
      return true;
    },

    /** 驅逐在場精靈下場（隨機切換至場下存活的非額外精靈）。
     *  deferToDamageChain 時延後到「同一傷害及其印記等反應全部結束後」才執行，
     *  並在執行前重申保留 1 點體力——否則後續印記反應會把剛保留的 1 點再打掉。 */
    expel: (ctx: BattleEventContext, p: any): boolean => {
      const side: Side = p.side === 'opp' ? ctx.targetSide : ctx.actor;
      const ownerId = identity(ctx.self);
      const run = () => {
        const live = ctx.getFullTeam(side).find((e: any) => identity(e) === ownerId);
        if (!live || live.isVanished) return;
        if (p.keepHp !== undefined) ctx.updateAnyElf?.(side, ownerId, { currentHp: p.keepHp });
        const active = side === 'p1' ? ctx.activeP1 : ctx.activeP2;
        if (identity(active) !== ownerId) return;
        if (ctx.expel?.(side)) ctx.addLog(`🌀 【${ctx.self?.name}】被驅逐下場！`, 'effect');
      };
      if (p.deferToDamageChain && ctx.afterDamageChain) ctx.afterDamageChain(() => run());
      else run();
      return true;
    },

    /** 清除信仰對象（5019 ᚺᚢᚷᛁᚾ「消除對手信仰對象」：狂信的 CANT_ACT 失效——battleHelpers FAITH_TARGET 讀取）。 */
    clear_faith_target: (ctx: BattleEventContext, p: any): boolean => {
      if (!['self', 'opp'].includes(p.side)) return false;
      const e = p.side === 'self' ? ctx.self : ctx.target;
      if (!e || (e as any).faithTarget === undefined) return false;
      ctx.updateElf(p.side === 'self' ? ctx.actor : ctx.targetSide, { faithTarget: undefined } as any);
      return true;
    },

    /** 兩印記層數差值寫入 lastAmount（5028 永恆誓約「對手滴數高於自身時獲得等同差值」：b-a，低於 0 歸 0）。 */
    mark_gap_to_last: (ctx: BattleEventContext, p: any, st: RunState): boolean => {
      if (!['self', 'opp'].includes(p.sideA) || !['self', 'opp'].includes(p.sideB)) return false;
      if (typeof p.idA !== 'string' || !p.idA || typeof p.idB !== 'string' || !p.idB) return false;
      const readCount = (side: 'self' | 'opp') => {
        const s: Side = side === 'self' ? ctx.actor : ctx.targetSide;
        return (ctx.getMarks(s) || []).find((m: any) => m.id === (side === 'self' ? p.idA : p.idB))?.count || 0;
      };
      const gap = readCount(p.sideB) - readCount(p.sideA);
      st.lastAmount = Math.max(0, gap);
      return st.lastAmount > 0;
    },

    /** 本次技能威力提升 lastAmount×ratio（5028 王·洛浦凌波「每消耗1點威力+1」：clear_shield 寫入消耗量後消費）。 */
    power_from_last: (ctx: BattleEventContext, p: any, st: RunState): boolean => {
      const comp = (ctx as any).powerComp || st.event?.data?.powerComp;
      if (!comp || !Number.isFinite(comp.power) || ctx.skill?.category === '屬性') return false;
      if (!Number.isFinite(p.ratio) || p.ratio <= 0) return false;
      if (!(st.lastAmount > 0)) return false;
      comp.power += Math.floor(st.lastAmount * p.ratio);
      return true;
    },

    /** 無視自身負先制等級（5012 王·蒼銀之棺）：本次行動先制低於 0 時視為 0。
     *  寫入引擎讀取端 ignoreSelfNegativePriorityThisAction（battleEngine 先制結算）。 */
    ignore_negative_priority: (ctx: BattleEventContext): boolean => {
      ctx.setPlayerState('ignoreSelfNegativePriorityThisAction', true);
      return true;
    },

    /** 讀取能力值寫入 lastAmount（「附加自身攻擊值15%的肅霜之禁」等：stat×ratio 後供後續動作消費）。 */
    stat_to_last: (ctx: BattleEventContext, p: any, st: RunState): boolean => {
      if (!['self', 'opp'].includes(p.side)) return false;
      if (!['hp', 'atk', 'def', 'spatk', 'spdef', 'speed'].includes(p.stat)) return false;
      if (!Number.isFinite(p.ratio) || p.ratio <= 0) return false;
      const elf = p.side === 'self' ? ctx.self : ctx.target;
      const v = p.stat === 'hp' ? elf.maxHp : elf.calculatedStats?.[p.stat];
      if (!Number.isFinite(v)) return false;
      st.lastAmount = Math.floor(v * p.ratio);
      return st.lastAmount > 0;
    },

    /** 每回合一次：同一 key 於同一回合僅第一次回傳 true（寫 st.last 供 chain）。
     *  供「先後手雙時點」的被動避免重複執行（自己出手與對手出手各派發一次）。 */
    round_once: (ctx: BattleEventContext, p: any, st: RunState): boolean => {
      if (typeof p.key !== 'string' || !p.key) return false;
      const stateKey = `blockRoundOnce:${p.key}`;
      const round = ctx.roundNumber ?? 0;
      if (ctx.getPlayerState(stateKey) === round) { st.last = false; return false; }
      ctx.setPlayerState(stateKey, round);
      st.last = true;
      return true;
    },

    /** 本次技能必定命中（自身擁有魂珠時）：寫入引擎 soulSureHitThisAction 讀取端。 */
    sure_hit: (ctx: BattleEventContext): boolean => {
      ctx.setPlayerState('soulSureHitThisAction', true);
      return true;
    },

    /** 場上存在技能 PP 值為 0 的精靈（敵我雙方在場任一；條件型動作，命中寫 st.last）。 */
    field_pp_zero: (ctx: BattleEventContext, _p: any, st: RunState): boolean => {
      const zero = [ctx.self, ctx.target].some((e: any) => (e?.skills || []).some((s: any) => (s.pp ?? 0) <= 0));
      st.last = zero;
      return zero;
    },

    /** 場上存在指定異常狀態的精靈（敵我雙方在場任一；條件型動作，命中寫 st.last）。 */
    field_status: (ctx: BattleEventContext, p: any, st: RunState): boolean => {
      if (typeof p.status !== 'string' || !p.status) return false;
      const present = [ctx.self, ctx.target].some((e: any) => Number((ctx.getStatuses?.(e) || {})[p.status] || 0) > 0);
      st.last = present;
      return present;
    },

    /** 吸取固定體力並把恢復溢出轉為下回合攻擊真傷（5034 戰鬥階段結束）：
     *  對對手造成 flat 固定傷害（自身體力低於 maxHp×belowRatio 時 ×double），
     *  以實際吸取量恢復自身，恢復溢出每溢出自身最大體力 percentPerMaxHp 則下回合
     *  攻擊額外附加對手最大體力同比例的真實傷害。數值與期限全由 Kit 給。 */
    drain_fixed_overflow: (ctx: BattleEventContext, p: any): boolean => {
      if (!(p.flat > 0)) return false;
      const doubled = p.doubleBelowRatio !== undefined && ctx.self.currentHp < ctx.self.maxHp * p.doubleBelowRatio;
      const amount = p.flat * (doubled ? (p.doubleMultiplier ?? 2) : 1);
      let done = false;
      ctx.applyPinkDamage(ctx.targetSide, amount, undefined, undefined, undefined, 'fixed', {
        onSettled: (r: any) => {
          const gained = Math.max(0, Number(r?.settledAmount) || 0);
          if (!gained) return;
          ctx.applyHeal(ctx.actor, gained, { onSettled: (recovery: any) => {
            // 只計超過體力上限的恢復量，不把減療／封回血造成的未恢復量當作溢出。
            const overflow = Math.max(0, (recovery?.hpBefore ?? 0) + (recovery?.settledAmount ?? 0) - ctx.self.maxHp);
            const percent = Math.floor(overflow / ctx.self.maxHp * 100) / 100;
            if (!percent) return;
            ctx.addTimerTo(ctx.actor, { id: p.id || 'orb_overflow', name: p.label || '魂珠溢出',
              kind: 'round_counter', source: 'soulmark', remaining: p.turns ?? 1, tickAt: 'round_end', scope: 'elf',
              ownerBattleId: identity(ctx.self), payload: { attackAdditionalTruePercent: percent } } as any, true);
            ctx.addLog(`🔮 恢復溢出 ${overflow} 點：下回合攻擊附加對手最大體力 ${Math.round(percent * 100)}% 真實傷害！`, 'effect');
          } });
        },
      } as any);
      ctx.addLog(`🔮 吸取對手 ${amount} 點固定體力${doubled ? '（低於半血翻倍）' : ''}！`, 'damage');
      done = true;
      return done;
    },
  };
}

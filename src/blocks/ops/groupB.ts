// B 組新通用 op（2026-10-17，未連接 73 項計畫 B 組）。
// 全部是資料驅動的通用機制：沒有精靈名稱、魂印名稱或專屬常數。
// 讀取端：convert_damage_to_heal_next → runtime.runSideTimers 的 convertDamageToHeal（次數型消耗與比例）；
//         on_next_switch_in（voluntary_switch_out）→ runSideTimers 的 voluntaryOnly 與 ON_SWITCH_OUT 的 forced 旗標；
//         on_next_switch_in（opp）→ effects/deferredEntryEffects 同一佇列；
//         first_next → battleEngine calcPriority 既有的 first 計時器；add_invalid_own → 既有 addInvalid 計時器；
//         damage_floor_flat → damageComp.floor（既有最終傷害下限）／技能無效時以技能傷害補償。
import type { BattleEventContext } from '../../effects/types';
import type { RunState } from '../runtime';
import { deferAllyEntry } from '../../effects/deferredEntryEffects';

type S = 'p1' | 'p2';
type OpFn = (ctx: BattleEventContext, p: any, st: RunState) => boolean | void;
const STAT_KEYS = ['atk', 'def', 'spatk', 'spdef', 'speed', 'accuracy'] as const;
const idOf = (e: any) => String(e?.battleId || e?.id || '');

/** 契約：新 op 允許的參數名（登記於 sequenceContract.SEQUENCE_ACTION_FIELDS）。 */
export const GROUP_B_ACTION_FIELDS: Record<string, readonly string[]> = {
  convert_damage_to_heal_next: ['n', 'ratio', 'kind'],
  status_transfer_all: ['side', 'as', 'status', 'turns'],
  on_next_switch_in: ['side', 'after', 'resource', 'ratio', 'body', 'label'],
  first_next: ['uses'],
  add_invalid_own: ['uses', 'kind'],
  damage_floor_flat: ['amount', 'doublings', 'doubleBy', 'healRatio'],
  // 陣亡轉贈：把目前護盾值（與守護印記旗標）交給下一隻上場己方。
  // 讀取端 effects/rules/nextElfPending（nextElfShield）＋ imperial-shield/battleRule（守護印記層數曲線）。
  defer_shield_to_next: ['guardianMark', 'min'],
};

/** 新增的計數來源（登記於契約的 per 白名單；runtime 以 PER_COUNTERS 讀取）。 */
export const GROUP_B_PER_NAMES = ['stat_level_unequal_kinds', 'stat_level_equal_kinds', 'foe_hp_deciles', 'self_hp_lost_deciles'] as const;
const DECILE_SOURCES = ['foe_hp_deciles', 'self_hp_lost_deciles'];

/** 能力等級比較：6 種能力逐項比。相同＝雙方等級相等且不為 0（無論上升或下降都算「處於該狀態」）；不相同＝等級不等。 */
export function groupBCounters(liveElf: (ctx: BattleEventContext, side: S) => any): Record<string, (ctx: BattleEventContext) => number> {
  const levels = (ctx: BattleEventContext) => {
    const self = liveElf(ctx, ctx.actor)?.statStages || {}, opp = liveElf(ctx, ctx.targetSide)?.statStages || {};
    return STAT_KEYS.map(k => [Number((self as any)[k]) || 0, Number((opp as any)[k]) || 0] as const);
  };
  const decile = (current: number, max: number) => max > 0 ? Math.max(0, Math.min(10, Math.floor(Math.max(0, current) / max * 10 + 1e-9))) : 0;
  return {
    stat_level_unequal_kinds: ctx => levels(ctx).filter(([a, b]) => a !== b).length,
    stat_level_equal_kinds: ctx => levels(ctx).filter(([a, b]) => a === b && a !== 0).length,
    foe_hp_deciles: ctx => { const e = liveElf(ctx, ctx.targetSide); return decile(e?.currentHp ?? 0, e?.maxHp ?? 0); },
    self_hp_lost_deciles: ctx => { const e = liveElf(ctx, ctx.actor); return decile((e?.maxHp ?? 0) - (e?.currentHp ?? 0), e?.maxHp ?? 0); },
  };
}

/** 契約補充檢查；回傳 null 代表通過。nested 讓 sequenceContract 驗證交付子流程（trig=entrance）。 */
export function groupBActionIssue(op: string, p: any, trig: string, nested: (body: any[], trig: string) => string | null): string | null {
  if (op === 'convert_damage_to_heal_next') {
    if (!Number.isInteger(p.n) || p.n < 1 || p.n > 100) return '下N次傷害轉體力需1至100的整數次數';
    if (!(p.ratio > 0 && p.ratio <= 1)) return '傷害轉體力比例需大於0且不超過100%';
    if (!['攻擊', '技能'].includes(p.kind)) return '傷害轉體力需明確攻擊／技能傷害範圍';
  }
  if (op === 'defer_shield_to_next') {
    if (p.guardianMark !== undefined && typeof p.guardianMark !== 'boolean') return '陣亡轉贈守護印記需布林旗標';
    if (p.min !== undefined && (!Number.isInteger(p.min) || p.min < 0)) return '陣亡轉贈最低護盾需非負整數';
  }
  if (op === 'status_transfer_all') {
    if (!['self', 'opp'].includes(p.side)) return '異常轉化需單一目標';
    if (!Number.isInteger(p.turns) || p.turns < 1 || p.turns > 10000) return '異常轉化需正整數期限';
    if ((p.as === 'highest_mark') === (typeof p.status === 'string')) return '異常轉化需擇一：自身記錄的異常抗性最高項，或明確異常名稱';
    if (p.as !== undefined && p.as !== 'highest_mark') return '異常轉化的動態來源只支援自身記錄的異常抗性最高項';
  }
  if (op === 'on_next_switch_in') {
    if (!['self', 'opp'].includes(p.side) || !['now', 'voluntary_switch_out'].includes(p.after ?? 'now')) return '下隻登場交付需明確陣營與時機';
    if (p.after === 'voluntary_switch_out' && (p.side !== 'self' || !['use', 'self_skill', 'self_attack', 'self_status', 'after_hit', 'kill', 'not_killed'].includes(trig))) return '主動切換後交付只能由自身陣營在使用／命中／擊敗事件建立';
    if (p.side === 'opp' && !['use', 'self_skill', 'self_attack', 'self_status', 'after_hit', 'kill', 'not_killed'].includes(trig)) return '對手下隻登場交付需自身使用／命中／擊敗事件';
    if (!['none', 'maxHp', 'currentHp'].includes(p.resource ?? 'none') || !(p.ratio === undefined || p.ratio > 0)) return '交付資源快照只支援無、最大體力或當前體力，比例需為正數';
    if (!Array.isArray(p.body) || !p.body.length) return '下隻登場交付需子流程';
    const issue = nested(p.body, 'entrance'); if (issue) return `下隻登場交付：${issue}`;
  }
  if (op === 'first_next' && (!Number.isInteger(p.uses) || p.uses < 1 || p.uses > 100)) return '首次必定先手需正整數次數';
  if (op === 'add_invalid_own' && (!Number.isInteger(p.uses) || p.uses < 1 || p.uses > 100 || !['all', '攻擊', '屬性'].includes(p.kind ?? 'all'))) return '自身附加效果失效需正整數次數與技能範圍';
  if (op === 'damage_floor_flat') {
    if (!['outgoing_attack', 'on_invalid', 'self_invalid'].includes(trig)) return '傷害保底需攻擊傷害公式前事件，或技能無效事件作補償';
    if (!(p.amount > 0 && p.amount <= 1e6)) return '傷害保底需正數基數';
    if (p.doublings !== undefined && (!Number.isInteger(p.doublings) || p.doublings < 0 || p.doublings > 20)) return '保底翻倍次數需0至20的整數';
    if (p.doubleBy !== undefined && !DECILE_SOURCES.includes(p.doubleBy)) return '保底翻倍來源不明';
    if (p.healRatio !== undefined && (!(p.healRatio > 0 && p.healRatio <= 10) || trig === 'outgoing_attack')) return '補償吸血比例只用於技能無效時的補償傷害，且需為正數';
  }
  return null;
}

export function groupBPresentation(op: string, p: any, side: string): string | null {
  switch (op) {
    case 'convert_damage_to_heal_next': return `令自身下${p.n}次受到的${p.kind}傷害轉化為體力（${Math.round(p.ratio * 100)}%）`;
    case 'status_transfer_all': return `${side}所有異常轉化為${p.as === 'highest_mark' ? '自身記錄的異常抗性最高項異常' : p.status}（${p.turns}回合）`;
    case 'on_next_switch_in': return `${p.side === 'opp' ? '對手' : '己方'}下隻精靈登場時（${p.after === 'voluntary_switch_out' ? '自身下次主動切換下場後' : '立即建立'}）執行${p.body?.length ?? 0}條子流程`;
    case 'first_next': return `下${p.uses}次使用技能必定先手`;
    case 'add_invalid_own': return `自身下${p.uses}次使用的${p.kind === '攻擊' ? '攻擊' : p.kind === '屬性' ? '屬性' : ''}技能附加效果失效`;
    case 'damage_floor_flat': return `本次造成技能傷害不少於${p.amount}${p.doublings ? `，並先翻倍${p.doublings}次` : ''}${p.doubleBy === 'foe_hp_deciles' ? '，對手體力每有10%額外翻倍1次' : p.doubleBy === 'self_hp_lost_deciles' ? '，自身已損失體力每有10%額外翻倍1次' : ''}`;
    default: return null;
  }
}

export function groupBOperations(helpers: {
  liveElf: (ctx: BattleEventContext, side: S) => any;
  addTimer: (ctx: BattleEventContext, side: S, name: string, n: number, mode: 'turns' | 'uses', payload: Record<string, any>, ...rest: any[]) => void;
  ops: () => Record<string, OpFn>;
  counters: Record<string, (ctx: BattleEventContext) => number>;
}): Record<string, OpFn> {
  const { liveElf, addTimer } = helpers;
  const deliveryKey = 'nextElfBlockPrograms';
  const snapshot = (ctx: BattleEventContext, resource: string) => resource === 'none' ? 0 : Number(liveElf(ctx, ctx.actor)?.[resource] ?? 0);
  return {
    // 陣亡轉贈：把自身目前護盾值寫入 nextElfShield（讀取端 effects/rules/nextElfPending 於下一隻登場時發放）；
    // guardianMark 為真時同時升起「守護印記」旗標（讀取端 imperial-shield/battleRule 依層數給減傷）。
    // 通用：不帶精靈名稱；守護印記的層數曲線與期限由 battleRule 的通用規格決定。
    defer_shield_to_next: (ctx, p) => {
      const selfElf = liveElf(ctx, ctx.actor);
      const shield = Math.max(0, Math.floor(Number(selfElf?.shield) || 0));
      const amount = Math.max(Number(p.min) || 0, shield);
      if (amount > 0) ctx.setPlayerState('nextElfShield', amount);
      if (p.guardianMark) ctx.setPlayerState('nextElfGuardianMark', true);
      if (amount > 0 || p.guardianMark) {
        ctx.addLog?.(`🛡️ 陣亡轉贈：護盾 ${amount} 點${p.guardianMark ? '與守護印記' : ''}將交給下一隻上場精靈！`, 'effect');
      }
      return amount > 0 || !!p.guardianMark;
    },
    // 下N次受到的攻擊／技能傷害轉化為體力；每次實際轉化消耗一次（runtime.runSideTimers 讀取）。
    convert_damage_to_heal_next: (ctx, p, st) => {
      addTimer(ctx, ctx.actor, '下次受到的傷害轉體力', p.n, 'uses',
        { convertDamageToHeal: true, convertRatio: p.ratio, kind: p.kind, sourceKind: st.sourceKind });
      return true;
    },
    // 對手（或自身）所有異常轉化為指定異常；動態來源＝自身記錄的異常抗性最高項（elf.starGovernanceStatus）。
    status_transfer_all: (ctx, p, st) => {
      const status = p.as === 'highest_mark' ? liveElf(ctx, ctx.actor)?.starGovernanceStatus : p.status;
      if (typeof status !== 'string' || !status || status === '無') return false;
      return helpers.ops().convert_status(ctx, { side: p.side, status, turns: p.turns }, st) === true;
    },
    // 下一隻登場精靈的一次性掛鉤。after=now：立即把子流程排給「己方下隻／對手下隻」登場者；
    // after=voluntary_switch_out：自身下次主動切換下場時才排給己方下隻（死亡後的強制換人不算）。
    on_next_switch_in: (ctx, p, st) => {
      const resource = p.resource ?? 'none', ratio = p.ratio ?? 1, label = p.label || '下次隊友登場效果';
      if (p.after === 'voluntary_switch_out') {
        addTimer(ctx, ctx.actor, '下次主動切換後交付', 1, 'uses', {
          trig: 'switch_out', voluntaryOnly: true, once: true, sourceKind: st.sourceKind,
          body: [{ acts: [{ op: 'next_ally_entry', p: { resource, ratio, excludeSource: true, body: structuredClone(p.body), label }, label: 'next_ally_entry' }] }],
        });
        return true;
      }
      if (p.side === 'self') return deferAllyEntry(ctx, { resource, ratio, excludeSource: true, body: p.body, label }, st);
      const pending: any[] = ctx.getOpponentState(deliveryKey) || [];
      if (pending.length >= 100) return false;
      const value = snapshot(ctx, resource);
      ctx.setOpponentState(deliveryKey, [...pending, { sourceSide: ctx.actor, sourceBattleId: idOf(ctx.self), sourceKind: st.sourceKind || 'skill',
        amount: Math.max(0, Math.floor(value * ratio)), excludeSource: false, body: structuredClone(p.body), label }]);
      return true;
    },
    // 下N次使用技能必定先手：use_counter 帶 first 與 prio:0，沿用引擎既有的先制消耗點。
    first_next: (ctx, p) => {
      addTimer(ctx, ctx.actor, '首次必定先手', p.uses, 'uses', { first: true, prio: 0, startAfterActionId: ctx.actionId });
      return true;
    },
    // 自身下N次使用技能時，附加效果失效（可於下隻登場子流程內建立在登場者身上）。
    add_invalid_own: (ctx, p) => {
      addTimer(ctx, ctx.actor, '附加失效', p.uses, 'uses', { addInvalid: p.kind || 'all' });
      return true;
    },
    // 傷害保底：公式前設 damageComp.floor；技能無效（沒有 damageComp）時改以技能傷害補償並記錄結算量（可選吸血比例）。
    damage_floor_flat: (ctx, p, st) => {
      const counter = p.doubleBy ? helpers.counters[p.doubleBy] : undefined;
      const times = (p.doublings || 0) + (counter ? counter(ctx) : 0);
      const amount = Math.floor(p.amount * 2 ** times);
      if (!(amount > 0)) return false;
      const comp = st.event?.data?.damageComp || (ctx as any).damageComp;
      if (comp) {
        if (comp.isIncoming || comp.damageCategory !== 'skill_attack') return false;
        comp.floor = Math.max(comp.floor || 0, amount);
        return true;
      }
      if (st.event?.trig !== 'self_invalid' && st.event?.trig !== 'on_invalid') return false;
      const dealt = Number(ctx.applySkillTypeDamage(ctx.targetSide, amount, ctx.skill?.name || '傷害保底', { elem: ctx.skill?.type, floor: amount, node: 'attack_damage' }) || 0);
      st.lastAmount = dealt;
      if (dealt > 0 && p.healRatio > 0) ctx.applyHeal(ctx.actor, Math.floor(dealt * p.healRatio)); // 補償傷害同樣是「造成技能傷害」，吸血比例由 Kit 給
      return dealt > 0;
    },
  };
}


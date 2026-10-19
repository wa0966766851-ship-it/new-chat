// 5007 克塔亞特／濁 魂印「濁」通用件（DSH 20261018 第二十四批）。
// 額外精靈生命週期與真實傷害疊層缺口，以通用 op 表達；引擎既有 createExtraElf／addExtraElf 承擔召喚。
import type { BattleEventContext } from '../../effects/types';
import { createExtraElf } from '../../utils/extraElf';

type S = 'p1' | 'p2';

/**
 * 額外精靈專屬 Kit 註冊表（DSH 20261020）。
 * params 無法攜帶 KitEntry 陣列（序列化會丟失），故由資料層註冊、op 執行時按名查找。
 */
const EXTRA_ELF_KITS = new Map<string, any[]>();
export function registerExtraElfKit(name: string, kit: any[]): void { EXTRA_ELF_KITS.set(name, kit); }
export function extraElfKitByName(name: string): any[] | undefined { return EXTRA_ELF_KITS.get(name); }

/**
 * 克塔亞特（5007 濁的額外精靈）自身條款——定義在 op 同模組，避免模組載入順序問題（DSH 20261020）。
 * node 對應引擎廣播：ally_entered（隊友出戰）、battle_phase_end、self_fatal。
 * 己方＝克塔亞特所在陣營（使用者裁定 2026-10-18），故漸凍施加對象為 opp 視角。
 */
export const CTHYAAT_SELF_KIT: any[] = [
  { codeId: 'effect_sequence', source: 'soulmark', role: 'innate', node: 'ally_entered', order: 0,
    customText: '克塔亞特：己方精靈每次出戰時令其漸凍1回合，未觸發則3回合內造成非真實傷害減半n次（n=本次在場期間所受到真實傷害次數）',
    params: { clause: { raw: '克塔亞特：己方精靈每次出戰時令其漸凍1回合，未觸發則3回合內造成非真實傷害減半n次', trig: 'ally_entered', parsed: true, body: [
      { acts: [{ op: 'status', p: { side: 'self', status: '漸凍', turns: 1, chance: 100 } }] },
    ] } } },
  { codeId: 'effect_sequence', source: 'soulmark', role: 'innate', node: 'battle_phase_end', order: 1,
    customText: '克塔亞特：己方精靈任意戰鬥階段節點結算時自身額外汲取己方在場精靈當前體力¼',
    params: { clause: { raw: '克塔亞特：己方精靈任意戰鬥階段節點結算時自身額外汲取己方在場精靈當前體力¼', trig: 'phase_end', parsed: true, body: [
      { acts: [{ op: 'extra_elf_heal_owner', p: { ratio: 0.25, side: 'self' } }] },
    ] } } },
  { codeId: 'effect_sequence', source: 'soulmark', role: 'innate', node: 'self_fatal', order: 2,
    customText: '克塔亞特：被擊敗時將自身最大體力上限的50%平均分給己方存活精靈',
    params: { clause: { raw: '克塔亞特：被擊敗時將自身最大體力上限的50%平均分給己方存活精靈', trig: 'fatal', parsed: true, body: [
      { acts: [{ op: 'vanish_on_death_maxhp_share', p: { ratio: 0.5, side: 'opp' } }] },
    ] } } },
];
// 模組載入即註冊（同模組常數，無順序問題）。
EXTRA_ELF_KITS.set('克塔亞特', CTHYAAT_SELF_KIT);
const idOf = (e: any) => String(e?.battleId || e?.id || '');

export const BRINKK_ACTION_FIELDS: Record<string, readonly string[]> = {
  summon_extra_elf: ['name', 'type', 'statFromTeamRatio', 'side', 'kit'],
  true_damage_stack: ['key', 'stackStep', 'maxStacks', 'dir', 'kind'],
  off_field_hp_drain: ['ratio', 'key', 'maxStacks'],
  extra_elf_heal_owner: ['ratio', 'side'],
  vanish_on_death_maxhp_share: ['ratio', 'side'],
};

export function brinkkActionIssue(op: string, p: any): string | null {
  if (op === 'summon_extra_elf') {
    if (typeof p.name !== 'string' || !p.name) return '召喚額外精靈需名稱';
    if (typeof p.type !== 'string' || !p.type) return '召喚額外精靈需屬性';
    if (!(p.statFromTeamRatio > 0 && p.statFromTeamRatio <= 1)) return '召喚額外精靈能力來源需0至100%比例';
    if (!['self', 'opp'].includes(p.side)) return '召喚額外精靈需指定陣營';
    return null;
  }
  if (op === 'true_damage_stack') {
    if (typeof p.key !== 'string' || !p.key) return '真實傷害疊層需狀態鍵';
    if (!(p.stackStep > 0 && p.stackStep <= 1)) return '真實傷害疊層每層需0至100%';
    if (!Number.isInteger(p.maxStacks) || p.maxStacks < 1 || p.maxStacks > 100) return '真實傷害疊層上限需1至100';
    if (!['in', 'out', 'in_reduce', 'out_reduce'].includes(p.dir)) return '真實傷害疊層方向不明';
    if (!['技能', '攻擊', '固定', '百分比', '非真實'].includes(p.kind)) return '真實傷害疊層傷害類型不明';
    return null;
  }
  if (op === 'off_field_hp_drain') {
    if (!(p.ratio > 0 && p.ratio <= 1)) return '場下消耗體力需0至100%比例';
    if (typeof p.key !== 'string' || !p.key) return '場下消耗體力需狀態鍵';
    if (!Number.isInteger(p.maxStacks) || p.maxStacks < 1 || p.maxStacks > 100) return '場下疊層上限需1至100';
    return null;
  }
  if (op === 'extra_elf_heal_owner') {
    if (!(p.ratio > 0 && p.ratio <= 1)) return '額外精靈汲取需0至100%比例';
    return null;
  }
  if (op === 'vanish_on_death_maxhp_share') {
    if (!(p.ratio > 0 && p.ratio <= 1)) return '死亡消逝需0至100%體力上限比例';
    return null;
  }
  return null;
}

export function brinkkOperations(helpers: { liveElf: (ctx: BattleEventContext, side: S) => any }) {
  return {
    summon_extra_elf: (ctx: BattleEventContext, p: any): boolean => {
      if (typeof (ctx as any).addExtraElf !== 'function') return false;
      const side: S = p.side === 'self' ? ctx.actor : ctx.targetSide;
      const team = ((ctx as any).getFullTeam?.(side) || []) as any[];
      const base = helpers.liveElf(ctx, side) || team[0];
      if (!base) return false;
      const sum = team.filter(e => e && !e.isVanished).reduce((acc: any, e: any) => {
        const st = e.calculatedStats || {};
        for (const k of ['atk', 'def', 'spatk', 'spdef', 'speed', 'hp']) acc[k] += st[k] || 0;
        return acc;
      }, { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0, hp: 0 });
      const scaled: any = {};
      for (const k of Object.keys(sum)) scaled[k] = Math.max(1, Math.floor(sum[k] * p.statFromTeamRatio));
      // DSH 20261020：額外精靈的專屬 Kit 由註冊表按名字取得（Kit 參數無法通過 params 序列化）。
      const extraKit = extraElfKitByName(p.name);
      const extra = createExtraElf(base, { name: p.name, type: p.type, calculatedStats: scaled, maxHp: scaled.hp, currentHp: scaled.hp,
        ...(extraKit?.length ? { kit: extraKit } : {}) } as any);
      (ctx as any).addExtraElf(side, extra);
      (ctx as any).addLog?.('召喚額外精靈：' + p.name, 'effect');
      return true;
    },
    true_damage_stack: (ctx: BattleEventContext, p: any): boolean => {
      const key = p.key;
      const prev = Number((ctx as any).getPlayerState?.(key) || 0);
      if (prev >= p.maxStacks) return false;
      const next = prev + 1;
      (ctx as any).setPlayerState?.(key, next);
      const total = next * p.stackStep;
      const act = (ctx as any).runAct;
      if (typeof act === 'function') act({ op: 'dmg_mod_turns', p: { side: 'self', dir: p.dir, kind: p.kind, boost: total, reduce: total, turns: 1 }, label: p.key + ' 疊層' });
      return true;
    },
    off_field_hp_drain: (ctx: BattleEventContext, p: any): boolean => {
      const elf = helpers.liveElf(ctx, ctx.actor);
      if (!elf) return false;
      const key = p.key;
      const prev = Number((ctx as any).getPlayerState?.(key) || 0);
      const loss = Math.floor((Number(elf.currentHp) || 0) * p.ratio);
      if ((Number(elf.currentHp) || 0) - loss <= 0) return false;
      (ctx as any).adjustHp?.(ctx.actor, -loss);
      if (prev < p.maxStacks) (ctx as any).setPlayerState?.(key, prev + 1);
      return true;
    },
    // 「己方」＝克塔亞特（額外精靈）所在的那一方，不是魂印持有者方。
    extra_elf_heal_owner: (ctx: BattleEventContext, p: any): boolean => {
      // 己方＝額外精靈所在方（DSH 20261020：side 依發起者視角）。
      const ownerSide: S = p.side === 'self' ? ctx.actor : ctx.targetSide;
      const active = helpers.liveElf(ctx, ownerSide);
      if (!active) return false;
      // 規格：汲取量＝計算當下的當前體力（非最大體力、非節點開始快照）。
      const amount = Math.floor((Number(active.currentHp) || 0) * p.ratio);
      if (amount <= 0) return false;
      (ctx as any).adjustHp?.(ownerSide, -amount);
      // 「自身額外汲取」：吸取量回填給發起的額外精靈。
      const team = ((ctx as any).getFullTeam?.(ownerSide) || []) as any[];
      const extraSelf = team.find((e: any) => e.isExtra && (ctx.self?.battleId === e.battleId || ctx.self?.id === e.id));
      if (extraSelf) (ctx as any).updateElf?.(ownerSide, { id: extraSelf.id, currentHp: Math.min(extraSelf.maxHp, (Number(extraSelf.currentHp) || 0) + amount) });
      return true;
    },
    // 「己方」＝克塔亞特所在方。
    vanish_on_death_maxhp_share: (ctx: BattleEventContext, p: any): boolean => {
      const ownerSide: S = p.side === 'self' ? ctx.actor : ctx.targetSide;
      const team = ((ctx as any).getFullTeam?.(ownerSide) || []) as any[];
      for (const e of team) {
        if (!e || e.isVanished) continue;
        const cut = Math.floor((Number(e.maxHp) || 0) * p.ratio);
        if (cut > 0) (ctx as any).updateAnyElf?.(ownerSide, idOf(e), { maxHp: Math.max(1, (Number(e.maxHp) || 1) - cut) });
      }
      (ctx as any).vanishElf?.(ownerSide, idOf((ctx as any).self));
      return true;
    },
  };
}
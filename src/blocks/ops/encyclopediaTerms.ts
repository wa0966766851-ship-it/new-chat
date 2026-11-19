/**
 * 戰鬥百科名詞預作積木（2026-11-16）：官方定義已收進百科、專案尚無對應積木的機制。
 * - banish_turns（放逐）：對手背包中的精靈無法主動切換上場＝對手全隊（team 作用域）無法主動切換 N 回合。
 * - boost_invalid_turns（能力提升效果失效）：N 回合內目標的能力提升不參與能力值計算（傷害公式攻防等級讀取端），
 *   但仍算處於能力提升、仍計入等級計數（statStages 不變）。
 * - copy_opp_skill（複製技能）：自身下 N 次使用技能時，改用對手當回合選擇的技能（PP 仍扣原技能欄位）；對手當回合未選技能則不消耗。
 * - invoke_skill（調用技能）：自身下 N 次使用【外殼】技能（不指定＝任何技能）時，改以指定技能的邏輯結算（系別、類型、威力、效果），PP 扣外殼。
 *   與複製技能同一個讀取端（resolveSkillReplacement）：複製＝來源是對手當回合技能，調用＝來源是自身技能庫中的指定技能。
 * - unseal_skill（解封）：技能資料標 sealedUntilUnseal 時初始不可選（選招判定回傳「尚未解封」）；此動作解除指定技能的封印，本場有效。
 * 反饋（將自身異常依次附加給對手）沿用既有 copy_statuses{from:self,to:opp}；臨時體力上限沿用 maxhp{temporary:true}。
 */
import type { BattleEventContext } from '../../effects/types';
import type { RunState } from '../runtime';

// addBlockTimer 由 runtime 注入（避免 runtime ↔ ops 循環載入）。
type AddBlockTimer = (...args: any[]) => any;

export const ENCYCLOPEDIA_TERM_ACTION_FIELDS = {
  banish_turns: ['turns', 'next'],
  boost_invalid_turns: ['side', 'turns', 'next'],
  copy_opp_skill: ['uses'],
  invoke_skill: ['name', 'shell', 'uses'],
  unseal_skill: ['name'],
} as const;

export function encyclopediaTermActionIssue(op: string, p: any): string | null {
  if (!(op in ENCYCLOPEDIA_TERM_ACTION_FIELDS)) return null;
  const name = (v: any) => typeof v === 'string' && v.length > 0 && v.length <= 40;
  if (op === 'unseal_skill') return name(p?.name) ? null : '需指定要解封的技能名稱';
  if (op === 'invoke_skill') {
    if (!name(p?.name)) return '需指定要調用的技能名稱';
    if (p.shell !== undefined && !name(p.shell)) return '外殼技能名稱需為短文字';
    return Number.isInteger(p?.uses) && p.uses >= 1 && p.uses <= 99 ? null : '次數需為 1–99 的整數';
  }
  if (op === 'copy_opp_skill') return Number.isInteger(p?.uses) && p.uses >= 1 && p.uses <= 99 ? null : '次數需為 1–99 的整數';
  if (!(Number.isInteger(p?.turns) && p.turns >= 1 && p.turns <= 99)) return '回合數需為 1–99 的整數';
  if (p.next !== undefined && typeof p.next !== 'boolean') return '「下N回合」需為是／否';
  if (op === 'boost_invalid_turns' && !['self', 'opp'].includes(p.side)) return '能力提升效果失效需指定自身或對手';
  return null;
}

const isSkillCtx = (st: RunState) => st.sourceKind ? st.sourceKind === 'skill' : !st.event || ['use', 'after_hit', 'on_invalid'].includes(st.event.trig);

export function encyclopediaTermOperations(addBlockTimer: AddBlockTimer) {
  return {
    banish_turns: (ctx: BattleEventContext, p: { turns: number; next?: boolean }, st: RunState): boolean => {
      if (encyclopediaTermActionIssue('banish_turns', p)) return false;
      addBlockTimer(ctx, ctx.targetSide, '放逐', p.turns, 'turns', { lockSwitch: true, banish: true }, !!p.next, isSkillCtx(st) ? 'turn_effect' : 'round_counter', false, 'team');
      ctx.addLog(`🚷 【放逐】：${p.next ? '下' : ''}${p.turns} 回合內對手背包精靈無法主動切換上場！`, 'effect');
      return true;
    },
    boost_invalid_turns: (ctx: BattleEventContext, p: { side: 'self' | 'opp'; turns: number; next?: boolean }, st: RunState): boolean => {
      if (encyclopediaTermActionIssue('boost_invalid_turns', p)) return false;
      const side = p.side === 'opp' ? ctx.targetSide : ctx.actor;
      addBlockTimer(ctx, side, '能力提升效果失效', p.turns, 'turns', { boostInvalid: true }, !!p.next, isSkillCtx(st) ? 'turn_effect' : 'round_counter');
      ctx.addLog(`📉 【能力提升效果失效】：${p.turns} 回合內${p.side === 'opp' ? '對手' : '自身'}的能力提升不參與能力值計算！`, 'effect');
      return true;
    },
    copy_opp_skill: (ctx: BattleEventContext, p: { uses: number }): boolean => {
      if (encyclopediaTermActionIssue('copy_opp_skill', p)) return false;
      addBlockTimer(ctx, ctx.actor, '複製技能', p.uses, 'uses', { copyOppSkill: true }, false, undefined, false, 'elf', 'term_copy_opp_skill');
      ctx.addLog(`🪞 【複製技能】：自身下 ${p.uses} 次使用技能時改用對手當回合使用的技能！`, 'effect');
      return true;
    },
    invoke_skill: (ctx: BattleEventContext, p: { name: string; shell?: string; uses: number }): boolean => {
      if (encyclopediaTermActionIssue('invoke_skill', p)) return false;
      addBlockTimer(ctx, ctx.actor, '調用技能', p.uses, 'uses', { invokeSkill: p.name, ...(p.shell ? { invokeShell: p.shell } : {}) }, false, undefined, false, 'elf', `term_invoke_skill:${p.shell || '*'}`);
      ctx.addLog(`🔁 【調用技能】：自身下 ${p.uses} 次使用${p.shell ? `【${p.shell}】` : '技能'}時改以【${p.name}】結算！`, 'effect');
      return true;
    },
    unseal_skill: (ctx: BattleEventContext, p: { name: string }): boolean => {
      if (encyclopediaTermActionIssue('unseal_skill', p)) return false;
      const done: string[] = (ctx.self as any).unsealedSkills || [];
      if (done.includes(p.name)) return false;
      ctx.updateElf(ctx.actor, { unsealedSkills: [...done, p.name] } as any);
      ctx.addLog(`🔓 【解封】：【${p.name}】已可選擇使用！`, 'effect');
      return true;
    },
  };
}

/** 解封：技能資料標 sealedUntilUnseal 且本場尚未解封時不可選擇。 */
export const skillSealedUntilUnseal = (elf: any, skill: any): boolean =>
  skill?.sealedUntilUnseal === true && !((elf?.unsealedSkills || []) as string[]).includes(skill.name);

/**
 * 讀取端（複製／調用共用）：本次出手改用的技能與要消耗的計時器 id；沒有替換時原樣回傳。
 * 替換後的技能保留原技能欄位的 PP（PP 已由原技能扣除）；replacedFrom 記錄外殼名稱。
 */
export function resolveSkillReplacement(timers: any[] | undefined, skill: any, opponentSkill: any, self?: any): { skill: any; consume?: string; mode?: 'copy' | 'invoke' } {
  const live = (timers || []).filter(x => !x.pendingActivation && (x.remaining ?? 0) > 0 && x.payload?.block);
  const wrap = (src: any, mode: 'copy' | 'invoke', id: string) => ({ mode, consume: id,
    skill: { ...structuredClone(src), pp: skill.pp, maxPp: skill.maxPp, replacedFrom: skill.name, ...(mode === 'copy' ? { copiedFrom: src.name } : { invokedFrom: skill.name }), isFifthSkill: skill.isFifthSkill } });
  const inv = live.find(x => x.payload.block.invokeSkill && (!x.payload.block.invokeShell || x.payload.block.invokeShell === skill?.name));
  if (inv && inv.payload.block.invokeSkill !== skill?.name) {
    const target = [...(self?.skills || []), ...(self?.skillPool || [])].find((s: any) => s?.name === inv.payload.block.invokeSkill);
    if (target) return wrap(target, 'invoke', inv.id);
  }
  const copy = live.find(x => x.payload.block.copyOppSkill === true);
  if (copy && opponentSkill?.name && opponentSkill.name !== skill?.name) return wrap(opponentSkill, 'copy', copy.id);
  return { skill };
}
/** 舊名保留（複製技能）。 */
export const copyOpponentSkill = (timers: any[] | undefined, skill: any, opponentSkill: any) => resolveSkillReplacement(timers?.filter(t => t.payload?.block?.copyOppSkill), skill, opponentSkill);

/** 讀取端：該側目前是否處於能力提升效果失效（傷害公式用；與 findBlockTimer 同一套有效條件）。 */
export const boostInvalidActive = (timers: any[] | undefined): boolean =>
  (timers || []).some(t => t.payload?.block?.boostInvalid === true && !t.payload.block.mirror && !t.pendingActivation && (t.remaining ?? 0) > 0);

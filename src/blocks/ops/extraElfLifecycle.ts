// 額外精靈生命週期通用 op／條件（DSH 2026-10-31，B 組）。
// 不含任何精靈專屬碼：炫彩山神只是第一個使用者，之後的額外精靈同樣以這些 op 寫自己的 Kit。
//
// 供其他 Kit（例如卡修斯魂印）使用的 op：
//   kill_owned_extra { id, ownerShield?, resetOwnerRounds? }
//       令「擁有者（ctx.self）召喚的、種類 id 為 id 的額外精靈」死亡：先觸發其 self_fatal，再消逝。
//       ownerShield:'gone' 時，擁有者仍有護盾則不動作（防誤殺）；省略＝不檢查。
//       resetOwnerRounds:true 時一併清除擁有者方「本次在場累計回合數」。
//   reset_field_rounds { side }  清除該方「本次在場累計回合數」（與 kill_owned_extra.resetOwnerRounds 同一實作）。
// 額外精靈自己的 Kit 使用的 op（frame.kitOwner＝該額外精靈）：
//   extra_die {}                          自身死亡（觸發自己的 self_fatal 後消逝）
//   extra_cure_self {}                    解除自身異常狀態
//   extra_owner_shield { ratio }          為召喚者附加「召喚者最大體力 × ratio」的護盾
//   extra_owner_status { status, turns }  為召喚者附加狀態
// 條件：
//   entered_not_owner {}  ally_entered 節點專用：登場者與額外精靈同隊、不是額外精靈、且不是召喚者（同名亦視為召喚者）
import type { BattleEventContext } from '../../effects/types';
import { extraKindOf } from '../../utils/extraElf';
import { clearAllStatuses } from '../../utils/battleHelpers';

type S = 'p1' | 'p2';
const idOf = (e: any) => String(e?.battleId || e?.id || '');

export const EXTRA_ELF_LIFECYCLE_ACTION_FIELDS: Record<string, readonly string[]> = {
  kill_owned_extra: ['id', 'ownerShield', 'resetOwnerRounds'],
  reset_field_rounds: ['side'],
  extra_die: [],
  extra_cure_self: [],
  extra_owner_shield: ['ratio'],
  extra_owner_status: ['status', 'turns'],
};
export const EXTRA_ELF_LIFECYCLE_CONDITION_FIELDS: Record<string, readonly string[]> = {
  entered_not_owner: [],
};

export function extraElfLifecycleActionIssue(op: string, p: any): string | null {
  if (op === 'kill_owned_extra') {
    if (typeof p.id !== 'string' || !/^[A-Za-z][A-Za-z0-9_]*$/.test(p.id)) return '額外精靈種類 id 需英文字母開頭';
    if (p.ownerShield !== undefined && p.ownerShield !== 'gone') return '擁有者護盾條件只支援 gone';
    if (p.resetOwnerRounds !== undefined && typeof p.resetOwnerRounds !== 'boolean') return '清除在場回合數需布林值';
    return null;
  }
  if (op === 'reset_field_rounds') return ['self', 'opp'].includes(p.side) ? null : '清除在場回合數需指定自身或對手';
  if (op === 'extra_owner_shield') return p.ratio > 0 && p.ratio <= 2 ? null : '召喚者護盾需0至200%比例';
  if (op === 'extra_owner_status') {
    if (typeof p.status !== 'string' || !p.status) return '召喚者狀態需名稱';
    if (!Number.isInteger(p.turns) || p.turns < 1) return '召喚者狀態需正整數回合';
  }
  return null;
}

/** 擁有者目前的即時狀態（依 id 重新從隊伍取得）。 */
const liveOf = (ctx: BattleEventContext, side: S, elf: any) =>
  ((ctx as any).getFullTeam?.(side) || []).find((e: any) => idOf(e) === idOf(elf));

/** frame.kitOwner（額外精靈）的召喚者。 */
function summonerOf(ctx: BattleEventContext, side: S): any {
  const owner = (ctx as any).kitOwner;
  if (!owner?.summonerId) return undefined;
  return ((ctx as any).getFullTeam?.(side) || []).find((e: any) => idOf(e) === String(owner.summonerId));
}

export function extraElfLifecycleCondition(ctx: BattleEventContext, c: any): boolean | undefined {
  if (c.c !== 'entered_not_owner') return undefined;
  const holder = (ctx as any).kitOwner;
  if (!holder) return false;
  if ((ctx as any).enteredSide !== ctx.actor) return false;
  const team = ((ctx as any).getFullTeam?.(ctx.actor) || []) as any[];
  const enteredId = String((ctx as any).enteredId ?? '');
  const entered = team.find(e => idOf(e) === enteredId || String(e?.id) === enteredId);
  if (!entered || entered.isExtra) return false;
  const summoner = summonerOf(ctx, ctx.actor);
  if (summoner) return entered.name !== summoner.name;
  return idOf(entered) !== String(holder.summonerId ?? '');
}

// killExtraElf 由 runtime 經 ctx.killExtraElf 注入（blocks/runtime 不得靜態引入 battle/extraElfKit：它經 effectRunner 回引 runtime，會形成打包區塊循環，見 audit:bundle）。
export function extraElfLifecycleOperations(helpers: {
  runAct: (ctx: BattleEventContext, act: any, st: any) => any;
  killExtraElf: (ctx: any, side: S, extra: any, data?: Record<string, unknown>) => boolean;
}) {
  const resetRounds = (ctx: BattleEventContext, side: S) =>
    (side === ctx.actor ? ctx.setPlayerState : (ctx as any).setOpponentState)(`${side}_turnsInBattle`, 0);
  return {
    kill_owned_extra: (ctx: BattleEventContext, p: any): boolean => {
      const owner = liveOf(ctx, ctx.actor, ctx.self);
      if (!owner) return false;
      if (p.ownerShield === 'gone' && Number(owner.shield) > 0) return false;
      const extra = ((ctx as any).getFullTeam?.(ctx.actor) || []).find((e: any) =>
        e?.isExtra && extraKindOf(e) === p.id && String(e.summonerId) === idOf(owner));
      if (!extra) return false;
      const killed = helpers.killExtraElf(ctx, ctx.actor, extra, { reason: 'owned_extra_kill', ownerId: idOf(owner) });
      if (killed && p.resetOwnerRounds) resetRounds(ctx, ctx.actor);
      if (killed) (ctx as any).addLog?.(`【${extra.name}】死亡，清除${owner.name}本次在場累計回合數。`, 'effect');
      return killed;
    },
    reset_field_rounds: (ctx: BattleEventContext, p: any): boolean => {
      resetRounds(ctx, p.side === 'self' ? ctx.actor : ctx.targetSide);
      return true;
    },
    extra_die: (ctx: BattleEventContext): boolean => {
      const me = (ctx as any).kitOwner;
      return me ? helpers.killExtraElf(ctx, ctx.actor, me, { reason: 'self_die' }) : false;
    },
    extra_cure_self: (ctx: BattleEventContext): boolean => {
      const me = liveOf(ctx, ctx.actor, (ctx as any).kitOwner);
      if (!me) return false;
      const updated = { ...me, effects: [...(me.effects || [])], battleStatuses: { ...(me.battleStatuses || {}) } };
      clearAllStatuses(updated);
      (ctx as any).updateAnyElf?.(ctx.actor, idOf(me), { effects: updated.effects, battleStatuses: updated.battleStatuses,
        battleStatus: updated.battleStatus, battleStatusDuration: updated.battleStatusDuration });
      return true;
    },
    extra_owner_shield: (ctx: BattleEventContext, p: any, st: any): boolean => {
      const owner = summonerOf(ctx, ctx.actor);
      if (!owner || owner.isVanished || Number(owner.currentHp) <= 0) return false;
      const ownerCtx: any = (ctx as any).contextForElf?.(ctx.actor, owner);
      return !!ownerCtx && !!helpers.runAct(ownerCtx, { op: 'shield', p: { ratio: p.ratio } }, st);
    },
    extra_owner_status: (ctx: BattleEventContext, p: any, st: any): boolean => {
      const owner = summonerOf(ctx, ctx.actor);
      if (!owner || owner.isVanished || Number(owner.currentHp) <= 0) return false;
      const ownerCtx: any = (ctx as any).contextForElf?.(ctx.actor, owner);
      return !!ownerCtx && !!helpers.runAct(ownerCtx, { op: 'status', p: { side: 'self', status: p.status, turns: p.turns, chance: 100 } }, st);
    },
  };
}

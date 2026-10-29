// 5031 六界神王「界」被擊敗反饋（組1；DSH 20261018 final-g1）。
// reflect_defeat_true{ratio}：被擊敗事件中，令「致死來源」受到 自身本回合受到的技能傷害 × ratio 的真實傷害。
//   來源取自被擊敗事件資料 killerSide／killerId（battleEngine 6.2 派發），以 applyDamageToElf 指名個體，
//   所以來源已離場（位於場下）也可命中；查無來源則回落為對方當前在場精靈（舊 handler 行為）。
//   取 receivedSkillDamageThisRound（blocks/registry.recordBattleFacts 於每次受技能傷害累計；同回合同個體）。
import type { BattleEventContext } from '../../effects/types';
import type { RunState } from '../runtime';

const idOf = (e: any) => String(e?.battleId || e?.id || '');

export const DEFEAT_REFLECT_ACTION_FIELDS: Record<string, readonly string[]> = {
  reflect_defeat_true: ['ratio'],
  opp_skill_record_clear: [],
};

export function defeatReflectActionIssue(op: string, p: any, trig: string): string | null {
  if (op === 'opp_skill_record_clear') return null;
  if (op !== 'reflect_defeat_true') return null;
  if (!(p.ratio > 0 && p.ratio <= 10)) return '被擊敗反饋需正比例';
  if (trig !== 'defeated') return '被擊敗反饋只能於被擊敗事件執行';
  return null;
}

/** 引擎的「使用技能紀錄」＝玩家狀態中的 blkUses:<技能>／blkStreak:<技能>／blkLastSkill／lastSkillUsedName。 */
const RECORD_FIXED_KEYS = ['blkLastSkill', 'lastSkillUsedName'] as const;

export function defeatReflectOperations() {
  return {
    // opp_skill_record_clear：清除對方（玩家狀態）全部技能使用紀錄——累計次數、連續使用、最後使用技能。
    //   技能名取對方整隊技能（紀錄以技能名為鍵）；無紀錄也視為成功執行但回傳 false。
    opp_skill_record_clear: (ctx: BattleEventContext): boolean => {
      const c: any = ctx;
      const names = new Set<string>();
      for (const elf of (c.getFullTeam?.(c.targetSide) || [])) for (const s of [...(elf?.skills || []), ...(elf?.skillPool || [])]) if (s?.name) names.add(String(s.name));
      let cleared = false;
      const clear = (key: string) => { if (c.getOpponentState?.(key) != null && c.getOpponentState(key) !== 0) { c.setOpponentState(key, null); cleared = true; } };
      for (const n of names) { clear(`blkUses:${n}`); clear(`blkStreak:${n}`); }
      for (const k of RECORD_FIXED_KEYS) clear(k);
      if (cleared) c.addLog?.('🧹 對方使用技能紀錄已清除。', 'effect');
      return cleared;
    },
    reflect_defeat_true: (ctx: BattleEventContext, p: any, st: RunState): boolean => {
      st.lastAmount = 0;
      const c: any = ctx;
      const self = c.self ?? (c.actor === 'p1' ? c.activeP1 : c.activeP2);
      const record = c.getPlayerState?.('receivedSkillDamageThisRound');
      if (!self || !record || record.round !== (c.roundNumber ?? 0) || record.ownerBattleId !== idOf(self)) return false;
      const amount = Math.floor(Number(record.amount) * p.ratio);
      if (!Number.isFinite(amount) || amount <= 0) return false;
      const data: any = st.event?.data?.effectEventData || st.event?.data || {};
      const sideId = (data.killerSide === 'p1' || data.killerSide === 'p2') ? data.killerSide : c.targetSide;
      let sourceId = data.killerId ? String(data.killerId) : '';
      const team: any[] = c.getFullTeam?.(sideId) || [];
      let source = sourceId ? team.find((e: any) => idOf(e) === sourceId) : null;
      if (!source || source.isVanished || (Number(source.currentHp) || 0) <= 0) {
        source = sideId === c.targetSide ? (c.target ?? (sideId === 'p1' ? c.activeP1 : c.activeP2)) : null;
        sourceId = source ? idOf(source) : '';
      }
      if (!source || !sourceId || (Number(source.currentHp) || 0) <= 0 || !c.applyDamageToElf) return false;
      st.lastAmount = c.applyDamageToElf(sideId, sourceId, amount, 'true', { label: '被擊敗反饋', reaction: true, applyTypeMatchup: false });
      if (st.lastAmount > 0) c.addLog?.(`💀 【${self.name}】被擊敗：致死來源【${source.name}】受到 ${st.lastAmount} 點真實傷害。`, 'effect');
      return st.lastAmount > 0;
    },
  };
}

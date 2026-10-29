// 恐懼之種寫入端通用件（legacyWrapped 拆解；DSH 20261018 第十三批·第一波，5025 魂印「懼」）。
// maxhp_absorb_all：吸取敵我雙方所有精靈（含自身、場上或背包、含額外精靈）amount 點體力上限附加給自身，
//   每隻最多吸取至該精靈體力上限為 floor（語意同舊 handler zhakesi-fear/registry.ts ROUND_END 全隊掃描：
//   消逝者跳過、上限低於下限者跳過、currentHp 超過新上限時夾至新上限）。
// opp_active_swap：對手在場精靈身分是否自上次同類檢查後更換（首次檢查僅記錄基準不觸發）——
//   「每次己方精靈登場…提高1層」的回合級偵測通用化（主動換人於選擇階段完成，回合開始即比出差異；
//   死亡換人於下次回合開始偵測）。建議於 battle_start 先記錄基準，使首回合選擇階段的換人也能計數。
import type { BattleEventContext } from '../../effects/types';

const idOf = (e: any) => String(e?.battleId || e?.id || '');

/** 契約欄位（登記於 sequenceContract）。 */
export const FEAR_SEED_ACTION_FIELDS: Record<string, readonly string[]> = {
  maxhp_absorb_all: ['amount', 'floor'],
  opp_active_swap: [],
};

/** 契約補充檢查；回傳 null 代表通過。 */
export function fearSeedActionIssue(op: string, p: any): string | null {
  if (op === 'maxhp_absorb_all') {
    if (!Number.isSafeInteger(p.amount) || p.amount < 1 || p.amount > 10000) return '全場體力上限吸取需1至10000整數點數';
    if (!Number.isSafeInteger(p.floor) || p.floor < 1 || p.floor > 10000) return '體力上限吸取需正整數下限';
    return null;
  }
  return null;
}

/** 執行端（併入 runtime 的 OPS）。 */
export function fearSeedOperations() {
  return {
    maxhp_absorb_all: (ctx: BattleEventContext, p: any): boolean => {
      const p1Team: any[] = ctx.getFullTeam('p1') || [];
      const p2Team: any[] = ctx.getFullTeam('p2') || [];
      const allElves = [...p1Team, ...p2Team];
      let totalAbsorbed = 0;
      for (const elf of allElves) {
        if (!elf || elf.isVanished || elf.maxHp <= p.floor) continue;
        const reduceAmount = Math.min(p.amount, elf.maxHp - p.floor);
        elf.maxHp -= reduceAmount;
        if (elf.currentHp > elf.maxHp) elf.currentHp = elf.maxHp;
        totalAbsorbed += reduceAmount;
        const teamSide = p1Team.some(e => idOf(e) === idOf(elf)) ? 'p1' : 'p2';
        ctx.updateElf(teamSide, { id: elf.id, maxHp: elf.maxHp, currentHp: elf.currentHp });
      }
      // 吸取量附加給自身（自身也可能在上述掃描中被吸取，附加後為淨增益）。
      const self = (ctx.getFullTeam(ctx.actor) || []).find((e: any) => idOf(e) === idOf(ctx.self)) || ctx.self;
      if (!self) return false;
      self.maxHp += totalAbsorbed;
      ctx.updateElf(ctx.actor, { id: self.id, maxHp: self.maxHp });
      ctx.addLog(`🦇 【懼】：魂印吸取！吸取敵我雙方所有精靈 ${p.amount} 點體力上限（最多吸取至 ${p.floor}），自身體力上限增加 ${totalAbsorbed} 點！`, 'effect');
      return true;
    },
    // 對手在場精靈身分變化檢查：比對自上次檢查起的對手在場者身分（狀態鍵隨精靈身分隔離）。
    // 首次檢查僅記錄基準不觸發；主動換人於選擇階段完成，回合開始即比出差異；死亡換人於下次回合開始偵測。
    opp_active_swap: (ctx: BattleEventContext): boolean => {
      const key = `blkOppActiveSeen:${idOf(ctx.self)}`;
      const currentId = idOf(ctx.target) || idOf(ctx.targetSide === 'p1' ? ctx.activeP1 : ctx.activeP2);
      const lastId = ctx.getPlayerState(key);
      ctx.setPlayerState(key, currentId);
      return !!lastId && lastId !== currentId;
    },
  };
}

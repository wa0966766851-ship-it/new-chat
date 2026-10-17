import type { BattleSkillHandler, DamageComputation } from '../../types';
import { EffectTiming } from '../../types';
import { STATS, activeUntil, bump, drain, grantStatusImmunity, hasBoost, hasDrop, live, modify, percent, read, restorePP, reverseDrops, status, transferBoosts, until, write, type ArenaContext } from './shared';

export function tianfengEntry(c: ArenaContext, countEntry = true): void {
  const count = countEntry ? bump(c, 'entry') : read(c, 'entry');
  const trigger = bump(c, 'entryTrigger');
  // Source rule: sixth activation clears earlier entry effects; seventh starts over.
  if (trigger === 6) {
    for (const name of ['cap', 'attack', 'critGuard', 'healCut', 'ppDrain', 'specialBoost']) write(c, name, 0);
    return;
  }
  const names = ['cap', 'attack', 'critGuard', 'healCut', 'ppDrain', 'specialBoost'];
  for (let i = 0; i < Math.min(6, count); i++) until(c, names[i], 2);
}

// arena_13 魂印已遷移為真 Kit（migratedArena13SoulKit.ts；DSH 20261017）——soul handler 整份移除。
// 技能表 TIANFENG_SKILLS 保留（三技仍為 wrapped route；下批遷移）。tianfengEntry/settleBloodRain
// 仍被三技 handler 引用——保留匯出。
export function handleTianfengSoulMark(_c: any, _event: any, _data?: any): void {}

// 命中後結算（引擎 BattleSkillAfterHitRegistry 合併 *_AFTER_HIT 導出）：
// 鋒毫浸血雨「下 1 回合攻擊命中時消耗自身目前體力½並造成等量百分比傷害」——結算點原掛魂印
// handler 的 AFTER_ATTACK_HIT（隨魂印遷 Kit 移除）；同批（規則3.4）併入技能表自身導出。
export const TIANFENG_AFTER_HIT: Record<string, (c: any, info?: any) => number> = {
  '鋒毫浸血雨': (c, info) => {
    if ((info?.hitIndex ?? 0) !== 0) return 0;
    return settleBloodRain(c);
  },
};

export const TIANFENG_SKILLS: Record<string, BattleSkillHandler> = {
  '鋒毫浸血雨': c => {
    // 原 write('bloodRainRound', round+1) 依賴魂印的 round 計數（隨魂印遷 Kit 移除）——
    // 改為武裝標記制：本次行動不觸發，下一次（不同行動）命中時觸發（規則3.4 同批修正）。
    write(c, 'bloodRainArmed', 1); write(c, 'bloodRainArmedAction', Number((c as any).moveIndex ?? 0) + 1000 * (read(c, 'round') || 0) + 1);
    until(c, 'attrNull', 2); until(c, 'pressure', 2);
    if (c.target.currentHp > 0) {
      modify(c, c.targetSide, -1);
      if (!hasDrop(c.target)) c.setOpponentState('cannotSwitchTurns', 2);
    }
  },
  // 艷羅劍典已遷移為真 Kit（migratedArena13SkillKits；DSH 20261017）。
  '法咒共鳴斬': c => { c.setPlayerState('ignoreDamageLimitThisAction', true); c.setPlayerState('ignoreAttackImmunityThisAction', true); },
  // 敕赦千銘已遷移為真 Kit（migratedArena13SkillKits；DSH 20261017）。
  // 萬蒼書帝錄已遷移為真 Kit（migratedArena13SkillKits；DSH 20261017）。

};

/** 鋒毫浸血雨：下 1 回合攻擊命中時（僅一次），消耗自身目前體力 1/2 並造成等量百分比傷害。 */
export function settleBloodRain(c: ArenaContext): number {
  const armed = read(c, 'bloodRainArmed');
  if (!armed) return 0;
  const nowToken = Number((c as any).moveIndex ?? 0) + 1000 * (read(c, 'round') || 0);
  // 同一（武裝時的）行動不觸發：armedAction 記錄的是「武裝行動+1」——本行動 token 等於其-1 時跳過。
  if (nowToken === read(c, 'bloodRainArmedAction') - 1) return 0;
  write(c, 'bloodRainArmed', 0);
  const cost = Math.floor(c.self.currentHp / 2);
  c.adjustHp(c.actor, -cost);
  return percent(c, cost, '鋒毫浸血雨');
}

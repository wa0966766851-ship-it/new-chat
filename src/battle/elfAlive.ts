import type { Elf } from '../types';
import { godDescentFloor, isAliveBySurvivalRule, releaseExpiredSurvivalRule } from './survivalRules';

/** 陣亡判定（考慮存活規則與免死回合）。引擎、規則、註冊表共用。 */
export const checkElfDead = (elf: Elf | undefined | null) => {
  if (!elf) return true;
  // 正死亡線不覆蓋既有負體力存活規則；到達正死亡線仍可觸發通用免死。
  if((elf.heldDeathFloorRatio||0)>0&&godDescentFloor(elf.survivalRule,elf.maxHp)>=0&&elf.currentHp<=elf.maxHp*elf.heldDeathFloorRatio!)return !(elf.deathImmunity&&elf.deathImmunity.deathImmuneTurns>0);
  // God descent: the floor is a DEATH line, not a clamp. Read the formula from the
  // rule (floorMult / minHp) instead of hardcoding a multiplier, so maxHp changes
  // and legacy saved rules both stay consistent. General death immunity still applies.
  const survivalRule = elf.survivalRule;
  if (survivalRule?.active && survivalRule.mode === 'god_descent' && elf.currentHp <= 0
      && elf.currentHp <= godDescentFloor(survivalRule, elf.maxHp)) {
    return !(elf.deathImmunity && elf.deathImmunity.deathImmuneTurns > 0);
  }
  // 0體力存活規則只在免死窗口內算數（窗口外視為一般精靈）。
  if (isAliveBySurvivalRule(elf.currentHp, releaseExpiredSurvivalRule(elf.survivalRule, elf.deathImmunity))) return false;
  if (elf.deathImmunity && elf.deathImmunity.deathImmuneTurns > 0) return false;
  return true;
};

/** 正死亡線（如星形鈴鐺草）判死且體力仍為正：死亡定案為 0 體力。
 *  否則換下場或道具用完時死亡線解除，精靈會帶著正體力「復活」，與各處 currentHp>0 判定不一致而卡在換人。 */
export const positiveDeathLineSettled = (elf: Elf | undefined | null) =>
  !!elf && (elf.heldDeathFloorRatio||0) > 0 && elf.currentHp > 0 && checkElfDead(elf);

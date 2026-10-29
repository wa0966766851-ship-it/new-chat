import type { BattleSkillHandler } from '../../types';
import type { SoulMarkHandler } from '../../battleEventRegistry';
import { WUWEI_SKILLS, WUWEI_SKILL_TRANSFORMS, handleWuweiSoulMark } from './wuweiRegistry';
import { TIANFENG_SKILLS, TIANFENG_AFTER_HIT, handleTianfengSoulMark } from './tianfengRegistry';
import { WUJI_SKILLS, handleWujiSoulMark } from './wujiRegistry';
import { MOIRAI_SKILLS, handleMoiraiSoulMark } from './moiraiRegistry';
import { DRAGON_HEALING_SKILLS, handleDragonHealingSoulMark } from './dragonHealingRegistry';

/** Separate, reviewable registration unit; the live registry never glob-imports this directory. */
export const STAGED_ARENA_SKILLS: Record<string, BattleSkillHandler> = {
  ...WUWEI_SKILLS, ...TIANFENG_SKILLS, ...WUJI_SKILLS, ...MOIRAI_SKILLS, ...DRAGON_HEALING_SKILLS,
};
export { TIANFENG_AFTER_HIT };
export const STAGED_ARENA_SOULS: Record<string, SoulMarkHandler> = {
  // 2026-10-30：龍錄天鋒（arena_13）魂印已遷真 Kit（migratedArena13SoulKit）；
  // 這裡保留 handler 供技能支援讀取端派發（規則3.4），與命運龍輪同模式。
  '龍錄天鋒': handleTianfengSoulMark,
  // 無為龍者魂印「無為之境」已遷真 Kit（migratedArena12SkillKits；DSH 20261018）——規則3.3 由魂印表移除。
  '無極聖武': handleWujiSoulMark,
  // 命運龍輪：魂印本文已遷 Kit（migratedMoiraiSoulKit）；此映射保留供技能支援讀取端派發（規則3.4）。
  '命運龍輪 莫伊萊': handleMoiraiSoulMark,
  '鎮世龍魂・龍之治癒': handleDragonHealingSoulMark,
};
export const STAGED_ARENA_SKILL_TRANSFORMS = { ...WUWEI_SKILL_TRANSFORMS };

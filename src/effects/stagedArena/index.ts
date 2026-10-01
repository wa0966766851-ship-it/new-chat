import type { BattleSkillHandler } from '../types';
import type { SoulMarkHandler } from '../battleEventRegistry';
import { WUWEI_SKILLS, WUWEI_SKILL_TRANSFORMS, handleWuweiSoulMark } from './wuweiRegistry';
import { TIANFENG_SKILLS, handleTianfengSoulMark } from './tianfengRegistry';
import { WUJI_SKILLS, handleWujiSoulMark } from './wujiRegistry';
import { MOIRAI_SKILLS, handleMoiraiSoulMark } from './moiraiRegistry';
import { DRAGON_HEALING_SKILLS, handleDragonHealingSoulMark } from './dragonHealingRegistry';

/** Separate, reviewable registration unit; the live registry never glob-imports this directory. */
export const STAGED_ARENA_SKILLS: Record<string, BattleSkillHandler> = {
  ...WUWEI_SKILLS, ...TIANFENG_SKILLS, ...WUJI_SKILLS, ...MOIRAI_SKILLS, ...DRAGON_HEALING_SKILLS,
};
export const STAGED_ARENA_SOULS: Record<string, SoulMarkHandler> = {
  '無為龍者': handleWuweiSoulMark,
  '龍錄天鋒': handleTianfengSoulMark,
  '無極聖武': handleWujiSoulMark,
  '命運龍輪 莫伊萊': handleMoiraiSoulMark,
  '鎮世龍魂・龍之治癒': handleDragonHealingSoulMark,
};
export const STAGED_ARENA_SKILL_TRANSFORMS = { ...WUWEI_SKILL_TRANSFORMS };

import { SKILL_STONE_ATTRIBUTES, SKILL_STONE_GRADES } from '../data/skillStones';
import { stoneAfterHit } from './skillStoneEffects';
import type { BattleSkillHandler, BattleSkillAfterHitHandler } from './types';

// 六個等級共用一份參數化 handler；SS 是本次使用型態，不是玩家可額外裝備的石頭。
const names = SKILL_STONE_ATTRIBUTES.flatMap(attr => Object.keys(SKILL_STONE_GRADES).map(g => `${attr}石之力-${g}`));
export const SKILL_STONE_SKILLS: Record<string, BattleSkillHandler> = Object.fromEntries(names.map(n => [n, () => {}]));
export const SKILL_STONE_AFTER_HIT: Record<string, BattleSkillAfterHitHandler> = Object.fromEntries(names.map(n => [n, ctx => stoneAfterHit(ctx)]));

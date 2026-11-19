import { holdsBossTrait } from '../data/bossTraits';

/**
 * 瞬殺（秒殺）免疫的唯一判定入口（2026-11-15）。
 * 結算（instantKill.ts 的 queue／settle）與 AI 評估都讀這裡；精靈、魂印不各自寫死免疫。
 * 目前來源：BOSS 特性「疾行」。
 */
export function instantKillImmune(target: { currentHp?: number; effects?: any[]; battleStatuses?: Record<string, number> } | null | undefined): boolean {
  return !!target && holdsBossTrait(target, 'rush');
}
/** 技能是否帶瞬殺（秒殺與瞬殺同義）。AI 用於避免對免疫目標選瞬殺技能。 */
export const mentionsInstantKill = (text?: string): boolean => /秒殺|瞬殺/.test(String(text || ''));

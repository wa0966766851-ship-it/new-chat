import { Elf } from '../types';

/**
 * 取得出戰隊伍 (排除額外精靈)
 * 目前架構中 team 即為出戰隊伍，未來若有額外精靈需在此排除
 */
export function getEligibleTeam(team: Elf[]): Elf[] {
  return team.filter(e => !(e as any).isExtra);
}

/**
 * 取得首位精靈 (跳過消逝)
 */
export function getFirstStarter(team: Elf[]): Elf | undefined {
  const eligible = team.filter(e => !e.isVanished && !(e as any).isExtra);
  return eligible[0];
}

/**
 * 取得第 n 位精靈 (跳過消逝，n 為 1-indexed)
 */
export function getNthElf(team: Elf[], n: number): Elf | undefined {
  const eligible = team.filter(e => !e.isVanished && !(e as any).isExtra);
  return eligible[n - 1];
}

/**
 * 取得鄰位精靈 (跳過消逝，動態重新編號後的相鄰者)
 */
export function getAdjacentElves(team: Elf[], targetElf: Elf): Elf[] {
  const eligible = team.filter(e => !e.isVanished && !(e as any).isExtra);
  const idx = eligible.findIndex(e => (e.battleId && e.battleId === targetElf.battleId) || e.id === targetElf.id || e.name === targetElf.name);
  if (idx === -1) return [];
  
  const result: Elf[] = [];
  if (idx > 0) result.push(eligible[idx - 1]);
  if (idx < eligible.length - 1) result.push(eligible[idx + 1]);
  return result;
}

/**
 * 取得隔位精靈 (跳過消逝，動態重新編號後的隔位者)
 */
export function getSeparatedElves(team: Elf[], targetElf: Elf): Elf[] {
  const eligible = team.filter(e => !e.isVanished && !(e as any).isExtra);
  const idx = eligible.findIndex(e => (e.battleId && e.battleId === targetElf.battleId) || e.id === targetElf.id || e.name === targetElf.name);
  if (idx === -1) return [];
  
  const result: Elf[] = [];
  if (idx > 1) result.push(eligible[idx - 2]);
  if (idx < eligible.length - 2) result.push(eligible[idx + 2]);
  return result;
}

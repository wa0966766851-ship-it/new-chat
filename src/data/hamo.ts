import type { Elf, Skill } from '../types';
import {HAMO_SOURCE_DATA} from './descriptionSources';

// 可編輯完整原文位於 hamoSource.json，沿既有描述封裝完整還原。
export const HAMO_SOURCE = HAMO_SOURCE_DATA.soul as string;
export const HAMO_SKILLS_DATA = HAMO_SOURCE_DATA.skills as Skill[];
export const HAMO_SEED: Omit<Elf, 'calculatedStats' | 'maxHp' | 'currentHp'> = {
  id: '5035', name: '御天龍神·哈莫', type: '龍', level: 100, seerId: 3809, path: 'imperial_dragon_hamo',
  baseStats: {hp:199, atk:171, spatk:60, def:122, spdef:122, speed:141},
  soulMark: {name:'鱗', description:HAMO_SOURCE, effectType:'none', effectValue:0},
  skills: HAMO_SKILLS_DATA, skillPool: HAMO_SKILLS_DATA.map(s => ({...s})),
};

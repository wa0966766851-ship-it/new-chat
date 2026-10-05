import type { Elf, Skill } from '../types';
import source from '../../docs/spirit-arena/heavyweights.json';

type Seed = Omit<Elf, 'calculatedStats' | 'currentHp' | 'maxHp'>;
const art: Record<number, number | undefined> = { 12: 4661, 13: 4903, 14: 4800, 15: 4275 };

/** Prepared roster. Intentionally not imported by defaultElves until all five registries are verified. */
export const STAGED_ARENA_ELVES: Seed[] = source.filter(e => e.sourceId !== 17).map(e => {
  const skills: Skill[] = e.skills.map((s, index) => ({
    name: s.name,
    // 屬性技能與既有精靈一致顯示「無屬性」圖示；攻擊技能保留技能本身屬性
    type: s.kind === '屬性' ? '無屬性' : s.type.join('.'),
    category: s.kind as Skill['category'],
    power: s.power,
    pp: s.pp,
    currentPp: s.pp,
    maxPp: s.pp,
    priority: s.priority,
    accuracy: s.accuracy,
    isSureHit: s.alwaysHit,
    isFifthSkill: index === 4,
    effectType: 'custom',
    effectDetail: `staged_arena_${e.sourceId}`,
    description: s.description,
  }));
  return {
    id: `arena_${e.sourceId}`,
    name: e.name,
    type: e.type.join('.'),
    level: 100,
    seerId: art[e.sourceId],
    baseStats: { hp: e.baseStats.hp, atk: e.baseStats.atk, spatk: e.baseStats.spa, def: e.baseStats.def, spdef: e.baseStats.spd, speed: e.baseStats.speed },
    soulMark: { name: e.trait, description: e.traitDetail.replaceAll('<br>', '\n'), effectType: 'custom', effectValue: 0, ...(e.sourceId === 12 ? { ignorePpLimit: true } : {}) },
    skills,
    skillPool: skills.map(s => ({ ...s })),
  };
});

import type { Elf, Skill } from '../types';
import { NEW_ELF_SOURCES as sourceEntries } from './descriptionSources';

/**
 * elf_source_files/elf_files 的新精靈資料入口。
 *
 * 這裡只做原文資料的結構化，不把尚未完成的效果硬翻成近似機制；
 * 能力缺口會由專屬 registry 逐條補上，未完成部分仍保留在 description。
 */
type SourceSkill = Partial<Skill> & { name: string; description: string };
type SourceEntry = { name: string; soulDescription: string; skills: SourceSkill[] };

const entries = sourceEntries as SourceEntry[];

function source(name: string): SourceEntry {
  const entry = entries.find(item => item.name === name);
  if (!entry) throw new Error(`missing new elf source: ${name}`);
  return entry;
}

function stripSoulHeading(description: string): string {
  return description.replace(/^##\s*◆\s*專屬特性\/魂印\s*/u, '').trim();
}

function skillsFor(entry: SourceEntry): Skill[] {
  return entry.skills.map(skill => ({
    name: skill.name,
    type: skill.type || '無屬性',
    category: skill.category || '屬性',
    power: Number(skill.power || 0),
    pp: Number(skill.pp || 0),
    currentPp: Number(skill.pp || 0),
    maxPp: Number(skill.maxPp || skill.pp || 0),
    accuracy: Number(skill.accuracy ?? 100),
    isSureHit: Boolean(skill.isSureHit),
    priority: Number(skill.priority || 0),
    isFifthSkill: Boolean(skill.isFifthSkill),
    effectType: skill.effectType || 'none',
    effectDetail: skill.effectDetail || '',
    description: skill.description,
  }));
}

function makeSeed(args: {
  id: string;
  name: string;
  type: string;
  seerId: number;
  height?: number;
  weight?: number;
  gender: string;
  baseStats: Elf['baseStats'];
  path: string;
  source: SourceEntry;
}): Omit<Elf, 'calculatedStats' | 'currentHp' | 'maxHp'> {
  const skills = skillsFor(args.source);
  return {
    id: args.id,
    name: args.name,
    type: args.type,
    seerId: args.seerId,
    level: 100,
    ...(args.height === undefined ? {} : { height: args.height }),
    ...(args.weight === undefined ? {} : { weight: args.weight }),
    gender: args.gender,
    path: args.path,
    baseStats: args.baseStats,
    description: `資料來源：elf_source_files/elf_files；${args.name} 的效果以原文為準。`,
    soulMark: {
      name: args.name === '星核寰宇·艾斯菲亞' ? '核' : args.name === '星軌重構·艾斯菲格' ? '格' : '邪',
      description: stripSoulHeading(args.source.soulDescription),
      effectType: 'none',
      effectValue: 0,
    },
    skills,
    skillPool: skills.map(skill => ({ ...skill })),
  };
}

const aesfiaSource = source('星核寰宇·艾斯菲亞');
const aesfigSource = source('星軌重構·艾斯菲格');
const mogosSource = source('邪靈主宰·摩哥斯');

export const ASTRAL_AESFIA_SEED = makeSeed({
  id: '5032',
  name: '星核寰宇·艾斯菲亞',
  type: '超能',
  seerId: 79,
  height: 183,
  weight: 37.5,
  gender: '雄性',
  baseStats: { hp: 176, atk: 70, def: 116, spatk: 137, spdef: 116, speed: 130 },
  path: 'astral_aesfia',
  source: aesfiaSource,
});

export const ASTRAL_AESFIG_SEED = makeSeed({
  id: '5033',
  name: '星軌重構·艾斯菲格',
  type: '超能',
  seerId: 418,
  height: 190,
  weight: 42,
  gender: '雄性',
  baseStats: { hp: 173, atk: 70, def: 114, spatk: 140, spdef: 114, speed: 134 },
  path: 'astral_aesfig',
  source: aesfigSource,
});

export const MOGOS_SEED = makeSeed({
  id: '5034',
  name: '邪靈主宰·摩哥斯',
  type: '邪靈',
  seerId: 3561,
  gender: '無性別',
  baseStats: { hp: 174, atk: 80, def: 120, spatk: 154, spdef: 120, speed: 142 },
  path: 'mogos_overlord',
  source: mogosSource,
});

export const NEW_ELF_SEEDS = [ASTRAL_AESFIA_SEED, ASTRAL_AESFIG_SEED, MOGOS_SEED] as const;


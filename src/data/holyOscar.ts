import type {Elf} from '../types';
import {HOLY_OSCAR_SOURCE} from './holyOscarSource';
import {HOLY_OSCAR_SKILLS} from './holyOscarSkills';
import {HOLY_OSCAR_SOUL_KIT} from './holyOscarSoulKit';
/** 聖靈奧斯卡（官方 3425 聖靈守護奧斯卡）；預設外觀＝皮膚 599 創界衣缽·奧斯卡（素材 1400599）。 */
export const HOLY_OSCAR_SEED={id:'5048',seerId:1400599,name:'聖靈奧斯卡',type:'聖靈',level:100,
 baseStats:{hp:182,atk:175,def:120,spatk:60,spdef:120,speed:158},
 skills:HOLY_OSCAR_SKILLS,skillPool:HOLY_OSCAR_SKILLS.map(s=>structuredClone(s)),
 soulMark:{name:'聖',description:HOLY_OSCAR_SOURCE.split('魂印:')[1].split('技能:')[0].trim(),effectMode:'kit',effectType:'none',effectValue:0,kit:HOLY_OSCAR_SOUL_KIT},
} as Omit<Elf,'calculatedStats'|'currentHp'|'maxHp'>;

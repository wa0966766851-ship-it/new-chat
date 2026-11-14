import type {Elf} from '../types';
import {TIANXIE_SOURCE} from './tianxieSource';
import {TIANXIE_READY_SKILLS} from './tianxieSkills';
import {TIANXIE_SOUL_KIT} from './tianxieSoulKit';
export const TIANXIE_SEED={id:'5047',seerId:2652,name:'難違天律.天邪龍王',type:'邪靈.龍',level:100,
 baseStats:{hp:199,atk:181,def:132,spatk:60,spdef:132,speed:146},
 skills:TIANXIE_READY_SKILLS,skillPool:TIANXIE_READY_SKILLS.map(s=>structuredClone(s)),
 soulMark:{name:'難',description:TIANXIE_SOURCE.split('魂印”難”:')[1].split('害怕:')[0].trim(),effectMode:'kit',effectType:'none',effectValue:0,kit:TIANXIE_SOUL_KIT},
} as Omit<Elf,'calculatedStats'|'currentHp'|'maxHp'>;
